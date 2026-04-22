// 08-user-journey-one-shot.js
// One-shot Waiting Room Test — ยิง 250 VU พร้อมกัน วัด Active vs Queued
//
// WR_MODE=single (default) — GET /form/{type} แค่ 1 req ต่อ VU → 250 VU = 250 requests
//                            เร็วที่สุด เห็น active/queued ratio ชัดเจน
// WR_MODE=count            — GET / + GET /form → 2 req แต่ละ VU
//                            เจอ WR → นับ → จบ ไม่รอ
// WR_MODE=wait             — GET / + GET /form + retry + POST /submit → full flow
//                            เจอ WR → รอจนผ่าน → submit ต่อ
//
// วิธีรัน:
//   k6 run scenarios/08-user-journey.js                          ← single (1 req/VU)
//   k6 run -e WR_MODE=count scenarios/08-user-journey.js
//   k6 run -e WR_MODE=wait -e WR_TIMEOUT=180 scenarios/08-user-journey.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';
import { randomItem, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';
import { BASE_URL, commonHeaders } from '../config.js';
import { buildPayload } from '../helpers/mock-data.js';
import { FORM_TYPES } from '../helpers/form-types.js';
import { makeSummary } from '../helpers/summary.js';

// ── Custom Metrics ───────────────────────────────────────────────────────────
const activeFirstHit  = new Counter('active_first_hit');        // เปิดหน้าได้ปกติ
const queueFirstHit   = new Counter('queue_first_hit');         // ติด WR
const cfNativeWrHits  = new Counter('cf_native_wr_hits');       // CF native WR โดยเฉพาะ
const waitingRoomHits = new Counter('waiting_room_hits');       // WR รวม
const submitWrHits    = new Counter('submit_waiting_room_hits');

// ── Env vars ─────────────────────────────────────────────────────────────────
// WR_MODE:
//   "single" (default) — 1 VU = 1 GET /form/{type} = 1 request → ตัวเลขตรงที่สุด
//   "count"            — GET / + GET /form (2 req) เจอ WR → จบ
//   "wait"             — full flow พร้อม retry + submit
const WR_MODE        = __ENV.WR_MODE    || 'single';
const WR_TIMEOUT_SEC = parseInt(__ENV.WR_TIMEOUT || '120', 10);
const WR_RETRY_SEC   = parseInt(__ENV.WR_RETRY   || '10',  10);

// ── Options ──────────────────────────────────────────────────────────────────
export const options = {
  scenarios: {
    one_shot_250: {
      executor: 'per-vu-iterations',
      vus: 200,
      iterations: 1,
      maxDuration: WR_MODE === 'wait' ? '5m' : '1m',
    },
  },
  thresholds: {
    'active_first_hit':         [],
    'queue_first_hit':          [],
    'cf_native_wr_hits':        [],
    'waiting_room_hits':        [],
    'submit_waiting_room_hits': [],
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function thinkTime(minSec, maxSec) {
  sleep(randomIntBetween(minSec * 10, maxSec * 10) / 10);
}

function getPage(path, pageType, formType) {
  return http.get(`${BASE_URL}${path}`, {
    headers: { ...commonHeaders, 'Accept': 'text/html' },
    tags: { page: path, page_type: pageType, ...(formType ? { form_type: formType } : {}) },
  });
}

function postSubmit(formType, payload) {
  return http.post(`${BASE_URL}/submit/${formType}`, payload, {
    headers: commonHeaders,
    tags: { page: `/submit/${formType}`, page_type: 'submit', form_type: formType },
    timeout: '30s',
  });
}

function isCfNativeWrPage(body) {
  if (!body) return false;
  return (
    body.includes('Waiting Room powered by Cloudflare') ||
    body.includes('waitingrooms-text')
  );
}

function isWaitingRoomPage(body) {
  if (!body) return false;
  return (
    isCfNativeWrPage(body)        ||
    body.includes('waiting-room') ||
    body.includes('ผู้เข้าใช้เต็ม') ||
    body.includes('ระบบยุ่ง')
  );
}

function recordWrHit(formType, body) {
  waitingRoomHits.add(1, { form_type: formType });
  queueFirstHit.add(1, { form_type: formType });
  if (isCfNativeWrPage(body)) {
    cfNativeWrHits.add(1, { form_type: formType });
    console.log(`[VU ${__VU}] QUEUE [CF NATIVE WR] (${formType}) mode=${WR_MODE}`);
  } else {
    console.log(`[VU ${__VU}] QUEUE [WR] (${formType}) mode=${WR_MODE}`);
  }
}

function waitForPage(path, pageType, formType) {
  const maxAttempts = Math.ceil(WR_TIMEOUT_SEC / WR_RETRY_SEC);
  for (let i = 0; i < maxAttempts; i++) {
    sleep(WR_RETRY_SEC);
    const res = getPage(path, pageType, formType);
    if (!isWaitingRoomPage(res.body)) return res;
  }
  return null;
}

// ── Main VU ──────────────────────────────────────────────────────────────────
export default function () {
  const formType = randomItem(FORM_TYPES);

  // ════════════════════════════════════════════════════════════
  // single mode — 1 VU = 1 GET = 1 request → ตัวเลขตรงที่สุด
  // 250 VU → 250 requests → active_first_hit + queue_first_hit = 250
  // ════════════════════════════════════════════════════════════
  if (WR_MODE === 'single') {
    const res = getPage(`/form/${formType}`, 'form-page', formType);

    check(res, { 'form-page: status 200': (r) => r.status === 200 });

    if (isWaitingRoomPage(res.body)) {
      recordWrHit(formType, res.body);
    } else {
      activeFirstHit.add(1, { form_type: formType });
      console.log(`[VU ${__VU}] ACTIVE (${formType})`);
    }
    return; // จบแค่นี้ — 1 req ต่อ VU
  }

  // ════════════════════════════════════════════════════════════
  // count / wait mode — GET / + GET /form (+ submit ถ้า wait)
  // ════════════════════════════════════════════════════════════

  // Step 1: index
  const indexRes = getPage('/', 'index', undefined);
  check(indexRes, {
    'index: status 200':     (r) => r.status === 200,
    'index: has form links': (r) => r.body && r.body.includes('/form/'),
  });

  if (isWaitingRoomPage(indexRes.body)) {
    recordWrHit('index', indexRes.body);
    if (WR_MODE === 'count') return;
    const passed = waitForPage('/', 'index', undefined);
    if (!passed) { console.warn(`[VU ${__VU}] WR timeout on index`); return; }
  }

  thinkTime(1, 2);

  // Step 2: form page
  const formPageRes = getPage(`/form/${formType}`, 'form-page', formType);

  if (isWaitingRoomPage(formPageRes.body)) {
    recordWrHit(formType, formPageRes.body);
    if (WR_MODE === 'count') return;

    const startWait = Date.now();
    const passed = waitForPage(`/form/${formType}`, 'form-page', formType);
    if (!passed) { console.warn(`[VU ${__VU}] WR timeout (${formType})`); return; }
    console.log(`[VU ${__VU}] PASSED WR after ${Math.round((Date.now() - startWait) / 1000)}s`);
  } else {
    activeFirstHit.add(1, { form_type: formType });
    console.log(`[VU ${__VU}] ACTIVE (${formType}) mode=${WR_MODE}`);
  }

  // Step 3: submit (wait mode เท่านั้น)
  if (WR_MODE !== 'wait') return;

  const hasFile = ['job-application', 'complaint', 'warranty-claim', 'partnership', 'incident-report']
    .includes(formType);
  thinkTime(hasFile ? 3 : 2, hasFile ? 7 : 5);

  const submitRes = postSubmit(formType, buildPayload(formType, __VU, __ITER));

  const submitted = check(submitRes, {
    'submit: status 200':        (r) => r.status === 200,
    'submit: ok true':           (r) => { try { return JSON.parse(r.body).ok === true; } catch { return false; } },
    'submit: has submission_id': (r) => { try { const b = JSON.parse(r.body); return typeof b.submission_id === 'string' && b.submission_id.length > 0; } catch { return false; } },
  });

  if (!submitted) {
    const body = submitRes.body || '';
    if (body.trimStart().startsWith('<') || isWaitingRoomPage(body)) {
      submitWrHits.add(1, { form_type: formType });
      console.warn(`[VU ${__VU}] submit blocked by WR (${formType})`);
    } else {
      console.warn(`[VU ${__VU}] submit failed status=${submitRes.status} (${formType})`);
    }
  }

  thinkTime(1, 2);
}

// ── Summary log ───────────────────────────────────────────────────────────────
export function handleSummary(data) {
  return makeSummary(data, `one-shot-wr-${WR_MODE}`);
}
