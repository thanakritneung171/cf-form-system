/**
 * gen-wrangler.ts
 * Generate wrangler.toml สำหรับ Worker 1 และ Worker 2 จาก FORMS_CONFIG
 *
 * วิธีใช้: npx ts-node scripts/gen-wrangler.ts
 * หรือ:   node --import tsx scripts/gen-wrangler.ts
 *
 * จะสร้าง/overwrite:
 *   workers/worker1-intake/wrangler.toml
 *   workers/worker2-dispatcher/wrangler.toml
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

// import โดยตรงจาก shared (ไม่ผ่าน workspace alias เพราะ run เป็น script Node.js)
import { FORMS_CONFIG, FORM_TYPES } from '../shared/src/forms-config';

const ROOT = join(import.meta.dirname, '..');

// ===== Worker 1 wrangler.toml =====

function genWorker1(): string {
  const producerLines = FORM_TYPES.map(t => {
    const b = FORMS_CONFIG[t].queue.intakeBinding;
    return `[[queues.producers]]\nbinding = "${b}"\nqueue = "intake-${t}"`;
  }).join('\n\n');

  const consumerLines = FORM_TYPES.map(t => {
    const cfg = FORMS_CONFIG[t].queue.intakeConfig;
    return [
      `[[queues.consumers]]`,
      `queue = "intake-${t}"`,
      `max_batch_size = ${cfg.maxBatchSize}`,
      `max_batch_timeout = ${cfg.maxBatchTimeout}`,
      `max_concurrency = ${cfg.maxConcurrency}`,
      `max_retries = ${cfg.maxRetries}`,
      `dead_letter_queue = "intake-${t}-dlq"`,
    ].join('\n');
  }).join('\n\n');

  return `name = "worker1-intake"
main = "src/index.ts"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

# ======================================================
# ⚠️  แก้ไข database_id ด้วย ID จริงหลัง run setup.sh
# ======================================================

[[d1_databases]]
binding = "DB"
database_name = "form-system-db"
database_id = "REPLACE_WITH_DATABASE_ID"

[[r2_buckets]]
binding = "UPLOADS"
bucket_name = "form-system-uploads"

# ===== Intake Queue Producers (${FORM_TYPES.length} ตัว) =====

${producerLines}

# Webhook producer
[[queues.producers]]
binding = "WEBHOOK_QUEUE"
queue = "webhook-queue"

# ===== Intake Queue Consumers (${FORM_TYPES.length} ตัว) =====

${consumerLines}

# Webhook consumer
[[queues.consumers]]
queue = "webhook-queue"
max_batch_size = 10
max_batch_timeout = 10
max_concurrency = 5
max_retries = 3
dead_letter_queue = "webhook-dlq"

# Scheduled trigger: cleanup sessions ทุก 1 ชั่วโมง
[triggers]
crons = ["0 * * * *"]
`;
}

// ===== Worker 2 wrangler.toml =====

function genWorker2(): string {
  const producerLines = FORM_TYPES.map(t => {
    const b = FORMS_CONFIG[t].queue.dispatchBinding;
    return `[[queues.producers]]\nbinding = "${b}"\nqueue = "dispatch-${t}"`;
  }).join('\n\n');

  const consumerLines = FORM_TYPES.map(t => {
    const cfg = FORMS_CONFIG[t].queue.dispatchConfig;
    return [
      `[[queues.consumers]]`,
      `queue = "dispatch-${t}"`,
      `max_batch_size = ${cfg.maxBatchSize}`,
      `max_batch_timeout = ${cfg.maxBatchTimeout}`,
      `max_concurrency = ${cfg.maxConcurrency}`,
      `max_retries = ${cfg.maxRetries}`,
      `dead_letter_queue = "dispatch-${t}-dlq"`,
    ].join('\n');
  }).join('\n\n');

  return `name = "worker2-dispatcher"
main = "src/index.ts"
compatibility_date = "2024-09-23"

# ======================================================
# ⚠️  แก้ไข database_id และ WORKER3_URL ด้วยค่าจริง
# ======================================================

[[d1_databases]]
binding = "DB"
database_name = "form-system-db"
database_id = "REPLACE_WITH_DATABASE_ID"

[[r2_buckets]]
binding = "UPLOADS"
bucket_name = "form-system-uploads"

# ===== Dispatch Queue Producers (${FORM_TYPES.length} ตัว) =====

${producerLines}

# Webhook producer
[[queues.producers]]
binding = "WEBHOOK_QUEUE"
queue = "webhook-queue"

# ===== Dispatch Queue Consumers (${FORM_TYPES.length} ตัว) =====

${consumerLines}

# Cron: scan pending submissions ทุก 1 นาที
[triggers]
crons = ["* * * * *"]

[vars]
# ⚠️  แก้ URL Worker 3 จริงหลัง deploy Worker 3
WORKER3_URL = "https://worker3-external-api.REPLACE_YOUR_SUBDOMAIN.workers.dev"
`;
}

// ===== Write files =====

const w1Path = join(ROOT, 'workers/worker1-intake/wrangler.toml');
const w2Path = join(ROOT, 'workers/worker2-dispatcher/wrangler.toml');

writeFileSync(w1Path, genWorker1(), 'utf8');
writeFileSync(w2Path, genWorker2(), 'utf8');

console.log(`✓ Generated ${w1Path}`);
console.log(`✓ Generated ${w2Path}`);
console.log(`\nจำนวน form types: ${FORM_TYPES.length}`);
console.log(`จำนวน queues ที่ generated (producers+consumers):`);
console.log(`  Worker 1: ${FORM_TYPES.length} intake producers + ${FORM_TYPES.length} intake consumers + 1 webhook producer + 1 webhook consumer`);
console.log(`  Worker 2: ${FORM_TYPES.length} dispatch producers + ${FORM_TYPES.length} dispatch consumers + 1 webhook producer`);
