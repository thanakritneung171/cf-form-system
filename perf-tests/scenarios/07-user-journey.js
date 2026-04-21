// 07-user-journey.js — Realistic User Journey Test
// จำลองพฤติกรรมผู้ใช้จริง ไม่ใช่แค่ยิง API ตรง ๆ
//
// Flow ต่อ 1 iteration:
//   1. GET /                        → เข้าหน้า index
//   2. think time (1–3 วิ)
//   3. สุ่ม form type
//   4. GET /form/{type}             → เปิดหน้าฟอร์ม
//      ↳ ถ้าติด Waiting Room       → poll /api/waiting-room/acquire จนได้ slot
//      ↳ timeout 60 วิ → skip iteration นี้
//   5. think time (2–7 วิ)          → จำลองกรอกข้อมูล
//   6. POST /submit/{type}          → ส่งฟอร์ม
//   7. think time (1–2 วิ)

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';
import { randomItem, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';
import { BASE_URL, commonHeaders } from '../config.js';
import { buildPayload } from '../helpers/mock-data.js';
import { FORM_TYPES } from '../helpers/form-types.js';
import { makeSummary } from '../helpers/summary.js';

// ── Custom metric: นับครั้งที่เจอ Waiting Room (แยกตาม formType) ───────────────
// ใช้ใน log สรุปว่า form ไหนถูก waiting room บ่อยแค่ไหน
const waitingRoomHits = new Counter('waiting_room_hits');

// ── Custom metric: submit ได้ HTML waiting room กลับมา (status 200 + HTML) ──────
// กรณีที่ตรวจสอบ waiting room ที่หน้า form แล้วแต่ยัง slip เข้า submit ไม่ได้
const submitWaitingRoomHits = new Counter('submit_waiting_room_hits');

// ── สร้าง threshold entry สำหรับทุก path ──────────────────────────────────────
// รวมหน้า waiting-room API ด้วย เพื่อให้ k6 track sub-metric
const _pageThresholds = {};
const _allPaths = [
  '/',
  ...FORM_TYPES.map((t) => `/form/${t}`),
  ...FORM_TYPES.map((t) => `/submit/${t}`),
  '/api/waiting-room/acquire',    // waiting room poll API
  '/api/waiting-room/position',   // ถ้ามีการ poll position
  '/busy',                        // หน้า high-traffic
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
  sleep(randomIntBetween(minSec * 10, maxSec * 10) / 10);
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

function isWaitingRoomPage(body) {
  if (!body) return false;
  // Custom worker WR: มีคำว่า 'waiting-room' (hyphen), 'ผู้เข้าใช้เต็ม', 'ระบบยุ่ง'
  // Cloudflare WR จริง: มี 'waitingrooms-text', 'Waiting Room powered by Cloudflare'
  // Fallback: body เป็น HTML (ไม่ใช่ JSON) → แสดงว่าไม่ได้รับ JSON response ที่คาดไว้
  return (
    body.includes('waiting-room') ||
    body.includes('waitingrooms-text') ||
    body.includes('Waiting Room powered by Cloudflare') ||
    body.includes('ผู้เข้าใช้เต็ม') ||
    body.includes('ระบบยุ่ง')
  );
}

/**
 * Poll waiting room acquire จนได้ slot หรือ timeout
 * tag `page` = '/api/waiting-room/acquire' → ปรากฏใน log สรุป
 */
function waitForSlot(formType, timeoutSec) {
  const pollInterval = 3;
  const maxAttempts  = Math.ceil(timeoutSec / pollInterval);

  for (let i = 0; i < maxAttempts; i++) {
    sleep(pollInterval);

    const res = http.get(
      `${BASE_URL}/api/waiting-room/acquire?formType=${encodeURIComponent(formType)}`,
      {
        headers: commonHeaders,
        // tag `page` ทำให้ปรากฏใน section "อื่น ๆ" ของ log
        tags: { page: '/api/waiting-room/acquire', page_type: 'waiting-room-api', form_type: formType },
      }
    );

    let data;
    try { data = JSON.parse(res.body); } catch { continue; }
    if (data.ok === true) return true;
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main VU function
// ─────────────────────────────────────────────────────────────────────────────
export default function () {
  // ── Step 1: หน้า index ──────────────────────────────────────────────────────
  const indexRes = getPage('/', 'index');
  check(indexRes, {
    'index: status 200':     (r) => r.status === 200,
    'index: has form links': (r) => r.body && r.body.includes('/form/'),
  });

  thinkTime(1, 3);

  // ── Step 2: สุ่ม form type ───────────────────────────────────────────────────
  const formType = randomItem(FORM_TYPES);

  // ── Step 3: เปิดหน้าฟอร์ม ───────────────────────────────────────────────────
  let formPageRes = getPage(`/form/${formType}`, 'form-page');

  // ── Step 3b: จัดการ Waiting Room ────────────────────────────────────────────
  if (isWaitingRoomPage(formPageRes.body)) {
    // นับว่าเจอ waiting room กี่ครั้ง (แยก tag ตาม formType เพื่อดูใน log)
    waitingRoomHits.add(1, { form_type: formType });

    console.log(`[VU ${__VU}][iter ${__ITER}] waiting room — formType: ${formType}, polling...`);

    const gotSlot = waitForSlot(formType, 60);

    if (!gotSlot) {
      console.warn(`[VU ${__VU}][iter ${__ITER}] waiting room timeout — skipping ${formType}`);
      return;
    }

    // ได้ slot → เปิดหน้าฟอร์มอีกครั้ง
    formPageRes = getPage(`/form/${formType}`, 'form-page');
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
    if (isHtml || isWaitingRoomPage(body)) {
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
