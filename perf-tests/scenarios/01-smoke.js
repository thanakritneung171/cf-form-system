// 01-smoke.js — Smoke Test
// ตรวจสอบว่า system ทำงานได้เบื้องต้น ก่อน run load test จริง
// 1 VU, 1 นาที, ฟอร์ม contact อย่างเดียว

import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, commonHeaders } from '../config.js';
import { buildPayload } from '../helpers/mock-data.js';

export const options = {
  vus: 1,
  duration: '1m',
  thresholds: {
    // error rate ต้องต่ำกว่า 1%
    http_req_failed: ['rate<0.01'],
    // 95th percentile ต้องน้อยกว่า 500ms
    http_req_duration: ['p(95)<500'],
  },
};

export default function () {
  const payload = buildPayload('contact', __VU, __ITER);
  const res = http.post(`${BASE_URL}/submit/contact`, payload, {
    headers: commonHeaders,
  });

  // ตรวจสอบ response ว่าถูกต้อง
  check(res, {
    'status is 200': (r) => r.status === 200,
    'has submission_id': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.ok === true && typeof body.submission_id === 'string';
      } catch {
        return false;
      }
    },
  });

  sleep(1);
}
