# CF Form System — คู่มืออธิบายระบบ

## ภาพรวม

ระบบรับฟอร์มออนไลน์บน Cloudflare Workers รองรับ **10 ประเภทฟอร์ม** พร้อมไฟล์แนบ, admin dashboard, และ webhook  
ออกแบบให้รับโหลดสูงได้โดยไม่มีเซิร์ฟเวอร์ (serverless) ทั้งหมดทำงานบน Cloudflare Edge

---

## สถาปัตยกรรมภาพรวม

```
                        ┌─────────────────────────────────────────────────────────┐
                        │                   Cloudflare Edge                       │
                        │                                                         │
User (Browser)          │   Worker 1          Worker 2          Worker 3          │
     │                  │   (Intake)          (Dispatcher)      (External API)    │
     │  POST /submit     │      │                  │                  │            │
     ├─────────────────►│      │                  │                  │            │
     │                  │      │ upload R2         │                  │            │
     │                  │      ├──────────────────►│(R2 Bucket)       │            │
     │                  │      │                  │                  │            │
     │                  │      │ send to queue     │                  │            │
     │                  │      ├──►intake-queue    │                  │            │
     │                  │      │    (consumer)     │                  │            │
     │                  │      │    INSERT D1      │                  │            │
     │  { ok: true }    │      │                  │                  │            │
     │◄─────────────────│      │                  │                  │            │
     │                  │      │            cron(ทุก 1 นาที)         │            │
     │                  │      │         ◄────────┤                  │            │
     │                  │      │                  │ scan pending D1   │            │
     │                  │      │                  ├──►dispatch-queue  │            │
     │                  │      │                  │    (consumer)     │            │
     │                  │      │                  │    POST ──────────►            │
     │                  │      │                  │         200/500/400            │
     │                  │      │                  │ UPDATE D1         │            │
     │                  │      │                  │                  │            │
     │                  └─────────────────────────────────────────────────────────┘
     │
     │  GET /admin/submissions
     ├─────────────────► Worker 1 (Admin Dashboard)
```

---

## 3 Workers และหน้าที่

### Worker 1 — Intake (`worker1-intake`)

**หน้าที่หลัก:** รับฟอร์ม, เก็บไฟล์, Admin Dashboard, ส่ง Webhook

| Route | Method | ทำอะไร |
|-------|--------|---------|
| `/` | GET | หน้าแสดงฟอร์มทั้ง 10 แบบ |
| `/form/:type` | GET | หน้าฟอร์มแต่ละประเภท |
| `/submit/:type` | POST | รับ multipart form + ไฟล์ |
| `/admin/*` | GET/POST | Admin Dashboard |
| `/style.css` | GET | CSS สำหรับหน้าฟอร์ม |

**Queue handler:**
- `intake-*` → บันทึก submission ลง D1
- `webhook-queue` → ส่ง HTTP POST ไปยัง webhook URL

**Scheduled (ทุก 1 ชั่วโมง):**
- ลบ sessions ที่หมดอายุออกจาก D1

---

### Worker 2 — Dispatcher (`worker2-dispatcher`)

**หน้าที่หลัก:** ดึง submission ที่รอ → ส่งไป Worker 3

**Scheduled (ทุก 1 นาที):**
```
1. Recovery: ตรวจ submissions ที่ค้าง 'dispatching' นานกว่า 10 นาที
   - retry_count >= 3 → mark 'failed'
   - retry_count <  3 → reset กลับ 'pending' (นับ retry_count++)

2. Scan pending:
   UPDATE submissions SET status='dispatching'
   WHERE status='pending' LIMIT 1000

3. Group by form_type → chunk 100 IDs/batch → sendBatch ต่อ chunk
   (Cloudflare Queue limit = 100 msg/batch, D1 variable limit = ~100)
   ถ้า sendBatch fail → revert เฉพาะ chunk นั้นกลับ 'pending'
```

**Queue handler (`dispatch-*`):**
```
ดึง submission จาก D1
ดึงไฟล์จาก R2 → แปลงเป็น base64
POST → Worker 3 /api/receive
  200 → UPDATE status='complete'
  5xx → retry (backoff 30/60/300s)
  4xx → UPDATE status='failed'
ยิง webhook event (completed/failed)
```

---

### Worker 3 — External API Mock (`worker3-external-api`)

**หน้าที่:** จำลอง API ปลายทางสำหรับทดสอบ

```
POST /api/receive
  90% → 200 OK    (ประมวลผลสำเร็จ)
   5% → 500 Error (ให้ Worker 2 retry)
   5% → 400 Error (fail ถาวร)
```

ในระบบจริง Worker 3 คือ API ของระบบอื่น เช่น CRM, ERP, Email service

---

## โฟลการทำงานละเอียด

### 1. ผู้ใช้ส่งฟอร์ม

```
[Browser]
    │
    │  POST /submit/contact
    │  Content-Type: multipart/form-data
    │  Body: fullName, email, phone, subject, message
    │
    ▼
[Worker 1 - handleSubmit]
    │
    ├─ validate text fields (ครบ? format ถูก?)
    ├─ validate files (ขนาด? จำนวน? mime type?)
    │
    ├─ upload ไฟล์ขึ้น R2
    │   key: submissions/2026-04-08/{uuid}/resume-0.pdf
    │
    ├─ สร้าง IntakeMessage
    │   { submission_id, form_type, data, files, idempotency_key }
    │
    ├─ env.INTAKE_CONTACT.send(message)  ← เลือก queue ตาม form_type
    │
    └─ return { ok: true, submission_id: "uuid" }
```

### 2. Worker 1 รับ Message จาก Intake Queue

```
[intake-contact queue] → trigger Worker 1 queue handler
    │
    ├─ INSERT OR IGNORE INTO submissions (id, form_type, data, status='pending', ...)
    │   ← OR IGNORE ป้องกัน duplicate จาก idempotency_key
    │
    ├─ INSERT OR IGNORE INTO submission_files (...)
    │   ← บันทึก metadata ไฟล์ที่อยู่ใน R2
    │
    ├─ msg.ack()
    │
    └─ fireWebhookEvent('submission.created', ...)
        → ส่งเข้า webhook-queue
```

### 3. Worker 2 Cron — ส่งไป Dispatch Queue

```
[ทุก 1 นาที - Scheduled Event]
    │
    ├─ [Recovery] ตรวจ 'dispatching' ที่ค้างนานกว่า 10 นาที
    │   ├─ retry_count >= 3 → UPDATE status='failed'
    │   └─ retry_count <  3 → UPDATE status='pending', retry_count++
    │
    ├─ UPDATE submissions SET status='dispatching'
    │  WHERE status='pending' LIMIT 1000
    │  RETURNING id, form_type
    │
    ├─ group by form_type
    │   { contact: [id1..id161], newsletter: [id3, ...] }
    │
    ├─ chunk ทีละ 100 แล้ว sendBatch ต่อ chunk:
    │   contact  chunk1 → DISPATCH_CONTACT.sendBatch([100 messages])
    │   contact  chunk2 → DISPATCH_CONTACT.sendBatch([ 61 messages])
    │   newsletter ...  → DISPATCH_NEWSLETTER.sendBatch([...])
    │
    └─ ถ้า sendBatch fail → revert เฉพาะ chunk นั้น → status='pending'
        (ไม่กระทบ chunk ที่ส่งสำเร็จแล้ว)
```

### 4. Worker 2 รับ Message จาก Dispatch Queue

```
[dispatch-contact queue] → trigger Worker 2 queue handler
    │
    ├─ SELECT * FROM submissions WHERE id=?
    ├─ SELECT * FROM submission_files WHERE submission_id=?
    │
    ├─ ดึงไฟล์จาก R2
    │   env.UPLOADS.get(file.r2_key)
    │   → แปลงเป็น base64
    │
    ├─ POST → Worker 3 /api/receive
    │   body: { submission_id, form_type, data, files: [{base64}] }
    │   timeout: 30 วินาที
    │
    ├─ 200 OK:
    │   UPDATE status='complete'
    │   msg.ack()
    │   fireWebhookEvent('submission.completed')
    │
    ├─ 5xx Error:
    │   UPDATE retry_count++, last_error
    │   msg.retry({ delaySeconds: 30/60/300 })  ← exponential backoff
    │
    └─ 4xx Error:
        UPDATE status='failed'
        msg.ack()
        fireWebhookEvent('submission.failed')
```

### 5. Webhook Flow

```
[webhook-queue] → trigger Worker 1 queue handler
    │
    ├─ SELECT webhook จาก D1 (is_active=1)
    ├─ ตรวจ events filter (subscription.created? completed? failed?)
    ├─ ตรวจ form_types filter (เฉพาะบาง form type?)
    │
    ├─ สร้าง payload JSON
    │   { event, timestamp, data: { submission_id, form_type, status, summary } }
    │
    ├─ สร้าง HMAC-SHA256 signature
    │   X-Webhook-Signature: sha256=<hex>
    │
    ├─ POST → webhook URL
    │   timeout: 10 วินาที
    │
    ├─ 2xx → UPDATE webhook_deliveries status='success'
    ├─ 5xx → retry (backoff 10/60/300s)
    └─ 4xx → UPDATE status='failed' (ไม่ retry)
```

---

## Queue Architecture

### ทำไม 42 Queues?

```
10 form types × (intake + intake-dlq + dispatch + dispatch-dlq) = 40
+ webhook-queue + webhook-dlq                                   =  2
                                                               ─────
                                                                 42
```

### แต่ละ Queue มี Config ต่างกัน

```
┌────────────────────┬──────────────┬────────────────┬─────────────────────────────────┐
│ Form Type          │ Intake Batch │ Dispatch Batch │ เหตุผล                          │
├────────────────────┼──────────────┼────────────────┼─────────────────────────────────┤
│ newsletter         │ 500 / 20 cc  │ 200 / 10 cc    │ payload เบา volume สูงมาก       │
│ event-registration │ 200 / 15 cc  │ 100 /  8 cc    │ burst ช่วงอีเวนต์               │
│ contact            │ 100 / 10 cc  │  50 /  5 cc    │ ทั่วไป                          │
│ feedback           │ 100 / 10 cc  │  50 /  5 cc    │ ทั่วไป                          │
│ product-inquiry    │ 100 / 10 cc  │  50 /  5 cc    │ ทั่วไป                          │
│ complaint          │  30 /  5 cc  │  10 /  3 cc    │ มีรูปภาพ                        │
│ warranty-claim     │  30 /  5 cc  │  15 /  3 cc    │ มีไฟล์ + SLA สูง                │
│ job-application    │  20 /  5 cc  │  10 /  3 cc    │ PDF ใหญ่                        │
│ partnership        │  10 /  3 cc  │   5 /  2 cc    │ PDF ใหญ่มาก                     │
│ incident-report    │  10 /  3 cc  │   5 /  2 cc    │ รูปหลายไฟล์ใหญ่                 │
└────────────────────┴──────────────┴────────────────┴─────────────────────────────────┘
cc = max_concurrency
```

### Dead Letter Queue (DLQ)

เมื่อ message retry ครบแล้วยังไม่สำเร็จ → ย้ายเข้า DLQ โดยอัตโนมัติ

```
intake-incident-report → retry 3 ครั้ง fail → intake-incident-report-dlq
                                                        ↑
                                               admin ดึงกลับมา retry ได้ภายหลัง
```

**ประโยชน์:** ข้อมูลไม่หาย, ตรวจสอบได้ว่า form type ไหนมีปัญหา, แก้ bug แล้ว replay ได้

---

## Database Schema (D1)

```
submissions              submission_files
──────────────────       ────────────────────────
id (PK)                  id (PK)
form_type                submission_id (FK)
data (JSON)              field_name
status                   original_filename
submitted_at             content_type
dispatched_at            size_bytes
completed_at             r2_key
retry_count              uploaded_at
last_error
idempotency_key

users                    sessions
──────────────────       ──────────────
id (PK)                  id (PK)
username (UNIQUE)        user_id (FK)
email (UNIQUE)           created_at
password_hash            expires_at
password_salt            ip
role                     user_agent
is_active
created_at

webhooks                 webhook_deliveries
──────────────────       ──────────────────────
id (PK)                  id (PK)
name                     webhook_id (FK)
url                      event_type
secret                   submission_id
events (JSON array)      status
form_types (JSON/null)   response_code
is_active                response_body
created_at               attempt_count
                         delivered_at
```

---

## ระบบ Auth & Security

### Password Hashing
```
PBKDF2-SHA256, 100,000 iterations, random 32-byte salt
→ ป้องกัน brute force และ rainbow table
```

### Session
```
random 64-char hex token → เก็บใน D1
Cookie: admin_session=<token>; HttpOnly; Secure; SameSite=Strict
→ revocable ทันทีที่ logout หรือ admin ลบ user
```

### CSRF Protection
```
Token = HMAC-SHA256(sessionId + hourlyTimestamp, SESSION_SECRET)
→ ผูกกับ session + หมุนเวียนทุกชั่วโมง
→ ตรวจสอบทุก POST ที่เปลี่ยนข้อมูล
```

### Rate Limiting (Login)
```
ตรวจ login_attempts ใน D1
> 5 ครั้งใน 10 นาที จาก IP เดียวกัน → 429 Too Many Requests
```

### Webhook Signature
```
X-Webhook-Signature: sha256=HMAC-SHA256(body, webhook.secret)
→ ผู้รับ webhook ตรวจสอบได้ว่า payload ไม่ถูกแก้ไข
```

### File Download
```
GET /admin/files/:id → ต้องผ่าน auth ทุกครั้ง
→ ไม่ expose R2 URL ตรง ป้องกันไฟล์รั่วไหล
```

---

## Admin Dashboard

URL: `https://worker1-intake.cloudflare-training3.workers.dev/admin`

### Roles

```
admin    → ดูทุกอย่าง + retry + export + จัดการ user + จัดการ webhook
operator → ดู + retry + export
viewer   → ดูอย่างเดียว
```

### หน้าหลัก

| หน้า | URL | เนื้อหา |
|------|-----|---------|
| Submissions | `/admin/submissions` | pending/dispatching/failed + filter + bulk retry |
| Dispatched | `/admin/dispatched` | complete/failed + success rate + avg duration |
| Submission Detail | `/admin/submissions/:id` | ข้อมูลครบ + download ไฟล์ |
| Queue Status | `/admin/queues` | stats 24h แต่ละ form type |
| Users | `/admin/users` | CRUD users (admin only) |
| Webhooks | `/admin/webhooks` | CRUD + test + delivery log (admin only) |
| Profile | `/admin/profile` | เปลี่ยน password |

---

## File Storage (R2)

### Key Pattern
```
submissions/2026-04-08/{submission_id}/{fieldName}-{index}.{ext}

ตัวอย่าง:
submissions/2026-04-08/abc-123/resume-0.pdf
submissions/2026-04-08/abc-123/evidence-0.jpg
submissions/2026-04-08/abc-123/evidence-1.jpg
```

### ข้อมูลที่เก็บ
- ไฟล์จริงอยู่ใน R2
- metadata (field_name, filename, size, r2_key) อยู่ใน D1
- Worker 2 อ่านจาก R2 แปลงเป็น base64 ส่งไป Worker 3

---

## 10 Form Types

| # | Form Type | ชื่อ | มีไฟล์ | Queue Profile |
|---|-----------|------|--------|---------------|
| 1 | contact | ติดต่อทั่วไป | ✗ | LIGHT |
| 2 | job-application | สมัครงาน | ✓ PDF 1 ไฟล์ | MEDIUM-HEAVY |
| 3 | complaint | ร้องเรียน | ✓ รูป 1-3 ไฟล์ | MEDIUM |
| 4 | event-registration | ลงทะเบียนอีเวนต์ | ✗ | BULK |
| 5 | product-inquiry | สอบถามสินค้า | ✗ | LIGHT |
| 6 | warranty-claim | เคลมประกัน | ✓ รูป/PDF 1 ไฟล์ | MEDIUM |
| 7 | newsletter | สมัครรับข่าวสาร | ✗ | BULK |
| 8 | feedback | แสดงความคิดเห็น | ✗ | LIGHT |
| 9 | partnership | ขอเป็นพาร์ทเนอร์ | ✓ PDF 1 ไฟล์ | HEAVY |
| 10 | incident-report | รายงานเหตุการณ์ | ✓ รูปสูงสุด 5 ไฟล์ | HEAVY |

---

## Submission Status Flow

```
[ผู้ใช้ submit]
      │
      ▼
   pending  ◄─── bulk retry (admin)
      │         ◄─── network error (reset อัตโนมัติ)
      │         ◄─── sendBatch fail (revert อัตโนมัติ)
      │         ◄─── Cron recovery (retry_count < 3, หลัง 10 นาที)
      │
      │ Worker 2 cron scan (chunk 100/batch)
      ▼
 dispatching
      │
      ├── Worker 3 ตอบ 200 ──────────────► complete ✓
      │                                    fire: submission.completed
      │
      ├── Worker 3 ตอบ 5xx ──► retry ──► (ลองใหม่ backoff 30/60/300s)
      │   retry_count++                        └──► complete หรือ failed
      │   status ยังคง dispatching
      │
      ├── Worker 3 ตอบ 4xx ──────────────► failed ✗
      │                                    fire: submission.failed
      │
      ├── Network error ─────────────────► pending (reset, retry queue)
      │
      └── ค้าง dispatching > 10 นาที (Cron recovery)
           ├── retry_count < 3 ──► pending (reset)
           └── retry_count ≥ 3 ──► failed ✗
```

---

## Environment Variables & Secrets

| ชื่อ | ประเภท | Worker | คำอธิบาย |
|------|--------|--------|----------|
| `SESSION_SECRET` | Secret | W1 | HMAC key สำหรับ session + CSRF |
| `WORKER3_URL` | Var | W2 | URL ของ Worker 3 |
| `DB` | D1 Binding | W1, W2 | D1 Database |
| `UPLOADS` | R2 Binding | W1, W2 | R2 Bucket |
| `INTAKE_*` | Queue Binding | W1 | 10 intake queue producers |
| `DISPATCH_*` | Queue Binding | W2 | 10 dispatch queue producers |
| `WEBHOOK_QUEUE` | Queue Binding | W1, W2 | Webhook queue producer |

---

## โครงสร้างไฟล์โปรเจค

```
cf-form-system/
├── shared/
│   └── src/
│       ├── types.ts          ← TypeScript types ทั้งหมด
│       ├── forms-config.ts   ← config ของ 10 form types
│       └── index.ts          ← re-export
│
├── workers/
│   ├── worker1-intake/
│   │   ├── src/
│   │   │   ├── index.ts      ← main router + queue + scheduled handlers
│   │   │   ├── auth.ts       ← session, CSRF, password, rate limit
│   │   │   ├── validators.ts ← form/file validation
│   │   │   └── html/         ← HTML pages (SSR) แยกต่อหน้า
│   │   │       ├── index.ts       ← re-export ทั้งหมด
│   │   │       ├── layout.ts      ← base layout + CSS
│   │   │       ├── login.ts       ← หน้า login
│   │   │       ├── forms.ts       ← 10 form pages
│   │   │       ├── submissions.ts ← submissions list + detail
│   │   │       ├── dispatched.ts  ← dispatched records
│   │   │       ├── users.ts       ← user management
│   │   │       ├── webhooks.ts    ← webhook management
│   │   │       ├── queues.ts      ← queue stats
│   │   │       └── loadtest.ts    ← load test page
│   │   ├── wrangler.jsonc    ← bindings: D1, R2, 11 queues, cron
│   │   └── tsconfig.json
│   │
│   ├── worker2-dispatcher/
│   │   ├── src/
│   │   │   ├── index.ts      ← cron scanner + dispatch queue handler
│   │   │   └── helpers.ts    ← log(), chunkArray()
│   │   ├── wrangler.jsonc    ← bindings: D1, R2, 11 queues, cron
│   │   └── tsconfig.json
│   │
│   └── worker3-external-api/
│       ├── src/
│       │   └── index.ts      ← mock API (90/5/5)
│       ├── wrangler.jsonc    ← ไม่มี bindings พิเศษ
│       └── tsconfig.json
│
├── schema/
│   └── d1-schema.sql         ← CREATE TABLE + indexes
│
├── scripts/
│   └── gen-wrangler.ts       ← generate wrangler.jsonc จาก forms-config
│
├── tests/
│   └── manual-tests.md       ← 27 test scenarios พร้อม curl commands
│
├── setup.sh                  ← สร้าง D1/R2/42 queues + seed admin user
├── pnpm-workspace.yaml
└── package.json              ← scripts: dev, deploy, typegen, db:migrate
```

---

## คำสั่งที่ใช้บ่อย

```bash
# Dev — รัน 3 workers พร้อมกัน
pnpm dev             # concurrently ใน terminal เดียว (แยก log ด้วยสี)
                     # หรือกด Ctrl+Shift+B ใน VSCode เพื่อเปิดแยก 3 terminal panels

# Dev — รันทีละตัว
pnpm dev:w1          # Worker 1 ที่ http://localhost:8787
pnpm dev:w2          # Worker 2 ที่ http://localhost:8788
pnpm dev:w3          # Worker 3 ที่ http://localhost:8789

# Deploy
pnpm deploy:all      # deploy ทั้ง 3 workers พร้อมกัน

# Database
pnpm db:migrate            # apply schema ไปยัง remote D1
pnpm db:migrate:local      # apply schema ไปยัง local D1

# Type generation (ทำหลังแก้ wrangler.jsonc)
pnpm typegen

# Regenerate wrangler.jsonc (ทำหลังแก้ forms-config.ts)
pnpm gen:wrangler

# ดู logs realtime
wrangler tail worker1-intake
wrangler tail worker2-dispatcher
wrangler tail worker3-external-api

# ดู D1
wrangler d1 execute form-system-db --remote \
  --command "SELECT status, COUNT(*) FROM submissions GROUP BY status"

# ดู queue
wrangler queues list
```
