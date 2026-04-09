// mock-data.js — สร้าง payload สำหรับแต่ละ form type
// ใช้ __VU และ __ITER ของ k6 เพื่อให้แต่ละ request มี unique id

import http from 'k6/http';
import { mockFile } from './files.js';

/**
 * สร้าง unique id จาก VU + iteration + timestamp
 * ป้องกัน idempotency key ชน กัน
 */
function makeId(vu, iter) {
  return `${vu}-${iter}-${Date.now()}`;
}

/**
 * สร้าง FormData payload พร้อมส่งให้ http.post()
 * fullName ขึ้นต้นด้วย "LoadTest User" เพื่อให้ cleanup endpoint ลบได้
 *   (worker ค้นหา: json_extract(data, '$.fullName') LIKE 'LoadTest User %')
 *
 * @param {string} formType - form type เช่น 'contact', 'job-application'
 * @param {number} vu - __VU ของ k6
 * @param {number} iter - __ITER ของ k6
 * @returns {Object} - FormData object สำหรับ http.post()
 */
export function buildPayload(formType, vu, iter) {
  const id = makeId(vu, iter);

  // common fields — ทุกฟอร์มมี
  const base = {
    fullName: `LoadTest User ${id}`,
    email: `k6-${id}@perftest.local`,
    phone: '0800000000',
  };

  switch (formType) {
    case 'contact':
      return {
        ...base,
        subject: `Load test subject ${id}`,
        message: `Automated load test message from VU ${vu} iter ${iter}`,
      };

    case 'job-application': {
      // มีไฟล์ resume (PDF required) — ใช้ http.file() wrap
      const resume = mockFile('pdf', `resume-${id}.pdf`);
      return {
        ...base,
        position: 'Load Test Engineer',
        experience: '3',
        resume: http.file(resume.data, resume.filename, resume.contentType),
      };
    }

    case 'complaint': {
      // photos optional แต่ส่ง 1 ไฟล์เพื่อ test path นี้
      const photo = mockFile('png', `photo-${id}.png`);
      return {
        ...base,
        category: 'สินค้าชำรุด',
        description: `Load test complaint description ${id}`,
        photos: http.file(photo.data, photo.filename, photo.contentType),
      };
    }

    case 'event-registration':
      return {
        ...base,
        eventId: 'EVT-2026-001: Annual Conference',
        dietaryRequirement: 'ไม่มี',
        tshirtSize: 'M',
      };

    case 'product-inquiry':
      return {
        ...base,
        productCode: `PRD-${String(vu).padStart(5, '0')}`,
        quantity: '10',
        message: `Load test inquiry ${id}`,
      };

    case 'warranty-claim': {
      // receipt required (image หรือ PDF)
      const receipt = mockFile('pdf', `receipt-${id}.pdf`);
      return {
        ...base,
        serialNumber: `SN-2024-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`,
        issue: `Load test warranty issue ${id}`,
        receipt: http.file(receipt.data, receipt.filename, receipt.contentType),
      };
    }

    case 'newsletter':
      // multiselect — k6 FormData ส่ง array ด้วยการใช้ key ซ้ำ
      // แต่ k6 http.post() กับ plain object ไม่รองรับ array โดยตรง
      // ใช้ workaround: ส่งเป็น string แล้วให้ worker parse (หรือส่งซ้ำ key)
      // k6 รองรับ FormData array ผ่าน object ที่มี key เดียวกันหลายค่าโดยใช้ Array
      return {
        ...base,
        // interests เป็น multiselect — k6 จะส่งเป็น field ซ้ำถ้าเป็น array
        'interests': ['เทคโนโลยี', 'ธุรกิจ'],
        frequency: 'ทุกสัปดาห์',
      };

    case 'feedback':
      return {
        ...base,
        rating: '4',
        category: 'บริการ',
        comment: `Load test feedback comment ${id}`,
      };

    case 'partnership': {
      // companyProfile PDF required
      const profile = mockFile('pdf', `profile-${id}.pdf`);
      return {
        ...base,
        companyName: `LoadTest Corp ${id}`,
        businessType: 'เทคโนโลยี',
        companyProfile: http.file(profile.data, profile.filename, profile.contentType),
      };
    }

    case 'incident-report': {
      // evidence optional — ส่ง 1 ไฟล์เพื่อ test path
      const evidence = mockFile('png', `evidence-${id}.png`);
      return {
        ...base,
        location: `Load Test Location ${vu}`,
        incidentType: 'ความปลอดภัย',
        description: `Load test incident description ${id}`,
        evidence: http.file(evidence.data, evidence.filename, evidence.contentType),
      };
    }

    default:
      // fallback — ส่งแค่ base fields
      return base;
  }
}
