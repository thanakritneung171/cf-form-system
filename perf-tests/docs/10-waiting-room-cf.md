# 10-waiting-room-cf.js — คู่มือการใช้งาน

## ทดสอบอะไร?

`10-waiting-room-cf.js` เป็น **wave test** ที่ยิง 250 VUs พร้อมกันไปยัง URL เดียว
เพื่อวัดพฤติกรรม **Cloudflare Waiting Room (native)** ว่า:

- มีกี่คนถูก **admit ทันที** (เห็นหน้า origin)
- มีกี่คนถูก **เข้าคิว** (เห็นหน้า Waiting Room)
- คนที่ถูกคิวต้องรอนานแค่ไหนก่อนเข้าได้

ต่างจาก `08-waiting-room-wave.js` ตรงที่ **ไม่ใช้** API backend ของ worker
(`/api/waiting-room/acquire`) แต่ poll เข้า URL เดิมซ้ำ ๆ ให้ Cloudflare เป็นคน
ตัดสินใจว่า user จะได้ slot เมื่อไร — เหมือน browser จริง

---

## Waiting Room config ที่ทดสอบ

| ค่า | จำนวน |
|------|-------|
| Total Active Users | 200 |
| New Users Per Minute | 200 |
| Session Duration | 60s |
| VUs ที่ยิง | 250 |

คาดหวัง: 200 คนแรกเข้าได้ทันที อีก 50 คนถูกเข้าคิว
และทยอยได้ slot ตอน session ของ 200 คนแรกหมดอายุ (≥60 วิ)

---

## Flow ต่อ 1 Virtual User

```
VU เริ่มพร้อมกันที่ t=0
        │
        ▼
┌────────────────────────────┐
│  GET TARGET_URL            │  ← initial request
└─────────────┬──────────────┘
              │
     response เป็น Waiting Room page?
              │
    ┌─────────┴──────────┐
    │ NO (origin)        │ YES (queued)
    ▼                    ▼
admitted_users++    queued_users++
[VU X] ADMITTED     [VU X] QUEUED
    │                    │
sleep(60s)          loop: sleep 3–5s → GET TARGET_URL
    │                    │          (ทำจน admit ได้ หรือ timeout)
    │                    ▼
    │          [VU X] WAITING — attempt N, Ys elapsed
    │                    │
    │            admit แล้ว?
    │                    │
    │                   yes
    │                    ▼
    │         waiting_time.add(ms)
    │         admitted_users++
    │         [VU X] ADMITTED after Zs
    │         sleep(60s)
    │                    │
    └────────┬───────────┘
             ▼
        VU จบการทำงาน
```

---

## Custom Metrics

| Metric | ประเภท | นับเมื่อไหร่ |
|--------|--------|------------|
| `admitted_users` | Counter | VU เข้าได้ (ทันที หรือหลังเข้าคิว) |
| `queued_users` | Counter | VU เจอหน้า Waiting Room ใน request แรก |
| `waiting_time` | Trend (ms) | เวลาตั้งแต่ request แรกจนกระทั่ง admit (เฉพาะคนที่ถูกคิว) |

### ความสัมพันธ์

```
admitted_users + queued_users = VUs ทั้งหมดที่เข้าถึง Waiting Room ได้
admitted_users ≥ queued users ที่ได้รับ slot ในที่สุด
```

> คนที่ถูกคิวแล้วในที่สุด admit ได้ จะถูกนับใน **ทั้ง** `queued_users` (ตอนแรก)
> และ `admitted_users` (ตอน poll สำเร็จ) — ออกแบบให้ `admitted_users` สะท้อน
> จำนวนคนที่ **ในที่สุด** เข้าระบบได้

---

## Thresholds

```js
admitted_users:  ['count>=200']   // ต้อง admit ≥ 200 คน
http_req_failed: ['rate<0.05']    // transport error < 5%
```

`count>=200` คือ sanity check ว่า Waiting Room ปล่อยคนเข้าตาม capacity ที่ตั้งไว้
(ไม่ใช่ pass ทุกคน หรือ block ทุกคน)

---

## Executor

```js
executor:    'per-vu-iterations'
vus:         250
iterations:  1
maxDuration: '700s'  // พอสำหรับ poll timeout + session
```

### ทำไมไม่ใช้ `constant-vus`?

| executor | ปัญหา |
|----------|-------|
| `constant-vus` | VU loop ซ้ำตลอด duration → `admitted_users` ถูกนับหลายรอบ |
| `ramping-vus` | VU ไม่ได้เริ่มพร้อมกัน ทำให้ไม่ใช่ wave |
| `shared-iterations` | ไม่รับประกันว่า 250 VU จะรันพร้อมกัน |
| `per-vu-iterations` ✓ | VU ทุกตัวเริ่ม t=0 แล้วจบหลัง 1 iteration — เป็น wave แท้ |

---

## การตรวจจับ Waiting Room page

ใช้หลายวิธีรวมกัน เพราะ Cloudflare ไม่มี header สาธารณะที่เสถียร:

1. Response header `cf-waiting-room` (ถ้ามี)
2. Body มี keyword: `waiting-room`, `waitingrooms-text`,
   `Waiting Room powered by Cloudflare`, `cf-waiting-room`
3. Body มี Cloudflare challenge pattern + `waitingroom`
4. Body มีข้อความภาษาไทย: `ผู้เข้าใช้เต็ม`, `ระบบยุ่ง`, `คุณอยู่ในคิว`

ถ้าไม่เข้าเงื่อนไขข้างบน = origin page = ADMITTED

---

## วิธีรัน

### รันพื้นฐาน (250 VUs → URL default)
```bash
cd perf-tests
k6 run scenarios/10-waiting-room-cf.js
```

### เปลี่ยน target URL
```bash
k6 run -e TARGET_URL=https://your-site.example.com/ scenarios/10-waiting-room-cf.js
```

### ปรับจำนวน VUs
```bash
k6 run -e VUS=500 scenarios/10-waiting-room-cf.js
```

### ปรับ session duration (default 60s)
```bash
k6 run -e SESSION_SECONDS=30 scenarios/10-waiting-room-cf.js
```

### ปรับ poll timeout (default 600s)
```bash
k6 run -e POLL_TIMEOUT_SEC=300 scenarios/10-waiting-room-cf.js
```

### ทดสอบ flow ด้วย VU น้อย ๆ ก่อน
```bash
k6 run -e VUS=5 -e SESSION_SECONDS=5 scenarios/10-waiting-room-cf.js
```

### บันทึก JSON output
```bash
k6 run --out json=results/wr-cf-$(date +%Y%m%d-%H%M).json scenarios/10-waiting-room-cf.js
```

### PowerShell (Windows)
```powershell
k6 run `
  -e TARGET_URL=https://formsystem.softdebut.online/ `
  -e VUS=250 `
  scenarios/10-waiting-room-cf.js
```

---

## Environment variables

| Variable | Default | ความหมาย |
|----------|---------|---------|
| `TARGET_URL` | `https://formsystem.softdebut.online/` | URL ที่จะยิง |
| `VUS` | `250` | จำนวน virtual users |
| `SESSION_SECONDS` | `60` | เวลาที่ VU ถือ session หลัง admit |
| `POLL_TIMEOUT_SEC` | `600` | เวลาสูงสุดที่ยอมรอในคิวก่อน timeout |
| `LOG_DIR` | `.` (cwd) | folder สำหรับไฟล์ summary `.log` (ต้องมีอยู่แล้ว) |

---

## ไฟล์ log

เมื่อ test เสร็จจะเขียน summary ที่ **current working directory** (ที่รัน `k6 run`)
ด้วยชื่อ `{date}_{time}_waiting-room-cf.log`

ถ้าอยากให้ไปลงใน folder อื่น ใช้ env `LOG_DIR`:

```bash
# รันจาก repo root แล้วเก็บ log ไว้ใน perf-tests/logs/
k6 run -e LOG_DIR=perf-tests/logs scenarios/10-waiting-room-cf.js

# รันจาก perf-tests/
k6 run -e LOG_DIR=logs scenarios/10-waiting-room-cf.js
```

> **ข้อควรระวัง:** k6 **ไม่สร้าง directory ให้อัตโนมัติ** — ต้อง mkdir เองก่อน
> ไม่งั้นจะเจอ error `could not open 'logs/...': The system cannot find the path specified.`

### ตัวอย่างผลลัพธ์ (250 VUs, capacity 200)

```
╔════════════════════════════════════════════════════════════╗
║  k6 — Cloudflare Waiting Room Wave Test                    ║
╚════════════════════════════════════════════════════════════╝

  Date        : 2026-04-22 15:30:00
  Target URL  : https://formsystem.softdebut.online/
  VUs         : 250
  Session     : 60s

  ────────────────────────────────────────────────────────────

  Classification

  Admitted users    :    247
  Queued users      :     50
  ─────────────────────────────
  Total measured    :    297

  Waiting time (queued users only)

  avg               : 38.4s
  p(95)             : 62.1s
  max               : 71.0s

  ────────────────────────────────────────────────────────────
```

> **หมายเหตุ:** `Total measured` > VUs เพราะคนที่ถูกคิวแล้ว admit ภายหลัง
> จะถูกนับใน **ทั้ง** `queued_users` และ `admitted_users`

---

## ตัวอย่าง console log ระหว่างรัน

```
[VU 12]  ADMITTED immediately
[VU 13]  QUEUED — entering waiting room
[VU 47]  ADMITTED immediately
[VU 13]  WAITING — attempt 1, 4s elapsed
[VU 13]  WAITING — attempt 2, 7s elapsed
...
[VU 13]  ADMITTED after 63s (15 polls)
[VU 249] QUEUED — entering waiting room
[VU 249] TIMEOUT — never admitted after 600s
```

---

## การตีความผลลัพธ์

### กรณีปกติ

```
admitted_users (immediate) ≈ 200     ← capacity
queued_users               = VUs - 200
eventually admitted        ≈ VUs     ← ภายใน poll timeout
```

คลาดเคลื่อน ±5 คนถือว่าปกติ เพราะ VU ไม่ได้ hit พร้อมกันแบบ atomic

### กรณีผิดปกติ

| อาการ | สาเหตุ |
|-------|--------|
| `admitted (immediate)` = 250 | capacity ตั้งสูงเกิน หรือ Waiting Room ไม่ทำงาน |
| `admitted (immediate)` = 0 | capacity = 0 หรือคิวเต็มจากรอบก่อน |
| `queued_users` เยอะ แต่ `admitted_users` น้อย | session duration จริงนานเกิน poll timeout |
| `http_req_failed` สูง | origin/Cloudflare มีปัญหา — ตรวจ error log |
| `waiting_time.max` ≥ `POLL_TIMEOUT_SEC` | มี VU ที่ timeout — ลองเพิ่ม `POLL_TIMEOUT_SEC` |

### นับจำนวน "admitted ทันที" อย่างไร

Script นี้ไม่มี counter แยกสำหรับ admit-ทันที vs admit-หลังคิว แต่คำนวณได้:

```
admitted_immediately = admitted_users - queued_users (ที่ admit สำเร็จ)
                     ≈ admitted_users - queue_to_active
```

ถ้าต้องการเมตริกนี้ชัด ๆ สามารถเพิ่ม counter `admitted_immediately` แยกได้
(ใส่ก่อน `sleep(SESSION_SECONDS)` ใน branch แรก)

---

## เปรียบเทียบกับ scenario อื่น

| | 08-waiting-room-wave | 10-waiting-room-cf |
|--|----------------------|--------------------|
| วัตถุประสงค์ | วัด capacity ของ app-level queue (worker API) | วัด Cloudflare native Waiting Room |
| วิธี poll | `/api/waiting-room/acquire` | GET URL เดิมซ้ำ |
| ส่งฟอร์มหลัง admit | ใช่ | ไม่ (แค่ sleep session) |
| Session model | submit แล้วจบ | ถือ session 60s เพื่อ hold slot |
| เหมาะเมื่อไร | ทดสอบ queue logic ที่เขียนเอง | ทดสอบการตั้งค่า Waiting Room บน Cloudflare |

---

## ข้อควรระวัง

1. **รันจริงจะกินเวลา ≥ 60 วิ** — VU ที่ admit จะ hold session 60 วิก่อนปล่อย
   หากต้องการ dry-run เร็ว ๆ ใช้ `SESSION_SECONDS=5`
2. **Cookie jar** ทำงานอัตโนมัติใน k6 — cookie `__cfwaitingroom` ที่
   Cloudflare ออกให้จะติดไปกับ VU ตลอด iteration
3. **Poll interval 3–5 วินาที** เป็น random เพื่อหลีกเลี่ยง synchronized polling
   ที่อาจทำให้ Cloudflare rate-limit
4. **Total Active Users = 200 นับจาก Cloudflare** ไม่ใช่ k6 — ถ้ามี user จริงเข้าเว็บ
   พร้อมกับการรัน test จำนวน admit ที่ k6 เห็นจะน้อยกว่า 200
