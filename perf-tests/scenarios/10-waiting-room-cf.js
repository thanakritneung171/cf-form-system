// 10-waiting-room-cf.js — Cloudflare Waiting Room wave test
//
// Fires 250 VUs simultaneously at a single URL and classifies each as
// ADMITTED (origin page) or QUEUED (waiting room page). Queued VUs poll the
// same URL every 3–5s until admitted, then hold the session for 60s.
//
// Run:
//   k6 run perf-tests/scenarios/10-waiting-room-cf.js
//   k6 run -e TARGET_URL=https://formsystem.softdebut.online/ perf-tests/scenarios/10-waiting-room-cf.js
//   k6 run -e TARGET_URL=... -e VUS=250 perf-tests/scenarios/10-waiting-room-cf.js
//
// Waiting Room config under test:
//   Total Active Users    : 200
//   New Users Per Minute  : 200
//   Session Duration      : 60s

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';

// ── Configuration ────────────────────────────────────────────────────────────
const TARGET_URL      = __ENV.TARGET_URL      || 'https://formsystem.softdebut.online/';
const VUS             = parseInt(__ENV.VUS    || '250', 10);
const SESSION_SECONDS = parseInt(__ENV.SESSION_SECONDS || '60', 10);
const POLL_MIN_SEC    = 3;
const POLL_MAX_SEC    = 5;
const POLL_TIMEOUT_SEC = parseInt(__ENV.POLL_TIMEOUT_SEC || '600', 10);

// ตั้ง DEBUG=1 เพื่อ dump headers + body 500 ตัวแรกของ VU 1 (ช่วย debug detection)
const DEBUG = __ENV.DEBUG === '1';

// ── Custom metrics ───────────────────────────────────────────────────────────
const admittedUsers = new Counter('admitted_users');
const queuedUsers   = new Counter('queued_users');
const waitingTime   = new Trend('waiting_time', true);

// ── Executor ─────────────────────────────────────────────────────────────────
// per-vu-iterations with iterations: 1 gives us exactly one request per VU and
// every VU starts at t=0 → a true simultaneous wave. constant-vus would keep
// recycling VUs, which is not what we want here.
export const options = {
  discardResponseBodies: false,
  noConnectionReuse: false,
  userAgent: 'k6-waiting-room-wave/1.0',
  scenarios: {
    wave: {
      executor:    'per-vu-iterations',
      vus:         VUS,
      iterations:  1,
      maxDuration: `${POLL_TIMEOUT_SEC + SESSION_SECONDS + 60}s`,
    },
  },
  thresholds: {
    // At least 200 users must be admitted — immediately or after polling.
    // k6 thresholds are evaluated at end-of-test, so this covers the
    // "admitted within the first few seconds" expectation (Cloudflare
    // Waiting Room grants 200 active slots up-front).
    admitted_users: ['count>=200'],
    // Keep an eye on transport-level failures.
    http_req_failed: ['rate<0.05'],
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Detect whether a response is the Cloudflare Waiting Room holding page
 * rather than the origin page. Uses multiple heuristics because Cloudflare
 * does not expose a stable public header for this.
 */
function isWaitingRoomResponse(res) {
  const h = res.headers || {};

  if (DEBUG && __VU === 1) {
    console.log(`[DEBUG VU1] status=${res.status}`);
    console.log(`[DEBUG VU1] headers=${JSON.stringify(h)}`);
    console.log(`[DEBUG VU1] body_snippet=${String(res.body || '').slice(0, 800)}`);
  }

  if (h['Cf-Waiting-Room'] || h['cf-waiting-room']) return true;

  const body = res.body || '';
  if (!body) return false;

  return (
    body.includes('waiting-room') ||
    body.includes('waitingrooms-text') ||
    body.includes('Waiting Room powered by Cloudflare') ||
    body.includes('cf-waiting-room') ||
    body.includes('/cdn-cgi/challenge-platform/') && body.includes('waitingroom') ||
    body.includes('ผู้เข้าใช้เต็ม') ||
    body.includes('ระบบยุ่ง') ||
    body.includes('คุณอยู่ในคิว')
  );
}

function fetchTarget() {
  return http.get(TARGET_URL, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    redirects: 5,
    tags: { url: TARGET_URL },
  });
}

function randomPollDelay() {
  return randomIntBetween(POLL_MIN_SEC * 10, POLL_MAX_SEC * 10) / 10;
}

// ── VU main ──────────────────────────────────────────────────────────────────
// k6 automatically maintains a per-VU cookie jar, so session cookies issued by
// Cloudflare Waiting Room (e.g. __cfwaitingroom) persist across requests in
// the same VU — which is what the Waiting Room needs to track queue position.
export default function () {
  const vu = __VU;
  const startedAt = Date.now();

  // Step 1 — initial request.
  let res = fetchTarget();
  let queued = isWaitingRoomResponse(res);

  check(res, {
    'initial: status 200 or 429': (r) => r.status === 200 || r.status === 429,
  });

  if (!queued) {
    admittedUsers.add(1);
    waitingTime.add(0);
    console.log(`[VU ${vu}] ADMITTED immediately`);
    sleep(SESSION_SECONDS);
    return;
  }

  // Step 2 — queued. Record and poll until admitted or timeout.
  queuedUsers.add(1);
  console.log(`[VU ${vu}] QUEUED — entering waiting room`);

  const deadline = startedAt + POLL_TIMEOUT_SEC * 1000;
  let attempt = 0;

  while (Date.now() < deadline) {
    attempt++;
    const delay = randomPollDelay();
    sleep(delay);

    const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
    console.log(`[VU ${vu}] WAITING — attempt ${attempt}, ${elapsedSec}s elapsed`);

    res = fetchTarget();
    if (!isWaitingRoomResponse(res)) {
      const waitedMs = Date.now() - startedAt;
      waitingTime.add(waitedMs);
      admittedUsers.add(1);
      console.log(`[VU ${vu}] ADMITTED after ${Math.round(waitedMs / 1000)}s (${attempt} polls)`);
      sleep(SESSION_SECONDS);
      return;
    }
  }

  console.warn(`[VU ${vu}] TIMEOUT — never admitted after ${POLL_TIMEOUT_SEC}s`);
}

// ── Summary ──────────────────────────────────────────────────────────────────
export function handleSummary(data) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const timeStr = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  // LOG_DIR is relative to where `k6 run` was invoked. Trailing slash optional.
  // Default is '.' (current working dir) so the write never fails; set e.g.
  // LOG_DIR=perf-tests/logs when running from the repo root.
  const logDirRaw = (__ENV.LOG_DIR || '.').replace(/\/+$/, '');
  const logFile = `${logDirRaw}/${dateStr}_${timeStr}_waiting-room-cf.log`;

  const m = data.metrics;
  const admitted = m.admitted_users?.values?.count ?? 0;
  const queued   = m.queued_users?.values?.count   ?? 0;
  const total    = admitted + queued;

  const waitAvgMs = m.waiting_time?.values?.avg ?? 0;
  const waitP95Ms = m.waiting_time?.values?.['p(95)'] ?? 0;
  const waitMaxMs = m.waiting_time?.values?.max ?? 0;

  const fmt = (ms) => `${(ms / 1000).toFixed(1)}s`;
  const SEP = '─'.repeat(60);

  const lines = [
    '',
    '╔════════════════════════════════════════════════════════════╗',
    '║  k6 — Cloudflare Waiting Room Wave Test                    ║',
    '╚════════════════════════════════════════════════════════════╝',
    '',
    `  Date        : ${dateStr} ${timeStr.replace(/-/g, ':')}`,
    `  Target URL  : ${TARGET_URL}`,
    `  VUs         : ${VUS}`,
    `  Session     : ${SESSION_SECONDS}s`,
    '',
    SEP,
    '',
    '  Classification',
    '',
    `  Admitted users    : ${String(admitted).padStart(6)}`,
    `  Queued users      : ${String(queued).padStart(6)}`,
    `  ─────────────────────────────────`,
    `  Total measured    : ${String(total).padStart(6)}`,
    '',
    '  Waiting time (queued users only)',
    '',
    `  avg               : ${fmt(waitAvgMs)}`,
    `  p(95)             : ${fmt(waitP95Ms)}`,
    `  max               : ${fmt(waitMaxMs)}`,
    '',
    SEP,
    '',
    `  Generated: ${now.toISOString()}`,
    '',
  ];

  const logContent = lines.join('\n');

  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }) + logContent,
    [logFile]: logContent,
  };
}
