// config.js — ค่า config กลางสำหรับทุก scenario
// อ่านค่าจาก environment variables ที่ส่งผ่าน k6 run -e หรือ .env

export const BASE_URL = __ENV.BASE_URL || 'https://worker1-intake.softdebut-poc.workers.dev';

// Token สำหรับ identify load test traffic (ใช้ใน header X-Load-Test-Token)
export const LOAD_TEST_TOKEN = __ENV.LOAD_TEST_TOKEN || 'dev-token';

// Headers ที่แนบไปทุก request เพื่อ tag ว่าเป็น load test traffic
export const commonHeaders = {
  'X-Load-Test-Token': LOAD_TEST_TOKEN,
};

// จำนวน requests สูงสุดทั้งหมด (รวมทุก VU)
// 0 = ไม่จำกัด (ใช้ duration/stages แทน)
// k6 หยุดเมื่อถึง iterations หรือ duration ก่อน แล้วแต่อย่างไหนจะมาถึงก่อน
//
// ตัวอย่าง:
//   k6 run -e MAX_REQUESTS=1000 scenarios/02-load.js   → หยุดที่ 1000 requests
//   k6 run scenarios/02-load.js                         → หยุดตาม duration/stages
export const MAX_REQUESTS = parseInt(__ENV.MAX_REQUESTS || '0', 10) || undefined;
