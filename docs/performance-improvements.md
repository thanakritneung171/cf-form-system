# Performance Improvements — CF Form System

บันทึกการปรับปรุงประสิทธิภาพทั้งหมด เพื่อเพิ่ม throughput จาก ~3 req/sec

---

## ปัญหาเริ่มต้น

| ตัวชี้วัด | ก่อนแก้ |
|-----------|---------|
| Throughput | ~2–3 req/sec |
| 28,926 submissions | ใช้เวลา ~3 ชั่วโมง |
| สาเหตุหลัก | Sequential processing + missing indexes + small batch config |

---

## การแก้ไขทั้งหมด (เรียงตามลำดับที่ทำ)

---

### Round 1 — sendBatch Chunking

**ปัญหา:**
- `sendBatch` ส่งทีละ 161 messages → `Payload Too Large`
- Revert SQL ใช้ `IN (161 vars)` → `D1 too many SQL variables`

**แก้ไข:** `workers/worker2-dispatcher/src/index.ts`

```
เดิม: sendBatch(ids ทั้งหมด 161 ตัว)
ใหม่: chunkArray(ids, 100) → sendBatch ทีละ chunk
      ถ้า fail → revert เฉพาะ chunk นั้น (ไม่กระทบ chunk อื่น)
```

**ไฟล์ที่เปลี่ยน:**
- `workers/worker2-dispatcher/src/index.ts` — เพิ่ม chunking loop
- `workers/worker2-dispatcher/src/helpers.ts` — แยก `chunkArray()` + `log()` ออกเป็น helper file

---

### Round 2 — Parallel Queue Processing

**ปัญหา:** Queue consumer ประมวลผล message ทีละตัว (sequential `for await`)

| จุด | เดิม | ใหม่ |
|-----|------|------|
| W2 `handleDispatchQueue` | `for...of await` | `Promise.all(map)` |
| W2 `processSubmission` D1 queries | submission แล้ว files ทีละ query | `Promise.all([query1, query2])` |
| W2 R2 file fetches | `for...of await` ทีละไฟล์ | `Promise.all(map)` |
| W1 `handleIntakeQueue` | `for...of await` | `Promise.all(map)` |
| W1 `handleWebhookQueue` | `for...of await` | `Promise.all(map)` + `continue` → `return` |

**ไฟล์ที่เปลี่ยน:**
- `workers/worker2-dispatcher/src/index.ts`
- `workers/worker1-intake/src/index.ts`

---

### Round 3 — Dispatch Queue Config Tuning

**ปัญหา:** `max_batch_timeout` สูงเกินไป → messages นั่งรอ, `max_concurrency` ต่ำเกินไป

**แก้ไข:** `workers/worker2-dispatcher/wrangler.jsonc`

| Form type | batch_timeout | batch_size | concurrency |
|-----------|---------------|------------|-------------|
| contact | 10s → **2s** | 50 → **100** | 5 → **10** |
| event-registration | 10s → **2s** | 100 | 8 → **15** |
| product-inquiry | 10s → **2s** | 50 → **100** | 5 → **10** |
| newsletter | 5s → **2s** | 100 | 10 → **20** |
| feedback | 10s → **2s** | 50 → **100** | 5 → **10** |
| complaint | 20s → **5s** | 10 → **20** | 3 → **5** |
| warranty-claim | 15s → **5s** | 15 → **20** | 3 → **5** |
| job-application | 15s → **5s** | 10 | 3 → **5** |
| partnership | 20s → **10s** | 5 | 2 → **3** |
| incident-report | 20s → **10s** | 5 | 2 → **3** |

---

### Round 4 — Deep Performance Analysis & Fix

#### Fix 4.1 — DB Indexes ที่หายไป

**ปัญหา:**
- `SELECT * FROM webhooks WHERE is_active=1` ทำทุก submission → full table scan
- Cron recovery query `WHERE status='dispatching' AND dispatched_at < ?` → index เดิมไม่ครอบ `dispatched_at`

**แก้ไข:** `schema/d1-schema.sql`

```sql
-- composite index สำหรับ cron recovery
CREATE INDEX IF NOT EXISTS idx_submissions_status_dispatched
  ON submissions(status, dispatched_at);

-- index สำหรับ webhook query ที่ทำทุก submission
CREATE INDEX IF NOT EXISTS idx_webhooks_is_active
  ON webhooks(is_active);
```

> **หมายเหตุ:** ต้อง apply schema ใน production ด้วย:
> ```bash
> wrangler d1 execute form-system-db --remote --file=schema/d1-schema.sql
> ```

---

#### Fix 4.2 — Cron Recovery Queries Parallel

**ปัญหา:** 3 sequential DB calls ในทุก cron run (COUNT + 2×UPDATE)

```
เดิม:  await COUNT  →  await UPDATE failed  →  await UPDATE reset  (3 round-trips)
ใหม่:  ลบ COUNT    →  Promise.all([UPDATE failed, UPDATE reset])   (1 round-trip)
```

สอง UPDATE ทำ parallel ได้เพราะ target คนละ set (retry_count >= 3 vs < 3)

**ไฟล์ที่เปลี่ยน:** `workers/worker2-dispatcher/src/index.ts`

---

#### Fix 4.3 — Batch INSERT submission_files

**ปัญหา:** N files = N ครั้ง `INSERT OR IGNORE` แยกกัน → N round-trips ต่อ submission

```
เดิม: Promise.all(files.map(f => DB.prepare(INSERT).bind(...).run()))
      → 5 files = 5 queries

ใหม่: DB.prepare(`INSERT ... VALUES (?,..),(?,..),(?,..)`).bind(...allParams).run()
      → 5 files = 1 query
```

ปลอดภัย: max 5 files/submission × 8 params = 40 variables (ต่ำกว่า D1 limit ~100)

**ไฟล์ที่เปลี่ยน:** `workers/worker1-intake/src/index.ts`

---

#### Fix 4.4 — Parallel fireWebhookEvent

**ปัญหา:** Loop webhooks แบบ sequential → N webhooks = N×2 sequential DB+queue calls

```
เดิม:
  for (wh of webhooks) {
    await INSERT webhook_delivery   ← sequential
    await QUEUE.send()              ← sequential
  }

ใหม่:
  const applicable = webhooks.filter(...)   ← filter ก่อน
  await Promise.all(applicable.map(async (wh) => {
    await INSERT webhook_delivery
    await QUEUE.send()
  }))                                        ← parallel across webhooks
```

**ไฟล์ที่เปลี่ยน:**
- `workers/worker1-intake/src/index.ts` — `fireWebhookEvent()`
- `workers/worker2-dispatcher/src/index.ts` — `fireWebhookEvent()`

---

#### Fix 4.5 — Webhook Queue Config Tuning

**ปัญหา:** webhook-queue consumer batch เล็กและ timeout นานเกินไป

**แก้ไข:** `workers/worker1-intake/wrangler.jsonc`

| ค่า | เดิม | ใหม่ |
|-----|------|------|
| max_batch_size | 10 | **50** |
| max_batch_timeout | 10s | **2s** |
| max_concurrency | 5 | **15** |

---

## สรุปไฟล์ที่เปลี่ยนทั้งหมด

| ไฟล์ | การเปลี่ยนแปลง |
|------|----------------|
| `workers/worker2-dispatcher/src/index.ts` | Chunking, Parallel queue, Parallel cron recovery, Parallel fireWebhook |
| `workers/worker2-dispatcher/src/helpers.ts` | ไฟล์ใหม่: `log()`, `chunkArray()` |
| `workers/worker2-dispatcher/wrangler.jsonc` | Dispatch queue config tuning |
| `workers/worker1-intake/src/index.ts` | Parallel intake queue, Batch file INSERT, Parallel fireWebhook, Parallel webhook queue |
| `workers/worker1-intake/wrangler.jsonc` | Webhook queue config tuning |
| `schema/d1-schema.sql` | เพิ่ม 2 indexes ใหม่ |

---

## ผลที่คาดหวัง

| ปัญหาที่แก้ | ผลกระทบ |
|-------------|---------|
| Sequential → Parallel queue processing | +10–20x throughput ต่อ batch |
| Batch INSERT files (N queries → 1) | ลด D1 round-trips ~5x สำหรับ forms ที่มีไฟล์ |
| Parallel fireWebhookEvent | ลด latency per submission ~Nx (N = webhook count) |
| Parallel cron recovery | ลด cron startup time ~33% |
| Indexes | ลด query time ~10–100x สำหรับ webhook + recovery queries |
| Queue config tuning | ลด wait time 5–10x (timeout 10s → 2s) |

**คาดว่า throughput รวม:** ~3 req/sec → **50–150+ req/sec**

---

## วิธี Deploy

```bash
# 1. Apply indexes ใหม่
wrangler d1 execute form-system-db --remote --file=schema/d1-schema.sql

# 2. Deploy workers
pnpm deploy:all
```
