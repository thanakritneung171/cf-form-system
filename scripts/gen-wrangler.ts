/**
 * gen-wrangler.ts
 * Generate wrangler.jsonc สำหรับ Worker 1 และ Worker 2 จาก FORMS_CONFIG
 * เพื่อป้องกัน typo และให้ binding names sync กับ forms-config.ts เสมอ
 *
 * วิธีใช้:
 *   pnpm gen:wrangler
 *   หรือ: npx tsx scripts/gen-wrangler.ts
 *
 * จะสร้าง/overwrite:
 *   workers/worker1-intake/wrangler.jsonc
 *   workers/worker2-dispatcher/wrangler.jsonc
 *
 * หลังรัน ต้อง regenerate types ด้วย:
 *   pnpm typegen
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

// import โดยตรงจาก shared (ไม่ผ่าน workspace alias เพราะ run เป็น script Node.js)
import { FORMS_CONFIG, FORM_TYPES } from '../shared/src/forms-config';

const ROOT = join(import.meta.dirname, '..');

// ===== Worker 1 wrangler.jsonc =====

function genWorker1(): string {
  // สร้าง producer entries
  const producers = [
    ...FORM_TYPES.map(t => {
      const b = FORMS_CONFIG[t].queue.intakeBinding;
      return `      { "binding": "${b.padEnd(30)}", "queue": "intake-${t}" }`;
    }),
    `      // Webhook producer — ตัวเดียวใช้ร่วมกันทุก form type`,
    `      { "binding": "WEBHOOK_QUEUE",                  "queue": "webhook-queue" }`,
  ].join(',\n');

  // สร้าง consumer entries
  const consumers = [
    ...FORM_TYPES.map(t => {
      const cfg = FORMS_CONFIG[t].queue.intakeConfig;
      const comment = `      // ${t}`;
      const entry = [
        `      {`,
        `        "queue": "intake-${t}",`,
        `        "max_batch_size": ${cfg.maxBatchSize},`,
        `        "max_batch_timeout": ${cfg.maxBatchTimeout},`,
        `        "max_concurrency": ${cfg.maxConcurrency},`,
        `        "max_retries": ${cfg.maxRetries},`,
        `        "dead_letter_queue": "intake-${t}-dlq"`,
        `      }`,
      ].join('\n');
      return `${comment}\n${entry}`;
    }),
    `      // Webhook consumer`,
    [
      `      {`,
      `        "queue": "webhook-queue",`,
      `        "max_batch_size": 10,`,
      `        "max_batch_timeout": 10,`,
      `        "max_concurrency": 5,`,
      `        "max_retries": 3,`,
      `        "dead_letter_queue": "webhook-dlq"`,
      `      }`,
    ].join('\n'),
  ].join(',\n');

  return `{
  // ใช้ $schema เพื่อให้ IDE แสดง autocomplete/validation
  "$schema": "node_modules/wrangler/config-schema.json",

  "name": "worker1-intake",
  "main": "src/index.ts",
  "compatibility_date": "2024-09-23",
  "compatibility_flags": ["nodejs_compat"],

  // ======================================================
  // ⚠️ แก้ไข database_id ด้วย ID จริงหลัง run setup.sh
  // ======================================================

  // D1 Database — เก็บ submissions, users, sessions, webhooks
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "form-system-db",
      "database_id": "REPLACE_WITH_DATABASE_ID"
    }
  ],

  // R2 Bucket — เก็บไฟล์แนบของทุก form type
  "r2_buckets": [
    {
      "binding": "UPLOADS",
      "bucket_name": "form-system-uploads"
    }
  ],

  "queues": {
    // ===== Intake Queue Producers (${FORM_TYPES.length} ตัว — แยกต่อ form type) =====
    // Producer binding ต้องตรงกับ FORMS_CONFIG[formType].queue.intakeBinding ใน forms-config.ts
    "producers": [
${producers}
    ],

    // ===== Intake Queue Consumers (${FORM_TYPES.length} ตัว) + Webhook consumer =====
    // batch size/concurrency ปรับตามลักษณะข้อมูลแต่ละฟอร์ม
    "consumers": [
${consumers}
    ]
  },

  // Scheduled trigger: cleanup expired sessions ทุก 1 ชั่วโมง
  "triggers": {
    "crons": ["0 * * * *"]
  }
}
`;
}

// ===== Worker 2 wrangler.jsonc =====

function genWorker2(): string {
  const producers = [
    ...FORM_TYPES.map(t => {
      const b = FORMS_CONFIG[t].queue.dispatchBinding;
      return `      { "binding": "${b.padEnd(32)}", "queue": "dispatch-${t}" }`;
    }),
    `      // Webhook producer — ยิง event completion/failure ไปยัง webhook-queue`,
    `      { "binding": "WEBHOOK_QUEUE",                    "queue": "webhook-queue" }`,
  ].join(',\n');

  const consumers = FORM_TYPES.map(t => {
    const cfg = FORMS_CONFIG[t].queue.dispatchConfig;
    const comment = `      // ${t}`;
    const entry = [
      `      {`,
      `        "queue": "dispatch-${t}",`,
      `        "max_batch_size": ${cfg.maxBatchSize},`,
      `        "max_batch_timeout": ${cfg.maxBatchTimeout},`,
      `        "max_concurrency": ${cfg.maxConcurrency},`,
      `        "max_retries": ${cfg.maxRetries},`,
      `        "dead_letter_queue": "dispatch-${t}-dlq"`,
      `      }`,
    ].join('\n');
    return `${comment}\n${entry}`;
  }).join(',\n');

  return `{
  // ใช้ $schema เพื่อให้ IDE แสดง autocomplete/validation
  "$schema": "node_modules/wrangler/config-schema.json",

  "name": "worker2-dispatcher",
  "main": "src/index.ts",
  "compatibility_date": "2024-09-23",

  // ======================================================
  // ⚠️ แก้ไข database_id และ WORKER3_URL ด้วยค่าจริง
  // ======================================================

  // D1 Database — อ่าน submissions ที่ pending เพื่อ dispatch
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "form-system-db",
      "database_id": "REPLACE_WITH_DATABASE_ID"
    }
  ],

  // R2 Bucket — ดึงไฟล์แนบเพื่อส่งไปยัง Worker 3
  "r2_buckets": [
    {
      "binding": "UPLOADS",
      "bucket_name": "form-system-uploads"
    }
  ],

  "queues": {
    // ===== Dispatch Queue Producers (${FORM_TYPES.length} ตัว — แยกต่อ form type) =====
    // Producer binding ต้องตรงกับ FORMS_CONFIG[formType].queue.dispatchBinding ใน forms-config.ts
    "producers": [
${producers}
    ],

    // ===== Dispatch Queue Consumers (${FORM_TYPES.length} ตัว) =====
    // batch size/concurrency ปรับตามขนาดไฟล์และ SLA ของแต่ละฟอร์ม
    "consumers": [
${consumers}
    ]
  },

  // Cron: scan pending submissions ทุก 1 นาที แล้ว route ไปยัง dispatch queues
  "triggers": {
    "crons": ["* * * * *"]
  },

  // Environment variables (ไม่ใช่ secrets — secrets ตั้งผ่าน wrangler secret put)
  "vars": {
    // ⚠️ แก้ URL Worker 3 จริงหลัง deploy Worker 3 แล้ว
    "WORKER3_URL": "https://worker3-external-api.REPLACE_YOUR_SUBDOMAIN.workers.dev"
  }
}
`;
}

// ===== Write files =====

const w1Path = join(ROOT, 'workers/worker1-intake/wrangler.jsonc');
const w2Path = join(ROOT, 'workers/worker2-dispatcher/wrangler.jsonc');

writeFileSync(w1Path, genWorker1(), 'utf8');
writeFileSync(w2Path, genWorker2(), 'utf8');

console.log(`✓ Generated ${w1Path}`);
console.log(`✓ Generated ${w2Path}`);
console.log(`\nจำนวน form types: ${FORM_TYPES.length}`);
console.log(`\nหลังรันแล้ว ต้อง regenerate types ด้วย: pnpm typegen`);
