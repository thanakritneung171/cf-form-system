// config.js — ค่า config กลางสำหรับทุก scenario
// อ่านค่าจาก environment variables ที่ส่งผ่าน k6 run -e หรือ .env

export const BASE_URL = __ENV.BASE_URL || 'https://worker1-intake.softdebut-poc.workers.dev';

// Token สำหรับ identify load test traffic (ใช้ใน header X-Load-Test-Token)
// ตัว worker ปัจจุบันยังไม่ enforce token นี้ แต่เก็บไว้สำหรับ future rate-limit bypass
export const LOAD_TEST_TOKEN = __ENV.LOAD_TEST_TOKEN || 'dev-token';

// Headers ที่แนบไปทุก request เพื่อ tag ว่าเป็น load test traffic
export const commonHeaders = {
  'X-Load-Test-Token': LOAD_TEST_TOKEN,
};
