# 07-user-journey.js — คู่มือการใช้งาน

## ทดสอบอะไร?

`07-user-journey.js` จำลองพฤติกรรมผู้ใช้จริง — ไม่ใช่แค่ยิง API ตรง ๆ

| scenario เดิม (01–06) | user-journey (07) |
|----------------------|-------------------|
| POST `/submit/contact` ตรงทันที | เข้า `/` ก่อน → เลือกฟอร์ม → กรอก → submit |
| ไม่มี think time | มี think time ระหว่างขั้นตอน |
| test เฉพาะ backend API | test ทั้ง frontend HTML + backend API |
| เหมาะกับ stress/spike | เหมาะกับ load ปกติและ regression |

---

## Flow ต่อ 1 Virtual User (1 รอบ)

```
VU เริ่มต้น
    │
    ▼
┌─────────────────────────────┐
│  GET /                      │  เข้าหน้า index — เห็น list ฟอร์มทั้งหมด
│  ตรวจ: status 200           │
│        มี /form/ links      │
└─────────────┬───────────────┘
              │ think time 1–3 วิ  (จำลองผู้ใช้อ่านและเลือก)
              ▼
    🎲 สุ่ม form type (1 ใน 10)
              │
              ▼
┌─────────────────────────────┐
│  GET /form/{type}           │  เปิดหน้าฟอร์มที่เลือก
│  ตรวจ: status 200           │
│        มี submit button     │
└─────────────┬───────────────┘
              │ think time 2–5 วิ  (กรอกข้อมูล / แนบไฟล์)
              │ ฟอร์มที่มีไฟล์: 3–7 วิ
              ▼
┌─────────────────────────────┐
│  POST /submit/{type}        │  ส่งฟอร์ม
│  ตรวจ: status 200           │
│        ok: true             │
│        มี submission_id     │
└─────────────┬───────────────┘
              │ think time 1–2 วิ
              ▼
    รอบถัดไป ↺
```

---

## ขั้นตอน URL ที่ถูก hit

| ขั้นตอน | Method | Path | `page` tag ใน metrics |
|---------|--------|------|----------------------|
| 1 | GET | `/` | `page:/` |
| 2 | GET | `/form/{type}` | `page:/form/contact`, `page:/form/newsletter`, ... (แยกต่อ type) |
| 3 | POST | `/submit/{type}` | `page:/submit/contact`, `page:/submit/newsletter`, ... |
| 3b (ถ้าเจอ waiting room) | GET | `/api/waiting-room/acquire?formType=...` | `page:/api/waiting-room/acquire` |

> **หมายเหตุ:** ใช้ custom tag `page` แทน `url` เพราะ `url` เป็น system tag ของ k6
> ที่ไม่สามารถ override สำหรับ sub-metrics ได้

---

## Load Profile

```
VUs
 50 │                    ████████████████
    │               ████▀              ▀████
 20 │          █████▀                       ▀
    │    ██████▀
  5 │████▀
    └────────────────────────────────────────▶ เวลา
      1m   1m   3m   5m   2m   3m   1m
    ramp  hold  hold peak hold  hold ramp-down
         up

ระยะเวลารวม: ~16 นาที
```

| Stage | ระยะเวลา | VUs | จุดประสงค์ |
|-------|---------|-----|-----------|
| Ramp up | 1 นาที | 0 → 5 | เริ่มต้นช้า ๆ |
| Load | 3 นาที | 5 → 20 | เพิ่ม load ปกติ |
| Hold | 5 นาที | 20 | observe ผลลัพธ์ |
| Peak | 2 นาที | 20 → 50 | peak hour |
| Hold peak | 3 นาที | 50 | สังเกตความเสถียร |
| Ramp down | 1 นาที | 50 → 0 | ลด load |

---

## Thresholds

| Metric | เกณฑ์ | ความหมาย |
|--------|-------|---------|
| `http_req_duration{page_type:index}` p95 | < 800ms | หน้า index ต้องตอบเร็ว |
| `http_req_duration{page_type:form-page}` p95 | < 1,500ms | หน้าฟอร์มต้องตอบได้ |
| `http_req_duration{page_type:submit}` p95 | < 5,000ms | submit มี queue/validation |
| `http_req_failed` rate | < 10% | error rate รวมทั้งหมด |

> **หมายเหตุ:** `page_type` เป็น group tag (index/form-page/submit/waiting-room-api)
> ส่วน `page` เป็น tag รายละเอียดแยกต่อ URL path — ทั้งคู่ถูก track ใน metrics

---

## วิธีรัน

### รันพื้นฐาน
```bash
cd perf-tests
k6 run scenarios/07-user-journey.js
```

### เปลี่ยน BASE_URL (เช่น ทดสอบ local)
```bash
k6 run -e BASE_URL=http://localhost:8787 scenarios/07-user-journey.js
```

### เปลี่ยน BASE_URL + ใช้ token อื่น
```bash
k6 run \
  -e BASE_URL=https://my-worker.workers.dev \
  -e LOAD_TEST_TOKEN=my-token \
  scenarios/07-user-journey.js
```

### รันเฉพาะ VU น้อย (ทดสอบ flow ว่าทำงานถูก)
```bash
k6 run --vus 1 --iterations 3 scenarios/07-user-journey.js
```

### บันทึก JSON output ด้วย
```bash
k6 run \
  --out json=results/user-journey-$(date +%Y%m%d-%H%M).json \
  scenarios/07-user-journey.js
```

### PowerShell (Windows)
```powershell
k6 run `
  -e BASE_URL=http://localhost:8787 `
  scenarios/07-user-journey.js
```

---

## ไฟล์ Log สรุป

เมื่อ test เสร็จ จะสร้างไฟล์ log อัตโนมัติที่:

```
perf-tests/
└── logs/
    └── 2026-04-20_14-30-00_user-journey.log
```

> **หมายเหตุ:** log ใช้ flat path (ไม่มี subdirectory) เพราะ k6 ไม่สร้าง directory อัตโนมัติ

### ตัวอย่าง log ที่ได้

```
╔════════════════════════════════════════════════════════════════════════════╗
║  k6 Load Test Summary — USER-JOURNEY                                       ║
╚════════════════════════════════════════════════════════════════════════════╝

  วันที่    : 2026-04-20
  เวลา     : 14:30:00
  Scenario : user-journey

────────────────────────────────────────────────────────────────────────────

  📊 ภาพรวม

  Requests รวม     : 3,420
  Requests สำเร็จ  : 3,408
  Requests ล้มเหลว : 12 (0.35%)
  Iterations       : 1,140
  VUs สูงสุด       : 50
  Avg response     : 312 ms
  p(95) response   : 890 ms
  p(99) response   : 1,450 ms
  Waiting Room เจอ : 23 ครั้ง

────────────────────────────────────────────────────────────────────────────

  🌐 หน้าที่เปิด / URL ที่เข้าถึง

  ── หน้า Index ───────────────────────────────────────────────────────────

  Path                                        Reqs    สำเร็จ  ล้มเหลว  Avg ms  p95 ms
  /                                           1140      1132        8     124     205

  ── หน้า Form (กดเลือกจาก Index) ────────────────────────────────────────

  /form/event-registration                     118       118        0     210     340
  /form/newsletter                             115       115        0     198     312
  /form/contact                                112       112        0     201     325
  ...

  ── Submit Form (ส่งข้อมูล) ──────────────────────────────────────────────

  /submit/event-registration                   118       116        2     580    1620
  /submit/newsletter                           115       114        1     490    1340
  ...

  ── Waiting Room API (poll ขอ slot) ──────────────────────────────────────

  /api/waiting-room/acquire                     69        69        0     180     290

────────────────────────────────────────────────────────────────────────────

  🚦 Waiting Room — form ที่ถูก block

  เจอ Waiting Room รวม : 23 ครั้ง

  Form Type                           เจอกี่ครั้ง
  ──────────────────────────────────────────────────
  event-registration                  9
  newsletter                          7
  contact                             5
  feedback                            2
```

> ทุก 1 iteration = GET `/` + GET `/form/{type}` + POST `/submit/{type}`
> ถ้าเจอ Waiting Room จะมี GET `/api/waiting-room/acquire` เพิ่มด้วย

---

## Checks ที่ตรวจสอบ

| Check | ตรวจอะไร |
|-------|---------|
| `index: status 200` | หน้า index ต้องตอบ 200 |
| `index: has form links` | HTML ต้องมี `/form/` link |
| `form-page: status 200` | หน้าฟอร์มต้องตอบ 200 |
| `form-page: has submit button` | HTML ต้องมีปุ่ม submit |
| `submit: status 200` | API ต้องตอบ 200 |
| `submit: ok true` | JSON body ต้องมี `ok: true` |
| `submit: has submission_id` | ต้องได้ `submission_id` กลับมา |

---

## Form Types ที่สุ่มเลือก

| Form Type | ประเภท | มีไฟล์ | Think time |
|-----------|--------|-------|-----------|
| contact | ติดต่อทั่วไป | ไม่มี | 2–5 วิ |
| newsletter | สมัครรับข่าว | ไม่มี | 2–5 วิ |
| feedback | ให้คะแนน | ไม่มี | 2–5 วิ |
| event-registration | ลงทะเบียนอีเวนต์ | ไม่มี | 2–5 วิ |
| product-inquiry | สอบถามสินค้า | ไม่มี | 2–5 วิ |
| job-application | สมัครงาน | PDF (resume) | 3–7 วิ |
| complaint | ร้องเรียน | PNG (รูปภาพ) | 3–7 วิ |
| warranty-claim | รับประกันสินค้า | PDF (ใบเสร็จ) | 3–7 วิ |
| partnership | ขอเป็นพาร์ทเนอร์ | PDF (company profile) | 3–7 วิ |
| incident-report | รายงานเหตุการณ์ | PNG (หลักฐาน) | 3–7 วิ |

---

## เปรียบเทียบกับ Scenario อื่น

| | 01-smoke | 02-load | 07-user-journey |
|--|---------|---------|----------------|
| flow | POST ตรง | POST ตรง | GET index → GET form → POST |
| think time | fixed 1s | fixed 0.5s | random 1–7s |
| form selection | contact เท่านั้น | random | random (สุ่มตาม user จริง) |
| ทดสอบ HTML rendering | ไม่ | ไม่ | ใช่ |
| รองรับ Waiting Room | ไม่ (429 = fail) | ไม่ (429 = fail) | ใช่ (poll จนได้ slot) |
| log per-URL | ไม่มี | ไม่มี | มี (แยกตาม path + waiting room stats) |
| เหมาะกับ | smoke check | load baseline | realistic regression |

---

## Waiting Room Handling

`07-user-journey.js` รองรับ Waiting Room อัตโนมัติ — ไม่ต้องตั้งค่าเพิ่ม

### Flow เมื่อเจอ Waiting Room

```
GET /form/{type}
    │
    ▼ response body มีคำว่า "waiting-room" / "ผู้เข้าใช้เต็ม" / "ระบบยุ่ง"?
    │
    ├─ ไม่ใช่ → ดำเนินการต่อ (กรอกฟอร์ม → submit)
    │
    └─ ใช่ → บันทึก waiting_room_hits counter
              → poll GET /api/waiting-room/acquire ทุก 3 วิ
              → ถ้าได้ { ok: true } → เปิดหน้าฟอร์มอีกครั้ง → submit
              → ถ้า timeout 60 วิ → skip iteration นี้ (console.warn)
```

### Log สรุป Waiting Room

ดูได้ใน section `🚦 Waiting Room — form ที่ถูก block` ของ log file
แสดงจำนวนครั้งที่เจอ waiting room แยกตาม form type

---

## Cleanup หลังทดสอบ

ข้อมูล load test ชื่อ `LoadTest User ...` จะสะสมใน database ล้างด้วย:

```bash
curl -X POST https://your-worker.workers.dev/admin/loadtest/cleanup \
  -b "session=<your-session-cookie>"
```

หรือเข้าหน้า Admin → Load Test → Clear Data
