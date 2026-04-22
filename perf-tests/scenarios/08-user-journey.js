// 08-user-journey-one-shot.js
// One-shot CF Waiting Room Measurement
//
// Scenarios:
//   one_shot  — ยิง VU พร้อมกัน 1 ครั้ง (default)
//   contacts  — ramping-arrival-rate ค่อย ๆ เพิ่ม request rate
//
// วิธีรัน:
//   k6 run scenarios/08-user-journey.js                        ← one_shot (250 VU)
//   k6 run -e VUS=300 scenarios/08-user-journey.js             ← one_shot (300 VU)
//   k6 run -e SCENARIO=contacts scenarios/08-user-journey.js   ← contacts

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';
import { randomItem, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';
import { BASE_URL, commonHeaders } from '../config.js';
import { buildPayload } from '../helpers/mock-data.js';
import { FORM_TYPES } from '../helpers/form-types.js';
import { makeSummary } from '../helpers/summary.js';

// ═══════════════════════════════════════════════════════════════════════════
// Custom Metrics
// ═══════════════════════════════════════════════════════════════════════════

// เปิดหน้า form ได้ปกติ → submit สำเร็จ
const activeFirstHit = new Counter('active_first_hit');

// เจอ CF Waiting Room → จบทันที
const queueFirstHit = new Counter('queue_first_hit');

// เจอ "Waiting Room powered by Cloudflare" โดยเฉพาะ
const cfNativeWrHits = new Counter('cf_native_wr_hits');

// submit ได้ WR HTML กลับมาแทน JSON
const submitWrHits = new Counter('submit_waiting_room_hits');

// ═══════════════════════════════════════════════════════════════════════════
// Env vars
// ═══════════════════════════════════════════════════════════════════════════

const VUS      = parseInt(__ENV.VUS || '250', 10);
const SCENARIO = (__ENV.SCENARIO || 'one_shot').trim();

// ═══════════════════════════════════════════════════════════════════════════
// Options — เลือก scenario ด้วย -e SCENARIO=contacts
// ═══════════════════════════════════════════════════════════════════════════

const scenarioDefs = {
  one_shot: {
    one_shot: {
      executor: 'per-vu-iterations',
      vus: VUS,
      iterations: 1,
      maxDuration: '1m',
    },
  },
  contacts: {
    contacts: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 200,
      stages: [
        { target: 50, duration: '30s' },
      ],
    },
  },
};

if (!scenarioDefs[SCENARIO]) {
  throw new Error(`Unknown SCENARIO "${SCENARIO}". Available: ${Object.keys(scenarioDefs).join(', ')}`);
}

export const options = {
  scenarios: scenarioDefs[SCENARIO],
  thresholds: {
    'active_first_hit':         [],
    'queue_first_hit':          [],
    'cf_native_wr_hits':        [],
    'submit_waiting_room_hits': [],
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

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

/**
 * ตรวจว่า response เป็นหน้า CF Waiting Room หรือไม่
 * - status 202 = CF WR (บาง config ส่ง 202 Accepted แทน 200)
 * - body มี "Waiting Room powered by Cloudflare"
 */
function isWaitingRoomResponse(res) {
  if (res.status === 202) return true;
  if (!res.body) return false;
  return res.body.includes('Waiting Room powered by Cloudflare');
}

// ═══════════════════════════════════════════════════════════════════════════
// Main VU — แต่ละ VU รัน 1 ครั้ง
// ═══════════════════════════════════════════════════════════════════════════

export default function () {
  const formType = randomItem(FORM_TYPES);

  // ── GET /form/{type} — จุดวัดผล ────────────────────────────────────────
  const res = getPage(`/form/${formType}`, 'form-page', formType);

  if (isWaitingRoomResponse(res)) {
    // ★ QUEUE — เจอ CF Waiting Room (status 202 หรือ body มี WR text) → นับ → จบทันที
    queueFirstHit.add(1, { form_type: formType });
    cfNativeWrHits.add(1, { form_type: formType });
    console.log(`[VU ${__VU}] FIRST HIT → QUEUE status=${res.status} (${formType})`);
    return;
  }

  // ★ ACTIVE — เปิดได้ปกติ
  activeFirstHit.add(1, { form_type: formType });
  console.log(`[VU ${__VU}] FIRST HIT → ACTIVE (${formType})`);

  check(res, {
    'form-page: status 200':        (r) => r.status === 200,
    'form-page: has submit button': (r) => r.body && r.body.includes('submit'),
  });

  // ── Submit ────────────────────────────────────────────────────────────
  sleep(randomIntBetween(10, 20) / 10); // think 1–2 วิ

  const payload   = buildPayload(formType, __VU, __ITER);
  const submitRes = postSubmit(formType, payload);

  const submitted = check(submitRes, {
    'submit: status 200': (r) => r.status === 200,
    'submit: ok true':    (r) => {
      try { return JSON.parse(r.body).ok === true; } catch { return false; }
    },
  });

  if (!submitted) {
    const body = submitRes.body || '';
    if (body.trimStart().startsWith('<') || isWaitingRoomResponse(submitRes)) {
      submitWrHits.add(1, { form_type: formType });
      console.warn(`[VU ${__VU}] submit got WR page (${formType})`);
    } else {
      console.warn(`[VU ${__VU}] submit failed status=${submitRes.status} (${formType})`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════════════════

export function handleSummary(data) {
  return makeSummary(data, 'one-shot-wr');
}
