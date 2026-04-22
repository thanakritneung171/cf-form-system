# Plan: เพิ่ม JMeter Test Suite ขนาน k6 (cf-form-system)

## Context

ปัจจุบัน `cf-form-system/perf-tests/` มีแต่ k6 scenarios (8 ไฟล์) ยิงไปที่ `https://formsystem.softdebut.online`. ผู้ใช้ต้องการเพิ่ม **JMeter test plan (.jmx)** ขนานกัน เพื่อรันบนเครื่องเดียว ~100-500 users — เลือกพอร์ต 4 scenarios ที่สำคัญ: **Smoke, Load, Mixed Forms, Waiting Room Wave**.

ระบบเดียวกัน, target/headers/payload/threshold ต้องตรงกับ k6 เดิม เพื่อเทียบผลกันได้. สิ่งที่ต้องระวังเป็นพิเศษ:
- **Multipart file upload** (5/10 forms) — JMeter ต้องส่ง PDF/PNG จริงผ่าน Files Upload tab
- **Unique idempotency id** — ต้องไม่ชนกันระหว่าง threads
- **Per-VU cookie jar** — สำคัญมากสำหรับ Waiting Room (CF ใช้ `__cfwaitingroom` cookie track queue position)
- **WR detection markers** — ใช้ markers เดียวกับ `11-waiting-room-first-hit.js:104-111` ที่ proven แล้วว่าไม่ false-positive

---

## โครงสร้างไฟล์ใหม่

สร้างใต้ root project: [cf-form-system/perf-tests-jmeter/](cf-form-system/perf-tests-jmeter/)

```
perf-tests-jmeter/
├── README.md                          # วิธีติดตั้ง JMeter + รัน
├── env.properties                     # BASE_URL, LOAD_TEST_TOKEN, MAX_REQUESTS, VUS
├── plans/
│   ├── 01-smoke.jmx                   # ↔ scenarios/01-smoke.js
│   ├── 02-load.jmx                    # ↔ scenarios/02-load.js
│   ├── 06-mixed-forms.jmx             # ↔ scenarios/06-mixed-forms.js
│   └── 11-waiting-room-first-hit.jmx  # ↔ scenarios/11-waiting-room-first-hit.js
├── data/
│   ├── form-types-light.csv           # contact,newsletter,feedback,event-registration,product-inquiry
│   ├── form-types-all.csv             # 10 form types (สำหรับ random)
│   └── files/
│       ├── mock.pdf                   # ~68 bytes (จาก helpers/files.js minimalPdf)
│       └── mock.png                   # ~67 bytes (จาก helpers/files.js minimalPng)
├── groovy/
│   ├── unique-id.groovy               # สร้าง threadNum-iter-time id (PreProcessor)
│   ├── detect-wr.groovy               # ตรวจ waiting-room markers (PostProcessor)
│   └── wr-summary.groovy              # dump counter จาก props (tearDown)
├── results/                           # JTL output (gitignored)
└── scripts/
    ├── run-smoke.sh / .ps1
    ├── run-load.sh  / .ps1
    ├── run-mixed.sh / .ps1
    └── run-wr.sh    / .ps1
```

---

## Mapping ระหว่าง k6 → JMeter

| k6 concept | JMeter equivalent |
|---|---|
| `__VU` | `${__threadNum}` |
| `__ITER` | `${__counter(FALSE,)}` per-VU |
| `Date.now()` | `${__time(yyyyMMddHHmmssSSS,)}` |
| `randomItem(arr)` | CSV Data Set Config (sharingMode=All, recycle=true) |
| `randomIntBetween(a,b)` + sleep | Uniform Random Timer |
| `http.file(data,name,ct)` | HTTP Request → **Files Upload** tab + `useMultipart=true` |
| `commonHeaders` (`X-Load-Test-Token`) | HTTP Header Manager (test-plan scope) |
| Per-VU cookie jar | HTTP Cookie Manager (default per-thread isolation, อย่าตั้ง `Clear cookies each iteration`) |
| `check()` | Response Assertion + JSR223 Assertion สำหรับ JSON |
| `executor: shared-iterations` | Thread Group + Loop = `MAX_REQUESTS / vus` |
| `executor: per-vu-iterations vus:250 iter:1` | Thread Group: 250 threads, ramp 0s, loops 1 |
| stages (ramp 0→5→10→0) | **Ultimate Thread Group** plugin (jp@gc-casutg) |
| Custom Counter metric | `props.get/put` จาก JSR223 + tearDown dump |
| `handleSummary` log file | **Backend Listener (Summary)** → CSV + Aggregate Report → `results/<scenario>.csv` |

---

## รายละเอียดแต่ละ plan

### 1. `plans/01-smoke.jmx` (ตรงกับ [01-smoke.js](cf-form-system/perf-tests/scenarios/01-smoke.js))
- 1 Thread Group: 1 thread, 1 minute (หรือ `MAX_REQUESTS` iterations)
- HTTP Defaults: protocol/host จาก `${__P(BASE_URL,...)}`
- Header Manager: `X-Load-Test-Token: ${__P(LOAD_TEST_TOKEN,dev-token)}`
- HTTP Sampler `POST /submit/contact` (multipart form-data):
  - `fullName` = `LoadTest User ${__threadNum}-${__counter}-${__time()}`
  - `email`, `phone`, `subject`, `message`
- Response Assertion: status `200`
- JSR223 Assertion (Groovy): parse JSON, check `ok===true && submission_id`
- Constant Timer 1000ms
- Listener: Simple Data Writer → `results/smoke.jtl`

### 2. `plans/02-load.jmx` (ตรงกับ [02-load.js](cf-form-system/perf-tests/scenarios/02-load.js))
- **Ultimate Thread Group**: stages 0→5 (2m), hold→10 (10m), 10→0 (2m)
  - Fallback: Stepping Thread Group ถ้าไม่ติด plugin
- CSV Data Set Config: `data/form-types-all.csv` (one column `form_type`, random)
- HTTP Sampler `POST /submit/${form_type}` — แต่เนื่องจาก payload ต่างกันต่อ type ต้องใช้:
  - **Switch Controller** บน `${form_type}` → 10 child HTTP Samplers (สำหรับ load จริง ใช้แค่ 5 light forms ก็พอ ตามจิตวิญญาณ k6 เดิมที่ random ทุก type)
  - หรือ JSR223 PreProcessor ใส่ params dynamic — เลือก Switch Controller เพราะอ่านง่ายกว่า
- Heavy forms (มีไฟล์): Files Upload tab ชี้ไป `data/files/mock.pdf` หรือ `mock.png`
- Constant Timer 500ms
- Thresholds (Duration Assertion + Listener): p(95) < 2000ms, error rate < 1%

### 3. `plans/06-mixed-forms.jmx` (ตรงกับ [06-mixed-forms.js](cf-form-system/perf-tests/scenarios/06-mixed-forms.js))
- **10 Thread Groups ขนานกัน** (one per form type):
  - 5 light: 50 threads, duration 5m, sleep 0.5s
  - 5 heavy: 10 threads, duration 5m, sleep 1-2s
- ทุก Thread Group share: HTTP Defaults, Header Manager, Cookie Manager (test-plan scope)
- Heavy forms: HTTP Sampler มี Files Upload tab (resume/photos/receipt/companyProfile/evidence)
- Per-Thread-Group Listener: Aggregate Report → `results/mixed-{form}.csv`
- Test-plan Listener: Summary Report → `results/mixed-summary.csv`

### 4. `plans/11-waiting-room-first-hit.jmx` (ตรงกับ [11-waiting-room-first-hit.js](cf-form-system/perf-tests/scenarios/11-waiting-room-first-hit.js))
ส่วนที่ซับซ้อนที่สุด — ต้อง replicate first-hit classification + queue polling:

- Thread Group: `${__P(VUS,250)}` threads, ramp 0s, loop 1
- HTTP Cookie Manager: **อย่า** เลือก Clear cookies each iteration (per-thread จะคง `__cfwaitingroom`)
- ลำดับ child elements:
  1. **JSR223 PreProcessor** `unique-id.groovy` → set var `unique_id`
  2. **CSV Data Set Config** `form-types-all.csv` → var `form_type` (random)
  3. **HTTP Sampler** GET `/` (page=`index`)
  4. Uniform Random Timer 1000-2000ms
  5. **HTTP Sampler** GET `/form/${form_type}` (page=`form-page`) ← FIRST HIT
  6. **JSR223 PostProcessor** `detect-wr.groovy`:
     - markers: `"Waiting Room powered by Cloudflare"`, `"waitingrooms-text"`, `"คุณอยู่ในคิว"`, `"ผู้เข้าใช้เต็ม"`
     - set vars `is_queued`, `is_cf_native_wr`
     - increment counters in `props`: `active_first_hit`, `queue_first_hit`, `cf_native_wr_hits`
  7. **If Controller** `${__jexl3(!vars.get("is_queued"))}` → Active path:
     - Uniform Random Timer 2000-4000ms
     - HTTP Sampler POST `/submit/${form_type}` (multipart, with file ถ้าต้องการ)
  8. **Else (If Controller** `${__jexl3(vars.get("is_queued"))}`) → Queue path:
     - **While Controller** `${__jexl3(vars.get("still_waiting") != "false")}`
       - Uniform Random Timer 3000-5000ms
       - HTTP Sampler GET `/form/${form_type}` (page=`form-page-poll`)
       - JSR223 PostProcessor: ถ้าไม่เจอ WR markers → `vars.put("still_waiting","false")` + increment `queue_to_active`
       - Loop deadline: ตรวจ `__time()` เทียบ start time, exit ถ้าเกิน `POLL_TIMEOUT`
     - Uniform Random Timer 2000-4000ms
     - HTTP Sampler POST `/submit/${form_type}`
  9. **JSR223 Assertion** บน submit: status 200 + ok:true + has submission_id
- **tearDown Thread Group**: JSR223 `wr-summary.groovy` อ่าน `props` → write banner ไป `results/wr-summary-{timestamp}.txt`:
  ```
  Active users (first-hit) : XX
  Queued users (first-hit) : XX
  Queue → Active later     : XX
  ```

---

## Files & utilities ที่ต้องสร้างใหม่

### `groovy/unique-id.groovy` (PreProcessor)
```groovy
def id = "${ctx.threadNum}-${vars.getIteration()}-${System.currentTimeMillis()}"
vars.put("unique_id", id)
vars.put("full_name", "LoadTest User ${id}")
vars.put("email", "jmeter-${id}@perftest.local")
```

### `groovy/detect-wr.groovy` (PostProcessor)
- ใช้ markers เดียวกับ k6 (`isWaitingRoomPage` ที่ [11-waiting-room-first-hit.js:104-111](cf-form-system/perf-tests/scenarios/11-waiting-room-first-hit.js#L104-L111))
- Atomic increment ผ่าน `props` (synchronized) เพราะ multiple threads แชร์

### `data/files/mock.pdf` & `mock.png`
- เนื้อหาเดียวกับ [helpers/files.js:11](cf-form-system/perf-tests/helpers/files.js#L11) (PDF) และ [helpers/files.js:25-35](cf-form-system/perf-tests/helpers/files.js#L25-L35) (PNG)
- เขียนเป็น binary file ไว้ล่วงหน้า (ไม่ต้อง generate runtime)

### `env.properties`
```properties
BASE_URL=https://formsystem.softdebut.online
LOAD_TEST_TOKEN=dev-token
VUS=250
POLL_TIMEOUT=180
MAX_REQUESTS=0
```

### `scripts/run-*.sh` / `.ps1` template
```bash
jmeter -n -t plans/01-smoke.jmx \
  -q env.properties \
  -l results/smoke-$(date +%Y%m%d-%H%M%S).jtl \
  -e -o results/smoke-report-$(date +%Y%m%d-%H%M%S)
```

### `README.md`
- Install: `winget install Apache.JMeter` (Windows), `brew install jmeter` (Mac)
- Plugin Manager: ดาวน์โหลด `jmeter-plugins-manager.jar` ใส่ `lib/ext/`
- Required plugins: **Custom Thread Groups** (jpgc-casutg) สำหรับ Ultimate Thread Group
- วิธีรัน GUI vs non-GUI mode + ตัวอย่าง override: `-JBASE_URL=http://localhost:8787 -JVUS=100`

---

## Critical files to reference (ไม่แก้ไข, แค่อ่าน)

- [cf-form-system/perf-tests/config.js](cf-form-system/perf-tests/config.js) — `BASE_URL`, `LOAD_TEST_TOKEN`, `commonHeaders`
- [cf-form-system/perf-tests/helpers/mock-data.js](cf-form-system/perf-tests/helpers/mock-data.js) — schema ของแต่ละ form type
- [cf-form-system/perf-tests/helpers/files.js](cf-form-system/perf-tests/helpers/files.js) — minimalPdf/minimalPng bytes
- [cf-form-system/perf-tests/helpers/form-types.js](cf-form-system/perf-tests/helpers/form-types.js) — `FORM_TYPES`, `FORMS_WITH_FILES`, `LIGHT_FORMS`
- [cf-form-system/perf-tests/scenarios/01-smoke.js](cf-form-system/perf-tests/scenarios/01-smoke.js)
- [cf-form-system/perf-tests/scenarios/02-load.js](cf-form-system/perf-tests/scenarios/02-load.js)
- [cf-form-system/perf-tests/scenarios/06-mixed-forms.js](cf-form-system/perf-tests/scenarios/06-mixed-forms.js)
- [cf-form-system/perf-tests/scenarios/11-waiting-room-first-hit.js](cf-form-system/perf-tests/scenarios/11-waiting-room-first-hit.js)

---

## Verification

หลัง implement เสร็จ:

1. **Smoke** — รัน `scripts/run-smoke.sh` → คาดผล: 100% success, p95 < 500ms, มี `submission_id` ใน response
   ```bash
   jmeter -n -t plans/01-smoke.jmx -q env.properties -l results/smoke.jtl
   ```
   เทียบ `wrangler tail worker1-intake` ให้เห็น POST `/submit/contact` มีจริง

2. **Load** — รัน `run-load.sh -JMAX_REQUESTS=200` → ตรวจ: error rate < 1%, p95 < 2000ms (baseline จาก [memory](C:/Users/Thanakrit_C/.claude/projects/c--Users-Thanakrit-C-Desktop-Cloudflare-load100k-cf-form-system/memory/project_cf_form_system.md))

3. **Mixed Forms** — รัน 5 นาที → ตรวจ Aggregate Report ว่า light forms p95 < 500ms, heavy forms p95 < 3000ms (queue isolation)

4. **Waiting Room** — รัน `run-wr.sh -JVUS=250` → ตรวจ:
   - `results/wr-summary-*.txt` แสดง active+queued ≈ 250
   - Cloudflare Dashboard → Waiting Room → ต้องเห็น sessions queued
   - admin dashboard `/admin/submissions` ต้องมี LoadTest User entries

5. **เทียบกับ k6** — รัน scenario เดียวกันด้วย k6 (`k6 run scenarios/01-smoke.js`) แล้วเทียบ p95/error rate — ค่าควรใกล้เคียงกัน (±10%)

6. **Cleanup** — ลบ test data ผ่าน admin หรือ SQL:
   ```bash
   wrangler d1 execute form-system-db --remote --command \
     "DELETE FROM submissions WHERE json_extract(data, '$.fullName') LIKE 'LoadTest User %'"
   ```
