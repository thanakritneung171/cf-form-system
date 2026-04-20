// 02-load.js — Load Test
// ทดสอบ normal load ที่คาดว่าจะรับได้จริง
// ramp 0→50 (2m), hold 50 (10m), ramp 50→100 (2m), ramp down (2m)
// ยิง mix ของ contact + newsletter + feedback (ฟอร์มเบา ไม่มีไฟล์)

import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomItem } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';
import { BASE_URL, commonHeaders, MAX_REQUESTS } from '../config.js';
import { buildPayload } from '../helpers/mock-data.js';
import { FORM_TYPES } from '../helpers/form-types.js';

export const options = MAX_REQUESTS
  ? {
      // MAX_REQUESTS set → shared-iterations: ยิงครบแล้วหยุด (ไม่ใช้ stages)
      scenarios: {
        load: {
          executor: 'shared-iterations',
          vus: 10,
          iterations: MAX_REQUESTS,
          maxDuration: '30m',
        },
      },
      thresholds: {
        http_req_failed: ['rate<0.01'],
        http_req_duration: ['p(95)<2000', 'p(99)<3000'],
      },
    }
  : {
      // ไม่กำหนด MAX_REQUESTS → ใช้ stages ปกติ
      stages: [
        { duration: '2m', target: 5 },
        { duration: '10m', target: 10 },
        { duration: '2m', target: 10 },
        { duration: '2m', target: 0 },
      ],
      thresholds: {
        http_req_failed: ['rate<0.01'],
        http_req_duration: ['p(95)<2000', 'p(99)<3000'],
      },
    };

// สุ่ม random ทุกครั้ง
// const LIGHT_FORMS = ['contact', 'newsletter', 'feedback'];

export default function () {
  const formType = randomItem(FORM_TYPES);
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
