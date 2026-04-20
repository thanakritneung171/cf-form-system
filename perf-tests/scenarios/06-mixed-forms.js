// 06-mixed-forms.js — Mixed Forms Test
// ยิงทั้ง 10 ฟอร์มพร้อมกันโดยใช้ k6 scenarios feature
// ทดสอบ queue isolation — ฟอร์มมีไฟล์ไม่ควร block ฟอร์มเบา
//
// VU allocation:
//   ฟอร์มเบา (ไม่มีไฟล์): 50 VU ต่อฟอร์ม
//   ฟอร์มมีไฟล์:          10 VU ต่อฟอร์ม

import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, commonHeaders, MAX_REQUESTS } from '../config.js';

// แบ่ง MAX_REQUESTS ให้แต่ละ scenario สัดส่วนตาม VU weight
// ฟอร์มเบา (50 VU each × 5) = 250 shares, ฟอร์มไฟล์ (10 VU each × 5) = 50 shares → รวม 300
// ถ้าไม่กำหนด MAX_REQUESTS → ใช้ duration ปกติ (undefined = ไม่จำกัด)
const perLightScenario = MAX_REQUESTS ? Math.floor(MAX_REQUESTS * 50 / 300) : undefined;
const perHeavyScenario = MAX_REQUESTS ? Math.floor(MAX_REQUESTS * 10 / 300) : undefined;
import { buildPayload } from '../helpers/mock-data.js';

// ── helper สำหรับแต่ละ form type ──────────────────────────────────────────

function submitForm(formType) {
  const res = http.post(
    `${BASE_URL}/submit/${formType}`,
    buildPayload(formType, __VU, __ITER),
    { headers: commonHeaders, timeout: '30s' }
  );
  check(res, {
    [`${formType} status 200`]: (r) => r.status === 200,
    [`${formType} ok`]: (r) => {
      try { return JSON.parse(r.body).ok === true; } catch { return false; }
    },
  });
}

// export แยกต่อฟอร์ม — k6 scenarios ใช้ exec: 'submitContact' เป็นต้น
export function submitContact()           { submitForm('contact');           sleep(0.5); }
export function submitNewsletter()        { submitForm('newsletter');        sleep(0.5); }
export function submitFeedback()          { submitForm('feedback');          sleep(0.5); }
export function submitEventRegistration() { submitForm('event-registration'); sleep(0.5); }
export function submitProductInquiry()    { submitForm('product-inquiry');   sleep(0.5); }
export function submitJobApplication()    { submitForm('job-application');   sleep(1);   }
export function submitComplaint()         { submitForm('complaint');         sleep(1);   }
export function submitWarrantyClaim()     { submitForm('warranty-claim');    sleep(1);   }
export function submitPartnership()       { submitForm('partnership');       sleep(2);   }
export function submitIncidentReport()    { submitForm('incident-report');   sleep(1);   }

// ── k6 scenarios config ───────────────────────────────────────────────────

export const options = {
  scenarios: {
    // ฟอร์มเบา — VU สูง
    contact: {
      executor: perLightScenario ? 'per-vu-iterations' : 'constant-vus',
      exec: 'submitContact',
      vus: 50,
      iterations: perLightScenario,
      duration: perLightScenario ? undefined : '5m',
    },
    newsletter: {
      executor: perLightScenario ? 'per-vu-iterations' : 'constant-vus',
      exec: 'submitNewsletter',
      vus: 50,
      iterations: perLightScenario,
      duration: perLightScenario ? undefined : '5m',
    },
    feedback: {
      executor: perLightScenario ? 'per-vu-iterations' : 'constant-vus',
      exec: 'submitFeedback',
      vus: 50,
      iterations: perLightScenario,
      duration: perLightScenario ? undefined : '5m',
    },
    'event-registration': {
      executor: perLightScenario ? 'per-vu-iterations' : 'constant-vus',
      exec: 'submitEventRegistration',
      vus: 50,
      iterations: perLightScenario,
      duration: perLightScenario ? undefined : '5m',
    },
    'product-inquiry': {
      executor: perLightScenario ? 'per-vu-iterations' : 'constant-vus',
      exec: 'submitProductInquiry',
      vus: 50,
      iterations: perLightScenario,
      duration: perLightScenario ? undefined : '5m',
    },
    // ฟอร์มมีไฟล์ — VU น้อย เพราะ payload ใหญ่กว่า
    'job-application': {
      executor: perHeavyScenario ? 'per-vu-iterations' : 'constant-vus',
      exec: 'submitJobApplication',
      vus: 10,
      iterations: perHeavyScenario,
      duration: perHeavyScenario ? undefined : '5m',
    },
    complaint: {
      executor: perHeavyScenario ? 'per-vu-iterations' : 'constant-vus',
      exec: 'submitComplaint',
      vus: 10,
      iterations: perHeavyScenario,
      duration: perHeavyScenario ? undefined : '5m',
    },
    'warranty-claim': {
      executor: perHeavyScenario ? 'per-vu-iterations' : 'constant-vus',
      exec: 'submitWarrantyClaim',
      vus: 10,
      iterations: perHeavyScenario,
      duration: perHeavyScenario ? undefined : '5m',
    },
    partnership: {
      executor: perHeavyScenario ? 'per-vu-iterations' : 'constant-vus',
      exec: 'submitPartnership',
      vus: 10,
      iterations: perHeavyScenario,
      duration: perHeavyScenario ? undefined : '5m',
    },
    'incident-report': {
      executor: perHeavyScenario ? 'per-vu-iterations' : 'constant-vus',
      exec: 'submitIncidentReport',
      vus: 10,
      iterations: perHeavyScenario,
      duration: perHeavyScenario ? undefined : '5m',
    },
  },
  thresholds: {
    // ฟอร์มเบาต้องไม่ช้าเพราะฟอร์มมีไฟล์ทำงานพร้อมกัน (queue isolation)
    'http_req_duration{scenario:contact}':     ['p(95)<500'],
    'http_req_duration{scenario:newsletter}':  ['p(95)<500'],
    'http_req_duration{scenario:feedback}':    ['p(95)<500'],
    // ฟอร์มมีไฟล์ — ยอมช้ากว่า
    'http_req_duration{scenario:job-application}': ['p(95)<3000'],
    'http_req_duration{scenario:complaint}':        ['p(95)<3000'],
    'http_req_duration{scenario:warranty-claim}':   ['p(95)<3000'],
    'http_req_duration{scenario:partnership}':      ['p(95)<3000'],
    'http_req_duration{scenario:incident-report}':  ['p(95)<3000'],
    // overall error rate
    http_req_failed: ['rate<0.01'],
  },
};

// default function ไม่ถูกใช้เมื่อมี scenarios config
// แต่ k6 ต้องการ export อย่างน้อยหนึ่ง function
export default function () {}
