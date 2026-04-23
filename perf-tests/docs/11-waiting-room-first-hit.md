# 11-waiting-room-first-hit.js — คู่มือการใช้งาน

## ทดสอบอะไร?

`11-waiting-room-first-hit.js` เป็น **wave test** ที่ยิง 250 VU พร้อมกันไปยัง
`GET /form/{type}` แล้วตามด้วย `POST /submit/{type}` เพื่อวัดว่า:

- ใน **first hit** ของแต่ละ VU มีกี่คนเป็น **Active** (เห็นหน้า form ปกติ)
- ใน **first hit** ของแต่ละ VU มีกี่คนเป็น **Queue** (เห็นหน้า Waiting Room)
- ในกลุ่มที่โดนคิว สุดท้าย **ได้ slot กี่คน** (queue → active)
- มีกี่คนที่ `POST /submit` แล้วโดน WR บล็อก

ต่างจาก [10-waiting-room-cf.js](10-waiting-room-cf.md) ตรงที่ scenario นี้
**จบ flow ด้วยการ submit ฟอร์มจริง** และเลือก form type แบบสุ่ม (ทั้ง 10 ประเภท)
— ไม่ได้แค่ hold session ว่าง ๆ

---

## กติกาการนับสำคัญ — "FIRST HIT only"

FIRST HIT ของแต่ละ VU = `GET /form/{type}` **ครั้งแรกเท่านั้น**

- response เป็นหน้า form ปกติ → `active_first_hit` +1
- response เป็นหน้า Waiting Room → `queue_first_hit` +1

หลังจากนั้น ไม่ว่า VU จะผ่านคิวเข้ามาได้หรือไม่ จะ **ไม่** นับใน
`active_first_hit` อีก — ป้องกัน queue → active ถูกนับซ้ำเป็น active

> VU ที่โดนคิวแล้ว poll จนได้ slot จะถูกนับแยกใน `queue_to_active`

ทำผ่าน per-VU flag `firstHitCounted` ใน [scenarios/11-waiting-room-first-hit.js:172](../scenarios/11-waiting-room-first-hit.js#L172)

---

## Flow ต่อ 1 Virtual User

```
VU เริ่มพร้อมกันที่ t=0
        │
        ▼
GET /                         ← ไม่นับ first hit
        │
thinkTime(1–2s)
        │
        ▼
GET /form/{type}              ← FIRST HIT (ตัดสิน active/queue)
        │
 isWaitingRoomPage(body)?
        │
  ┌─────┴──────┐
  │ NO         │ YES
  ▼            ▼
active_first  queue_first_hit++
_hit++        waiting_room_hits++
              (+ cf_native_wr_hits ถ้าเป็น CF native WR)
  │            │
  │     ┌──────┴──────────────────────────┐
  │     │ loop: sleep 3–5s → GET /form/{type}
  │     │        จน body ไม่ใช่ WR
  │     │        หรือ timeout (POLL_TIMEOUT)
  │     │
  │     ▼
  │  admitted? ──no──► จบ (timeout)
  │     │yes
  │     ▼
  │  queue_to_active++
  │     │
  └─────┴──────┐
               ▼
     thinkTime(2–4s หรือ 3–7s ถ้ามี file)
               │
               ▼
     POST /submit/{type}
               │
      submit ผ่าน? ──no──► submit_waiting_room_hits++ (ถ้า body เป็น HTML/WR)
               │yes
               ▼
            จบ
```

---

## Custom Metrics

| Metric | ประเภท | นับเมื่อไหร่ |
|--------|--------|------------|
| `active_first_hit` | Counter | FIRST HIT → หน้า form ปกติ |
| `queue_first_hit` | Counter | FIRST HIT → หน้า Waiting Room |
| `queue_to_active` | Counter | VU ที่โดนคิวแล้ว poll สำเร็จ ได้ slot |
| `cf_native_wr_hits` | Counter | FIRST HIT ที่เป็น CF **native** WR holding page (subset ของ `queue_first_hit`) |
| `waiting_room_hits` | Counter | alias ของ `queue_first_hit` (เพื่อให้ summary helper เดิมใช้ได้) |
| `submit_waiting_room_hits` | Counter | `POST /submit` ถูก WR บล็อก |

### ความสัมพันธ์

```
active_first_hit + queue_first_hit = VUs ทั้งหมด
queue_to_active ≤ queue_first_hit
cf_native_wr_hits ≤ queue_first_hit
```

ทุก metric แนบ tag `form_type` เพื่อแยกดูต่อฟอร์มได้

---

## Thresholds

```js
thresholds: {
  'active_first_hit':         [],
  'queue_first_hit':          [],
  'queue_to_active':          [],
  'cf_native_wr_hits':        [],
  'waiting_room_hits':        [],
  'submit_waiting_room_hits': [],
}
```

ทุก threshold เป็น empty array — **ไม่มี pass/fail criteria** script นี้เป็น
scenario สำหรับ **สังเกต/วัด** ไม่ใช่ gate — ตีความผลจาก summary เอง

---

## Executor

```js
one_shot_wave: {
  executor:    'per-vu-iterations',
  vus:         VUS,               // default 250
  iterations:  1,
  maxDuration: `${POLL_TIMEOUT_SEC + 120}s`,
}
```

`per-vu-iterations + iterations:1` → VU ทุกตัวเริ่มที่ t=0 และยิงครั้งเดียว
— เป็น wave แท้

ดูเหตุผลที่ไม่ใช้ `constant-vus` / `ramping-vus` ได้ใน
[10-waiting-room-cf.md](10-waiting-room-cf.md#executor)

---

## การตรวจจับ Waiting Room page

ต่างจาก scenario 10 ตรงที่ใช้ **signal เฉพาะ** เพื่อลด false-positive
(ดู [scenarios/11-waiting-room-first-hit.js:104](../scenarios/11-waiting-room-first-hit.js#L104)):

1. `Waiting Room powered by Cloudflare` (CF native)
2. `waitingrooms-text` (CF native)
3. `คุณอยู่ในคิว`
4. `ผู้เข้าใช้เต็ม`

**ไม่** ใช้ substring กว้าง ๆ เช่น `waiting-room` หรือ `cf-waiting-room`
เพราะหน้าปกติมี link/class ที่มีคำนี้ (เช่น nav link `/admin/waiting-room`)
ซึ่งจะทำให้ active โดนนับเป็น queue โดยไม่ควร

---

## วิธีรัน

### รันพื้นฐาน (250 VU, poll timeout 180s)
```bash
cd perf-tests
k6 run scenarios/11-waiting-room-first-hit.js
```

### ปรับจำนวน VU
```bash
k6 run -e VUS=500 scenarios/11-waiting-room-first-hit.js
```

### ปรับ poll timeout
```bash
k6 run -e POLL_TIMEOUT=300 scenarios/11-waiting-room-first-hit.js
```

### ปรับ poll interval (default 3–5s)
```bash
k6 run -e POLL_MIN_SEC=5 -e POLL_MAX_SEC=10 scenarios/11-waiting-room-first-hit.js
```

### เปลี่ยน target
```bash
k6 run -e BASE_URL=https://staging.example.com scenarios/11-waiting-room-first-hit.js
```

### Dry-run ด้วย VU น้อย ๆ
```bash
k6 run -e VUS=5 -e POLL_TIMEOUT=30 scenarios/11-waiting-room-first-hit.js
```

### PowerShell (Windows)
```powershell
k6 run `
  -e VUS=250 `
  -e POLL_TIMEOUT=180 `
  scenarios/11-waiting-room-first-hit.js
```

---

## Environment variables

| Variable | Default | ความหมาย |
|----------|---------|---------|
| `VUS` | `250` | จำนวน virtual users |
| `POLL_TIMEOUT` | `180` | เวลาสูงสุดที่ queue-user ยอม poll (วินาที) |
| `POLL_MIN_SEC` | `3` | poll interval ขั้นต่ำ |
| `POLL_MAX_SEC` | `5` | poll interval สูงสุด |
| `BASE_URL` | `https://formsystem.softdebut.online` | จาก [perf-tests/config.js](../config.js) |
| `LOAD_TEST_TOKEN` | `dev-token` | ใส่ header `X-Load-Test-Token` |

---

## ตัวอย่าง summary banner

```
╔════════════════════════════════════════════════════════════╗
║  Waiting Room Wave — First-Hit Classification              ║
╚════════════════════════════════════════════════════════════╝

  Active users (first-hit) :    200
  Queued users (first-hit) :     50
  Total first-hits         :    250
  Queue → Active later     :     42
```

Banner ถูก append ต่อท้าย output ของ `makeSummary()` ใน
[scenarios/11-waiting-room-first-hit.js:227](../scenarios/11-waiting-room-first-hit.js#L227)

---

## การตีความผลลัพธ์

### กรณีปกติ (capacity = 200, VUs = 250)

```
active_first_hit  ≈ 200      ← capacity ของ WR
queue_first_hit   ≈ 50       ← VUs ที่เหลือ
queue_to_active   ≈ 40–50    ← คนที่ poll จนได้ slot ภายใน timeout
submit_waiting_room_hits = 0 ← ไม่ควรมี submit โดน WR บล็อก
```

### กรณีผิดปกติ

| อาการ | สาเหตุ |
|-------|--------|
| `active_first_hit` = 250 | WR ไม่ทำงาน / capacity สูงเกิน |
| `active_first_hit` = 0 | คิวเต็มจากรอบก่อน หรือ WR บล็อกทั้งหมด |
| `queue_first_hit` เยอะ แต่ `queue_to_active` น้อย | session duration จริงนานกว่า POLL_TIMEOUT |
| `cf_native_wr_hits` = 0 แต่ `queue_first_hit` > 0 | WR เป็น app-level ไม่ใช่ CF native |
| `submit_waiting_room_hits` > 0 | WR ปล่อยให้เข้าหน้า form แต่บล็อก POST — ตรวจ WR config |

---

## ความแตกต่างจาก scenario พี่น้อง

| | 10-waiting-room-cf | 11-waiting-room-first-hit |
|--|---------------------|----------------------------|
| Target | URL root เดียว | `GET /form/{type}` + `POST /submit/{type}` |
| Form type | ไม่มี | สุ่มจาก 10 ประเภท |
| Admit หลัง poll นับซ้ำ? | ใช่ (`admitted_users` รวมสองครั้ง) | ไม่ — first-hit ถูกนับครั้งเดียว |
| มี submit จริง? | ไม่ (hold session 60s) | มี |
| วัด WR block ที่ POST? | ไม่ | ใช่ (`submit_waiting_room_hits`) |
| เหมาะเมื่อไร | ตรวจ capacity ของ WR แบบดิบ ๆ | วัด flow จริงรวม submit ตอน WR active |

---

## ข้อควรระวัง

1. **Cookie jar อัตโนมัติ** — k6 เก็บ `__cfwaitingroom` ให้ต่อ VU
   ทำให้ Cloudflare track queue position ได้จริงระหว่าง poll
2. **Random poll 3–5s** ช่วยหลีกเลี่ยง synchronized polling ที่อาจโดน rate-limit
3. **POLL_TIMEOUT default 180s** อาจสั้นไปถ้า capacity ต่ำ / queue ยาว —
   ถ้า `queue_to_active` น้อยผิดปกติ ให้เพิ่ม `POLL_TIMEOUT`
4. **`waiting_room_hits` = `queue_first_hit`** — เก็บไว้เพื่อ compat กับ
   `makeSummary()` helper เท่านั้น อย่าเอาสองค่ามาบวกกัน
5. **False-positive guard** — อย่าเติมคีย์เวิร์ดกว้าง ๆ ลงใน
   `isWaitingRoomPage()` โดยไม่ตรวจว่าไม่ชนกับ markup ของหน้าปกติ
