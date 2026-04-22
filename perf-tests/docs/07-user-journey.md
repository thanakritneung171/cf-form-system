# 07-user-journey.js — คู่มือการใช้งาน

จำลองพฤติกรรมผู้ใช้จริง — เข้าหน้าเว็บ → เลือกฟอร์ม → กรอกข้อมูล → ส่ง
รองรับ **Cloudflare Waiting Room** อัตโนมัติ (retry จนผ่าน)

---

## สารบัญ

- [Flow ต่อ 1 Virtual User](#flow)
- [Scenarios ทั้งหมด](#scenarios)
- [คำสั่งรัน](#commands)
- [Environment Variables](#env-vars)
- [Cloudflare Waiting Room](#waiting-room)
- [Metrics & Thresholds](#metrics)
- [Log File](#log-file)
- [Form Types](#form-types)

---

## Flow ต่อ 1 Virtual User {#flow}

```
VU เริ่มต้น
    │
    ▼  [jitter sleep 0–N วิ]  ← กระจาย VU ไม่ให้ชนพร้อมกัน
    │
    ▼
┌──────────────────────────────┐
│  GET /                       │  เข้าหน้า index
│  ✓ status 200                │
│  ✓ มี /form/ links           │
└──────────────┬───────────────┘
               │  ถ้าติด CF WR → retry GET / จนผ่าน
               │  think time 1–3 วิ
               ▼
    🎲 สุ่ม form type (1 ใน 10)
               │
               ▼
┌──────────────────────────────┐
│  GET /form/{type}            │  เปิดหน้าฟอร์ม
│  ✓ status 200                │
│  ✓ มี submit button          │
└──────────────┬───────────────┘
               │  ถ้าติด CF WR → retry GET /form/{type} จนผ่าน
               │  think time 2–7 วิ  (จำลองกรอกข้อมูล)
               ▼
┌──────────────────────────────┐
│  POST /submit/{type}         │  ส่งฟอร์ม
│  ✓ status 200                │
│  ✓ ok: true                  │
│  ✓ มี submission_id          │
└──────────────┬───────────────┘
               │  think time 1–2 วิ
               ▼
    รอบถัดไป ↺
```

---

## Scenarios ทั้งหมด {#scenarios}

| Scenario | Executor | VUs | ระยะเวลา | จุดประสงค์ |
|----------|----------|-----|---------|-----------|
| `ramp` | ramping-vus | 5 → 50 | ~16 นาที | Load ปกติ ค่อยๆ ขึ้น |
| `conn_200` | constant-vus | 200 | 2 นาที | Concurrent connections 200 คงที่ |
| `shared_200` | shared-iterations | 200 | สูงสุด 10 นาที | 200 iterations แบ่งกัน 200 VU |
| `shared_250` | shared-iterations | 250 | สูงสุด 10 นาที | 250 iterations แบ่งกัน 250 VU |
| `wr_flood` | constant-vus | 300 | 5 นาที | **บังคับให้ CF Waiting Room activate** |

---

### `ramp` — Load ปกติ (default)

```
VUs
 50 │                    ████████████████
 20 │          ██████████                 ▀▀▀▀▀▀
  5 │█████████▀
    └──────────────────────────────────────────▶ เวลา
      1m    3m    5m    2m    3m    1m
```

| Stage | ระยะเวลา | VUs | ความหมาย |
|-------|---------|-----|---------|
| Warm up | 1 นาที | 0 → 5 | เริ่มต้นช้าๆ ระบบ warm up |
| Ramp | 3 นาที | 5 → 20 | เพิ่ม load ทีละน้อย |
| Hold | 5 นาที | 20 | สังเกตความเสถียรที่ load ปกติ |
| Peak | 2 นาที | 20 → 50 | จำลอง peak hour |
| Hold peak | 3 นาที | 50 | วัด performance ที่ peak |
| Ramp down | 1 นาที | 50 → 0 | ลด load |

---

### `conn_200` — 200 Concurrent Users คงที่

200 VU ยิงพร้อมกันนาน 2 นาที — ทดสอบว่า Worker รับ concurrent load 200 ได้
JITTER=45 วิ → VU ทยอย start ไม่ชนพร้อมกัน

---

### `shared_200` / `shared_250` — Shared Iterations

200 (หรือ 250) iterations แบ่งกันทำ — แต่ละ VU รับ iteration จาก pool
เหมาะกับทดสอบว่าระบบรับ **รวม N submissions** ได้ครบ
JITTER สูง → กระจาย VU ไม่ให้ชนพร้อมกัน

---

### `wr_flood` — บังคับ CF Waiting Room

```
VUs
300 │████████████████████████████████████████
    └──────────────────────────────────────▶ เวลา
           5 นาที
```

ออกแบบมาเฉพาะเพื่อ **ทดสอบ CF Waiting Room** ให้ activate:

| Parameter | ค่า | เหตุผล |
|-----------|-----|--------|
| VUs | 300 | เกิน Total active users (200) |
| JITTER | 0 วิ | VU ทั้งหมด start พร้อมกัน → new_users/นาที พุ่งสูง |
| THINK_SCALE | 0.0 | ไม่มี sleep → request ต่อเนื่อง → active session สะสมเร็ว |
| WR_TIMEOUT | 600 วิ | รอ WR นานสูงสุด 10 นาที |
| WR_RETRY | 20 วิ | retry GET ทุก 20 วิ |

**CF Waiting Room จะ activate เมื่อ:**
`new_users_per_minute` เกิน threshold → 300 VU start พร้อมกัน = ~300 new users ใน 10 วิแรก
`total_active_users` เกิน 200 → 300 VU active session พร้อมกัน

---

## คำสั่งรัน {#commands}

> รันทุกคำสั่งจาก directory `perf-tests/`
> ```
> cd C:\web_source\cf-form-system\perf-tests
> ```

---

### วิธีที่ 1 — ใช้ Script (แนะนำ)

Script จะ set ค่า WR_TIMEOUT / WR_RETRY / JITTER / THINK_SCALE ให้อัตโนมัติ

**PowerShell (Windows):**
```powershell
# ramp (default)
.\scripts\run-journey.ps1

# conn_200
.\scripts\run-journey.ps1 conn_200

# shared_200
.\scripts\run-journey.ps1 shared_200

# shared_250
.\scripts\run-journey.ps1 shared_250

# wr_flood — บังคับ CF Waiting Room
.\scripts\run-journey.ps1 wr_flood
```

**Bash / Git Bash / WSL:**
```bash
# ramp (default)
bash scripts/run-journey.sh

# conn_200
bash scripts/run-journey.sh conn_200

# shared_200
bash scripts/run-journey.sh shared_200

# shared_250
bash scripts/run-journey.sh shared_250

# wr_flood — บังคับ CF Waiting Room
bash scripts/run-journey.sh wr_flood
```

---

### วิธีที่ 2 — คำสั่ง k6 โดยตรง (Manual)

**ramp (default):**
```bash
k6 run -e SCENARIO=ramp -e WR_TIMEOUT=300 -e WR_RETRY=15 -e JITTER=30 -e THINK_SCALE=1.0 scenarios/07-user-journey.js
```

**conn_200:**
```bash
k6 run -e SCENARIO=conn_200 -e WR_TIMEOUT=480 -e WR_RETRY=15 -e JITTER=45 -e THINK_SCALE=1.0 scenarios/07-user-journey.js
```

**shared_200:**
```bash
k6 run -e SCENARIO=shared_200 -e WR_TIMEOUT=480 -e WR_RETRY=15 -e JITTER=45 -e THINK_SCALE=1.0 scenarios/07-user-journey.js
```

**shared_250:**
```bash
k6 run -e SCENARIO=shared_250 -e WR_TIMEOUT=600 -e WR_RETRY=20 -e JITTER=60 -e THINK_SCALE=1.0 scenarios/07-user-journey.js
```

**wr_flood:**
```bash
k6 run -e SCENARIO=wr_flood -e WR_TIMEOUT=600 -e WR_RETRY=20 -e JITTER=0 -e THINK_SCALE=0.0 scenarios/07-user-journey.js
```

---

### วิธีที่ 3 — เปลี่ยน BASE_URL (ทดสอบ environment อื่น)

```bash
# ทดสอบ production
k6 run -e SCENARIO=ramp -e BASE_URL=https://your-worker.workers.dev \
  -e WR_TIMEOUT=300 -e WR_RETRY=15 -e JITTER=30 -e THINK_SCALE=1.0 \
  scenarios/07-user-journey.js

# ทดสอบ local (CF WR ไม่ทำงาน)
k6 run -e SCENARIO=ramp -e BASE_URL=http://localhost:8787 \
  -e WR_TIMEOUT=300 -e WR_RETRY=15 -e JITTER=30 -e THINK_SCALE=1.0 \
  scenarios/07-user-journey.js
```

หรือตั้งใน `.env`:
```env
BASE_URL=https://your-worker.workers.dev
```

---

### Debug — รัน VU เดียว ไม่บันทึก log

```bash
# รัน 1 VU, 3 iterations — ดู flow ว่าทำงานถูก
k6 run --vus 1 --iterations 3 -e SCENARIO=ramp -e WR_TIMEOUT=60 -e WR_RETRY=5 -e JITTER=0 -e THINK_SCALE=1.0 scenarios/07-user-journey.js
```

---

## Environment Variables {#env-vars}

| Variable | Default | ความหมาย |
|----------|---------|---------|
| `SCENARIO` | `ramp` | ชื่อ scenario ที่จะรัน |
| `BASE_URL` | `http://localhost:8787` | URL ของ Worker |
| `WR_TIMEOUT` | `300` | รอ CF Waiting Room นานสูงสุด (วินาที) |
| `WR_RETRY` | `15` | retry GET ทุกกี่วินาที เมื่อติด WR |
| `JITTER` | `30` | random delay ก่อนเริ่ม (0 = ไม่มี jitter) |
| `THINK_SCALE` | `1.0` | ตัวคูณ think time (0.0 = ไม่มี think time) |

**ตารางค่า default แต่ละ scenario:**

| Scenario | WR_TIMEOUT | WR_RETRY | JITTER | THINK_SCALE |
|----------|-----------|---------|--------|------------|
| ramp | 300s | 15s | 30s | 1.0 |
| conn_200 | 480s | 15s | 45s | 1.0 |
| shared_200 | 480s | 15s | 45s | 1.0 |
| shared_250 | 600s | 20s | 60s | 1.0 |
| **wr_flood** | **600s** | **20s** | **0s** | **0.0** |

---

## Cloudflare Waiting Room {#waiting-room}

### CF Waiting Room ทำงานอย่างไร

CF Waiting Room มี **2 threshold** — ต้องเกินทั้งคู่จึง activate:

| Threshold | ความหมาย |
|-----------|---------|
| `Total active users` | จำนวน active session พร้อมกันสูงสุด |
| `New users per minute` | rate ของ new user ต่อนาทีที่ยอมรับ |

> CF นับ "active user" ผ่าน **`__cfwaitingroom` cookie**
> ผู้ใช้ที่เข้ามาและมี cookie อยู่ = active จนกว่า session duration จะหมด (default 5 นาที)

---

### Flow เมื่อ VU เจอ CF Waiting Room

```
GET / หรือ GET /form/{type}
         │
         ▼  response body ตรวจหา:
         │  - "Waiting Room powered by Cloudflare"
         │  - "waitingrooms-text"
         │  - "waiting-room"
         │  - "ผู้เข้าใช้เต็ม" / "ระบบยุ่ง"
         │
    ติด WR? ─── ไม่ใช่ ──▶ ดำเนินการต่อ
         │
        ใช่
         │
         ▼
    บันทึก waiting_room_hits counter
    log: "CF WR — formType: X, retrying every Ys..."
         │
         ▼  loop จนกว่าจะผ่านหรือ timeout
    sleep(WR_RETRY_SEC)
    GET /form/{type}
         │
    ผ่าน WR? ─── ใช่ ──▶ กรอกฟอร์ม → submit
         │
        ไม่
         │ (ทำซ้ำจนครบ maxAttempts)
         ▼
    timeout → skip iteration นี้
    log: "WR timeout — skipping {formType}"
```

---

### ทำไม `shared_250` ถึงอาจไม่ติด CF WR

| สาเหตุ | รายละเอียด |
|-------|-----------|
| ทดสอบกับ localhost | CF WR เป็น Cloudflare Edge feature — ไม่ทำงานบน local dev |
| JITTER สูง | 250 VU กระจายใน 60 วิ = ~4 VU/วิ → new_users/นาที ไม่สูงพอ |
| Think time ยาว | 4–12 วิ/iteration → VU ไม่ได้ active พร้อมกันทั้งหมด |
| `new_users_per_minute` threshold | ต้องเกิน **ทั้งคู่** — ถ้าตั้ง new_users/นาที สูงเกินไป WR ไม่ activate |

**แก้ไข:** ใช้ `wr_flood` แทน — JITTER=0, THINK_SCALE=0, 300 VU → ติด WR แน่นอน

---

### CF Dashboard ที่ต้องตั้งค่าสำหรับทดสอบ

```
Cloudflare Dashboard → Traffic → Waiting Rooms → แก้ไข

Total active users   = 50      ← ต่ำๆ ให้ trigger ง่าย (ขั้นต่ำ 200 สำหรับ Free/Pro)
New users per minute = 20
Session duration     = 1 นาที  ← สั้น ให้ slot ว่างเร็ว
```

> **หมายเหตุ:** Free/Pro plan ต้องตั้ง `Total active users` ≥ 200
> Enterprise สามารถตั้งต่ำกว่าได้

---

## Metrics & Thresholds {#metrics}

### Thresholds (เกณฑ์ผ่าน/ไม่ผ่าน)

| Metric | เกณฑ์ | ความหมาย |
|--------|-------|---------|
| `http_req_duration{page_type:index}` p95 | < 800ms | หน้า index ตอบเร็ว |
| `http_req_duration{page_type:form-page}` p95 | < 1,500ms | หน้าฟอร์มตอบได้ |
| `http_req_duration{page_type:submit}` p95 | < 5,000ms | submit ยอมรับ queue/validation |
| `http_req_failed` rate | < 10% | error rate รวมทั้งหมด |

---

### Custom Metrics

| Metric | ประเภท | ความหมาย |
|--------|--------|---------|
| `waiting_room_hits` | Counter | จำนวนครั้งที่ VU เจอ CF WR (แยก tag `form_type`) |
| `submit_waiting_room_hits` | Counter | จำนวนครั้งที่ submit endpoint คืน WR HTML แทน JSON |

---

### Tags ใน Metrics

| Tag | ค่าตัวอย่าง | ใช้กับ |
|-----|-----------|-------|
| `page` | `/`, `/form/contact`, `/submit/contact` | แยก metric ต่อ URL path |
| `page_type` | `index`, `form-page`, `submit` | แยก metric ต่อประเภทหน้า |
| `form_type` | `contact`, `newsletter`, ... | แยก waiting_room_hits ต่อ form |

---

## Log File {#log-file}

เมื่อ test เสร็จ จะสร้าง log อัตโนมัติที่:

```
perf-tests/logs/YYYY-MM-DD_HH-MM-SS_user-journey.log
```

### ตัวอย่าง log

```
╔════════════════════════════════════════════════════════════════╗
║  k6 Load Test Summary — USER-JOURNEY                           ║
╚════════════════════════════════════════════════════════════════╝

  วันที่    : 2026-04-21
  เวลา     : 10:30:00
  Scenario : user-journey

────────────────────────────────────────────────────────────────

  📊 ภาพรวม

  Requests รวม     : 3,420
  Requests สำเร็จ  : 3,400   (99.4%)
  Requests ล้มเหลว : 20      (0.6%)
  Iterations       : 1,140
  VUs สูงสุด       : 50
  Avg response     : 312 ms
  p(95) response   : 890 ms

────────────────────────────────────────────────────────────────

  🌐 Requests แยกต่อ URL

  /                                    1140   ✓1132   ✗8    avg 124ms  p95 205ms
  /form/contact                         112   ✓112    ✗0    avg 201ms  p95 325ms
  /submit/contact                       112   ✓110    ✗2    avg 580ms  p95 1620ms
  ...

────────────────────────────────────────────────────────────────

  🚦 CF Waiting Room Hits

  waiting_room_hits รวม     : 23 ครั้ง
  submit_waiting_room_hits  : 2  ครั้ง

  form_type               เจอ WR (ครั้ง)
  ────────────────────────────────────
  event-registration           9
  newsletter                   7
  contact                      5
  feedback                     2
```

---

## Form Types {#form-types}

| Form Type | ประเภท | มีไฟล์แนบ | Think time |
|-----------|--------|----------|-----------|
| `contact` | ติดต่อทั่วไป | ไม่มี | 2–5 วิ |
| `newsletter` | สมัครรับข่าวสาร | ไม่มี | 2–5 วิ |
| `feedback` | ให้คะแนน/ความคิดเห็น | ไม่มี | 2–5 วิ |
| `event-registration` | ลงทะเบียนอีเวนต์ | ไม่มี | 2–5 วิ |
| `product-inquiry` | สอบถามสินค้า | ไม่มี | 2–5 วิ |
| `job-application` | สมัครงาน | PDF (resume) | 3–7 วิ |
| `complaint` | ร้องเรียน | PNG (รูปภาพ) | 3–7 วิ |
| `warranty-claim` | รับประกันสินค้า | PDF (ใบเสร็จ) | 3–7 วิ |
| `partnership` | ขอเป็นพาร์ทเนอร์ | PDF (company profile) | 3–7 วิ |
| `incident-report` | รายงานเหตุการณ์ | PNG (หลักฐาน) | 3–7 วิ |

> `THINK_SCALE=0.0` (wr_flood) → think time ทั้งหมดเป็น 0 วินาที

---

## เปรียบเทียบกับ Scenario อื่น

| | 01–06 | ramp | shared_250 | wr_flood |
|--|-------|------|-----------|---------|
| Flow | POST ตรง | Full journey | Full journey | Full journey |
| Think time | fixed | 1–7 วิ | 1–7 วิ | **0 วิ** |
| Jitter | ไม่มี | 30 วิ | 60 วิ | **0 วิ** |
| ทดสอบ HTML | ไม่ | ใช่ | ใช่ | ใช่ |
| รองรับ CF WR | ไม่ | ใช่ | ใช่ | ใช่ |
| บังคับ CF WR | ไม่ | ไม่ | บางครั้ง | **ใช่** |
| เหมาะกับ | stress/spike | regression | capacity | WR testing |
