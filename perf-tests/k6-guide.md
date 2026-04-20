# คู่มือการใช้งาน k6 — CF Form System

## k6 ทำงานอย่างไรในโปรเจกต์นี้?

### ขั้นตอนการทำงาน

```
k6 ไม่ได้เข้าหน้า index ก่อน
↓
k6 ส่ง POST request โดยตรงไปที่ /submit/{formType}
↓
ไม่ผ่าน UI (ไม่เปิด browser)
```

**คำตอบ:** k6 ในโปรเจกต์นี้ **ไม่ผ่านหน้า index** — มันส่ง HTTP request ตรงไปที่ API endpoint
เลย คล้ายกับ Postman แต่ทำงานพร้อมกันหลาย Virtual User (VU)

### Flow จริง ๆ

```
[k6 VU]
  │
  ├─ POST /submit/contact       ← ส่งตรงเลย ไม่ผ่าน /
  ├─ POST /submit/newsletter
  ├─ POST /submit/feedback
  └─ ... (แต่ละ scenario ต่างกัน)
```

### ทำไมไม่ผ่านหน้า index?

- หน้า index เป็น UI สำหรับ browser เท่านั้น
- k6 เป็น API load testing tool (ไม่ใช่ browser)
- การทดสอบแบบนี้ช่วยวัด **ความแข็งแกร่งของ backend** โดยตรง
- ถ้าต้องการ simulate browser จริง ต้องใช้ Playwright/Puppeteer แทน

---

## Scenarios ที่มีในโปรเจกต์

| ไฟล์ | ชื่อ | VUs | ระยะเวลา | วัตถุประสงค์ |
|------|------|-----|----------|--------------|
| `01-smoke.js` | Smoke | 1 | 1 นาที | ตรวจว่าระบบใช้งานได้เบื้องต้น |
| `02-load.js` | Load | 0→100 | ~16 นาที | ทดสอบ load ปกติ |
| `03-stress.js` | Stress | 0→5000 | ~23 นาที | หา breaking point |
| `04-spike.js` | Spike | 10→5000 | ~7 นาที | จำลอง flash crowd |
| `05-soak.js` | Soak | 200 | 2 ชั่วโมง | ทดสอบ memory leak ระยะยาว |
| `06-mixed-forms.js` | Mixed | 280 | 5 นาที | ทดสอบ 10 form พร้อมกัน |
| `07-user-journey.js` | User Journey | 0→50 | ~15 นาที | จำลองผู้ใช้จริง (index→form→submit) |

---

## วิธีติดตั้ง k6

### Windows (winget)
```powershell
winget install k6 --source winget
```

### Windows (Chocolatey)
```powershell
choco install k6
```

### macOS
```bash
brew install k6
```

### Linux (Debian/Ubuntu)
```bash
sudo gpg -k
sudo gpg --no-default-keyring \
  --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 \
  --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] \
  https://dl.k6.io/deb stable main" | \
  sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

---

## วิธีใช้งาน

### 1. ตั้งค่าแรก
```bash
cd perf-tests
cp .env.example .env
# แก้ไข .env ตามต้องการ
```

ตัวอย่าง `.env`:
```
BASE_URL=https://worker1-intake.softdebut-poc.workers.dev
LOAD_TEST_TOKEN=my-secret-token
```

### 2. รัน Smoke test (แนะนำให้รันก่อนเสมอ)
```bash
# Windows PowerShell
.\scripts\run-smoke.ps1

# Bash / WSL
bash scripts/run-smoke.sh

# หรือรันตรง ๆ
k6 run scenarios/01-smoke.js
```

### 3. รัน Load test
```bash
k6 run scenarios/02-load.js
```

### 4. เปลี่ยน BASE_URL ชั่วคราว
```bash
k6 run -e BASE_URL=http://localhost:8787 scenarios/01-smoke.js
```

### 5. รัน test ทั้งหมด (ยกเว้น soak)
```bash
# Windows PowerShell
.\scripts\run-all.ps1

# Bash / WSL
bash scripts/run-all.sh
```

### 6. บันทึก JSON output
```bash
k6 run --out json=results/smoke-$(date +%Y%m%d).json scenarios/01-smoke.js
```

---

## วิธีดู log สรุป URL

ทุก scenario รองรับการสรุป URL เมื่อเสร็จแล้ว โดยใช้ `handleSummary`

### เพิ่มใน scenario ของคุณ

```javascript
import { makeSummary } from '../helpers/summary.js';

// เพิ่ม tag `page` ใน request (ใช้ `page` ไม่ใช่ `url` — url เป็น system tag ของ k6)
export default function () {
  const res = http.post(`${BASE_URL}/submit/contact`, payload, {
    headers: commonHeaders,
    tags: { page: '/submit/contact' },   // ← ใช้ชื่อ page
  });
}

// เพิ่ม handleSummary ที่ท้ายไฟล์
export function handleSummary(data) {
  return makeSummary(data, 'smoke');    // ← ระบุชื่อ scenario
}
```

> **หมายเหตุ:** k6 มี system tag `url` อยู่แล้ว — ไม่สามารถ override เพื่อใช้กับ sub-metrics ได้
> จึงใช้ชื่อ custom tag `page` แทน ซึ่ง `summary.js` จะอ่าน tag นี้เพื่อสรุป per-URL stats

### ไฟล์ log จะถูกสร้างที่

```
perf-tests/
└── logs/
    ├── 2026-04-20_14-30-00_smoke.log
    ├── 2026-04-20_15-00-00_load.log
    └── 2026-04-20_16-00-00_user-journey.log
```

> **หมายเหตุ:** log ใช้ flat path (ไม่มี subdirectory) เพราะ k6 ไม่สร้าง directory อัตโนมัติ

### ตัวอย่าง log ที่ได้

```
╔════════════════════════════════════════════════════════════════════════════╗
║  k6 Load Test Summary — SMOKE                                              ║
╚════════════════════════════════════════════════════════════════════════════╝

  วันที่    : 2026-04-20
  เวลา     : 14:30:00
  Scenario : smoke

────────────────────────────────────────────────────────────────────────────

  📊 ภาพรวม

  Requests รวม     : 60
  Requests สำเร็จ  : 60
  Requests ล้มเหลว : 0 (0.00%)
  Iterations       : 60
  VUs สูงสุด       : 1
  Avg response     : 245 ms
  p(95) response   : 312 ms
  p(99) response   : 498 ms

────────────────────────────────────────────────────────────────────────────

  🌐 หน้าที่เปิด / URL ที่เข้าถึง

  ── Submit Form (ส่งข้อมูล) ──────────────────────────────────────────────

  Path                                        Reqs    สำเร็จ  ล้มเหลว  Avg ms  p95 ms
  ────────────────────────────────────────────────────────────────────────────────────
  /submit/contact                               60        60        0     245     312

────────────────────────────────────────────────────────────────────────────

  ✅ Checks

    ✓  contact status 200                                   60 /    60  (100%)
    ✓  contact ok                                           60 /    60  (100%)
```

---

## ตัวอย่าง: รันแล้วสร้าง log อัตโนมัติ

```bash
# รัน smoke test พร้อม log
k6 run scenarios/01-smoke.js

# ดู log ที่สร้าง
cat logs/$(date +%Y-%m-%d)/*.log
```

---

## การทำความสะอาดข้อมูล

หลังจากรัน load test ข้อมูลทดสอบจะสะสมใน database ให้ล้างด้วย:

```bash
# ใช้ curl (ต้องมี session cookie)
curl -X POST https://your-worker.workers.dev/admin/loadtest/cleanup \
  -H 'Cookie: session=<your-session-token>'

# หรือเข้า Admin UI แล้วคลิก "Clear Load Test Data"
```

> ⚠️ **Soak test** สร้างข้อมูลได้มากถึง ~960,000 รายการใน 2 ชั่วโมง
> ควร cleanup หลังทดสอบทุกครั้ง

---

## Thresholds ที่ตั้งไว้

| Scenario | Error Rate | p95 | p99 |
|----------|-----------|-----|-----|
| Smoke | < 1% | < 500ms | — |
| Load | < 1% | < 1,000ms | < 2,000ms |
| Stress | ไม่กำหนด (observe) | — | — |
| Spike | < 20% | — | — |
| Soak | < 1% | < 2,000ms | — |
| Mixed (light forms) | < 1% | < 500ms | — |
| Mixed (file forms) | < 1% | < 3,000ms | — |

---

## คำถามที่พบบ่อย

**Q: k6 จะเข้าหน้า waiting room ไหม?**
A: ขึ้นอยู่กับ scenario:
- **01–06:** ไม่ — ส่ง request โดยตรง ถ้าเจอ waiting room จะได้ 429 กลับมา (นับเป็น error)
- **07-user-journey:** ใช่ — ตรวจ HTML response, ถ้าเจอ waiting room จะ poll `/api/waiting-room/acquire` จนได้ slot ก่อน submit

**Q: `07-user-journey.js` ต่างจาก scenario อื่นยังไง?**
A: เป็น scenario เดียวที่จำลองพฤติกรรมผู้ใช้จริง:
- เข้าหน้า `/` ก่อน (ไม่ POST ตรง)
- มี think time (random sleep) ระหว่างขั้นตอน
- รองรับ Waiting Room อัตโนมัติ
- สร้าง log สรุป URL ทุก path ที่เปิด + Waiting Room stats

**Q: ทดสอบ local ได้ไหม?**
A: ได้ เพียงเปลี่ยน BASE_URL:
```bash
k6 run -e BASE_URL=http://localhost:8787 scenarios/01-smoke.js
```

**Q: VU คืออะไร?**
A: Virtual User — k6 จำลองผู้ใช้หลายคนทำงานพร้อมกัน
100 VU = มีคน 100 คนส่ง request พร้อมกัน

**Q: ทำไม Stress test ไม่มี thresholds?**
A: เพราะ stress test ต้องการ observe ว่าระบบล่มที่จุดไหน
ไม่ใช่ทดสอบว่า pass/fail
