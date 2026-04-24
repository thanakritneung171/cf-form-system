# Video Demo Script: Cloudflare Waiting Room Performance Testing

## 📋 Demo Overview (Total ~10-12 minutes)

This demo shows how Cloudflare's built-in Waiting Room protects a form system during traffic spikes using k6 load testing.

---

## 🎬 Part 1: Introduction & Setup (1-2 min)

### Narration:
```
"สวัสดีครับ วันนี้ผมจะแสดง Waiting Room ของ Cloudflare 
ซึ่งเป็นระบบที่ช่วยป้องกันเซิร์ฟเวอร์จากการล่มเมื่อมี traffic ขยับเพิ่มขึ้นอย่างฉับพลัน

Waiting Room ทำงานอย่างไร:
- ส่วนไหนของเซิร์ฟเวอร์ที่ไม่ไหวจะกำหนด max concurrent users
- เมื่อผู้ใช้จำนวน max ได้เข้าไปแล้ว ผู้ใช้ที่มาหลัง ⏳ อยู่ในคิวรอ
- ระบบ Waiting Room จะ poll ทุก 3-5 วินาที เพื่อตรวจสอบว่ามี slot ว่างหรือไม่
- เมื่อมี user ออกจาก session ก็จะปล่อยให้ user ในคิวเข้ามาแทน

ปัจจุบัน form system ของเรา ตั้งค่าให้:
- Max Active Users:     200 users
- New Users Per Minute: 200 users/min
- Session Duration:     60 seconds
"
```

**On Screen:**
- Show form system URL: https://formsystem.softdebut.online/
- Show architecture diagram (or just explain):
  - Request → Cloudflare Waiting Room → Origin (Worker)

---

## 🔧 Part 2: Form System & Waiting Room Configuration (1-2 min)

### Visual Steps:

#### 2.1 Open Browser & Show Form
```
"ก่อนหน้านี้ ผมได้ตั้งค่า Waiting Room ที่ Cloudflare Dashboard แล้ว"

Open: https://formsystem.softdebut.online/
Show the form page (ตอนนี้ยังไม่มี WR เพราะ traffic ปกติ)
- Click on one of the forms (e.g., Contact Form)
- Show the form fields (name, email, message, etc.)
- Explain: "นี่คือหน้าฟอร์มปกติ user สามารถกรอกและ submit ได้ทันที"
```

#### 2.2 Simulate Waiting Room Manually (Optional visual)
```
"เมื่อเซิร์ฟเวอร์ไม่ไหว k6 ยิง traffic เข้ามา 
Cloudflare Waiting Room จะแสดงหน้านี้:"
```

Open browser console → Look at response headers or show cached waiting room page
- Or take a screenshot from a previous test run
- Show: "Waiting Room powered by Cloudflare" message
- Show: Thai message "คุณอยู่ในคิว" (You are in queue)

---

## 📊 Part 3: K6 Load Test Scenario (2-3 min)

### Narration:
```
"ตอนนี้เราจะใช้ k6 เพื่อทำ load test 
Scenario นี้จะยิง 250 users พร้อมกัน ให้เห็นว่า Waiting Room ทำงานอย่างไร

Metrics ที่เราวัด:
1. Active First Hit   = users ที่ได้เข้าไปหน้าฟอร์มปกติทันที
2. Queued First Hit   = users ที่ติดหน้า Waiting Room ตั้งแต่ครั้งแรก
3. Queue → Active    = users ที่รอแล้วได้เข้ามา slot ว่าง
4. Waiting Time      = ระยะเวลาที่ต้องรอในคิว

เทคนิคการ detect:
- ตรวจสอบ response body มี 'Waiting Room powered by Cloudflare'
- หรือตรวจหา Thai text 'คุณอยู่ในคิว'
- ตรวจหา CF cookie __cfwaitingroom
"
```

### Terminal Commands:

#### Step 3.1: Show the test file
```bash
# แสดง scenario file
cat perf-tests/scenarios/11-waiting-room-first-hit.js

# หรือเปิด VSCode ให้เห็น:
# - VUS = 250
# - POLL_TIMEOUT = 180s
# - Detection logic ของ WR
```

#### Step 3.2: Run K6 Test
```bash
# Option 1: ยิง 250 VU พร้อมกัน
k6 run perf-tests/scenarios/11-waiting-room-first-hit.js

# Option 2: พูดกำหนด VUS เอง (เพื่อให้น้อยกว่า อาจจะ 100 หรือ 150 สำหรับ demo เร็วขึ้น)
k6 run -e VUS=150 perf-tests/scenarios/11-waiting-room-first-hit.js

# Option 3: ถ้าต้องการ log
k6 run -e VUS=150 -e LOG_DIR=perf-tests/logs perf-tests/scenarios/11-waiting-room-first-hit.js
```

**On Screen While Running:**
- Show k6 output in real-time:
  - VU counter increasing
  - Requests being made
  - Console logs showing "[VU X] FIRST HIT → QUEUE" or "[VU X] FIRST HIT → ACTIVE"
- Duration: ~2-3 minutes for 150 VUs

---

## 🌐 Part 4: Browser Test - Getting Stuck in Waiting Room (2-3 min)

### Narration:
```
"ขณะที่ k6 กำลังยิง load test อยู่นั้น 
ผม จะ open browser และลองเข้าฟอร์มของระบบในเวลาเดียวกัน
เพื่อให้เห็นว่า user จริงจะได้รับสิ่งไหน"
```

### Live Browser Demo:

#### Step 4.1: Open Incognito Window
```
1. Open new Incognito window (Ctrl+Shift+N)
2. Go to: https://formsystem.softdebut.online/
3. Click on form link (e.g., Contact Form)
```

**Expected Outcome:**
- If load test is heavy enough:
  - User gets stuck on "Waiting Room powered by Cloudflare" page
  - Shows: "ระบบยุ่ง" or "คุณอยู่ในคิว" message
  - UI shows estimated wait time
  - Page auto-refreshes every 3-5 seconds

#### Step 4.2: Narration While Waiting
```
"ตอนนี้ browser จะ auto-refresh ทุก 3-5 วินาที 
เพื่อตรวจสอบว่ามี slot ว่างไหม

ส่วนเดิม (ไม่มี Waiting Room) จะ:
- Return 500/502 error
- User นั่งรอแล้ว timeout
- Server crash

แต่ตอนนี้เรามี WR:
- User นั่งรอสง่างาม
- UX ชัดเจน
- Server ไม่ล้ม ✓
"
```

#### Step 4.3: Wait for Admission
- Browser will eventually get past waiting room once traffic dies down
- Show the form page finally loads
- Or just show it stuck in waiting room (to save demo time)

---

## 📈 Part 5: K6 Results & Metrics Summary (2-3 min)

### After K6 Test Completes:

#### Show Terminal Output:
```
╔════════════════════════════════════════════════════════════╗
║  Waiting Room Wave — First-Hit Classification              ║
╚════════════════════════════════════════════════════════════╝

  Active users (first-hit) : 200
  Queued users (first-hit) :  50
  Total first-hits         : 250
  Queue → Active later     :  48

  ...
```

### Narration:
```
"ผลจาก k6 load test บอกเรา:
- Active users:        200 users (ได้เข้าไปเลยในครั้งแรก)
- Queued users:         50 users (ติด Waiting Room)
- Queue → Active later: 48 users (รอแล้วทีหลังได้เข้า)

ผลนี้ตรงตามที่ Cloudflare กำหนดไว้:
  Max Active Users = 200
  New Users Per Min = 200
  
งานของ Waiting Room ทำสำเร็จแล้ว ✓
- 200 users ได้เข้า ✓
- 50 users รอแต่ไม่ timeout ✓
- Server ยังไม่ crash ✓
"
```

#### Show Waiting Time Metrics:
```
  Waiting time (queued users only)
  
  avg     : 12.5s
  p(95)   : 45.2s
  max     : 58.3s
```

### Narration:
```
"สำหรับ users ที่ติด Waiting Room:
- เฉลี่ย:   12.5 วินาที (ส่วนมากได้เข้าเร็ว)
- 95th %:  45.2 วินาที (95% ของ users รอไม่เกิน 45 วินาที)
- สูงสุด:  58.3 วินาที (ยาวที่สุด ~1 นาที)

เหล่านี้คือ metrics ที่บ่งบอกว่า Waiting Room ประสิทธิผล
- ไม่มีใครรอเกิน session duration (60s)
- Server ยังคงรับ request อื่นๆ ได้ปกติ
"
```

---

## 📊 Part 6: Cloudflare Analytics Dashboard (1-2 min)

### Narration:
```
"สุดท้ายมาดูที่ Cloudflare Analytics Dashboard 
เพื่อเห็น overview ของ load test นี้"
```

### Steps:

#### 6.1 Open Cloudflare Dashboard
```
1. Go to: https://dash.cloudflare.com/
2. Select your account/domain
3. Open Analytics → Performance OR Traffic/Load
```

#### 6.2 Show Key Metrics:
- **Requests**: 250+ requests (from 250 VUs)
- **Cache Status**: Mix of HIT/MISS/PASS
- **Status Codes**: Mostly 200, some 200 (from WR)
- **Bandwidth**: Show traffic pattern
- **Origin Response Time**: Show latency distribution

#### 6.3 Filter by Waiting Room
```
If available in dashboard:
- Filter by "cf-waiting-room" header
- Or check error rate (should be 0%)
- Check cache performance
```

### Narration:
```
"ดูจาก Cloudflare Analytics:
- ไม่มี error (0% failure rate) ✓
- Origin response time ยังคงสูง ได้คาดหวัง (250 concurrent requests)
- Cloudflare Waiting Room ทำหน้าที่บ่งบอบ traffic ถูก ✓
- ทำให้ origin server ยังไหว ✓

ถ้า *ไม่มี* Waiting Room:
- Error rate จะพุ่งขึ้น 50-90%
- Origin 502/503 errors
- User experience แย่ลง

ดังนั้น Waiting Room = essential protection ✓
"
```

---

## ✅ Part 7: Summary & Key Takeaways (1 min)

### Narration:
```
"สรุปการทดสอบวันนี้:

1️⃣  Waiting Room คือ Cloudflare feature 
    ช่วย limit concurrent users ไปยัง origin

2️⃣  ป้องกัน server crash เมื่อ traffic spike

3️⃣  UX ดี → users เห็นข้อมูลชัดเจน 
    แทนที่จะได้ 502 error

4️⃣  K6 Load Test ช่วย validate ว่า config ใช้ได้

5️⃣  Metrics บ่งบอก:
    ✓ 200 users ได้เข้า
    ✓ 50 users รอแล้วได้เข้า
    ✓ Avg wait time ~12s
    ✓ 0% failure rate

ความคิดเห็น: 
Waiting Room เหมาะสำหรับ traffic-heavy events
เช่น flash sales, product launches, announcements

ขอบคุณที่ดู! ถ้าติดคำถามมาถามได้นะครับ"
```

---

## 📝 Timestamps (For Video Editing)

| Segment | Duration | Start | Notes |
|---------|----------|-------|-------|
| Part 1: Intro | 1-2 min | 0:00 | Setup + explanation |
| Part 2: Config | 1-2 min | 2:00 | Form system demo |
| Part 3: K6 Test | 2-3 min | 4:00 | Run test, show logs |
| Part 4: Browser | 2-3 min | 7:00 | Live waiting room |
| Part 5: Results | 2-3 min | 10:00 | k6 metrics summary |
| Part 6: Analytics | 1-2 min | 13:00 | CF dashboard |
| Part 7: Summary | 1 min | 15:00 | Key takeaways |
| **Total** | **10-14 min** | — | — |

---

## 🎥 Recording Tips

### Technical Setup:
1. **Terminal font**: Increase size (18-20pt) for readability
2. **VSCode theme**: Use dark theme for contrast
3. **Browser zoom**: 110-125% for clarity
4. **Microphone**: Clear Thai/English narration
5. **Recording software**: OBS, ScreenFlow, or Camtasia

### Demo Preparations:
- [ ] Pre-run k6 once to warm up
- [ ] Have Cloudflare dashboard logged in
- [ ] Have form system URL bookmarked
- [ ] Prepare talking points in Thai (use script above)
- [ ] Test k6 detection logic (Thai text in WR page)
- [ ] Optional: Record a "failed" run without WR to show contrast

### Presentation Flow:
- **Scripted**: Parts 1, 7 (intro/summary)
- **Demo**: Parts 2, 3, 5 (form, test, results)
- **Live**: Part 4 (browser waiting room)
- **Dashboard**: Part 6 (analytics)

---

## 🔗 Useful Commands for Demo

```bash
# Run with custom VU count (faster demo)
k6 run -e VUS=100 perf-tests/scenarios/11-waiting-room-first-hit.js

# Run with custom timeout (shorter wait if needed)
k6 run -e VUS=150 -e POLL_TIMEOUT=120 perf-tests/scenarios/11-waiting-room-first-hit.js

# Run and save logs
k6 run -e VUS=150 -e LOG_DIR=perf-tests/logs perf-tests/scenarios/11-waiting-room-first-hit.js

# Show form system in browser
curl -I https://formsystem.softdebut.online/form/contact-form
```

---

## 📚 Reference Links

- **Cloudflare Waiting Room Docs**: https://developers.cloudflare.com/waiting-room/
- **K6 Docs**: https://k6.io/docs/
- **Project Repo**: `cf-form-system`
- **Test Scenarios**: `perf-tests/scenarios/10-11-waiting-room-*.js`

---

**Created**: 2026-04-24  
**Project**: cf-form-system  
**Demo Length**: ~10-14 minutes  
**Language**: Thai (narration) + English (code/UI)
