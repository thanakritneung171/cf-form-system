# JMeter Performance Tests — cf-form-system

JMeter test plans ขนานกับ k6 scenarios ที่มีอยู่ใน `perf-tests/` เพื่อเทียบผลการทดสอบ

## Prerequisites

### Install JMeter

**Windows:**
```powershell
winget install Apache.JMeter
```

**macOS:**
```bash
brew install jmeter
```

**Manual:** ดาวน์โหลดจาก https://jmeter.apache.org/download_jmeter.cgi

### Required Plugins (optional)

สำหรับ Ultimate Thread Group (ใช้ใน 02-load.jmx ถ้าต้องการ stages ที่ละเอียดกว่า):

1. ดาวน์โหลด [JMeter Plugins Manager](https://jmeter-plugins.org/install/Install/) (`jmeter-plugins-manager.jar`)
2. ใส่ใน `<JMETER_HOME>/lib/ext/`
3. เปิด JMeter GUI → Options → Plugins Manager → ติดตั้ง **Custom Thread Groups** (jpgc-casutg)

## Test Plans

| Plan | k6 Equivalent | Description | VUs | Duration |
|------|---------------|-------------|-----|----------|
| `01-smoke.jmx` | `01-smoke.js` | Smoke test — 1 VU, contact form only | 1 | 1 min |
| `02-load.jmx` | `02-load.js` | Load test — ramp up, random form types | 10 | 16 min |
| `06-mixed-forms.jmx` | `06-mixed-forms.js` | Mixed forms — 10 parallel groups (5 light + 5 heavy) | 300 | 5 min |
| `11-waiting-room-first-hit.jmx` | `08-user-journey.js` | CF Waiting Room — burst 250 VU, classify active/queue | 250 | ~3 min |

## Quick Start

### CLI Mode (recommended)

```bash
# Smoke test
jmeter -n -t plans/01-smoke.jmx -q env.properties -l results/smoke.jtl

# Load test
jmeter -n -t plans/02-load.jmx -q env.properties -l results/load.jtl

# Mixed forms
jmeter -n -t plans/06-mixed-forms.jmx -q env.properties -l results/mixed.jtl

# Waiting Room burst
jmeter -n -t plans/11-waiting-room-first-hit.jmx -q env.properties -l results/wr.jtl
```

### Using run scripts

```bash
# Bash
./scripts/run-smoke.sh
./scripts/run-load.sh
./scripts/run-mixed.sh
./scripts/run-wr.sh

# PowerShell
.\scripts\run-smoke.ps1
.\scripts\run-load.ps1
.\scripts\run-mixed.ps1
.\scripts\run-wr.ps1
```

### Override parameters

```bash
# Change target URL
jmeter -n -t plans/01-smoke.jmx -q env.properties -JBASE_URL=http://localhost:8787 -l results/smoke.jtl

# Change VU count for WR test
jmeter -n -t plans/11-waiting-room-first-hit.jmx -q env.properties -JVUS=100 -l results/wr.jtl

# Change poll timeout
jmeter -n -t plans/11-waiting-room-first-hit.jmx -q env.properties -JPOLL_TIMEOUT=300 -l results/wr.jtl
```

### GUI Mode (for debugging)

```bash
jmeter -t plans/01-smoke.jmx -q env.properties
```

## Configuration

### `env.properties`

| Property | Default | Description |
|----------|---------|-------------|
| `BASE_URL` | `https://formsystem.softdebut.online` | Target URL |
| `LOAD_TEST_TOKEN` | `dev-token` | X-Load-Test-Token header value |
| `VUS` | `250` | Thread count for WR test |
| `POLL_TIMEOUT` | `180` | Max seconds to poll WR before giving up |
| `MAX_REQUESTS` | `0` | Max iterations (0 = use duration) |

## Waiting Room Detection

WR detection ใช้ markers เดียวกับ k6:

1. **HTTP Status 202** — CF WR config ส่ง 202 Accepted
2. **Body contains** `"Waiting Room powered by Cloudflare"` — CF native WR
3. **Body contains** `"waitingrooms-text"` — CF WR CSS class
4. **Body contains** `"waiting-room"`, `"ผู้เข้าใช้เต็ม"`, `"ระบบยุ่ง"` — custom WR

หลัง test เสร็จ ดูสรุปที่ `results/wr-summary-*.txt`:

```
Active users (first-hit)  : 200
Queued users (first-hit)  : 50
CF Native WR hits         : 50
Queue -> Active later     : 48
Queue timed out           : 2
```

## File Structure

```
perf-tests-jmeter/
├── README.md
├── env.properties              # Shared config
├── plans/
│   ├── 01-smoke.jmx
│   ├── 02-load.jmx
│   ├── 06-mixed-forms.jmx
│   └── 11-waiting-room-first-hit.jmx
├── data/
│   ├── form-types-light.csv    # 5 light form types
│   ├── form-types-all.csv      # All 10 form types
│   └── files/
│       ├── mock.pdf            # Minimal valid PDF (~68 bytes)
│       └── mock.png            # 1x1 red pixel PNG (~67 bytes)
├── groovy/
│   ├── unique-id.groovy        # PreProcessor: generate unique id per request
│   ├── build-payload.groovy    # PreProcessor: set extra_fields + file per form_type (shared)
│   ├── attach-fields.groovy    # PreProcessor: attach extra_fields + file to sampler (shared)
│   ├── detect-wr.groovy        # PostProcessor: detect CF Waiting Room
│   └── wr-summary.groovy       # tearDown: write WR counter summary
├── results/                    # JTL output + reports (gitignored)
└── scripts/
    ├── run-smoke.sh / .ps1
    ├── run-load.sh  / .ps1
    ├── run-mixed.sh / .ps1
    └── run-wr.sh    / .ps1
```

## k6 vs JMeter Mapping

| k6 | JMeter |
|---|---|
| `__VU` | `${__threadNum}` |
| `__ITER` | `${__counter(FALSE,)}` |
| `randomItem(arr)` | CSV Data Set Config (recycle=true) |
| `sleep(n)` | Constant/Uniform Random Timer |
| `http.file()` | HTTP Request → Files Upload tab |
| `check()` | Response Assertion + JSR223 Assertion |
| `Counter` metric | `props.get/put` (thread-safe via synchronized) |
| `per-vu-iterations` | Thread Group: N threads, loop 1 |
| `handleSummary()` | tearDown Thread Group + Groovy script |

## Cleanup

ลบ test data หลัง test:

```bash
wrangler d1 execute form-system-db --remote --command \
  "DELETE FROM submissions WHERE json_extract(data, '$.fullName') LIKE 'LoadTest User %'"
```

หรือใช้หน้า admin: `/admin/clear-data`
