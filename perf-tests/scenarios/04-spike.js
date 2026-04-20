// 04-spike.js — Spike Test (Flash Crowd)
// จำลอง traffic พุ่งทันทีแบบ flash crowd เช่น เปิดลงทะเบียนอีเวนต์พร้อมกัน
// สังเกตว่าระบบ recover ได้ไหมหลัง spike

import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, commonHeaders, MAX_REQUESTS } from '../config.js';
import { buildPayload } from '../helpers/mock-data.js';

export const options = MAX_REQUESTS
  ? {
      scenarios: {
        spike: {
          executor: 'shared-iterations',
          vus: 500,
          iterations: MAX_REQUESTS,
          maxDuration: '15m',
        },
      },
      thresholds: {
        http_req_failed: ['rate<0.20'],
      },
    }
  : {
      stages: [
        { duration: '30s', target: 10   },  // baseline ปกติ
        { duration: '10s', target: 5000 },  // SPIKE — ทุบทันที
        { duration: '3m',  target: 5000 },  // hold spike
        { duration: '10s', target: 10   },  // drop กลับ baseline
        { duration: '3m',  target: 10   },  // observe recovery
      ],
      thresholds: {
        http_req_failed: ['rate<0.20'],
      },
    };

// event-registration เหมาะที่สุดสำหรับ flash crowd scenario
export default function () {
  const res = http.post(
    `${BASE_URL}/submit/event-registration`,
    buildPayload('event-registration', __VU, __ITER),
    {
      headers: commonHeaders,
      timeout: '30s',
    }
  );

  check(res, {
    'status 200 or 429': (r) => r.status === 200 || r.status === 429,
    'not 5xx': (r) => r.status < 500,
  });

  sleep(0.2);
}
