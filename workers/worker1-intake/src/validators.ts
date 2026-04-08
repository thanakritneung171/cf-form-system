import type { FormConfig, FieldConfig } from 'shared/types';

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationError[];
}

/** ตรวจ MIME type ว่าเป็นไฟล์ที่อนุญาต */
export function isAllowedMime(contentType: string, accept: string): boolean {
  const allowed = accept.split(',').map(s => s.trim());
  return allowed.some(a => {
    if (a.startsWith('.')) {
      // extension เช่น .pdf → ตรวจว่า contentType เป็น application/pdf
      const extMap: Record<string, string[]> = {
        '.pdf': ['application/pdf'],
        '.jpg': ['image/jpeg'],
        '.jpeg': ['image/jpeg'],
        '.png': ['image/png'],
        '.webp': ['image/webp'],
      };
      return extMap[a]?.includes(contentType) ?? false;
    }
    // glob เช่น image/* หรือ exact เช่น image/jpeg
    if (a.endsWith('/*')) {
      return contentType.startsWith(a.slice(0, -1));
    }
    return contentType === a;
  });
}

/** แปลง field config ไปเป็น validation message */
function validateField(field: FieldConfig, value: string | string[] | undefined): string | null {
  // required check
  if (field.required) {
    if (value === undefined || value === null || value === '') return `กรุณากรอก${field.label}`;
    if (Array.isArray(value) && value.length === 0) return `กรุณาเลือก${field.label}อย่างน้อย 1 รายการ`;
  }
  if (!value || (Array.isArray(value) && value.length === 0)) return null;

  const strVal = Array.isArray(value) ? value[0] : value;

  // email validation
  if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strVal)) {
    return `รูปแบบ${field.label}ไม่ถูกต้อง`;
  }

  // phone validation
  if (field.type === 'tel' && !/^[0-9+\-\s()]{7,20}$/.test(strVal)) {
    return `รูปแบบ${field.label}ไม่ถูกต้อง`;
  }

  // number range validation
  if (field.type === 'number') {
    const num = parseFloat(strVal);
    if (isNaN(num)) return `${field.label}ต้องเป็นตัวเลข`;
    if (field.min !== undefined && num < field.min) return `${field.label}ต้องไม่น้อยกว่า ${field.min}`;
    if (field.max !== undefined && num > field.max) return `${field.label}ต้องไม่เกิน ${field.max}`;
  }

  // select validation
  if ((field.type === 'select' || field.type === 'multiselect') && field.options) {
    const vals = Array.isArray(value) ? value : [value];
    for (const v of vals) {
      if (!field.options.includes(v)) return `${field.label}มีค่าที่ไม่ถูกต้อง`;
    }
  }

  return null;
}

/**
 * ตรวจสอบข้อมูลฟอร์มทั้งหมด (ยกเว้นไฟล์ — ตรวจแยกใน validateFiles)
 */
export function validateFormData(
  config: FormConfig,
  data: Record<string, string | string[]>,
): ValidationResult {
  const errors: ValidationError[] = [];

  for (const field of config.fields) {
    if (field.type === 'file') continue; // ไฟล์ตรวจแยก
    const error = validateField(field, data[field.name]);
    if (error) errors.push({ field: field.name, message: error });
  }

  return { ok: errors.length === 0, errors };
}

export interface FileValidationItem {
  fieldName: string;
  filename: string;
  contentType: string;
  sizeByes: number;
}

/** ตรวจสอบไฟล์ที่ upload */
export function validateFiles(
  config: FormConfig,
  filesByField: Record<string, FileValidationItem[]>,
): ValidationResult {
  const errors: ValidationError[] = [];
  const MAX_TOTAL = 5;
  let totalFiles = 0;

  for (const field of config.fields) {
    if (field.type !== 'file') continue;

    const files = filesByField[field.name] ?? [];
    totalFiles += files.length;

    // required check
    if (field.required && files.length === 0) {
      errors.push({ field: field.name, message: `กรุณาแนบ${field.label}` });
      continue;
    }

    // max files per field
    if (field.maxFiles && files.length > field.maxFiles) {
      errors.push({ field: field.name, message: `${field.label}อนุญาตสูงสุด ${field.maxFiles} ไฟล์` });
    }

    for (const file of files) {
      // MIME type
      if (field.accept && !isAllowedMime(file.contentType, field.accept)) {
        errors.push({ field: field.name, message: `${file.filename}: ประเภทไฟล์ไม่อนุญาต` });
      }

      // ขนาดไฟล์
      const maxBytes = (field.maxSizeMB ?? 5) * 1024 * 1024;
      if (file.sizeByes > maxBytes) {
        errors.push({ field: field.name, message: `${file.filename}: ไฟล์ใหญ่เกิน ${field.maxSizeMB ?? 5} MB` });
      }
    }
  }

  // รวมทุกไฟล์ไม่เกิน 5 ไฟล์
  if (totalFiles > MAX_TOTAL) {
    errors.push({ field: '_files', message: `รวมทุกไฟล์ต้องไม่เกิน ${MAX_TOTAL} ไฟล์` });
  }

  return { ok: errors.length === 0, errors };
}

/** สร้าง R2 key สำหรับไฟล์ */
export function makeR2Key(
  submissionId: string,
  fieldName: string,
  index: number,
  originalFilename: string,
): string {
  const date = new Date().toISOString().slice(0, 10); // yyyy-mm-dd
  const ext = originalFilename.split('.').pop()?.toLowerCase() ?? 'bin';
  return `submissions/${date}/${submissionId}/${fieldName}-${index}.${ext}`;
}

/** escape HTML เพื่อป้องกัน XSS */
export function esc(str: unknown): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
