// 05-soak.js — Soak Test (Endurance Test)
// 200 VU คงที่ นาน 2 ชั่วโมง — ทดสอบ memory leak, resource exhaustion, connection pool หมด
//
// ⚠️  คำเตือน: test นี้จะสร้าง record ใน D1 ประมาณ 200 VU × 7200s / 1.5s ≈ ~960,000 rows
// ต้อง cleanup หลัง run โดยเรียก POST /admin/loadtest/cleanup (ต้องล็อกอิน admin ก่อน)
// หรือเรียก: curl -X POST http://localhost:8787/admin/loadtest/cleanup -b "session=..."

import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, commonHeaders, MAX_REQUESTS } from '../config.js';
import { buildPayload } from '../helpers/mock-data.js';
import { makeSummary } from '../helpers/summary.js';

export const options = {
  vus: 200,
  // MAX_REQUESTS set → หยุดที่จำนวน requests, ไม่ set → หยุดตาม duration
  ...(MAX_REQUESTS ? { iterations: MAX_REQUESTS } : { duration: '2h' }),
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<2000'],
  },
};

// mix ฟอร์มเบาเพื่อยืดระยะเวลาได้นานโดยไม่สร้าง file ขยะ
const FORMS = ['contact', 'newsletter', 'feedback', 'product-inquiry', 'event-registration'];

export default function () {
  const formType = FORMS[__VU % FORMS.length];
  const res = http.post(`${BASE_URL}/submit/${formType}`, buildPayload(formType, __VU, __ITER), {
    headers: commonHeaders,
    tags: { page: `/submit/${formType}`, page_type: 'submit' },
  });

  check(res, {
    'status 200': (r) => r.status === 200,
  });

  sleep(1.5);
}

export function handleSummary(data) {
  return makeSummary(data, 'soak');
}
