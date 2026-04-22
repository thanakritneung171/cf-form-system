// 07-user-journey.js — Realistic User Journey Test
// จำลองพฤติกรรมผู้ใช้จริง ไม่ใช่แค่ยิง API ตรง ๆ
//
// Flow ต่อ 1 iteration:
//   1. jitter sleep (0–30 วิ สุ่ม) → กระจาย VU ไม่ให้ชนพร้อมกัน
//   2. GET /                        → เข้าหน้า index
//      ↳ ถ้าติด CF Waiting Room    → retry จนผ่าน (timeout: WR_TIMEOUT_SEC)
//   3. think time (1–3 วิ)
//   4. สุ่ม form type
//   5. GET /form/{type}             → เปิดหน้าฟอร์ม
//      ↳ ถ้าติด CF Waiting Room    → retry GET /form/{type} จนผ่าน (ไม่ poll API เก่า)
//      ↳ timeout: WR_TIMEOUT_SEC → skip iteration นี้
//   6. think time (2–7 วิ)          → จำลองกรอกข้อมูล
//   7. POST /submit/{type}          → ส่งฟอร์ม
//   8. think time (1–2 วิ)
//
// NOTE: DO Waiting Room (/api/waiting-room/acquire) ถูกถอดออกแล้ว
//       ใช้ CF Waiting Room แทน — retry หน้าตรงๆ จนผ่านแทนการ poll API

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';
import { randomItem, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';
import { BASE_URL, commonHeaders } from '../config.js';
import { buildPayload } from '../helpers/mock-data.js';
import { FORM_TYPES } from '../helpers/form-types.js';
import { makeSummary } from '../helpers/summary.js';

// ── Custom metric: นับครั้งที่เจอ Waiting Room ทั้งหมด (แยกตาม formType) ────────
const waitingRoomHits = new Counter('waiting_room_hits');

// ── Custom metric: นับครั้งที่เจอ "Waiting Room powered by Cloudflare" โดยตรง ──
// แยกออกมาจาก waitingRoomHits เพื่อรู้ว่า CF native WR activate กี่ครั้ง
const cfNativeWrHits = new Counter('cf_native_wr_hits');

// ── Custom metric: submit ได้ HTML waiting room กลับมา (status 200 + HTML) ──────
const submitWaitingRoomHits = new Counter('submit_waiting_room_hits');

// ── Waiting Room timeout (วินาที) — ปรับตาม scenario ──────────────────────────
// shared_250: VU เยอะ → ต้องรอนาน | ramp: VU น้อย → รอสั้นกว่า
const WR_TIMEOUT_SEC = parseInt(__ENV.WR_TIMEOUT  || '300', 10); // default 5 นาที
const WR_RETRY_SEC   = parseInt(__ENV.WR_RETRY    || '15',  10); // retry ทุก 15 วิ
const JITTER_SEC     = parseInt(__ENV.JITTER       || '30',  10); // jitter สูงสุด 30 วิ
// wr_flood: THINK_SCALE=0 → skip think time ทั้งหมด เพื่อยิงแน่น
const THINK_SCALE    = parseFloat(__ENV.THINK_SCALE || '1.0');    // 0.0 = ไม่มี think time

// ── สร้าง threshold entry สำหรับทุก path ──────────────────────────────────────
const _pageThresholds = {};
const _allPaths = [
  '/',
  ...FORM_TYPES.map((t) => `/form/${t}`),
  ...FORM_TYPES.map((t) => `/submit/${t}`),
];
for (const p of _allPaths) {
  _pageThresholds[`http_reqs{page:${p}}`]         = [];
  _pageThresholds[`http_req_duration{page:${p}}`] = [];
  _pageThresholds[`http_req_failed{page:${p}}`]   = [];
}

// ── threshold สำหรับ waiting_room_hits (custom counter แยก form type) ─────────
_pageThresholds['waiting_room_hits'] = [];
for (const t of FORM_TYPES) {
  _pageThresholds[`waiting_room_hits{form_type:${t}}`] = [];
}

// ── threshold สำหรับ cf_native_wr_hits (CF "Waiting Room powered by Cloudflare") ─
_pageThresholds['cf_native_wr_hits'] = [];
for (const t of [...FORM_TYPES, 'index']) {
  _pageThresholds[`cf_native_wr_hits{form_type:${t}}`] = [];
}

// ── threshold สำหรับ submit_waiting_room_hits ──────────────────────────────────
_pageThresholds['submit_waiting_room_hits'] = [];
for (const t of FORM_TYPES) {
  _pageThresholds[`submit_waiting_room_hits{form_type:${t}}`] = [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Scenarios
// เลือก scenario ผ่าน env var: -e SCENARIO=ramp | conn_200 | all
// default = ramp (ถ้าไม่ระบุ)
// ─────────────────────────────────────────────────────────────────────────────
const _scenarios = {
  // ── Ramp profile (default) — ค่อยๆ ขึ้น → hold → peak → ลด ──────────────
  ramp: {
    executor: 'ramping-vus',
    stages: [
      { duration: '1m', target: 5  },
      { duration: '3m', target: 20 },
      { duration: '5m', target: 20 },
      { duration: '2m', target: 50 },
      { duration: '3m', target: 50 },
      { duration: '1m', target: 0  },
    ],
    gracefulRampDown: '30s',
  },

  // ── conn_200 — 200 VU คงที่ 2 นาที ────────────────────────────────────────
  conn_200: {
    executor: 'constant-vus',
    options: {
      browser: {
        type: 'chromium',
      },
    },
    vus: 200,
    duration: '2m',
    gracefulStop: '5m',
  },
  shared_200: {
    executor: 'shared-iterations',
    options: {
      browser: {
        type: 'chromium'
      }
    },
    vus: 200,
    iterations: 200,
    maxDuration: '10m',
    gracefulStop: '2m'
  },
  shared_250: {
    executor: 'shared-iterations',
    options: {
      browser: {
        type: 'chromium'
      }
    },
    vus: 250,
    iterations: 250,
    maxDuration: '10m',
    gracefulStop: '2m'
  },

  // ── wr_flood — ยิงพร้อมกัน 300 VU ไม่มี jitter ไม่มี think time ──────────
  // วัตถุประสงค์: บังคับให้ CF Waiting Room activate
  //   • JITTER=0     → VU ทั้งหมด start พร้อมกันทันที → new_users_per_minute พุ่งสูง
  //   • THINK_SCALE=0 → ไม่ sleep → request ต่อเนื่อง → active session สะสม > 200
  //   • 300 VU × 5 นาที → CF เห็น ~300 active sessions พร้อมกัน
  wr_flood: {
    executor: 'constant-vus',
    vus: 300,
    duration: '5m',
    gracefulStop: '30s',
  },
};

const _selectedScenario = __ENV.SCENARIO || 'ramp';
const _activeScenarios  = _selectedScenario === 'all'
  ? _scenarios
  : { [_selectedScenario]: _scenarios[_selectedScenario] };

export const options = {
  scenarios: _activeScenarios,
  thresholds: {
    'http_req_duration{page_type:index}':     ['p(95)<800'],
    'http_req_duration{page_type:form-page}': ['p(95)<1500'],
    'http_req_duration{page_type:submit}':    ['p(95)<5000'],
    http_req_failed:                           ['rate<0.10'],
    ..._pageThresholds,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function thinkTime(minSec, maxSec) {
  if (THINK_SCALE <= 0) return; // wr_flood: ข้าม think time ทั้งหมด
  sleep(randomIntBetween(minSec * 10, maxSec * 10) / 10 * THINK_SCALE);
}

function getPage(path, pageType) {
  return http.get(`${BASE_URL}${path}`, {
    headers: { ...commonHeaders, 'Accept': 'text/html' },
    tags: { page: path, page_type: pageType },
  });
}

function postSubmit(formType, payload) {
  return http.post(`${BASE_URL}/submit/${formType}`, payload, {
    headers: commonHeaders,
    tags: { page: `/submit/${formType}`, page_type: 'submit' },
    timeout: '30s',
  });
}

/**
 * ตรวจว่าเป็นหน้า CF native Waiting Room
 * - status 202 = CF WR (บาง config ส่ง 202 Accepted)
 * - body มี "Waiting Room powered by Cloudflare" หรือ "waitingrooms-text"
 * รับได้ทั้ง response object หรือ body string
 */
function isCfNativeWrPage(resOrBody) {
  if (!resOrBody) return false;
  // ถ้าเป็น response object
  if (typeof resOrBody === 'object' && resOrBody.status !== undefined) {
    if (resOrBody.status === 202) return true;
    const body = resOrBody.body || '';
    return body.includes('Waiting Room powered by Cloudflare') || body.includes('waitingrooms-text');
  }
  // ถ้าเป็น body string (backward compat)
  return (
    resOrBody.includes('Waiting Room powered by Cloudflare') ||
    resOrBody.includes('waitingrooms-text')
  );
}

/**
 * ตรวจว่าเป็นหน้า Waiting Room (ทั้ง CF native และ custom)
 * รับได้ทั้ง response object หรือ body string
 */
function isWaitingRoomPage(resOrBody) {
  if (!resOrBody) return false;
  if (isCfNativeWrPage(resOrBody)) return true;
  const body = (typeof resOrBody === 'object' && resOrBody.body !== undefined) ? resOrBody.body : resOrBody;
  if (!body) return false;
  return (
    body.includes('waiting-room') ||
    body.includes('ผู้เข้าใช้เต็ม') ||
    body.includes('ระบบยุ่ง')
  );
}

/**
 * Retry GET path จนได้หน้าจริง (ไม่ใช่ CF Waiting Room) หรือ timeout
 * ใช้แทน poll /api/waiting-room/acquire ที่ถูกถอดออกแล้ว
 * @returns response สุดท้ายที่ผ่าน WR หรือ null ถ้า timeout
 */
function waitForPage(path, pageType, timeoutSec, retryIntervalSec) {
  const maxAttempts = Math.ceil(timeoutSec / retryIntervalSec);

  for (let i = 0; i < maxAttempts; i++) {
    sleep(retryIntervalSec);
    const res = getPage(path, pageType);
    if (!isWaitingRoomPage(res)) return res;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main VU function
// ─────────────────────────────────────────────────────────────────────────────
export default function () {
  // ── Jitter: กระจาย VU ไม่ให้ชนพร้อมกันตอนเริ่ม ────────────────────────────
  // สำคัญมากสำหรับ shared_200/shared_250 ที่ VU ทั้งหมด start พร้อมกัน
  if (JITTER_SEC > 0) {
    sleep(randomIntBetween(0, JITTER_SEC * 10) / 10);
  }

  // ── Step 1: หน้า index ──────────────────────────────────────────────────────
  let indexRes = getPage('/', 'index');

  // ถ้า index ติด CF Waiting Room ให้ retry จนผ่าน
  if (isWaitingRoomPage(indexRes)) {
    waitingRoomHits.add(1, { form_type: 'index' });
    if (isCfNativeWrPage(indexRes)) {
      cfNativeWrHits.add(1, { form_type: 'index' });
      console.log(`[VU ${__VU}][iter ${__ITER}] CF NATIVE WR on index — "Waiting Room powered by Cloudflare" detected`);
    } else {
      console.log(`[VU ${__VU}][iter ${__ITER}] CF WR on index — retrying...`);
    }
    const passed = waitForPage('/', 'index', WR_TIMEOUT_SEC, WR_RETRY_SEC);
    if (!passed) {
      console.warn(`[VU ${__VU}][iter ${__ITER}] WR timeout on index — skipping`);
      return;
    }
    indexRes = passed;
  }

  check(indexRes, {
    'index: status 200':     (r) => r.status === 200,
    'index: has form links': (r) => r.body && r.body.includes('/form/'),
  });

  thinkTime(1, 3);

  // ── Step 2: สุ่ม form type ───────────────────────────────────────────────────
  const formType = randomItem(FORM_TYPES);

  // ── Step 3: เปิดหน้าฟอร์ม ───────────────────────────────────────────────────
  let formPageRes = getPage(`/form/${formType}`, 'form-page');

  // ── Step 3b: จัดการ CF Waiting Room ─────────────────────────────────────────
  // retry GET /form/{type} ตรงๆ จนผ่าน (ไม่ poll /api/waiting-room/acquire อีกต่อไป)
  if (isWaitingRoomPage(formPageRes)) {
    waitingRoomHits.add(1, { form_type: formType });
    if (isCfNativeWrPage(formPageRes)) {
      cfNativeWrHits.add(1, { form_type: formType });
      console.log(`[VU ${__VU}][iter ${__ITER}] CF NATIVE WR — "Waiting Room powered by Cloudflare" — formType: ${formType}, retrying every ${WR_RETRY_SEC}s...`);
    } else {
      console.log(`[VU ${__VU}][iter ${__ITER}] CF WR — formType: ${formType}, retrying every ${WR_RETRY_SEC}s (timeout: ${WR_TIMEOUT_SEC}s)...`);
    }

    const passed = waitForPage(`/form/${formType}`, 'form-page', WR_TIMEOUT_SEC, WR_RETRY_SEC);

    if (!passed) {
      console.warn(`[VU ${__VU}][iter ${__ITER}] WR timeout — skipping ${formType}`);
      return;
    }

    formPageRes = passed;
  }

  check(formPageRes, {
    'form-page: status 200':        (r) => r.status === 200,
    'form-page: has submit button': (r) => r.body && r.body.includes('submit'),
  });

  const hasFile = ['job-application', 'complaint', 'warranty-claim', 'partnership', 'incident-report']
    .includes(formType);
  thinkTime(hasFile ? 3 : 2, hasFile ? 7 : 5);

  // ── Step 4: ส่งฟอร์ม ────────────────────────────────────────────────────────
  const payload   = buildPayload(formType, __VU, __ITER);
  const submitRes = postSubmit(formType, payload);

  const submitted = check(submitRes, {
    'submit: status 200':        (r) => r.status === 200,
    'submit: ok true':           (r) => {
      try { return JSON.parse(r.body).ok === true; } catch { return false; }
    },
    'submit: has submission_id': (r) => {
      try {
        const b = JSON.parse(r.body);
        return typeof b.submission_id === 'string' && b.submission_id.length > 0;
      } catch { return false; }
    },
  });

  if (!submitted) {
    const body = submitRes.body || '';
    // ตรวจว่า response เป็น HTML (submit endpoint คาดหวัง JSON เสมอ)
    // ถ้าได้ HTML กลับมา = ถูก Waiting Room (custom หรือ CF) intercept
    const isHtml = body.trimStart().startsWith('<');
    if (isHtml || isWaitingRoomPage(submitRes)) {
      submitWaitingRoomHits.add(1, { form_type: formType });
      console.warn(`[VU ${__VU}][iter ${__ITER}] submit got waiting-room HTML — formType: ${formType}, status: ${submitRes.status}`);
    } else {
      console.warn(`[VU ${__VU}][iter ${__ITER}] submit failed — formType: ${formType}, status: ${submitRes.status}, body: ${body.slice(0, 120)}`);
    }
  }

  thinkTime(1, 2);
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary + Log
// ─────────────────────────────────────────────────────────────────────────────
export function handleSummary(data) {
  return makeSummary(data, 'user-journey');
}
