# Waiting Room — คู่มือทดสอบ

## เตรียมก่อนทดสอบ — ลด limit ให้ต่ำ

แก้ `workers/worker1-intake/src/waiting-room-config.ts` ชั่วคราว:

```typescript
'event-registration': { enabled: true, limit: 2, tokenTtlMinutes: 1, maxSubmitsPerToken: 2, shards: 1 },
```

แล้ว deploy:

```bash
cd workers/worker1-intake && npx wrangler deploy
```

---

## Test 1: หน้ารอคิว (พื้นฐาน)

```
เปิด browser 3 tabs ไปที่:
  Tab 1: https://worker1-intake.softdebut-poc.workers.dev/form/event-registration
  Tab 2: https://worker1-intake.softdebut-poc.workers.dev/form/event-registration
  Tab 3: https://worker1-intake.softdebut-poc.workers.dev/form/event-registration

ผลที่ต้องการ:
  Tab 1 → เห็นฟอร์ม (slot 1/2)
  Tab 2 → เห็นฟอร์ม (slot 2/2)
  Tab 3 → เห็นหน้ารอคิว "ลำดับที่ 1" + poll ทุก 3 วิ
```

---

## Test 2: Tab หลายอัน = คน 1 คน (fingerprint dedup)

```
เปิด browser ปกติ:
  Tab 1 → /form/event-registration → เห็นฟอร์ม
  Tab 2 → /form/event-registration → เห็นฟอร์ม (ใช้ token เดิม ไม่กิน slot ใหม่)
  Tab 3 → /form/event-registration → เห็นฟอร์ม (ใช้ token เดิม)

ตรวจสอบ active_count ที่ admin:
  https://worker1-intake.softdebut-poc.workers.dev/admin/waiting-room
  → Active ต้องเป็น 1 (ไม่ใช่ 3)
```

---

## Test 3: Submit แล้ว Tab อื่นยังใช้ได้

```
(limit: 2, maxSubmitsPerToken: 2)

เปิด 2 tabs สำหรับ fingerprint A:
  Tab A1 → กรอกฟอร์มแล้ว Submit → สำเร็จ (submitCount: 1/2)
  Tab A2 → กรอกฟอร์มแล้ว Submit → สำเร็จ (submitCount: 2/2)
  Tab A3 → Submit อีกครั้ง → Error "ส่งครบจำนวนแล้ว" (status 429)

หมายเหตุ: token ยังค้าง slot จน TTL หมด (1 นาที)
          ไม่ release ทันทีหลัง submit
```

---

## Test 4: Auto-enter เมื่อ slot ว่าง

```
(limit: 1)

Tab 1 (fingerprint A) → เห็นฟอร์ม (slot เต็มแล้ว)
Tab 2 (fingerprint B) → เห็นหน้ารอคิว กำลัง poll...

  กด F12 → Application → Cookies → ลบ wr_token_event_registration ของ Tab 1
  รีเฟรช Tab 1 (ไม่ submit)

  รอ 60 วินาที → DO alarm cleanup → slot คืน
  Tab 2 → poll ได้ token → redirect เข้าฟอร์มอัตโนมัติ ✓
```

---

## Test 5: Admin Reset

```
เปิด 2 browser profiles คนละ IP (หรือใช้ VPN):
  Browser A → /form/event-registration → เห็นฟอร์ม
  Browser B → /form/event-registration → เห็นหน้ารอคิว

เปิด admin:
  https://worker1-intake.softdebut-poc.workers.dev/admin/waiting-room
  → เห็น event-registration Active: 1 / 2

กด Reset → confirm
  → Active กลับเป็น 0
  Browser B → poll → ได้ slot → เข้าฟอร์มอัตโนมัติ ✓
  Browser A → refresh → ถูก redirect ไปหน้ารอ (token ถูกล้าง)
```

---

## Test 6: Load Test Bypass

```bash
# ไม่ติด waiting room เลย แม้ limit เต็ม
curl https://worker1-intake.softdebut-poc.workers.dev/form/event-registration \
  -H "X-Load-Test-Token: <your-token>" \
  -I
# → 200 OK เห็นฟอร์ม

# ยิง POST submit ก็ไม่ต้อง verify token
curl -X POST https://worker1-intake.softdebut-poc.workers.dev/submit/event-registration \
  -H "X-Load-Test-Token: <your-token>" \
  -F "fullName=LoadTest User 1" \
  -F "email=test@example.com"
# → {"ok":true,"submission_id":"..."}
```

ตั้งค่า token จริงด้วย:

```bash
npx wrangler secret put LOAD_TEST_TOKEN
# พิมพ์ค่า token เช่น "my-secret-loadtest-token"
```

---

## Test 7: ฟอร์ม 2 ตัวแยกกัน

```
เปิดพร้อมกัน:
  /form/event-registration (limit: 2) → ใช้ slot ของตัวเอง
  /form/newsletter         (limit: 2) → ใช้ slot ของตัวเอง

→ event-registration เต็ม ≠ ทำให้ newsletter เต็ม (DO แยก instance)
```

---

## ตรวจ API โดยตรง (curl)

```bash
BASE=https://worker1-intake.softdebut-poc.workers.dev

# ดูสถานะ
curl "$BASE/api/waiting-room/status?formType=event-registration"
# {"enabled":true,"formType":"event-registration","activeCount":1,"limit":2,"available":1}

# ขอ slot
curl "$BASE/api/waiting-room/acquire?formType=event-registration"
# {"ok":true,"tokenId":"uuid...","reused":false,"expiresAt":1234567890}
# หรือ
# {"ok":false,"position":1,"retryAfter":3,"activeCount":2,"limit":2}
```

---

## เสร็จแล้วคืนค่า limit จริง

```typescript
'event-registration': { enabled: true, limit: 5000, tokenTtlMinutes: 5, maxSubmitsPerToken: 3, shards: 1 },
```

```bash
npx wrangler deploy
```
