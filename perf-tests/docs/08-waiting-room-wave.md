# 08-waiting-room-wave.js — คู่มือการใช้งาน

## ทดสอบอะไร?

`08-waiting-room-wave.js` วัดพฤติกรรม Cloudflare Waiting Room แบบ **one-shot wave** —  
ยิง users พร้อมกันทีเดียว แล้วนับว่ากี่คนเข้าระบบได้ทันที (active) กับกี่คนถูกเข้าคิว (queued)

| scenario อื่น | waiting-room-wave (08) |
|--------------|----------------------|
| หลาย iteration ต่อ VU | 1 iteration ต่อ VU เท่านั้น |
| VU เริ่มทยอย (ramp) | VU ทุกตัวเริ่มพร้อมกัน (wave) |
| ไม่แยก active vs queued | นับ active_first_hit / queue_first_hit |
| test throughput / latency | test Waiting Room capacity ว่าตั้งค่าถูกไหม |

---

## หลักการวัด (Measurement Model)

มีจุดวัดเพียงจุดเดียวคือ **FIRST HIT** — request แรกที่ VU ส่งไปยัง `/form/{type}`

```
FIRST HIT (/form/{type})
        │
        ▼
   response body เป็น waiting room page?
        │
        ├─ ไม่ใช่ → active_first_hit++   [VU X] FIRST HIT → ACTIVE
        │
        └─ ใช่   → queue_first_hit++    [VU X] FIRST HIT → QUEUE
```

**สิ่งที่ไม่นับ (critical):**
- request หลังจาก first hit ทุกชนิด
- การที่ queued user ได้รับ slot ในภายหลัง — บันทึกแยกเป็น `queue_to_active` แต่ไม่เพิ่ม active_first_hit

---

## Flow ต่อ 1 Virtual User

```
VU เริ่มต้น (ทุก VU พร้อมกัน)
    │
    ▼
┌─────────────────────────────┐
│  GET /                      │  เข้าหน้า index
└─────────────┬───────────────┘
              │ think time 0.5–1.5 วิ  (สั้นกว่า 07 เพื่อให้ wave แน่น)
              ▼
    🎲 สุ่ม form type (1 ใน 10)
              │
              ▼
┌─────────────────────────────────────────────────────┐
│  GET /form/{type}   ← ── ── FIRST HIT (จุดวัด) ── ─│
│                                                     │
│  ถ้า ACTIVE → active_first_hit++                    │
│  ถ้า QUEUE  → queue_first_hit++                     │
└─────────────┬───────────────────────────────────────┘
              │
     ┌────────┴────────────────┐
     │ ACTIVE                  │ QUEUE
     ▼                         ▼
think 2–7 วิ          poll /api/waiting-room/acquire
     │                  ทุก 3 วิ จนได้ { ok: true }
     │                  หรือ timeout 120 วิ → exit
     │                         │
     │                  queue_to_active++
     │                  [VU X] ACQUIRED SLOT AFTER Xs
     │                         │
     │                  GET /form/{type}  (เปิดซ้ำ — ไม่นับใน metrics)
     │                  think 2–7 วิ
     │                         │
     └──────────┬──────────────┘
                ▼
       POST /submit/{type}
                │
                ▼
           VU จบการทำงาน
```

---

## Custom Metrics

| Metric | ประเภท | นับเมื่อไหร่ |
|--------|--------|------------|
| `active_first_hit` | Counter | first hit → ไม่ใช่ waiting room page |
| `queue_first_hit` | Counter | first hit → เป็น waiting room page |
| `queue_to_active` | Counter | queued user ได้รับ slot สำเร็จ (informational) |

### ความสัมพันธ์ระหว่าง metrics

```
active_first_hit + queue_first_hit = จำนวน VU ทั้งหมดที่วัดได้
queue_to_active ≤ queue_first_hit  (บางคนอาจ timeout ก่อนได้ slot)
```

---

## Executor Config

ใช้ `per-vu-iterations` — เหมาะกับ wave test ที่สุด

```js
executor:   'per-vu-iterations'
vus:        250   // ปรับด้วย -e VUS=N
iterations: 1     // แต่ละ VU รันครั้งเดียวเสมอ
```

| executor อื่น | ทำไมไม่ใช้ |
|--------------|-----------|
| `shared-iterations` | 250 VU อาจไม่ได้รัน 250 iterations พร้อมกัน |
| `constant-vus` | VU loop ซ้ำ — นับ active ซ้ำ |
| `ramping-vus` | VU ไม่ได้เริ่มพร้อมกัน |

---

## วิธีรัน

### รันพื้นฐาน (250 VUs)
```bash
cd perf-tests
k6 run scenarios/08-waiting-room-wave.js
```

### กำหนดจำนวน VU เอง
```bash
k6 run -e VUS=300 scenarios/08-waiting-room-wave.js
```

### เปลี่ยน target URL
```bash
k6 run \
  -e BASE_URL=https://my-worker.workers.dev \
  -e VUS=250 \
  scenarios/08-waiting-room-wave.js
```

### ทดสอบ flow ก่อนรันจริง (VU น้อย)
```bash
k6 run -e VUS=5 scenarios/08-waiting-room-wave.js
```

### บันทึก JSON output
```bash
k6 run \
  --out json=results/wave-$(date +%Y%m%d-%H%M).json \
  scenarios/08-waiting-room-wave.js
```

### PowerShell (Windows)
```powershell
k6 run `
  -e BASE_URL=http://localhost:8787 `
  -e VUS=250 `
  scenarios/08-waiting-room-wave.js
```

---

## ไฟล์ Log สรุป

เมื่อ test เสร็จ จะสร้างไฟล์ log อัตโนมัติที่:

```
perf-tests/
└── logs/
    └── 2026-04-21_10-00-00_waiting-room-wave.log
```

### ตัวอย่างผลลัพธ์ที่คาดหวัง (250 VUs, capacity 200)

```
╔════════════════════════════════════════════════════════════╗
║  k6 — Waiting Room Wave Test Summary                       ║
╚════════════════════════════════════════════════════════════╝

  Date     : 2026-04-21
  Time     : 10:00:00

  ────────────────────────────────────────────────────────────

  🎯 Waiting Room Classification (first hit only)

  Active users (admitted immediately) :    200
  Queued users (sent to waiting room) :     50
  ─────────────────────────────────────────────
  Total users measured                :    250

  Queue → Active transitions          :     47

  ────────────────────────────────────────────────────────────
```

> `queue_to_active` ต่ำกว่า `queue_first_hit` ได้ ถ้าบาง VU timeout ก่อนได้รับ slot

---

## ตัวอย่าง Console Log ระหว่างรัน

```
[VU 12]  FIRST HIT → ACTIVE (formType: contact)
[VU 13]  FIRST HIT → QUEUE  (formType: event-registration)
[VU 47]  FIRST HIT → ACTIVE (formType: newsletter)
[VU 13]  ACQUIRED SLOT AFTER 12s
[VU 198] FIRST HIT → QUEUE  (formType: feedback)
[VU 198] QUEUE TIMEOUT — giving up on feedback after 120s
```

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

## การตีความผลลัพธ์

### กรณีปกติ — Waiting Room ตั้งค่าถูกต้อง

```
active_first_hit ≈ capacity ที่ตั้งไว้
queue_first_hit  = 250 - active_first_hit
```

ความคลาดเคลื่อน ±5 คนถือว่าปกติ เนื่องจาก VU ไม่ได้ hit พร้อมกันแบบ atomic จริง ๆ

### กรณีผิดปกติ

| สิ่งที่เห็น | สาเหตุ |
|-----------|--------|
| `active_first_hit = 250` (ทุกคนเข้าได้) | capacity ตั้งสูงเกินหรือ Waiting Room ไม่ทำงาน |
| `active_first_hit = 0` (ทุกคนถูกคิว) | capacity ตั้ง 0 หรือ Waiting Room ค้างอยู่เต็ม |
| `active + queued < 250` | บาง VU error ก่อนถึง first hit — ดูที่ `http_req_failed` |
| `queue_to_active` ต่ำมาก | poll timeout 120 วิสั้นเกิน หรือ acquire API มีปัญหา |

---

## เปรียบเทียบกับ Scenario อื่น

| | 07-user-journey | 08-waiting-room-wave |
|--|-----------------|---------------------|
| วัตถุประสงค์ | realistic user load | Waiting Room capacity validation |
| executor | ramping-vus | per-vu-iterations |
| iterations ต่อ VU | ไม่จำกัด | 1 ครั้งเท่านั้น |
| เริ่มพร้อมกัน | ไม่ (ramp) | ใช่ (wave) |
| metrics หลัก | latency, error rate | active_first_hit, queue_first_hit |
| เหมาะกับ | regression, load profile | ตรวจสอบ Waiting Room config |

---

## Cleanup หลังทดสอบ

ข้อมูล load test ชื่อ `LoadTest User ...` จะสะสมใน database ล้างด้วย:

```bash
curl -X POST https://your-worker.workers.dev/admin/loadtest/cleanup \
  -b "session=<your-session-cookie>"
```

หรือเข้าหน้า Admin → Load Test → Clear Data
