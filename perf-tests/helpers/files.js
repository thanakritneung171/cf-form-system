// files.js — สร้างไฟล์จำลองขนาดเล็กที่สุดสำหรับ k6 multipart upload
// ใช้ binary ขั้นต่ำที่ผ่าน MIME validation ของ worker

/**
 * PDF ขั้นต่ำที่ valid (~68 bytes)
 * header + EOF comment เท่านั้น — browser/worker อ่าน MIME จาก Content-Type header
 * ไม่ใช่ content จริง ดังนั้น validator ฝั่ง server ที่ตรวจ MIME type header จะผ่าน
 */
export function minimalPdf() {
  // %PDF-1.4 minimal valid structure
  const src = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 3 3]>>endobj\nxref\n0 4\n0000000000 65535 f\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n9\n%%EOF';
  const bytes = new Uint8Array(src.length);
  for (let i = 0; i < src.length; i++) {
    bytes[i] = src.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * PNG 1x1 pixel สีแดง (~67 bytes)
 * เป็น valid PNG binary ที่ผ่าน MIME check
 */
export function minimalPng() {
  // PNG signature + IHDR + IDAT + IEND (1x1 red pixel)
  return new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR length + type
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // width=1, height=1
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, // bit depth, color, crc
    0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, // IDAT length + type
    0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00, // compressed pixel data
    0x00, 0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc, // crc
    0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, // IEND length + type
    0x44, 0xae, 0x42, 0x60, 0x82,                   // IEND crc
  ]).buffer;
}

/**
 * สร้าง mock file object สำหรับใช้กับ k6 http.file()
 * @param {'pdf'|'png'} type - ประเภทไฟล์
 * @param {string} filename - ชื่อไฟล์ที่จะส่ง
 * @returns {{ data: Uint8Array, filename: string, contentType: string }}
 */
export function mockFile(type, filename) {
  if (type === 'pdf') {
    return {
      data: minimalPdf(),
      filename: filename || 'mock.pdf',
      contentType: 'application/pdf',
    };
  }
  // default png
  return {
    data: minimalPng(),
    filename: filename || 'mock.png',
    contentType: 'image/png',
  };
}
