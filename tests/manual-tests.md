# Manual Tests — CF Form System

แทนที่ `https://worker1.cloudflare-training3.workers.dev` ด้วย URL จริงของ Worker 1

---

## Test 1: Submit ฟอร์ม text อย่างเดียว (contact)

```bash
curl -X POST https://worker1.cloudflare-training3.workers.dev/submit/contact \
  -F "fullName=ทดสอบ ระบบ" \
  -F "email=test@example.com" \
  -F "phone=0812345678" \
  -F "subject=ทดสอบระบบ" \
  -F "message=Hello World! ทดสอบการส่งฟอร์ม"
```

**ผลที่คาดหวัง:** `{"ok":true,"submission_id":"<uuid>"}`

---

## Test 2: Submit ฟอร์มพร้อมไฟล์ (job-application + PDF)

```bash
# สร้าง test PDF ง่ายๆ ก่อน
echo "%PDF-1.4 test resume" > /tmp/test-resume.pdf

curl -X POST https://worker1.cloudflare-training3.workers.dev/submit/job-application \
  -F "fullName=ผู้สมัคร ทดสอบ" \
  -F "email=applicant@example.com" \
  -F "phone=0823456789" \
  -F "position=Software Engineer" \
  -F "experience=3" \
  -F "resume=@/tmp/test-resume.pdf;type=application/pdf"
```

**ผลที่คาดหวัง:** `{"ok":true,"submission_id":"<uuid>"}`

---

## Test 3: Submit ฟอร์มพร้อมหลายไฟล์ (incident-report + รูป)

```bash
# สร้าง test images
convert -size 100x100 xc:red /tmp/evidence1.jpg 2>/dev/null || echo "fake jpg" > /tmp/evidence1.jpg
cp /tmp/evidence1.jpg /tmp/evidence2.jpg
cp /tmp/evidence1.jpg /tmp/evidence3.jpg

curl -X POST https://worker1.cloudflare-training3.workers.dev/submit/incident-report \
  -F "fullName=ผู้รายงาน" \
  -F "email=reporter@example.com" \
  -F "phone=0834567890" \
  -F "location=ชั้น 3 อาคาร A" \
  -F "incidentType=อุบัติเหตุ" \
  -F "description=พบสิ่งผิดปกติในพื้นที่" \
  -F "evidence=@/tmp/evidence1.jpg;type=image/jpeg" \
  -F "evidence=@/tmp/evidence2.jpg;type=image/jpeg" \
  -F "evidence=@/tmp/evidence3.jpg;type=image/jpeg"
```

**ผลที่คาดหวัง:** `{"ok":true,"submission_id":"<uuid>"}`

---

## Test 4: ตรวจสถานะใน D1

```bash
wrangler d1 execute form-system-db --remote \
  --command "SELECT id, form_type, status, retry_count, submitted_at FROM submissions ORDER BY submitted_at DESC LIMIT 10"
```

**ผลที่คาดหวัง:** เห็น records ที่เพิ่งส่ง status=pending หรือ dispatching

---

## Test 5: ตรวจ R2

```bash
wrangler r2 object list form-system-uploads
```

**ผลที่คาดหวัง:** เห็น keys ในรูปแบบ `submissions/yyyy-mm-dd/<id>/fieldname-0.ext`

---

## Test 6: Trigger dispatcher ด้วยตนเอง

```bash
# Worker 2 ต้องมี cron trigger ใน wrangler.toml
# สำหรับ local dev:
curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"

# สำหรับ remote (ต้อง enable Cron Triggers ใน dashboard):
curl -X POST "https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/workers/scripts/worker2-dispatcher/triggers/schedule" \
  -H "Authorization: Bearer <API_TOKEN>"
```

---

## Test 7: ดู log realtime

```bash
# เปิด 3 terminal แยกกัน:
wrangler tail worker1-intake
wrangler tail worker2-dispatcher
wrangler tail worker3-external-api
```

---

## Test 8: Load test — 100 concurrent submits

```bash
#!/bin/bash
WORKER_URL="https://worker1.cloudflare-training3.workers.dev"

echo "Starting load test: 100 concurrent submits..."
for i in $(seq 1 100); do
  curl -s -X POST "${WORKER_URL}/submit/contact" \
    -F "fullName=User${i}" \
    -F "email=user${i}@test.com" \
    -F "phone=0800000000" \
    -F "subject=load test ${i}" \
    -F "message=Load test message ${i}" \
    -o /dev/null \
    -w "[$i] %{http_code}\n" &
done
wait
echo "Done! Checking results..."

sleep 5
wrangler d1 execute form-system-db --remote \
  --command "SELECT status, COUNT(*) as cnt FROM submissions GROUP BY status"
```

---

## Test 9: Login — credential ถูกและผิด

```bash
# Login ด้วย credential ถูก
curl -c /tmp/cookies.txt -X POST https://worker1.cloudflare-training3.workers.dev/admin/login \
  -d "username=admin&password=admin1234&next=/admin/submissions" \
  -L -v 2>&1 | grep -E "< HTTP|Location|Set-Cookie"

# Login ด้วย credential ผิด
curl -X POST https://worker1.cloudflare-training3.workers.dev/admin/login \
  -d "username=admin&password=wrongpassword" \
  -v 2>&1 | grep "< HTTP"
```

**ผลที่คาดหวัง:** ถูก → 302 redirect พร้อม Set-Cookie, ผิด → 401

---

## Test 10: Access dashboard without cookie

```bash
curl -v https://worker1.cloudflare-training3.workers.dev/admin/submissions 2>&1 | grep "< HTTP\|Location"
```

**ผลที่คาดหวัง:** 302 redirect ไป `/admin/login`

---

## Test 11: ดู Submissions page

```bash
# ใช้ cookie จาก Test 9
curl -b /tmp/cookies.txt https://worker1.cloudflare-training3.workers.dev/admin/submissions | grep -o "submission_id[^<]*" | head
```

**ผลที่คาดหวัง:** หน้า HTML ที่มีตาราง submissions

---

## Test 12: ดู Dispatched page (หลัง cron ทำงาน)

```bash
curl -b /tmp/cookies.txt https://worker1.cloudflare-training3.workers.dev/admin/dispatched | grep -c "complete\|failed"
```

---

## Test 13: Download file จาก admin

```bash
# ดู file IDs
wrangler d1 execute form-system-db --remote \
  --command "SELECT id, original_filename FROM submission_files LIMIT 5"

# Download (ใช้ cookie)
curl -b /tmp/cookies.txt \
  "https://worker1.cloudflare-training3.workers.dev/admin/files/<FILE_ID>" \
  -o /tmp/downloaded-file
file /tmp/downloaded-file
```

**ผลที่คาดหวัง:** ได้ไฟล์ต้นฉบับ

---

## Test 14: Retry failed submission

```bash
# หา failed submission
wrangler d1 execute form-system-db --remote \
  --command "SELECT id FROM submissions WHERE status='failed' LIMIT 1"

# Retry
curl -b /tmp/cookies.txt -X POST https://worker1.cloudflare-training3.workers.dev/admin/bulk-retry \
  -H "Content-Type: application/json" \
  -d '{"ids":["<SUBMISSION_ID>"]}'

# ตรวจว่า status กลับเป็น pending
wrangler d1 execute form-system-db --remote \
  --command "SELECT id, status FROM submissions WHERE id='<SUBMISSION_ID>'"
```

---

## Test 15: Rate limit login (ผิด 6 ครั้ง)

```bash
for i in {1..6}; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    https://worker1.cloudflare-training3.workers.dev/admin/login \
    -d "username=admin&password=wrong${i}")
  echo "Attempt $i: HTTP $HTTP_CODE"
done
```

**ผลที่คาดหวัง:** ครั้งที่ 1-5 ได้ 401, ครั้งที่ 6 ได้ 429

---

## Test 16: สร้าง user role=operator

```bash
# Login เป็น admin ก่อน
curl -c /tmp/admin-cookies.txt -X POST https://worker1.cloudflare-training3.workers.dev/admin/login \
  -d "username=admin&password=admin1234"

# ดู form CSRF token แล้วสร้าง user
# (ทำง่ายกว่าผ่าน UI dashboard)
curl -b /tmp/admin-cookies.txt https://worker1.cloudflare-training3.workers.dev/admin/users/new > /tmp/user-form.html
grep -o 'name="_csrf" value="[^"]*"' /tmp/user-form.html
```

---

## Test 17: viewer ไม่เห็นปุ่ม retry

1. สร้าง user role=viewer จาก admin (badge สี cream `#fff0c2`)
2. Login ด้วย viewer
3. เข้าหน้า `/admin/submissions`
4. ตรวจว่าไม่มีปุ่ม "Retry" และ checkbox
5. ตรวจว่า stat cards แสดงถูกต้อง (4 ใบ: รอดำเนินการ/กำลังส่ง/วันนี้ทั้งหมด/ล้มเหลว)
6. ตรวจว่า stat cards คลิกได้ (link ไปหน้า filter ตาม status)

---

## Test 18: Export CSV

```bash
curl -b /tmp/cookies.txt \
  "https://worker1.cloudflare-training3.workers.dev/admin/export/submissions.csv" \
  -o /tmp/submissions.csv

# ตรวจ BOM UTF-8
hexdump -C /tmp/submissions.csv | head -1
# ต้องเห็น: ef bb bf (BOM)

# เปิดใน Excel หรือดู headers
head -1 /tmp/submissions.csv
```

---

## Test 19: Bulk retry หลาย submissions

```bash
# หา failed IDs
FAILED_IDS=$(wrangler d1 execute form-system-db --remote \
  --command "SELECT json_group_array(id) FROM (SELECT id FROM submissions WHERE status='failed' LIMIT 5)" \
  --json | jq -r '.[0].results[0]["json_group_array(id)"]')

echo "Failed IDs: $FAILED_IDS"

curl -b /tmp/cookies.txt -X POST https://worker1.cloudflare-training3.workers.dev/admin/bulk-retry \
  -H "Content-Type: application/json" \
  -d "{\"ids\": $FAILED_IDS}"
```

---

## Test 20: Webhook — สร้างและรับ payload

1. สร้าง URL บน https://webhook.site หรือ https://pipedream.com
2. Login เป็น admin → ไป `/admin/webhooks/new`
3. ใส่ URL, เลือก event `submission.created`, สร้าง
4. Submit ฟอร์ม contact ทดสอบ
5. ตรวจ webhook.site ว่าได้รับ payload

**ตัวอย่าง payload ที่จะได้รับ:**
```json
{
  "event": "submission.created",
  "timestamp": 1712345678000,
  "data": {
    "submission_id": "...",
    "form_type": "contact",
    "status": "pending",
    "submitted_at": 1712345678000,
    "summary": { "email": "test@example.com", "full_name": "ทดสอบ" }
  }
}
```

**Headers:**
```
X-Webhook-Event: submission.created
X-Webhook-Signature: sha256=<hmac>
X-Webhook-Delivery: del_<id>
```

---

## Test 21: Webhook retry (URL ตอบ 500)

1. สร้าง webhook ชี้ไป URL ที่ตอบ 500 เสมอ (ใช้ https://httpbin.org/status/500)
2. Submit ฟอร์ม
3. รอ 1-2 นาที แล้วตรวจ:

```bash
wrangler d1 execute form-system-db --remote \
  --command "SELECT id, webhook_id, attempt_count, status FROM webhook_deliveries ORDER BY created_at DESC LIMIT 5"
```

**ผลที่คาดหวัง:** attempt_count เพิ่มขึ้นจาก retry

---

## Test 22: ตรวจสอบ HMAC Signature

```bash
# Script verify webhook signature (Node.js)
node << 'EOF'
const crypto = require('crypto');

const secret = 'YOUR_WEBHOOK_SECRET';
const payload = '{"event":"submission.created",...}'; // ใส่ body จริง
const receivedSig = 'sha256=...'; // ใส่ header X-Webhook-Signature จริง

const expected = 'sha256=' + crypto
  .createHmac('sha256', secret)
  .update(payload)
  .digest('hex');

console.log('Expected:', expected);
console.log('Received:', receivedSig);
console.log('Match:', expected === receivedSig);
EOF
```

---

## Test 23: Session revoke หลัง logout

```bash
# Login และเก็บ cookie
curl -c /tmp/test-session.txt -X POST https://worker1.cloudflare-training3.workers.dev/admin/login \
  -d "username=admin&password=admin1234"

# ดึง session ID
cat /tmp/test-session.txt | grep admin_session

# Logout
curl -b /tmp/test-session.txt -X POST https://worker1.cloudflare-training3.workers.dev/admin/logout

# ลอง access ด้วย cookie เดิม (ต้อง redirect ไป login)
curl -b /tmp/test-session.txt -v https://worker1.cloudflare-training3.workers.dev/admin/submissions 2>&1 | grep "< HTTP\|Location"
```

**ผลที่คาดหวัง:** 302 redirect ไป /admin/login (session ถูก revoke แล้ว)

---

## ตรวจสอบ D1 tables ทั้งหมด

```bash
# ดู schema
wrangler d1 execute form-system-db --remote \
  --command "SELECT name FROM sqlite_master WHERE type='table'"

# ดู stats
wrangler d1 execute form-system-db --remote --command "
  SELECT 'submissions' as tbl, COUNT(*) as cnt FROM submissions
  UNION ALL SELECT 'files', COUNT(*) FROM submission_files
  UNION ALL SELECT 'users', COUNT(*) FROM users
  UNION ALL SELECT 'sessions', COUNT(*) FROM sessions
  UNION ALL SELECT 'webhooks', COUNT(*) FROM webhooks
  UNION ALL SELECT 'deliveries', COUNT(*) FROM webhook_deliveries
"
```

---

## Test 24: แต่ละฟอร์มไปถูก queue

Submit ทั้ง 10 ฟอร์มแล้วตรวจสอบว่าข้อมูลกระจายถูก queue:

```bash
WORKER_URL="https://worker1-intake.cloudflare-training3.workers.dev"

# Contact → intake-contact
curl -s -X POST "${WORKER_URL}/submit/contact" \
  -F "fullName=Test" -F "email=t@t.com" -F "phone=0800000000" \
  -F "subject=test" -F "message=test" | jq .

# Newsletter → intake-newsletter (batch ใหญ่ 500)
curl -s -X POST "${WORKER_URL}/submit/newsletter" \
  -F "fullName=Test" -F "email=t@t.com" -F "phone=0800000000" \
  -F "interests=เทคโนโลยี" -F "frequency=ทุกสัปดาห์" | jq .

# ตรวจ D1 ว่ามีทุก form_type
wrangler d1 execute form-system-db --remote \
  --command "SELECT form_type, COUNT(*) as cnt FROM submissions GROUP BY form_type ORDER BY form_type"
```

**ผลที่คาดหวัง:** เห็น 10 form_type แยกกัน ข้อมูลในแต่ละ intake queue แยกกัน

---

## Test 25: Isolation — ฟอร์มหนึ่งช้าไม่กระทบฟอร์มอื่น

แก้ Worker 3 ชั่วคราวให้ `incident-report` ตอบ 500 เสมอ แล้วส่งทั้ง 2 ฟอร์มพร้อมกัน:

```bash
# ส่ง incident-report หลายรายการ (จะ fail)
for i in {1..5}; do
  curl -s -X POST "${WORKER_URL}/submit/incident-report" \
    -F "fullName=Test${i}" -F "email=t${i}@t.com" -F "phone=0800000000" \
    -F "location=ชั้น${i}" -F "incidentType=อุบัติเหตุ" \
    -F "description=test" &
done

# ส่ง contact พร้อมกัน (ต้องทำงานปกติ ไม่ถูก block)
for i in {1..20}; do
  curl -s -X POST "${WORKER_URL}/submit/contact" \
    -F "fullName=User${i}" -F "email=u${i}@t.com" -F "phone=0800000000" \
    -F "subject=test" -F "message=msg${i}" &
done
wait

sleep 10
wrangler d1 execute form-system-db --remote \
  --command "SELECT form_type, status, COUNT(*) FROM submissions GROUP BY form_type, status ORDER BY form_type"
```

**ผลที่คาดหวัง:** `contact` มี status=complete, `incident-report` มี status=failed — ทั้งสองไม่รบกวนกัน

---

## Test 26: DLQ แยกต่อ form type

หลัง retry ครบ 3 ครั้งใน dispatch queue ข้อมูลจะเข้า DLQ ของ form type นั้นเท่านั้น:

```bash
# ดู DLQ ของ incident-report
wrangler queues list 2>&1 | grep dlq

# ตรวจว่า contact-dlq ว่างเปล่า (ถ้า contact ทำงานปกติ)
# ตรวจว่า incident-report-dlq มี messages (ถ้า incident-report fail)

# ดู dead letter ใน D1 (submissions ที่ retry เกิน max)
wrangler d1 execute form-system-db --remote \
  --command "SELECT form_type, retry_count, status FROM submissions WHERE retry_count >= 3 ORDER BY form_type"
```

---

## Test 27: Queue Status page

```bash
# เข้าหน้า Queue Status
curl -b /tmp/cookies.txt https://worker1-intake.cloudflare-training3.workers.dev/admin/queues | \
  grep -o 'form_type[^<]*' | head -20
```

**ผลที่คาดหวัง:**
- เห็น 10 แถว ครบทุก form type
- แต่ละแถวมีตัวเลข Pending, Dispatching, Complete(24h), Failed(24h)
- มี Success Rate และ Avg Duration
- คลิก "Pending" link → ไปหน้า Submissions filter ตาม form_type นั้นได้
- Stat cards 4 ใบด้านบน พร้อม accent bar สี warm palette
- Refresh bar (auto-refresh ทุก 30 วินาที เมื่อไม่ได้ตั้ง custom range)
- แถวที่ failed > 0 highlight ด้วย warm yellow background (#fff8e6)

**ตรวจ config table** (กด expand ด้านล่าง):
- newsletter: Intake Batch=500, Concurrency=20 (ใหญ่ที่สุด)
- incident-report: Intake Batch=10, Concurrency=3 (เล็กที่สุด)
- contact: Intake Batch=100, Concurrency=10 (กลางๆ)

---

## Test 28: ตรวจ Form Index Page (หน้า /)

```bash
curl https://worker1-intake.cloudflare-training3.workers.dev/ | grep -c "cat-section"
```

**ผลที่คาดหวัง:**
- เห็น 4 categories (ติดต่อ & สนับสนุน, สมัครงาน & พาร์ทเนอร์, สินค้า & บริการ, กิจกรรม & ข่าวสาร)
- แต่ละฟอร์มมี SVG icon + description
- ฟอร์มที่มี file upload แสดง badge "แนบไฟล์ได้"
- มีช่อง search ที่กรองฟอร์มแบบ real-time
- สีตาม Mistral warm palette (ivory background, amber/orange accents)

---

## Test 29: ตรวจ Login Page UI

```bash
curl https://worker1-intake.cloudflare-training3.workers.dev/admin/login | grep -o "login-title\|login-blocks\|login-avatar"
```

**ผลที่คาดหวัง:**
- Gradient identity bar (5 warm color blocks: yellow → amber → orange)
- Avatar circle สี orange (#fa520f)
- Title "SIGN IN" ขนาด 56px uppercase
- Background gradient warm cream
- Input fields พร้อม warm styling
