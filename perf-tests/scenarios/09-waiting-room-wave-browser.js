// 09-waiting-room-wave-browser.js — Waiting Room Wave Test (Browser)
//
// เหมือน 08-waiting-room-wave.js แต่ใช้ Chromium จริง — สำคัญเมื่อ Cloudflare
// Waiting Room ใช้ JavaScript challenge / cookie เพื่อตรวจว่าเป็น real browser
//
// ข้อแตกต่างจาก HTTP version (08):
//   - ใช้ k6/browser (Chromium) แทน k6/http สำหรับ page navigation
//   - ใช้ HTTP module เฉพาะ polling /api/waiting-room/acquire (JSON API)
//   - VU default = 30 (browser VU หนักกว่า ~10x)
//   - ใช้ LIGHT_FORMS เท่านั้น (ไม่มี file input — browser fill ทำได้ง่ายกว่า)
//   - ได้ Web Vitals metrics (LCP, FID, CLS) ฟรีจาก k6 browser
//
// Run:
//   k6 run perf-tests/scenarios/09-waiting-room-wave-browser.js
//   k6 run -e VUS=50 perf-tests/scenarios/09-waiting-room-wave-browser.js

import { browser } from 'k6/browser';
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';
import { randomItem } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';
import { BASE_URL, commonHeaders } from '../config.js';
import { LIGHT_FORMS } from '../helpers/form-types.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';

// ── Custom metrics (เหมือน 08 ทุกอย่าง) ────────────────────────────────────────
const activeFirstHit = new Counter('active_first_hit');
const queueFirstHit  = new Counter('queue_first_hit');
const queueToActive  = new Counter('queue_to_active');

// ── Executor config ────────────────────────────────────────────────────────────
// Browser VU แต่ละตัวเปิด Chromium process จริง → RAM สูง
// แนะนำ: ≤50 VU บน machine ปกติ, ≤100 VU บน server ขนาดใหญ่
const VUS = parseInt(__ENV.VUS || '30', 10);
// k6 v1.x ควบคุม headless ผ่าน K6_BROWSER_HEADLESS env var (OS level) เท่านั้น
// headless ใน scenario options block ถูก ignore โดย k6 v1.x
//
// เปิดหน้าต่าง browser:
//   PowerShell:  $env:K6_BROWSER_HEADLESS = "false"; k6 run -e VUS=3 ...
//   bash:        K6_BROWSER_HEADLESS=false k6 run -e VUS=3 ...

export const options = {
  scenarios: {
    wave: {
      executor:    'per-vu-iterations',
      vus:         VUS,
      iterations:  1,
      maxDuration: '15m',
      options: {
        browser: {
          type: 'chromium',
        },
      },
    },
  },
  thresholds: {
    active_first_hit:         [],
    queue_first_hit:          [],
    queue_to_active:          [],
    browser_web_vital_lcp:    ['p(95)<4000'],  // Largest Contentful Paint
    browser_web_vital_fid:    ['p(95)<300'],   // First Input Delay
    'browser_http_req_failed': ['rate<0.15'],
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

/** ตรวจ waiting room จาก HTML content ของ page (เหมือน 07/08) */
function isWaitingRoomContent(html) {
  if (!html) return false;
  return (
    html.includes('waiting-room') ||
    html.includes('waitingrooms-text') ||
    html.includes('Waiting Room powered by Cloudflare') ||
    html.includes('ผู้เข้าใช้เต็ม') ||
    html.includes('ระบบยุ่ง')||
    html.includes('คุณอยู่ในคิว')
  );
}

/**
 * สร้าง field values สำหรับแต่ละ form type (เฉพาะ LIGHT_FORMS)
 * key = HTML name attribute, value = ค่าที่จะกรอก
 */
function getFormFields(formType, vu) {
  const id = `${vu}-${Date.now()}`;
  const base = {
    fullName: `LoadTest User ${id}`,
    email:    `k6-${id}@perftest.local`,
    phone:    '0800000000',
  };

  switch (formType) {
    case 'contact':
      return { ...base, subject: `Load test subject ${id}`, message: `Automated load test from VU ${vu}` };
    case 'event-registration':
      return { ...base, eventId: 'EVT-2026-001: Annual Conference', dietaryRequirement: 'ไม่มี', tshirtSize: 'M' };
    case 'product-inquiry':
      return { ...base, productCode: `PRD-${String(vu).padStart(5, '0')}`, quantity: '10', message: `Load test inquiry ${id}` };
    case 'newsletter':
      return { ...base, frequency: 'ทุกสัปดาห์' };
    case 'feedback':
      return { ...base, rating: '4', category: 'บริการ', comment: `Load test feedback ${id}` };
    default:
      return base;
  }
}

/**
 * กรอกฟอร์มและกด submit ด้วย browser
 * ใช้ name attribute ในการ locate field — รองรับทั้ง input, textarea, select
 */
async function fillAndSubmit(page, formType, vu) {
  const fields = getFormFields(formType, vu);

  for (const [name, value] of Object.entries(fields)) {
    try {
      const locator = page.locator(`[name="${name}"]`);

      // ตรวจว่า element มีอยู่ก่อน (timeout สั้น)
      await locator.waitFor({ state: 'attached', timeout: 3000 });

      // ลอง fill ก่อน (input/textarea) — ถ้า fail ลอง selectOption (select)
      try {
        await locator.fill(String(value));
      } catch {
        await locator.selectOption(String(value)).catch(() => {});
      }
    } catch {
      // field นี้ไม่มีใน form — ข้ามไป
    }
  }

  // กด submit — ลอง selector ต่าง ๆ ตามลำดับ
  const submitSelectors = [
    'button[type="submit"]',
    'input[type="submit"]',
    'button[type="button"]:last-of-type',
  ];

  for (const sel of submitSelectors) {
    try {
      const btn = page.locator(sel);
      await btn.waitFor({ state: 'visible', timeout: 3000 });
      await btn.click();
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      break;
    } catch {
      // ลอง selector ถัดไป
    }
  }
}

/**
 * Poll /api/waiting-room/acquire ด้วย HTTP module (ไม่ต้องใช้ browser)
 * คืน elapsed seconds หรือ -1 ถ้า timeout
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
    if (data.ok === true) return Math.round((Date.now() - startTime) / 1000);
  }
  return -1;
}

// ── Main VU function (async — required for k6 browser) ─────────────────────────
export default async function () {
  const page = await browser.newPage();

  try {
    // ── Step 1: Index page ─────────────────────────────────────────────────────
    const indexRes = await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });

    check(indexRes, {
      'index: status 200': (r) => r && r.status() === 200,
    });

    // Short think time — คงความเป็น wave
    sleep(0.5 + Math.random());

    // ── Step 2: สุ่ม form type (light forms เท่านั้น) ──────────────────────────
    const formType = randomItem(LIGHT_FORMS);

    // ── Step 3: FIRST HIT ──────────────────────────────────────────────────────
    await page.goto(`${BASE_URL}/form/${formType}`, { waitUntil: 'networkidle' });

    const html     = await page.content();
    const isQueued = isWaitingRoomContent(html);

    if (isQueued) {
      queueFirstHit.add(1, { form_type: formType });
      console.log(`[VU ${__VU}] FIRST HIT → QUEUE  (formType: ${formType})`);
    } else {
      activeFirstHit.add(1, { form_type: formType });
      console.log(`[VU ${__VU}] FIRST HIT → ACTIVE (formType: ${formType})`);
    }

    // ── Step 4: ถ้าติดคิว — poll ด้วย HTTP แล้วเปิด form ซ้ำ ──────────────────
    if (isQueued) {
      const elapsed = waitForSlot(formType, 300);

      if (elapsed === -1) {
        console.warn(`[VU ${__VU}] QUEUE TIMEOUT — giving up on ${formType} after 300s`);
        return;
      }

      console.log(`[VU ${__VU}] ACQUIRED SLOT AFTER ${elapsed}s`);
      queueToActive.add(1, { form_type: formType });

      // เปิด form ซ้ำ — ไม่นับใน metrics
      await page.goto(`${BASE_URL}/form/${formType}`, { waitUntil: 'networkidle' });
    }

    check(await page.content(), {
      'form-page: not waiting room': (html) => !isWaitingRoomContent(html),
    });

    // ── Step 5: กรอกและส่งฟอร์ม ───────────────────────────────────────────────
    sleep(1 + Math.random() * 3);

    await fillAndSubmit(page, formType, __VU);

    sleep(0.5);

  } finally {
    // ปิด page เสมอ ไม่ว่าจะ error หรือไม่
    await page.close();
  }
}

// ── Summary ────────────────────────────────────────────────────────────────────
export function handleSummary(data) {
  const now     = new Date();
  const pad     = (n) => String(n).padStart(2, '0');
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const timeStr = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  const logFile = `logs/${dateStr}_${timeStr}_waiting-room-wave-browser.log`;

  const m            = data.metrics;
  const active       = m.active_first_hit?.values?.count ?? 0;
  const queued       = m.queue_first_hit?.values?.count  ?? 0;
  const transitioned = m.queue_to_active?.values?.count  ?? 0;
  const total        = active + queued;

  const lcp = Math.round(m.browser_web_vital_lcp?.values?.['p(95)'] ?? 0);
  const fid = Math.round(m.browser_web_vital_fid?.values?.['p(95)'] ?? 0);

  const SEP = '─'.repeat(60);

  const lines = [
    '',
    '╔════════════════════════════════════════════════════════════╗',
    '║  k6 Browser — Waiting Room Wave Test Summary               ║',
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
    '  🌐 Web Vitals (Chromium)',
    '',
    `  LCP p(95) : ${lcp} ms   (threshold < 4000ms)`,
    `  FID p(95) : ${fid} ms   (threshold < 300ms)`,
    '',
    SEP,
    '',
    `  Generated: ${now.toISOString()}`,
    '',
  ];

  const logContent = lines.join('\n');

  return {
    stdout:    textSummary(data, { indent: ' ', enableColors: true }) + logContent,
    [logFile]: logContent,
  };
}
