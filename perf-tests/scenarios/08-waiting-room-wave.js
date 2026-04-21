// 08-waiting-room-wave.js — One-Shot Waiting Room Wave Test
//
// Objective: Fire 250 users simultaneously and measure how many are admitted
// immediately (active) vs placed in the waiting room (queued).
//
// Measurement model — only the FIRST hit to /form/{type} counts:
//   response is NOT waiting room page → ACTIVE  (active_first_hit++)
//   response IS  waiting room page    → QUEUED  (queue_first_hit++)
//
// Subsequent transitions (queue → active) are tracked separately as
// queue_to_active but NEVER added to active_first_hit.
//
// Run:
//   k6 run perf-tests/scenarios/08-waiting-room-wave.js
//   k6 run -e VUS=250 perf-tests/scenarios/08-waiting-room-wave.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';
import { randomItem, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';
import { BASE_URL, commonHeaders } from '../config.js';
import { buildPayload } from '../helpers/mock-data.js';
import { FORM_TYPES } from '../helpers/form-types.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';

// ── Custom metrics ─────────────────────────────────────────────────────────────
// Each counter is incremented at most once per VU (enforced by firstHitRecorded flag).

/** Users admitted immediately on first /form/{type} hit */
const activeFirstHit  = new Counter('active_first_hit');

/** Users placed in waiting room on first /form/{type} hit */
const queueFirstHit   = new Counter('queue_first_hit');

/** Users who were queued and later acquired a slot (informational only) */
const queueToActive   = new Counter('queue_to_active');

// ── Executor config ────────────────────────────────────────────────────────────
// per-vu-iterations guarantees: 1 VU = 1 user, runs exactly once.
// All VUs start at the same time → simultaneous wave.

const VUS = parseInt(__ENV.VUS || '250', 10);

export const options = {
  scenarios: {
    wave: {
      executor:   'per-vu-iterations',
      vus:        VUS,
      iterations: 1,
      maxDuration: '10m',
    },
  },
  thresholds: {
    // Informational only — no hard failure thresholds for the wave test.
    active_first_hit: [],
    queue_first_hit:  [],
    queue_to_active:  [],
    http_req_failed:  ['rate<0.15'],
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function thinkTime(minSec, maxSec) {
  sleep(randomIntBetween(minSec * 10, maxSec * 10) / 10);
}

function getPage(path, pageType) {
  return http.get(`${BASE_URL}${path}`, {
    headers: { ...commonHeaders, Accept: 'text/html' },
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

/** Reuse existing detection logic from 07-user-journey.js */
function isWaitingRoomPage(body) {
  if (!body) return false;
  return (
    body.includes('waiting-room') ||
    body.includes('waitingrooms-text') ||
    body.includes('Waiting Room powered by Cloudflare') ||
    body.includes('ผู้เข้าใช้เต็ม') ||
    body.includes('ระบบยุ่ง')
  );
}

/**
 * Poll /api/waiting-room/acquire until a slot is acquired or timeout.
 * Returns the elapsed seconds, or -1 on timeout.
 */
function waitForSlot(formType, timeoutSec) {
  const pollInterval = 3;
  const maxAttempts  = Math.ceil(timeoutSec / pollInterval);
  const startTime    = Date.now();

  for (let i = 0; i < maxAttempts; i++) {
    sleep(pollInterval);

    const res = http.get(
      `${BASE_URL}/api/waiting-room/acquire?formType=${encodeURIComponent(formType)}`,
      {
        headers: commonHeaders,
        tags: { page: '/api/waiting-room/acquire', page_type: 'waiting-room-api', form_type: formType },
      }
    );

    let data;
    try { data = JSON.parse(res.body); } catch { continue; }
    if (data.ok === true) {
      return Math.round((Date.now() - startTime) / 1000);
    }
  }
  return -1;
}

// ── Main VU function ───────────────────────────────────────────────────────────
export default function () {
  // Per-VU flag — ensures the first-hit metric is recorded exactly once.
  // k6 resets VU state between iterations but we have iterations: 1, so this
  // is redundant safety; it lives here to make the intent explicit.
  let firstHitRecorded = false;

  // ── Step 1: Index page ───────────────────────────────────────────────────────
  const indexRes = getPage('/', 'index');
  check(indexRes, {
    'index: status 200':     (r) => r.status === 200,
    'index: has form links': (r) => r.body && r.body.includes('/form/'),
  });

  thinkTime(0.5, 1.5);  // Short think to keep the wave tight but realistic.

  // ── Step 2: Pick a random form type ─────────────────────────────────────────
  const formType = randomItem(FORM_TYPES);

  // ── Step 3: FIRST HIT — this is the only measurement point ──────────────────
  const formPageRes = getPage(`/form/${formType}`, 'form-page');

  const isQueued = isWaitingRoomPage(formPageRes.body);

  if (!firstHitRecorded) {
    firstHitRecorded = true;

    if (isQueued) {
      queueFirstHit.add(1, { form_type: formType });
      console.log(`[VU ${__VU}] FIRST HIT → QUEUE  (formType: ${formType})`);
    } else {
      activeFirstHit.add(1, { form_type: formType });
      console.log(`[VU ${__VU}] FIRST HIT → ACTIVE (formType: ${formType})`);
    }
  }

  // ── Step 4: If queued — poll for slot, then re-open form (no re-count) ───────
  let finalFormRes = formPageRes;

  if (isQueued) {
    const elapsedSec = waitForSlot(formType, 120);

    if (elapsedSec === -1) {
      console.warn(`[VU ${__VU}] QUEUE TIMEOUT — giving up on ${formType} after 120s`);
      return;
    }

    console.log(`[VU ${__VU}] ACQUIRED SLOT AFTER ${elapsedSec}s`);

    // queue_to_active is informational — it does NOT add to active_first_hit.
    queueToActive.add(1, { form_type: formType });

    // Re-open form now that a slot is available.
    finalFormRes = getPage(`/form/${formType}`, 'form-page');
  }

  check(finalFormRes, {
    'form-page: status 200':        (r) => r.status === 200,
    'form-page: has submit button': (r) => r.body && r.body.includes('submit'),
  });

  // ── Step 5: Fill out and submit the form ────────────────────────────────────
  const hasFile = ['job-application', 'complaint', 'warranty-claim', 'partnership', 'incident-report']
    .includes(formType);
  thinkTime(hasFile ? 3 : 2, hasFile ? 7 : 5);

  const payload   = buildPayload(formType, __VU, __ITER);
  const submitRes = postSubmit(formType, payload);

  check(submitRes, {
    'submit: status 200':        (r) => r.status === 200,
    'submit: ok true':           (r) => { try { return JSON.parse(r.body).ok === true; } catch { return false; } },
    'submit: has submission_id': (r) => {
      try {
        const b = JSON.parse(r.body);
        return typeof b.submission_id === 'string' && b.submission_id.length > 0;
      } catch { return false; }
    },
  });

  thinkTime(0.5, 1.5);
}

// ── Summary ────────────────────────────────────────────────────────────────────
export function handleSummary(data) {
  const now    = new Date();
  const pad    = (n) => String(n).padStart(2, '0');
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const timeStr = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  const logFile = `logs/${dateStr}_${timeStr}_waiting-room-wave.log`;

  const m            = data.metrics;
  const active       = m.active_first_hit?.values?.count  ?? 0;
  const queued       = m.queue_first_hit?.values?.count   ?? 0;
  const transitioned = m.queue_to_active?.values?.count   ?? 0;
  const total        = active + queued;

  const SEP = '─'.repeat(60);

  const lines = [
    '',
    '╔════════════════════════════════════════════════════════════╗',
    '║  k6 — Waiting Room Wave Test Summary                       ║',
    '╚════════════════════════════════════════════════════════════╝',
    '',
    `  Date     : ${dateStr}`,
    `  Time     : ${timeStr.replace(/-/g, ':')}`,
    '',
    SEP,
    '',
    '  🎯 Waiting Room Classification (first hit only)',
    '',
    `  Active users (admitted immediately) : ${String(active).padStart(6)}`,
    `  Queued users (sent to waiting room) : ${String(queued).padStart(6)}`,
    `  ─────────────────────────────────────────────`,
    `  Total users measured                : ${String(total).padStart(6)}`,
    '',
    `  Queue → Active transitions          : ${String(transitioned).padStart(6)}`,
    '',
    SEP,
    '',
    `  Generated: ${now.toISOString()}`,
    '',
  ];

  const logContent = lines.join('\n');

  // Also print the standard k6 summary to stdout.
  return {
    stdout:    textSummary(data, { indent: ' ', enableColors: true }) + logContent,
    [logFile]: logContent,
  };
}
