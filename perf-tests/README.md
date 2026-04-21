# cf-form-system — Performance Tests

k6 test suite สำหรับทดสอบ performance ของ worker1-intake  
ทำงานแบบ standalone — ไม่ต้องการ Node.js หรือ npm

---

## 1. Prerequisites

ติดตั้ง k6:

**Windows (Chocolatey)**
```powershell
choco install k6
```

**Windows (winget)**
```powershell
winget install k6 --source winget
```

**macOS (Homebrew)**
```bash
brew install k6
```

**Linux (Debian/Ubuntu)**
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6
```

ตรวจสอบ:
```bash
k6 version
```

---

## 2. Setup

```bash
cd perf-tests
cp .env.example .env
```

แก้ค่าใน `.env`:
```
BASE_URL=http://localhost:8787     # URL ของ worker ที่รันอยู่
LOAD_TEST_TOKEN=dev-token          # token สำหรับ tag load test traffic
```

---

## 3. Quick Start

```bash
cd perf-tests
k6 run scenarios/01-smoke.js
```

หรือใช้ script:

**bash/WSL:**
```bash
bash scripts/run-smoke.sh
```

**PowerShell:**
```powershell
.\scripts\run-smoke.ps1
```

---

## 4. Scenarios Overview

| # | File | VU | Duration | เป้าหมาย |
|---|------|----|----------|---------|
| 1 | `01-smoke.js` | 1 | 1m | ตรวจสอบ basic functionality |
| 2 | `02-load.js` | 0→100 | ~16m | ทดสอบ normal load |
| 3 | `03-stress.js` | 100→5000 | ~23m | หา breaking point |
| 4 | `04-spike.js` | 10→5000→10 | ~7m | Flash crowd / event burst |
| 5 | `05-soak.js` | 200 | 2h | Memory leak / resource exhaustion |
| 6 | `06-mixed-forms.js` | 280 total | 5m | Queue isolation ทั้ง 10 ฟอร์ม |
| 7 | `07-user-journey.js` | 0→50 | ~15m | Realistic user flow (index → form → submit) |
| 8 | `08-waiting-room-wave.js` | 250 (one-shot) | ~5m | Waiting Room capacity — นับ active vs queued users |

---

## 5. Running Tests

### รัน scenario เดี่ยว

```bash
# bash
k6 run scenarios/02-load.js

# พร้อม env vars
k6 run -e BASE_URL=https://my-worker.example.com scenarios/01-smoke.js

# บันทึก JSON result
k6 run --out json=results/smoke-$(date +%Y%m%d).json scenarios/01-smoke.js
```

```powershell
# PowerShell
k6 run scenarios\02-load.js
k6 run --out json=results\load-result.json scenarios\02-load.js
```

### รันทุก scenario (ยกเว้น soak)

```bash
bash scripts/run-all.sh
```

```powershell
.\scripts\run-all.ps1
```

### รัน soak test (ต้องทำแยก — ใช้เวลา 2 ชั่วโมง)

```bash
k6 run scenarios/05-soak.js
```

---

## 6. Reading Results

metrics สำคัญที่ควรดู:

| Metric | ความหมาย | เป้าหมาย |
|--------|----------|---------|
| `http_req_duration` p95 | latency ที่ 95th percentile | < 1s (load), < 500ms (smoke) |
| `http_req_duration` p99 | tail latency | < 2s |
| `http_req_failed` | rate ของ request ที่ error | < 1% |
| `http_reqs` | RPS (requests per second) | ดูค่าสูงสุดก่อน system เริ่ม error |
| `vus` | จำนวน VU ปัจจุบัน | ดู pattern รอง |

ดู JSON result ด้วย jq:
```bash
# p95 latency
cat results/smoke-xxx.json | jq '.metrics.http_req_duration.values["p(95)"]'

# error rate
cat results/smoke-xxx.json | jq '.metrics.http_req_failed.values.rate'

# RPS สูงสุด
cat results/smoke-xxx.json | jq '.metrics.http_reqs.values.rate'
```

---

## 7. CI Integration

ตัวอย่าง GitHub Actions:

```yaml
name: Smoke Test

on:
  push:
    branches: [main]

jobs:
  smoke:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install k6
        run: |
          sudo gpg --no-default-keyring \
            --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
            --keyserver hkp://keyserver.ubuntu.com:80 \
            --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
            | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update && sudo apt-get install -y k6

      - name: Run smoke test
        working-directory: perf-tests
        env:
          BASE_URL: ${{ secrets.WORKER_URL }}
          LOAD_TEST_TOKEN: ${{ secrets.LOAD_TEST_TOKEN }}
        run: k6 run scenarios/01-smoke.js
```

---

## 8. Cleanup

หลัง run test จะมี record ค้างอยู่ใน D1 database (fullName ขึ้นต้นด้วย `LoadTest User`)

วิธีลบ — ต้อง login เป็น admin/operator ก่อน:

```bash
# ล็อกอิน แล้วเรียก cleanup endpoint
curl -X POST http://localhost:8787/admin/loadtest/cleanup \
  -H 'Cookie: session=<your-session-cookie>'
```

หรือผ่าน UI: ไปที่ `/loadtest` ใน admin panel

cleanup จะลบ:
- records ใน `submissions` table ที่ fullName = `LoadTest User *`
- files ใน `submission_files` table
- objects ใน R2 bucket (`submissions/*/mock-*`)

---

## 9. Troubleshooting

**`ERRO connection refused`**  
→ Worker ยังไม่รัน ให้ start `wrangler dev` ก่อน

**`status 429 Too Many Requests`**
→ rate limit ถูก trigger — เป็นเรื่องปกติใน stress/spike test
→ ถ้าเกิดใน smoke test = ตั้งค่า rate limit ไว้เข้มเกินไป
→ Waiting Room เต็ม — `07-user-journey.js` จะ poll `/api/waiting-room/acquire` จนได้ slot อัตโนมัติ

**`429 "ส่งครบจำนวนแล้ว"`**
→ `maxSubmitsPerToken` ใน `waiting-room-config.ts` ถึง limit แล้ว
→ เกิดเมื่อ VU เดิม reuse cookie และเจอ form type เดิมซ้ำ จน quota หมด
→ เป็น behavior ปกติ — ไม่ถือว่าเป็น bug

**`status 422 Unprocessable Entity`**  
→ payload ไม่ถูกต้อง — ดู response body เพื่อดู validation errors  
→ อาจเกิดจาก form schema เปลี่ยนแต่ mock-data.js ยังไม่อัปเดต

**`check failed: has submission_id`**  
→ server ตอบ 200 แต่ body ไม่มี submission_id  
→ ดู worker logs สำหรับ error ภายใน

**k6 ใช้ RAM สูงใน stress test**  
→ ปกติ เพราะ k6 track metrics ของทุก request  
→ ใช้ `--no-summary` หรือ `--discard-response-bodies` ถ้า RAM จำกัด
