import type { FormConfig, FormType, QueueStageConfig } from './types';

// ===== ฟิลด์พื้นฐานที่ทุกฟอร์มมี =====
const BASE_FIELDS = [
  { name: 'fullName', label: 'ชื่อ-นามสกุล', type: 'text' as const, required: true, placeholder: 'กรอกชื่อ-นามสกุล' },
  { name: 'email', label: 'อีเมล', type: 'email' as const, required: true, placeholder: 'example@email.com' },
  { name: 'phone', label: 'เบอร์โทรศัพท์', type: 'tel' as const, required: true, placeholder: '0812345678' },
];

// ===== Queue config templates =====
// ฟอร์มที่มีไฟล์ใหญ่ → batch เล็ก, timeout นาน, concurrency น้อย
// ฟอร์มข้อมูลเบา volume สูง → batch ใหญ่, timeout สั้น, concurrency มาก

const LIGHT_INTAKE: QueueStageConfig   = { maxBatchSize: 100, maxBatchTimeout: 5,  maxConcurrency: 10, maxRetries: 3 };
const LIGHT_DISPATCH: QueueStageConfig = { maxBatchSize: 50,  maxBatchTimeout: 10, maxConcurrency: 5,  maxRetries: 3 };

const MEDIUM_INTAKE: QueueStageConfig   = { maxBatchSize: 30,  maxBatchTimeout: 10, maxConcurrency: 5,  maxRetries: 3 };

const HEAVY_INTAKE: QueueStageConfig   = { maxBatchSize: 10, maxBatchTimeout: 10, maxConcurrency: 3, maxRetries: 3 };
const HEAVY_DISPATCH: QueueStageConfig = { maxBatchSize: 5,  maxBatchTimeout: 20, maxConcurrency: 2, maxRetries: 5 };

const BULK_INTAKE: QueueStageConfig   = { maxBatchSize: 500, maxBatchTimeout: 3,  maxConcurrency: 20, maxRetries: 3 };
const BULK_DISPATCH: QueueStageConfig = { maxBatchSize: 200, maxBatchTimeout: 5,  maxConcurrency: 10, maxRetries: 3 };

// ===== Form configs =====

export const FORMS_CONFIG: Record<FormType, FormConfig> = {
  // ─── 1. Contact — ข้อมูลเบา volume ปานกลาง ───────────────────────────────
  contact: {
    type: 'contact',
    title: 'ติดต่อทั่วไป',
    description: 'ส่งข้อความหาเรา เราจะตอบกลับภายใน 1-2 วันทำการ',
    hasFileUpload: false,
    queue: {
      intakeBinding: 'INTAKE_CONTACT',
      dispatchBinding: 'DISPATCH_CONTACT',
      intakeConfig: LIGHT_INTAKE,
      dispatchConfig: LIGHT_DISPATCH,
    },
    fields: [
      ...BASE_FIELDS,
      { name: 'subject', label: 'หัวข้อ', type: 'text' as const, required: true, placeholder: 'ระบุหัวข้อที่ต้องการติดต่อ' },
      { name: 'message', label: 'ข้อความ', type: 'textarea' as const, required: true, rows: 5, placeholder: 'รายละเอียด...' },
    ],
  },

  // ─── 2. Job-application — มีไฟล์ PDF ใหญ่ batch เล็ก ────────────────────
  'job-application': {
    type: 'job-application',
    title: 'สมัครงาน',
    description: 'กรอกข้อมูลและแนบเรซูเม่เพื่อสมัครงาน',
    hasFileUpload: true,
    queue: {
      intakeBinding: 'INTAKE_JOB_APPLICATION',
      dispatchBinding: 'DISPATCH_JOB_APPLICATION',
      intakeConfig: { maxBatchSize: 20, maxBatchTimeout: 10, maxConcurrency: 5, maxRetries: 3 },
      dispatchConfig: { maxBatchSize: 10, maxBatchTimeout: 15, maxConcurrency: 3, maxRetries: 5 },
    },
    fields: [
      ...BASE_FIELDS,
      { name: 'position', label: 'ตำแหน่งที่สมัคร', type: 'text' as const, required: true, placeholder: 'เช่น Software Engineer' },
      { name: 'experience', label: 'ประสบการณ์ทำงาน (ปี)', type: 'number' as const, required: true, min: 0, max: 50 },
      { name: 'resume', label: 'เรซูเม่ (PDF)', type: 'file' as const, required: true, accept: '.pdf', multiple: false, maxFiles: 1, maxSizeMB: 5 },
    ],
  },

  // ─── 3. Complaint — มีรูป 1-3 ไฟล์ medium ───────────────────────────────
  complaint: {
    type: 'complaint',
    title: 'ร้องเรียน',
    description: 'แจ้งปัญหาหรือร้องเรียนพร้อมแนบรูปหลักฐาน',
    hasFileUpload: true,
    queue: {
      intakeBinding: 'INTAKE_COMPLAINT',
      dispatchBinding: 'DISPATCH_COMPLAINT',
      intakeConfig: MEDIUM_INTAKE,
      dispatchConfig: { maxBatchSize: 10, maxBatchTimeout: 20, maxConcurrency: 3, maxRetries: 3 },
    },
    fields: [
      ...BASE_FIELDS,
      { name: 'category', label: 'ประเภทการร้องเรียน', type: 'select' as const, required: true, options: ['สินค้าชำรุด', 'บริการไม่ดี', 'การจัดส่งล่าช้า', 'พนักงานไม่สุภาพ', 'อื่นๆ'] },
      { name: 'description', label: 'รายละเอียดการร้องเรียน', type: 'textarea' as const, required: true, rows: 5, placeholder: 'อธิบายปัญหาที่พบ...' },
      { name: 'photos', label: 'รูปหลักฐาน (1–3 รูป)', type: 'file' as const, required: false, accept: 'image/jpeg,image/png,image/webp', multiple: true, maxFiles: 3, maxSizeMB: 5 },
    ],
  },

  // ─── 4. Event-registration — burst เป็น batch ใหญ่ช่วงอีเวนต์ ──────────
  'event-registration': {
    type: 'event-registration',
    title: 'ลงทะเบียนอีเวนต์',
    description: 'ลงทะเบียนเข้าร่วมงานอีเวนต์',
    hasFileUpload: false,
    queue: {
      intakeBinding: 'INTAKE_EVENT_REGISTRATION',
      dispatchBinding: 'DISPATCH_EVENT_REGISTRATION',
      intakeConfig: { maxBatchSize: 200, maxBatchTimeout: 5, maxConcurrency: 15, maxRetries: 3 },
      dispatchConfig: { maxBatchSize: 100, maxBatchTimeout: 10, maxConcurrency: 8, maxRetries: 3 },
    },
    fields: [
      ...BASE_FIELDS,
      { name: 'eventId', label: 'อีเวนต์', type: 'select' as const, required: true, options: ['EVT-2026-001: Annual Conference', 'EVT-2026-002: Tech Workshop', 'EVT-2026-003: Networking Night'] },
      { name: 'dietaryRequirement', label: 'ข้อจำกัดด้านอาหาร', type: 'select' as const, required: false, options: ['ไม่มี', 'มังสวิรัติ', 'วีแกน', 'ฮาลาล', 'โคเชอร์', 'แพ้อาหารทะเล'] },
      { name: 'tshirtSize', label: 'ขนาดเสื้อ', type: 'select' as const, required: true, options: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] },
    ],
  },

  // ─── 5. Product-inquiry — ข้อมูลเบา เหมือน contact ─────────────────────
  'product-inquiry': {
    type: 'product-inquiry',
    title: 'สอบถามสินค้า',
    description: 'สอบถามข้อมูลและราคาสินค้า',
    hasFileUpload: false,
    queue: {
      intakeBinding: 'INTAKE_PRODUCT_INQUIRY',
      dispatchBinding: 'DISPATCH_PRODUCT_INQUIRY',
      intakeConfig: LIGHT_INTAKE,
      dispatchConfig: LIGHT_DISPATCH,
    },
    fields: [
      ...BASE_FIELDS,
      { name: 'productCode', label: 'รหัสสินค้า', type: 'text' as const, required: true, placeholder: 'เช่น PRD-00123' },
      { name: 'quantity', label: 'จำนวนที่ต้องการ', type: 'number' as const, required: true, min: 1, max: 99999 },
      { name: 'message', label: 'รายละเอียดเพิ่มเติม', type: 'textarea' as const, required: false, rows: 3, placeholder: 'คำถามหรือข้อสงสัย...' },
    ],
  },

  // ─── 6. Warranty-claim — มีไฟล์ 1 ไฟล์ SLA สำคัญ retry มากขึ้น ─────────
  'warranty-claim': {
    type: 'warranty-claim',
    title: 'เคลมประกัน',
    description: 'ยื่นคำขอเคลมสินค้าภายในระยะประกัน',
    hasFileUpload: true,
    queue: {
      intakeBinding: 'INTAKE_WARRANTY_CLAIM',
      dispatchBinding: 'DISPATCH_WARRANTY_CLAIM',
      intakeConfig: MEDIUM_INTAKE,
      dispatchConfig: { maxBatchSize: 15, maxBatchTimeout: 15, maxConcurrency: 3, maxRetries: 5 },
    },
    fields: [
      ...BASE_FIELDS,
      { name: 'serialNumber', label: 'หมายเลขซีเรียล', type: 'text' as const, required: true, placeholder: 'เช่น SN-2024-XXXXXXXX' },
      { name: 'issue', label: 'ปัญหาที่พบ', type: 'textarea' as const, required: true, rows: 4, placeholder: 'อธิบายอาการหรือปัญหาที่พบ...' },
      { name: 'receipt', label: 'ใบเสร็จ/ใบรับประกัน (รูปหรือ PDF)', type: 'file' as const, required: true, accept: 'image/jpeg,image/png,image/webp,.pdf', multiple: false, maxFiles: 1, maxSizeMB: 5 },
    ],
  },

  // ─── 7. Newsletter — volume สูงมาก payload เบามาก batch ใหญ่ ────────────
  newsletter: {
    type: 'newsletter',
    title: 'สมัครรับข่าวสาร',
    description: 'รับข่าวสารและโปรโมชันล่าสุดจากเรา',
    hasFileUpload: false,
    queue: {
      intakeBinding: 'INTAKE_NEWSLETTER',
      dispatchBinding: 'DISPATCH_NEWSLETTER',
      intakeConfig: BULK_INTAKE,
      dispatchConfig: BULK_DISPATCH,
    },
    fields: [
      ...BASE_FIELDS,
      { name: 'interests', label: 'หมวดหมู่ที่สนใจ', type: 'multiselect' as const, required: true, options: ['เทคโนโลยี', 'ธุรกิจ', 'ไลฟ์สไตล์', 'สุขภาพ', 'การเงิน', 'ท่องเที่ยว'] },
      { name: 'frequency', label: 'ความถี่ที่ต้องการรับ', type: 'select' as const, required: true, options: ['ทุกวัน', 'ทุกสัปดาห์', 'ทุกเดือน'] },
    ],
  },

  // ─── 8. Feedback — ข้อมูลเบา ─────────────────────────────────────────────
  feedback: {
    type: 'feedback',
    title: 'แสดงความคิดเห็น',
    description: 'แชร์ประสบการณ์และความคิดเห็นของคุณ',
    hasFileUpload: false,
    queue: {
      intakeBinding: 'INTAKE_FEEDBACK',
      dispatchBinding: 'DISPATCH_FEEDBACK',
      intakeConfig: LIGHT_INTAKE,
      dispatchConfig: LIGHT_DISPATCH,
    },
    fields: [
      ...BASE_FIELDS,
      { name: 'rating', label: 'คะแนนความพึงพอใจ (1–5)', type: 'number' as const, required: true, min: 1, max: 5 },
      { name: 'category', label: 'ด้านที่ต้องการรีวิว', type: 'select' as const, required: true, options: ['สินค้า', 'บริการ', 'เว็บไซต์', 'การจัดส่ง', 'ราคา', 'อื่นๆ'] },
      { name: 'comment', label: 'ความคิดเห็น', type: 'textarea' as const, required: false, rows: 4, placeholder: 'แสดงความคิดเห็นของคุณ...' },
    ],
  },

  // ─── 9. Partnership — มีไฟล์ PDF ใหญ่ volume น้อย priority สูง ──────────
  partnership: {
    type: 'partnership',
    title: 'ขอเป็นพาร์ทเนอร์',
    description: 'ร่วมเป็นพันธมิตรทางธุรกิจกับเรา',
    hasFileUpload: true,
    queue: {
      intakeBinding: 'INTAKE_PARTNERSHIP',
      dispatchBinding: 'DISPATCH_PARTNERSHIP',
      intakeConfig: { maxBatchSize: 10, maxBatchTimeout: 15, maxConcurrency: 3, maxRetries: 3 },
      dispatchConfig: { maxBatchSize: 5,  maxBatchTimeout: 20, maxConcurrency: 2, maxRetries: 5 },
    },
    fields: [
      ...BASE_FIELDS,
      { name: 'companyName', label: 'ชื่อบริษัท/องค์กร', type: 'text' as const, required: true, placeholder: 'ชื่อบริษัทหรือองค์กร' },
      { name: 'businessType', label: 'ประเภทธุรกิจ', type: 'select' as const, required: true, options: ['ค้าปลีก', 'ค้าส่ง', 'การผลิต', 'บริการ', 'เทคโนโลยี', 'การเงิน', 'อื่นๆ'] },
      { name: 'companyProfile', label: 'Company Profile (PDF)', type: 'file' as const, required: true, accept: '.pdf', multiple: false, maxFiles: 1, maxSizeMB: 5 },
    ],
  },

  // ─── 10. Incident-report — รูปหลายไฟล์ใหญ่ batch เล็กมาก retry มาก ─────
  'incident-report': {
    type: 'incident-report',
    title: 'รายงานเหตุการณ์',
    description: 'รายงานเหตุการณ์ผิดปกติพร้อมแนบหลักฐาน',
    hasFileUpload: true,
    queue: {
      intakeBinding: 'INTAKE_INCIDENT_REPORT',
      dispatchBinding: 'DISPATCH_INCIDENT_REPORT',
      intakeConfig: HEAVY_INTAKE,
      dispatchConfig: HEAVY_DISPATCH,
    },
    fields: [
      ...BASE_FIELDS,
      { name: 'location', label: 'สถานที่เกิดเหตุ', type: 'text' as const, required: true, placeholder: 'ระบุสถานที่หรือพื้นที่' },
      { name: 'incidentType', label: 'ประเภทเหตุการณ์', type: 'select' as const, required: true, options: ['อุบัติเหตุ', 'ความปลอดภัย', 'คุณภาพสินค้า', 'สิ่งแวดล้อม', 'อื่นๆ'] },
      { name: 'description', label: 'รายละเอียดเหตุการณ์', type: 'textarea' as const, required: true, rows: 5, placeholder: 'อธิบายเหตุการณ์ที่เกิดขึ้นโดยละเอียด...' },
      { name: 'evidence', label: 'รูปหลักฐาน (สูงสุด 5 รูป)', type: 'file' as const, required: false, accept: 'image/jpeg,image/png,image/webp', multiple: true, maxFiles: 5, maxSizeMB: 5 },
    ],
  },
};

export const FORM_TYPES: FormType[] = Object.keys(FORMS_CONFIG) as FormType[];

export function getFormConfig(type: string): FormConfig | null {
  return FORMS_CONFIG[type as FormType] ?? null;
}

export function isValidFormType(type: string): type is FormType {
  return type in FORMS_CONFIG;
}
