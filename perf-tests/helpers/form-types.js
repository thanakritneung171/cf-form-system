// form-types.js — รายชื่อฟอร์มและ field สำหรับ file upload
// แปลงมาจาก shared/src/forms-config.ts

// ฟอร์มทั้ง 10 ประเภท (ตรงกับ FormType ใน shared/types)
export const FORM_TYPES = [
  'contact',
  'job-application',
  'complaint',
  'event-registration',
  'product-inquiry',
  'warranty-claim',
  'newsletter',
  'feedback',
  'partnership',
  'incident-report',
];

// map form type → array ของ file field names (เฉพาะฟอร์มที่มีไฟล์)
// ดูจาก forms-config.ts: hasFileUpload: true
export const FORMS_WITH_FILES = {
  'job-application': ['resume'],          // PDF required, max 1
  'complaint':       ['photos'],          // image optional, max 3
  'warranty-claim':  ['receipt'],         // image/PDF required, max 1
  'partnership':     ['companyProfile'],  // PDF required, max 1
  'incident-report': ['evidence'],        // image optional, max 5
};

// ฟอร์มที่ไม่มีไฟล์ — ใช้ใน load test สำหรับ VU สูง
export const LIGHT_FORMS = [
  'contact',
  'newsletter',
  'feedback',
  'event-registration',
  'product-inquiry',
];
