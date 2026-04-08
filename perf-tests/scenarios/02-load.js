// 02-load.js — Load Test
// ทดสอบ normal load ที่คาดว่าจะรับได้จริง
// ramp 0→50 (2m), hold 50 (10m), ramp 50→100 (2m), ramp down (2m)
// ยิง mix ของ contact + newsletter + feedback (ฟอร์มเบา ไม่มีไฟล์)

import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, commonHeaders } from '../config.js';
import { buildPayload } from '../helpers/mock-data.js';

export const options = {
  stages: [
    { duration: '2m', target: 50 },   // ramp up
    { duration: '10m', target: 50 },  // hold steady
    { duration: '2m', target: 100 },  // ramp to peak
    { duration: '2m', target: 0 },    // ramp down
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],    // error < 1%
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
  },
};

// วน 3 ฟอร์มแบบ round-robin ตาม VU number
const LIGHT_FORMS = ['contact', 'newsletter', 'feedback'];

export default function () {
  const formType = LIGHT_FORMS[__VU % LIGHT_FORMS.length];
  const payload = buildPayload(formType, __VU, __ITER);

  const res = http.post(`${BASE_URL}/submit/${formType}`, payload, {
    headers: commonHeaders,
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'ok true': (r) => {
      try { return JSON.parse(r.body).ok === true; } catch { return false; }
    },
  });

  sleep(0.5);
}
