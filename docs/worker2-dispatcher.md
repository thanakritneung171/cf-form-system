# Worker 2 — Dispatcher (`worker2-dispatcher`)

**Local URL:** `http://localhost:8788`
**Production URL:** `https://worker2-dispatcher.<subdomain>.workers.dev`

---

## ภาพรวม

Worker ทำหน้าที่ poll submissions ที่รอ (`pending`) และส่งต่อไปยัง Worker 3 (External API)

มี 3 entry point:
1. **HTTP Fetch** — เฉพาะ `/health` endpoint
2. **Scheduled Cron** — scan pending → ส่งเข้า dispatch queues (ทุก 1 นาที)
3. **Queue Consumer** — รับจาก dispatch queues → POST ไป Worker 3

---

## HTTP API

### GET `/health`
Health check endpoint

**Response 200:**
```json
{ "ok": true, "worker": "worker2-dispatcher" }
```

> ทุก path อื่นคืน `404 Not Found`

---

## Scheduled Cron (ทุก 1 นาที)

**ชื่อ Job:** `handleScheduled`

**ขั้นตอน:**

```
1. UPDATE submissions
   SET status='dispatching', dispatched_at=<now>
   WHERE id IN (SELECT id FROM submissions WHERE status='pending' LIMIT 1000)
   RETURNING id, form_type

2. Group by form_type:
   { contact: [id1, id2], newsletter: [id3, ...] }

3. sendBatch ไปยัง dispatch queue ของแต่ละ form type:
   DISPATCH_CONTACT.sendBatch([{ body: { submission_id: id1 } }, ...])
   DISPATCH_NEWSLETTER.sendBatch([...])
   ...

4. ถ้า sendBatch fail → revert status กลับ 'pending'
```

**Batch limit:** ครั้งละไม่เกิน 1,000 submissions

---

## Queue Consumer — Dispatch Queues

Worker 2 รับ message จาก 10 dispatch queues (`dispatch-contact`, `dispatch-newsletter`, ฯลฯ)

### ขั้นตอนประมวลผลแต่ละ submission

```
1. SELECT * FROM submissions WHERE id=?
2. SELECT * FROM submission_files WHERE submission_id=?
3. ดึงไฟล์จาก R2 (env.UPLOADS.get(r2_key))
4. แปลงไฟล์เป็น base64
5. POST → Worker 3 /api/receive (timeout 30 วินาที)
6. Handle response:
   - 2xx → status='complete', ack, fire webhook 'submission.completed'
   - 5xx → retry_count++, msg.retry(delay), fire ไม่เกิน 3 ครั้ง
   - 4xx → status='failed', ack, fire webhook 'submission.failed'
   - network error → retry(30s)
```

### Retry Backoff Policy

| retry_count | delay |
|-------------|-------|
| 1 | 30 วินาที |
| 2 | 60 วินาที |
| ≥3 | 300 วินาที (5 นาที) |

### Payload ที่ส่งไป Worker 3

**POST** `{WORKER3_URL}/api/receive`

```json
{
  "submission_id": "uuid",
  "form_type": "contact",
  "submitted_at": 1712345678000,
  "data": {
    "fullName": "สมชาย ใจดี",
    "email": "somchai@example.com",
    "phone": "0812345678",
    "subject": "สอบถามข้อมูล",
    "message": "..."
  },
  "files": [
    {
      "field_name": "resume",
      "original_filename": "resume.pdf",
      "content_type": "application/pdf",
      "size_bytes": 102400,
      "content_base64": "JVBERi0xLjQK..."
    }
  ]
}
```

---

## Webhook Events ที่ยิง

เมื่อ submission เสร็จ/ล้มเหลว Worker 2 จะส่ง event เข้า `webhook-queue` ให้ Worker 1 ส่งต่อ

| Event | เมื่อไหร่ |
|-------|----------|
| `submission.completed` | Worker 3 ตอบ 2xx |
| `submission.failed` | Worker 3 ตอบ 4xx |

**ขั้นตอน fire webhook:**
```
1. SELECT webhooks WHERE is_active=1
2. ตรวจ events filter (เฉพาะ webhooks ที่ subscribe event นั้น)
3. ตรวจ form_types filter (ถ้ามี)
4. INSERT webhook_deliveries (status='pending')
5. WEBHOOK_QUEUE.send({ webhook_id, event_type, submission_id, delivery_id })
```

---

## Status Flow ของ Submission

```
pending
  │
  │  (Cron ทุก 1 นาที)
  ▼
dispatching
  │
  ├── Worker 3 → 2xx ──────────────► complete ✓
  │                                  fire: submission.completed
  │
  ├── Worker 3 → 5xx (retry ≤3) ──► dispatching → (retry) → complete หรือ failed
  │
  ├── Worker 3 → 5xx (retry >3) ──► failed ✗ (DLQ)
  │
  └── Worker 3 → 4xx ─────────────► failed ✗
                                     fire: submission.failed
```

---

## Database Operations

| Operation | SQL |
|-----------|-----|
| Scan pending | `UPDATE submissions SET status='dispatching' WHERE status='pending' LIMIT 1000 RETURNING id, form_type` |
| Read submission | `SELECT * FROM submissions WHERE id=?` |
| Read files | `SELECT * FROM submission_files WHERE submission_id=?` |
| Mark complete | `UPDATE submissions SET status='complete', completed_at=? WHERE id=?` |
| Mark failed | `UPDATE submissions SET status='failed', completed_at=?, last_error=? WHERE id=?` |
| Update retry | `UPDATE submissions SET retry_count=?, last_error=? WHERE id=?` |
| Revert pending | `UPDATE submissions SET status='pending', dispatched_at=NULL WHERE id IN (...)` |

---

## Bindings

| Binding | ประเภท | คำอธิบาย |
|---------|--------|----------|
| `DB` | D1 | ฐานข้อมูล submissions |
| `UPLOADS` | R2 | อ่านไฟล์แนบเพื่อแปลง base64 |
| `WORKER3_URL` | Var | URL ของ Worker 3 |
| `DISPATCH_*` | Queue Producer | 10 dispatch queues แยกตาม form type |
| `WEBHOOK_QUEUE` | Queue Producer | ส่ง webhook events ไปให้ Worker 1 |

---

## Dispatch Queue Config

| Form Type | Batch Size | Max Concurrency |
|-----------|-----------|----------------|
| newsletter | 200 | 10 cc |
| event-registration | 100 | 8 cc |
| contact | 50 | 5 cc |
| feedback | 50 | 5 cc |
| product-inquiry | 50 | 5 cc |
| complaint | 10 | 3 cc |
| warranty-claim | 15 | 3 cc |
| job-application | 10 | 3 cc |
| partnership | 5 | 2 cc |
| incident-report | 5 | 2 cc |
