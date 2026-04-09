// 04-spike.js — Spike Test (Flash Crowd)
// จำลอง traffic พุ่งทันทีแบบ flash crowd เช่น เปิดลงทะเบียนอีเวนต์พร้อมกัน
// สังเกตว่าระบบ recover ได้ไหมหลัง spike

import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, commonHeaders } from '../config.js';
import { buildPayload } from '../helpers/mock-data.js';

export const options = {
  stages: [
    { duration: '30s', target: 10   },  // baseline ปกติ
    { duration: '10s', target: 5000 },  // SPIKE — ทุบทันที
    { duration: '3m',  target: 5000 },  // hold spike
    { duration: '10s', target: 10   },  // drop กลับ baseline
    { duration: '3m',  target: 10   },  // observe recovery
  ],
  thresholds: {
    // ช่วง baseline (ก่อนและหลัง spike) ควรกลับมาตอบได้ปกติ
    // ไม่ set p95 เพราะ spike phase จะทำให้เกิน — ดูจาก graph แทน
    http_req_failed: ['rate<0.20'],  // ยอมรับ error สูงสุด 20% ระหว่าง spike
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
