// 03-stress.js — Stress Test
// รามขึ้นเรื่อยๆ เพื่อหา breaking point ของระบบ
// ไม่มี hard threshold — อยากเห็นว่าระบบพังตอนไหนและ error ชนิดไหน

import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, commonHeaders, MAX_REQUESTS } from '../config.js';
import { buildPayload } from '../helpers/mock-data.js';

export const options = MAX_REQUESTS
  ? {
      scenarios: {
        stress: {
          executor: 'shared-iterations',
          vus: 500,
          iterations: MAX_REQUESTS,
          maxDuration: '30m',
        },
      },
    }
  : {
      stages: [
        { duration: '2m',  target: 100  },
        { duration: '3m',  target: 500  },
        { duration: '3m',  target: 1000 },
        { duration: '3m',  target: 2000 },
        { duration: '3m',  target: 5000 },
        { duration: '5m',  target: 5000 },
        { duration: '3m',  target: 0    },
      ],
    };

// ใช้ contact เพื่อ isolate queue หลัก
export default function () {
  const res = http.post(`${BASE_URL}/submit/contact`, buildPayload('contact', __VU, __ITER), {
    headers: commonHeaders,
    // timeout สูงขึ้นเพื่อไม่ให้ timeout error บัง error จริง
    timeout: '30s',
  });

  // check แต่ไม่ fail test
  check(res, {
    'status 200': (r) => r.status === 200,
    'not 5xx':    (r) => r.status < 500,
  });

  // sleep น้อยเพื่อกดดัน server มากขึ้น
  sleep(0.1);
}
