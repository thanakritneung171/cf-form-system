# Worker 1 — Intake (`worker1-intake`)

**Local URL:** `http://localhost:8787`
**Production URL:** `https://worker1-intake.<subdomain>.workers.dev`

---

## ภาพรวม

Worker หลักของระบบ ทำหน้าที่ 3 อย่าง:
1. **รับฟอร์ม** จากผู้ใช้ (Public Form API) — Mistral AI-inspired warm design
2. **Admin Dashboard** สำหรับ admin จัดการ submissions, users, webhooks — warm palette + clickable stat cards + refresh bar
3. **Queue Consumer** สำหรับ intake queues และ webhook queue

---

## Public Routes (ไม่ต้อง Auth)

### GET `/`
แสดงหน้า index พร้อมฟอร์มทั้ง 10 แบบ — แบ่ง 4 หมวดหมู่:
- **ติดต่อ & สนับสนุน:** contact, complaint, feedback, incident-report
- **สมัครงาน & พาร์ทเนอร์:** job-application, partnership
- **สินค้า & บริการ:** product-inquiry, warranty-claim
- **กิจกรรม & ข่าวสาร:** event-registration, newsletter

แต่ละฟอร์มแสดง Feather-style SVG icon + description + badge "แนบไฟล์ได้" ถ้ามี file upload  
มีช่อง search สำหรับกรองฟอร์มแบบ real-time

### GET `/form/:type`
แสดงหน้าฟอร์ม HTML สำหรับแต่ละประเภท (Mistral warm design) — render ตรงโดยไม่มีการจัดคิว

| Form Type | คำอธิบาย | มีไฟล์แนบ |
|-----------|----------|-----------|
| `contact` | ติดต่อทั่วไป | ✗ |
| `job-application` | สมัครงาน | ✓ PDF 1 ไฟล์ |
| `complaint` | ร้องเรียน | ✓ รูป 1-3 ไฟล์ |
| `event-registration` | ลงทะเบียนอีเวนต์ | ✗ |
| `product-inquiry` | สอบถามสินค้า | ✗ |
| `warranty-claim` | เคลมประกัน | ✓ รูป/PDF 1 ไฟล์ |
| `newsletter` | สมัครรับข่าวสาร | ✗ |
| `feedback` | แสดงความคิดเห็น | ✗ |
| `partnership` | ขอเป็นพาร์ทเนอร์ | ✓ PDF 1 ไฟล์ |
| `incident-report` | รายงานเหตุการณ์ | ✓ รูปสูงสุด 5 ไฟล์ |

### POST `/submit/:type`
รับข้อมูลฟอร์ม `multipart/form-data` และอัปโหลดไฟล์ขึ้น R2

**Request:** `Content-Type: multipart/form-data`

**Response 200:**
```json
{ "ok": true, "submission_id": "uuid" }
```

**Response 422:**
```json
{
  "ok": false,
  "errors": [{ "field": "email", "message": "รูปแบบอีเมลไม่ถูกต้อง" }]
}
```

**Response 400:**
```json
{ "ok": false, "error": "form type ไม่ถูกต้อง" }
```

**File validation rules:**
- รวมทุก field ไม่เกิน 5 ไฟล์
- ขนาดไม่เกิน 5 MB ต่อไฟล์ (ตาม config ของแต่ละ form)
- MIME type ต้องตรงตาม field config (PDF / image/*)

**Flow หลังรับ submit:**
```
validate text → validate files → upload R2 → ส่งเข้า intake-{type} queue → return { ok: true }
```

### GET `/style.css`
ไฟล์ CSS สำหรับหน้าฟอร์ม (minified inline CSS)

---

## Admin Auth Routes

### GET `/admin/login`
แสดงหน้า Login — ออกแบบด้วย Mistral-style large typography (56px uppercase title), gradient identity bar, warm cream background  
Query params: `?error=...` `?next=...`

### POST `/admin/login`
**Content-Type:** `application/form-data`

| Field | คำอธิบาย |
|-------|----------|
| `username` | ชื่อผู้ใช้ |
| `password` | รหัสผ่าน |
| `next` | URL redirect หลัง login สำเร็จ (ต้องขึ้นต้นด้วย `/admin`) |

**Security:**
- Rate limit: 5 ครั้งต่อ IP ใน 10 นาที → 429
- Password: PBKDF2-SHA256, 100,000 iterations
- Session cookie: `admin_session` HttpOnly Secure SameSite=Strict (8 ชั่วโมง)

### POST `/admin/logout`
ลบ session จาก D1 และ clear cookie → redirect ไป `/admin/login`

---

## Admin Dashboard Routes (ต้อง Login)

> ทุก route ใน `/admin/*` ต้องมี cookie `admin_session` ที่ valid

### GET `/admin/submissions`
แสดง submissions ที่มี status: `pending`, `dispatching`, `failed`

**UI Features:**
- Page header พร้อม title + subtitle (จำนวนรายการทั้งหมด)
- Stat cards 4 ใบ (รอดำเนินการ/กำลังส่ง/วันนี้ทั้งหมด/ล้มเหลว) — แต่ละใบคลิกเพื่อ filter ตาม status ได้
- Stat cards มี accent bar สีตาม Mistral warm palette
- Auto-refresh ด้วย JavaScript refresh bar (ทุก 10 วินาที) แทน `<meta http-equiv="refresh">`
- Form type badge ใช้สี warm cream (`#fff0c2`) + amber border

**Query params:**

| Param | คำอธิบาย |
|-------|----------|
| `form_type` | filter ตาม form type |
| `status` | filter ตาม status |
| `from` | วันที่เริ่มต้น (yyyy-mm-dd) |
| `to` | วันที่สิ้นสุด (yyyy-mm-dd) |
| `q` | ค้นหาใน data (fulltext LIKE) |
| `page` | หน้า (default: 1, 50 รายการ/หน้า) |

### GET `/admin/dispatched`
แสดง submissions ที่มี status: `complete`, `failed`

**UI Features:**
- Page header + subtitle (จำนวนรายการ)
- Stat cards 4 ใบ (สำเร็จ/ล้มเหลว/Success Rate/Avg Dispatch Time) — คลิกได้
- Refresh bar + Export CSV พร้อม confirmation dialog

**Query params:** `form_type`, `status`, `from`, `to`, `page`

### GET `/admin/submissions/:id`
ดูรายละเอียด submission (ข้อมูล + ไฟล์แนบ)

### GET `/admin/files/:id`
ดาวน์โหลดไฟล์แนบ (stream จาก R2 ผ่าน auth เสมอ)

### GET `/admin/queues`
ดู queue statistics จาก D1 (24 ชั่วโมงล่าสุด) แยกตาม form type

**UI Features:**
- Page header + subtitle
- Stat cards (รอดำเนินการ/กำลังส่ง/สำเร็จ/ล้มเหลว) พร้อม accent bar
- Custom date range filter (datetime-local)
- Refresh bar (auto-refresh ทุก 30 วินาที เมื่อไม่ได้ตั้ง custom range)
- แถวที่มี problem (failed > 0 หรือ pending > 500) highlight ด้วย warm yellow background

| Column | คำอธิบาย |
|--------|----------|
| pending | submissions รอ dispatch |
| dispatching | กำลัง dispatch |
| complete_24h | สำเร็จใน 24h |
| failed_24h | ล้มเหลวใน 24h |
| avg_duration_s | เวลาเฉลี่ย (วินาที) |

---

## Admin API (JSON)

### GET `/admin/api/stats`
ต้อง login — คืน JSON จำนวน submissions แยกตาม status

**Response:**
```json
{
  "pending": 10,
  "dispatching": 5,
  "complete": 1000,
  "failed": 3
}
```

---

## Admin Actions (ต้อง role: admin หรือ operator)

### POST `/admin/bulk-retry`
Retry submissions ที่ failed หรือ complete → reset กลับเป็น `pending`

**Content-Type: application/json**
```json
{ "ids": ["uuid1", "uuid2"] }
```

**Content-Type: multipart/form-data**
```
ids=uuid1&ids=uuid2
```

**Response (JSON):**
```json
{ "ok": true, "retried": 2 }
```

### GET `/admin/export/submissions.csv`
Export CSV ของ submissions (pending/dispatching/failed)
Query params: `form_type`, `from`, `to`

### GET `/admin/export/dispatched.csv`
Export CSV ของ dispatched submissions (complete/failed)
Query params: `form_type`, `from`, `to`

---

## Admin Profile

### GET `/admin/profile`
ดูหน้าโปรไฟล์ตัวเอง

### POST `/admin/profile/password`
เปลี่ยนรหัสผ่าน (CSRF protected)

| Field | คำอธิบาย |
|-------|----------|
| `_csrf` | CSRF token |
| `current_password` | รหัสผ่านเดิม |
| `new_password` | รหัสผ่านใหม่ (≥8 ตัว) |
| `confirm_password` | ยืนยันรหัสผ่านใหม่ |

หลังเปลี่ยน password สำเร็จ → ลบ sessions ทั้งหมดของ user (force re-login)

---

## Admin Users (ต้อง role: admin เท่านั้น)

### GET `/admin/users`
รายการ users ทั้งหมด

### GET `/admin/users/new`
แสดง form สร้าง user ใหม่

### POST `/admin/users/new`
สร้าง user ใหม่ (CSRF protected)

| Field | คำอธิบาย |
|-------|----------|
| `_csrf` | CSRF token |
| `username` | ชื่อผู้ใช้ (unique) |
| `email` | อีเมล (unique) |
| `password` | รหัสผ่าน (≥8 ตัว) |
| `role` | `admin` / `operator` / `viewer` |

### GET `/admin/users/:id/edit`
แสดง form แก้ไข user

### POST `/admin/users/:id/edit` หรือ POST `/admin/users/:id`
อัปเดตข้อมูล user (CSRF protected)

| Field | คำอธิบาย |
|-------|----------|
| `_csrf` | CSRF token |
| `email` | อีเมล |
| `role` | role ใหม่ |
| `is_active` | `1` = active, `0` = inactive |
| `password` | รหัสผ่านใหม่ (ถ้าต้องการเปลี่ยน) |

### POST `/admin/users/:id/delete`
ปิดการใช้งาน user (set `is_active=0`) + ลบ sessions ทั้งหมด

---

## Admin Webhooks (ต้อง role: admin เท่านั้น)

### GET `/admin/webhooks`
รายการ webhooks ทั้งหมด + จำนวน delivery

### GET `/admin/webhooks/new`
แสดง form สร้าง webhook ใหม่

### POST `/admin/webhooks/new`
สร้าง webhook (CSRF protected)

| Field | คำอธิบาย |
|-------|----------|
| `_csrf` | CSRF token |
| `name` | ชื่อ webhook |
| `url` | URL ปลายทาง |
| `events` | array: `submission.created`, `submission.completed`, `submission.failed` |
| `form_types` | array form types ที่ต้องการรับ (ถ้าว่าง = รับทุก type) |

หลังสร้าง webhook secret จะแสดง **1 ครั้ง** เท่านั้น

### GET `/admin/webhooks/:id`
ดูรายละเอียด webhook + delivery log ล่าสุด 50 รายการ

### POST `/admin/webhooks/:id/toggle`
เปิด/ปิด webhook

### POST `/admin/webhooks/:id/delete`
ลบ webhook

### POST `/admin/webhooks/:id/test`
ส่ง test event `submission.created` ไปยัง webhook URL พร้อม HMAC signature

---

## Queue Consumers (Internal — ไม่ใช่ HTTP)

### `intake-{type}` Queue (10 queues)
รับ `IntakeMessage` จาก queue → INSERT ลง D1 → fire webhook event

```
INSERT OR IGNORE INTO submissions (id, form_type, data, status='pending', ...)
INSERT OR IGNORE INTO submission_files (...)
→ msg.ack()
→ fireWebhookEvent('submission.created', ...)
```

### `webhook-queue` Queue
รับ `WebhookMessage` → POST ไปยัง webhook URL พร้อม HMAC-SHA256 signature

```
Headers:
  Content-Type: application/json
  X-Webhook-Event: submission.created | submission.completed | submission.failed
  X-Webhook-Signature: sha256=<hmac>
  X-Webhook-Delivery: del_xxxxxxxx

Body:
{
  "event": "submission.created",
  "timestamp": 1712345678000,
  "data": {
    "submission_id": "uuid",
    "form_type": "contact",
    "status": "pending",
    "submitted_at": 1712345678000,
    "summary": { "email": "...", "full_name": "..." }
  }
}
```

Retry policy: 2xx = ack, 5xx = retry (10s/60s/300s), 4xx = fail (ไม่ retry)

---

## Scheduled (ทุก 1 ชั่วโมง)

ลบ sessions ที่หมดอายุ + ลบ login_attempts เก่า (> 20 นาที) ออกจาก D1

---

## Security

| Feature | รายละเอียด |
|---------|-----------|
| Password Hashing | PBKDF2-SHA256, 100,000 iterations, random 32-byte salt |
| Session | 64-char hex token, HttpOnly Secure SameSite=Strict, 8h |
| CSRF | HMAC-SHA256(sessionId + hourlyTimestamp) หมุนทุก 1h |
| Rate Limit Login | 5 ครั้ง / 10 นาที / IP → 429 |
| File Access | ทุก download ผ่าน auth — ไม่ expose R2 URL ตรง |
| Webhook Signature | HMAC-SHA256(body, secret) → `X-Webhook-Signature: sha256=...` |

---

## Bindings

| Binding | ประเภท | คำอธิบาย |
|---------|--------|----------|
| `DB` | D1 | ฐานข้อมูล submissions, users, webhooks |
| `UPLOADS` | R2 | เก็บไฟล์แนบ |
| `SESSION_SECRET` | Secret | HMAC key สำหรับ session + CSRF |
| `LOAD_TEST_TOKEN` | Secret | Token สำหรับ tag load test traffic |
| `INTAKE_*` | Queue Producer | 10 queues แยกตาม form type |
| `WEBHOOK_QUEUE` | Queue Producer | webhook queue |
