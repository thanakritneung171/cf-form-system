// 03-stress.js — Stress Test
// รามขึ้นเรื่อยๆ เพื่อหา breaking point ของระบบ
// ไม่มี hard threshold — อยากเห็นว่าระบบพังตอนไหนและ error ชนิดไหน

import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, commonHeaders } from '../config.js';
import { buildPayload } from '../helpers/mock-data.js';
import { makeSummary } from '../helpers/summary.js';

export const options = {
  stages: [
    { duration: '2m',  target: 100  },  // warm up
    { duration: '3m',  target: 500  },  // ramp ขึ้น
    { duration: '3m',  target: 1000 },  // เพิ่มแรงดัน
    { duration: '3m',  target: 2000 },  // stress zone
    { duration: '3m',  target: 5000 },  // near breaking point
    { duration: '5m',  target: 5000 },  // hold ที่ peak
    { duration: '3m',  target: 0    },  // ramp down สังเกต recovery
  ],
  // ไม่ set thresholds — เพื่อให้ test ไม่หยุดกลางคัน
  // ดู metrics หลัง run แทน
};

// ใช้ contact เพื่อ isolate queue หลัก
export default function () {
  const res = http.post(`${BASE_URL}/submit/contact`, buildPayload('contact', __VU, __ITER), {
    headers: commonHeaders,
    tags: { page: '/submit/contact', page_type: 'submit' },
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

export function handleSummary(data) {
  return makeSummary(data, 'stress');
}
