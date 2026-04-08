# CF Form System

ระบบรับฟอร์มขนาดใหญ่บน Cloudflare ด้วย 3 Workers — รองรับ 10 ฟอร์ม, ไฟล์ upload, queue processing, admin dashboard, user management, และ webhooks

## สถาปัตยกรรม

```
User → Worker 1 (Intake) → intake-queue → Worker 1 (consumer) → D1
                              ↓
                        Worker 2 (Cron) → dispatch-queue → Worker 2 (consumer) → Worker 3
                              ↓
                        webhook-queue → Worker 1 (consumer) → External URL
```

| Worker | หน้าที่ |
|--------|---------|
| **worker1-intake** | รับ form submit, upload R2, ส่ง queue, Admin dashboard |
| **worker2-dispatcher** | Cron scan pending, ส่งไป Worker 3, บันทึกผลลัพธ์ |
| **worker3-external-api** | Mock API ปลายทาง (สุ่ม 90% OK, 5% 500, 5% 400) |

## ฟอร์มทั้ง 10 แบบ

| Form Type | ชื่อ | มีไฟล์ |
|-----------|------|--------|
| contact | ติดต่อทั่วไป | ✗ |
| job-application | สมัครงาน | ✓ PDF (resume) |
| complaint | ร้องเรียน | ✓ รูป 1-3 ไฟล์ |
| event-registration | ลงทะเบียนอีเวนต์ | ✗ |
| product-inquiry | สอบถามสินค้า | ✗ |
| warranty-claim | เคลมประกัน | ✓ รูป/PDF |
| newsletter | สมัครรับข่าว | ✗ |
| feedback | แสดงความเห็น | ✗ |
| partnership | ขอเป็นพาร์ทเนอร์ | ✓ PDF |
| incident-report | รายงานเหตุการณ์ | ✓ รูปสูงสุด 5 ไฟล์ |

## ขั้นตอน Setup

### Prerequisites

```bash
npm install -g pnpm
npm install -g wrangler
wrangler login
```

### 1. Install dependencies

```bash
cd cf-form-system
pnpm install
```

### 2. สร้าง Cloudflare resources

```bash
chmod +x setup.sh
./setup.sh
```

Script จะสร้าง:
- D1 database: `form-system-db`
- R2 bucket: `form-system-uploads`
- Queues: `intake-queue`, `dispatch-queue`, `webhook-queue` และ DLQs
- Apply schema ลง D1
- Insert default admin user (admin/admin1234)
- ตั้ง `SESSION_SECRET` secret

### 3. อัพเดต wrangler.toml

หลัง run setup.sh จะได้ `database_id` ให้แก้ทุกไฟล์:

```bash
# workers/worker1-intake/wrangler.toml
# workers/worker2-dispatcher/wrangler.toml

# แทนที่ REPLACE_WITH_DATABASE_ID ด้วย ID จริง
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

อัพเดต Worker 3 URL ใน `workers/worker2-dispatcher/wrangler.toml`:

```toml
[vars]
WORKER3_URL = "https://worker3-external-api.<your-subdomain>.workers.dev"
```

### 4. Deploy

```bash
# Deploy Worker 3 ก่อน (เพื่อได้ URL)
pnpm --filter worker3-external-api run deploy

# อัพเดต WORKER3_URL ใน wrangler.toml ของ Worker 2 แล้ว:
pnpm --filter worker2-dispatcher run deploy

# Deploy Worker 1
pnpm --filter worker1-intake run deploy
```

หรือ deploy ทั้งหมดพร้อมกัน:
```bash
pnpm deploy:all
```

### 5. Apply schema (ถ้ายังไม่ได้ทำใน setup.sh)

```bash
pnpm db:migrate
```

### 6. เปลี่ยน password admin

เข้า `https://worker1-intake.<subdomain>.workers.dev/admin/login` แล้ว login ด้วย:
- Username: `admin`
- Password: `admin1234`

**เปลี่ยน password ทันทีหลัง login ครั้งแรก!**

---

## Development

### รัน workers ทั้ง 3 ตัวพร้อมกัน

```bash
pnpm dev
```

รันทั้ง 3 workers ใน terminal เดียว แยก log ด้วย prefix สี:
- `[W1]` worker1-intake → http://localhost:8787
- `[W2]` worker2-dispatcher → http://localhost:8788
- `[W3]` worker3-external-api → http://localhost:8789

หยุดทั้งหมดด้วย `Ctrl+C` ครั้งเดียว

### รันแยก 3 terminal panels ใน VSCode

กด `Ctrl+Shift+B` → จะเปิด 3 terminal panels แยกกัน แต่ละอันรัน worker คนละตัว

หยุด:
- Focus ที่แต่ละ terminal panel แล้วกด `Ctrl+C`
- หรือ Command Palette → `Tasks: Terminate Task` → `All Running Tasks`

### รันทีละตัว

```bash
pnpm dev:w1    # worker1-intake     → http://localhost:8787
pnpm dev:w2    # worker2-dispatcher → http://localhost:8788
pnpm dev:w3    # worker3-external-api → http://localhost:8789
```

---

## Local Development

### Worker 1

```bash
# สร้าง .dev.vars สำหรับ secrets
cat > workers/worker1-intake/.dev.vars << EOF
SESSION_SECRET=dev-secret-change-in-production
EOF

pnpm dev:w1
# เข้า http://localhost:8787
```

### Worker 2

```bash
cat > workers/worker2-dispatcher/.dev.vars << EOF
WORKER3_URL=http://localhost:8789
EOF

pnpm dev:w2
```

### Worker 3

```bash
pnpm dev:w3
# เข้า http://localhost:8789/health
```

### Local D1 + Queue

```bash
# Apply schema local
pnpm db:migrate:local

# Worker 1 จะสร้าง D1 local อัตโนมัติตาม wrangler.toml
```

---

## Admin Dashboard

URL: `https://worker1-intake.<subdomain>.workers.dev/admin`

### Roles

| Role | ดู | Retry | Export | User Mgmt | Webhook |
|------|----|-------|--------|-----------|---------|
| admin | ✓ | ✓ | ✓ | ✓ | ✓ |
| operator | ✓ | ✓ | ✓ | ✗ | ✗ |
| viewer | ✓ | ✗ | ✗ | ✗ | ✗ |

### หน้า Dashboard

- `/admin/submissions` — Submissions ล่าสุด (pending/dispatching/failed)
- `/admin/dispatched` — Dispatched records (complete/failed)
- `/admin/submissions/:id` — รายละเอียด + ดาวน์โหลดไฟล์
- `/admin/users` — จัดการ users (admin only)
- `/admin/webhooks` — จัดการ webhooks (admin only)
- `/admin/export/submissions.csv` — Export CSV
- `/admin/profile` — เปลี่ยน password

---

## API Endpoints (Worker 1)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | หน้า index ฟอร์มทั้ง 10 |
| GET | `/form/:type` | หน้าฟอร์ม |
| POST | `/submit/:type` | รับ multipart/form-data |

**Response จาก submit:**
```json
{ "ok": true, "submission_id": "uuid" }
// หรือ error:
{ "ok": false, "errors": [{ "field": "...", "message": "..." }] }
```

---

## Webhook Payload

```json
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

**Headers:**
- `X-Webhook-Event: submission.created`
- `X-Webhook-Signature: sha256=<hmac-sha256>`
- `X-Webhook-Delivery: del_<id>`

**Verify signature (Node.js):**
```js
const crypto = require('crypto');
const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
const isValid = expected === receivedSignature;
```

---

## Queue Architecture

```
POST /submit/:type
  → upload files to R2
  → send to intake-queue

intake-queue consumer (Worker 1)
  → INSERT submissions + submission_files to D1
  → fire submission.created webhook

Worker 2 Cron (* * * * *)
  → UPDATE status=dispatching WHERE status=pending LIMIT 200
  → send IDs to dispatch-queue

dispatch-queue consumer (Worker 2)
  → fetch submission + files from D1/R2
  → POST to Worker 3 /api/receive
  → 200: UPDATE status=complete
  → 5xx: retry (max 3, backoff 30/60/300s)
  → 4xx: UPDATE status=failed
  → fire completed/failed webhook

webhook-queue consumer (Worker 1)
  → POST to webhook URL with HMAC signature
  → retry on 5xx (10/60/300s backoff)
  → record in webhook_deliveries
```

---

## Security

- **Password hashing:** PBKDF2-SHA256, 100,000 iterations
- **Sessions:** Random 32-byte token ใน D1 (revocable)
- **CSRF:** HMAC token ผูกกับ session + hourly rotation
- **Rate limiting:** Login 5 ครั้ง/10 นาที/IP (ใช้ D1)
- **File download:** ต้องผ่าน auth ทุกครั้ง (ไม่ expose R2 URL ตรง)
- **Webhook secret:** แสดงครั้งเดียวตอนสร้าง

---

## Scripts

```bash
pnpm dev             # รัน 3 workers พร้อมกัน (concurrently)
pnpm dev:w1          # Dev Worker 1
pnpm dev:w2          # Dev Worker 2
pnpm dev:w3          # Dev Worker 3
pnpm deploy:all      # Deploy ทั้ง 3 workers
pnpm db:migrate      # Apply schema to remote D1
pnpm db:migrate:local # Apply schema to local D1
```

> **VSCode:** กด `Ctrl+Shift+B` เพื่อรัน 3 workers แยก terminal panels

---

## Troubleshooting

**Queue ไม่ทำงาน:**
```bash
# ดู DLQ
wrangler queues list
wrangler d1 execute form-system-db --remote --command "SELECT status, COUNT(*) FROM submissions GROUP BY status"
```

**Worker 2 cron ไม่ trigger:**
- ตรวจ Cloudflare Dashboard → Workers → worker2-dispatcher → Triggers → Cron Triggers

**ไฟล์ไม่ขึ้น R2:**
```bash
wrangler r2 object list form-system-uploads --prefix "submissions/"
```

**Session ไม่ work:**
```bash
wrangler d1 execute form-system-db --remote --command "SELECT * FROM sessions ORDER BY created_at DESC LIMIT 5"
```
