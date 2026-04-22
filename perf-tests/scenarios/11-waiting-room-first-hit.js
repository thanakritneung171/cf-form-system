// 11-waiting-room-first-hit.js
// One-shot Waiting Room Wave — 250 VU ยิงพร้อมกัน วัด Active vs Queued
// โดยใช้หลัก "FIRST HIT only"
//
// กติกาการนับ (สำคัญ):
//   FIRST HIT ของแต่ละ VU = GET /form/{type} ครั้งแรกเท่านั้น
//     → response เป็นหน้า form ปกติ        → active_first_hit +1
//     → response เป็นหน้า waiting room     → queue_first_hit  +1
//   หลังจากนั้น ไม่ว่า VU จะผ่านคิวเข้ามาได้หรือไม่ จะ *ไม่* นับใน active_first_hit
//   อีก — ป้องกัน queue → active ถูกนับซ้ำเป็น active
//
//   queue → active ที่ได้ slot จริงจะถูกนับแยกใน queue_to_active
//
// Flow ต่อ 1 VU (รันครั้งเดียว):
//   1. GET /
//   2. thinkTime
//   3. GET /form/{type}                    ← FIRST HIT (ตัดสิน active/queue)
//   4. active → thinkTime → POST /submit/{type} → จบ
//      queue  → loop GET /form/{type} ทุก 3-5s จนหน้าไม่ใช่ WR
//               (ให้ Cloudflare Waiting Room เป็นคนตัดสินใจเอง เหมือน browser)
//               → thinkTime → POST /submit/{type} → จบ
//
// รัน:
//   k6 run perf-tests/scenarios/11-waiting-room-first-hit.js
//   k6 run -e VUS=250 -e POLL_TIMEOUT=180 perf-tests/scenarios/11-waiting-room-first-hit.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';
import { randomItem, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';
import { BASE_URL, commonHeaders } from '../config.js';
import { buildPayload } from '../helpers/mock-data.js';
import { FORM_TYPES } from '../helpers/form-types.js';
import { makeSummary } from '../helpers/summary.js';

// ── Custom Metrics ───────────────────────────────────────────────────────────
const activeFirstHit  = new Counter('active_first_hit');    // first hit → หน้า form ปกติ
const queueFirstHit   = new Counter('queue_first_hit');     // first hit → waiting room
const queueToActive   = new Counter('queue_to_active');     // queued แล้วได้ slot ภายหลัง
const cfNativeWrHits  = new Counter('cf_native_wr_hits');   // first hit ที่เป็น CF native WR
const waitingRoomHits = new Counter('waiting_room_hits');   // alias ของ queue_first_hit (สำหรับ summary helper เดิม)
const submitWrHits    = new Counter('submit_waiting_room_hits');

// ── Env vars ─────────────────────────────────────────────────────────────────
const VUS              = parseInt(__ENV.VUS              || '250', 10);
const POLL_TIMEOUT_SEC = parseInt(__ENV.POLL_TIMEOUT     || '180', 10);
const POLL_MIN_SEC     = parseInt(__ENV.POLL_MIN_SEC     || '3',   10);
const POLL_MAX_SEC     = parseInt(__ENV.POLL_MAX_SEC     || '5',   10);

// ── Options ──────────────────────────────────────────────────────────────────
// per-vu-iterations + iterations:1 → ทุก VU ยิงพร้อมกันที่ t=0 และยิงครั้งเดียว
export const options = {
  scenarios: {
    one_shot_wave: {
      executor:    'per-vu-iterations',
      vus:         VUS,
      iterations:  1,
      maxDuration: `${POLL_TIMEOUT_SEC + 120}s`,
    },
  },
  thresholds: {
    'active_first_hit':         [],
    'queue_first_hit':          [],
    'queue_to_active':          [],
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

// ใช้เฉพาะ signal เฉพาะของ CF WR holding page เท่านั้น
// หลีกเลี่ยง substring กว้างๆ เช่น 'waiting-room' หรือ 'cf-waiting-room'
// เพราะหน้าปกติมี link/class ที่มีคำนี้ (เช่น nav link /admin/waiting-room)
// ทำให้ false-positive → active โดนนับเป็น queue
function isWaitingRoomPage(body) {
  if (!body) return false;
  return (
    isCfNativeWrPage(body)            ||
    body.includes('คุณอยู่ในคิว')        ||
    body.includes('ผู้เข้าใช้เต็ม')
  );
}

function randomPollDelay() {
  return randomIntBetween(POLL_MIN_SEC * 10, POLL_MAX_SEC * 10) / 10;
}

// Poll GET /form/{type} จนกว่า CF WR จะปล่อยเข้า (response ไม่ใช่ WR page)
// คืน response ที่ผ่านแล้ว หรือ null ถ้า timeout
//
// หมายเหตุ: k6 มี per-VU cookie jar อัตโนมัติ → cookie __cfwaitingroom
// จะถูกเก็บและส่งซ้ำทุก poll ทำให้ CF track queue position ได้จริง
function pollUntilAdmitted(formType) {
  const start = Date.now();
  const deadline = start + POLL_TIMEOUT_SEC * 1000;
  let attempt = 0;

  while (Date.now() < deadline) {
    attempt++;
    sleep(randomPollDelay());

    const res = getPage(`/form/${formType}`, 'form-page-poll', formType);
    if (!isWaitingRoomPage(res.body)) {
      const elapsed = Math.round((Date.now() - start) / 1000);
      console.log(`[VU ${__VU}] ACQUIRED SLOT AFTER ${elapsed}s (${attempt} polls)`);
      return res;
    }
  }

  console.warn(`[VU ${__VU}] ACQUIRE TIMEOUT after ${POLL_TIMEOUT_SEC}s (${attempt} polls)`);
  return null;
}

function submitAndCheck(formType) {
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
}

// ── Main VU ──────────────────────────────────────────────────────────────────
export default function () {
  const formType = randomItem(FORM_TYPES);

  // per-VU flag: first hit ถูกนับไปแล้วหรือยัง
  // การันตีว่า active_first_hit / queue_first_hit จะไม่ถูก +1 ซ้ำ
  let firstHitCounted = false;

  // Step 1 — GET /  (ไม่นับเป็น first hit — first hit คือ /form/{type})
  const indexRes = getPage('/', 'index', undefined);
  check(indexRes, { 'index: status 200': (r) => r.status === 200 });

  // Step 2 — think
  thinkTime(1, 2);

  // Step 3 — GET /form/{type}  ← FIRST HIT (ตัดสิน active vs queue)
  const firstRes = getPage(`/form/${formType}`, 'form-page', formType);
  check(firstRes, { 'form-page: status 200': (r) => r.status === 200 });

  const queued = isWaitingRoomPage(firstRes.body);
  let isActiveUser;

  if (!firstHitCounted) {
    if (queued) {
      queueFirstHit.add(1,   { form_type: formType });
      waitingRoomHits.add(1, { form_type: formType });
      if (isCfNativeWrPage(firstRes.body)) {
        cfNativeWrHits.add(1, { form_type: formType });
        console.log(`[VU ${__VU}] FIRST HIT → QUEUE [CF NATIVE WR] (${formType})`);
      } else {
        console.log(`[VU ${__VU}] FIRST HIT → QUEUE (${formType})`);
      }
      isActiveUser = false;
    } else {
      activeFirstHit.add(1, { form_type: formType });
      console.log(`[VU ${__VU}] FIRST HIT → ACTIVE (${formType})`);
      isActiveUser = true;
    }
    firstHitCounted = true;
  }

  // Step 4a — active path: think → submit → จบ
  if (isActiveUser) {
    thinkTime(2, 4);
    submitAndCheck(formType);
    return;
  }

  // Step 4b — queue path: poll GET /form/{type} จนผ่าน WR → submit
  // การ poll/reload นี้ *ไม่* นับเป็น active_first_hit (firstHitCounted = true แล้ว)
  const admittedRes = pollUntilAdmitted(formType);
  if (!admittedRes) return;

  queueToActive.add(1, { form_type: formType });

  thinkTime(2, 4);
  submitAndCheck(formType);
}

// ── Summary ──────────────────────────────────────────────────────────────────
export function handleSummary(data) {
  const m = data.metrics;
  const active = m.active_first_hit?.values?.count ?? 0;
  const queued = m.queue_first_hit?.values?.count  ?? 0;
  const q2a    = m.queue_to_active?.values?.count  ?? 0;

  const banner = [
    '',
    '╔════════════════════════════════════════════════════════════╗',
    '║  Waiting Room Wave — First-Hit Classification              ║',
    '╚════════════════════════════════════════════════════════════╝',
    '',
    `  Active users (first-hit) : ${String(active).padStart(6)}`,
    `  Queued users (first-hit) : ${String(queued).padStart(6)}`,
    `  Total first-hits         : ${String(active + queued).padStart(6)}`,
    `  Queue → Active later     : ${String(q2a).padStart(6)}`,
    '',
  ].join('\n');

  const base = makeSummary(data, 'waiting-room-first-hit');
  return {
    ...base,
    stdout: (base.stdout || '') + banner,
  };
}
