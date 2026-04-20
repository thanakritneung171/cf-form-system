// 07-waiting-room.js — Cloudflare Built-in Waiting Room Load Test
//
// ───────────────────────────────────────────────────────────────────
// ทดสอบ Cloudflare Built-in Waiting Room (ตั้งค่าจาก CF Dashboard)
// ที่ URL: https://formsystem.softdebut.online/
//
// เมื่อ CF Waiting Room ถูก trigger response จะเปลี่ยนเป็น:
//   - HTML ที่ CF generate (ไม่ใช่ content จาก origin)
//   - Set-Cookie: __cfwl_auth=... (CF Waiting Room session cookie)
//   - อาจมี Header: cf-waiting-room
//   - Body มี meta refresh ไป /cdn-cgi/...
//
// วิธีรัน:
//   k6 run perf-tests/scenarios/07-waiting-room.js
//   k6 run -e TARGET_URL=https://formsystem.softdebut.online perf-tests/scenarios/07-waiting-room.js
// ───────────────────────────────────────────────────────────────────

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { MAX_REQUESTS } from '../config.js';

// ─── Config ───────────────────────────────────────────────────────
const TARGET_URL = __ENV.TARGET_URL || 'https://formsystem.softdebut.online/';

// ─── Custom Metrics ───────────────────────────────────────────────
const waitingRoomHits = new Counter('waiting_room_hits');
const normalPageHits  = new Counter('normal_page_hits');
const waitingRoomRate = new Rate('waiting_room_rate');
const wrDuration      = new Trend('waiting_room_duration', true);

// ─── Load Profile ─────────────────────────────────────────────────
export const options = MAX_REQUESTS
  ? {
      scenarios: {
        waiting_room: {
          executor: 'shared-iterations',
          vus: 200,
          iterations: MAX_REQUESTS,
          maxDuration: '15m',
        },
      },
      thresholds: {
        http_req_failed:   ['rate<0.05'],
        http_req_duration: ['p(95)<5000'],
      },
    }
  : {
      stages: [
        { duration: '2m', target: 200 },
        { duration: '3m', target: 200 },
        { duration: '2m', target: 0 },
      ],
      thresholds: {
        http_req_failed:   ['rate<0.05'],
        http_req_duration: ['p(95)<5000'],
      },
    };

// ─── Detection: CF Built-in Waiting Room ──────────────────────────
//
// CF Waiting Room มี 4 signals:
//
//  1) Header "cf-waiting-room" — CF set เมื่อ intercept request
//
//  2) Cookie "__cfwl_auth" ใน Set-Cookie
//     (ต่างจาก __cf_bm ที่มีตลอดเวลา — __cfwl_auth เฉพาะ WR session)
//
//  3) Body มี /cdn-cgi/ + refresh → CF-generated page ไม่ใช่ origin
//
//  4) Body ไม่มี content ของเว็บจริง ("แบบฟอร์มออนไลน์")
//     แต่ยังมีบางอย่างอยู่ (status=200 body ไม่ว่าง)
//
function detectWaitingRoom(res) {
  const headers   = res.headers || {};
  const body      = (res.body || '').toLowerCase();
  const setCookie = headers['Set-Cookie'] || headers['set-cookie'] || '';

  const hasWRHeader      = 'cf-waiting-room' in headers;
  const hasWRCookie      = setCookie.includes('__cfwl_auth');
  const hasCdnCgiRefresh = body.includes('/cdn-cgi/') && body.includes('refresh');
  const hasWRText        =
    body.includes('waiting room')  ||
    body.includes('waitingroom')   ||
    body.includes('you are in line') ||
    body.includes('in the queue')  ||
    body.includes('estimated wait');
  const missingOriginContent =
    res.status === 200         &&
    body.length > 100          &&
    !body.includes('แบบฟอร์มออนไลน์') &&
    !body.includes('formsystem');

  return hasWRHeader || hasWRCookie || hasCdnCgiRefresh || hasWRText || missingOriginContent;
}

// ─── Setup: baseline check ────────────────────────────────────────
export function setup() {
  console.log('='.repeat(62));
  console.log('  Cloudflare Built-in Waiting Room — Load Test');
  console.log('='.repeat(62));
  console.log(`  Target  : ${TARGET_URL}`);
  console.log('  Profile : 0→200 VU (2m) → hold 3m → ramp down 2m');
  console.log('');
  console.log('  Detection signals (any match = in WR):');
  console.log('    1. Header: cf-waiting-room present');
  console.log('    2. Cookie: __cfwl_auth in Set-Cookie');
  console.log('    3. Body  : /cdn-cgi/ meta refresh');
  console.log('    4. Body  : "waiting room" / "in the queue" text');
  console.log('    5. Body  : ไม่มี origin content ปกติ');
  console.log('');

  const probe = http.get(TARGET_URL, {
    headers: { 'User-Agent': 'k6-setup-probe/1.0' },
    timeout: '10s',
  });

  const cfRay = probe.headers['Cf-Ray'] || probe.headers['cf-ray'] || 'N/A';
  const isWR  = detectWaitingRoom(probe);

  console.log(`  Baseline (1 request):`);
  console.log(`    HTTP status : ${probe.status}`);
  console.log(`    cf-ray      : ${cfRay}`);
  console.log(`    WR active?  : ${isWR ? '>>> YES — already in Waiting Room! <<<' : 'No (normal page, WR not triggered yet)'}`);
  console.log('='.repeat(62));
}

// ─── Main VU flow ──────────────────────────────────────────────────
export default function () {
  const jar = http.cookieJar();

  const res = http.get(TARGET_URL, {
    jar,
    headers: {
      'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7',
      'Cache-Control':   'no-cache',
    },
    redirects: 5,
    timeout: '30s',
  });

  const inWR = detectWaitingRoom(res);

  if (inWR) {
    waitingRoomHits.add(1);
    waitingRoomRate.add(1);
    wrDuration.add(res.timings.duration);
  } else {
    normalPageHits.add(1);
    waitingRoomRate.add(0);
  }

  check(res, {
    'status is 200':     (r) => r.status === 200,
    'no 5xx':            (r) => r.status < 500,
    'has cf-ray header': (r) => 'Cf-Ray' in r.headers || 'cf-ray' in r.headers,
    'in waiting room':   (_r) => inWR,  // pass = WR active, fail = normal page
  });

  sleep(inWR
    ? Math.random() * 5 + 3   // 3–8 วิ (simulate browser poll ขณะรอคิว)
    : Math.random() * 2 + 1   // 1–3 วิ (simulate อ่านหน้าเว็บ)
  );
}

// ─── Teardown ─────────────────────────────────────────────────────
export function teardown() {
  console.log('');
  console.log('='.repeat(62));
  console.log('  Tips อ่านผล:');
  console.log('');
  console.log('  waiting_room_rate สูง  → CF WR ทำงาน (คนถูกกัก)');
  console.log('  waiting_room_rate = 0  → WR ไม่ถูก trigger');
  console.log('    สาเหตุ: concurrent user ยังไม่เกิน threshold ที่ตั้งใน CF Dashboard');
  console.log('    แก้: ลอง เพิ่ม VU หรือ ลด threshold ใน CF Dashboard ลงก่อน test');
  console.log('');
  console.log('  "in waiting room" check:');
  console.log('    % pass = สัดส่วน request ที่เจอ WR');
  console.log('    % fail = สัดส่วน request ที่เข้าได้ปกติ');
  console.log('='.repeat(62));
}
