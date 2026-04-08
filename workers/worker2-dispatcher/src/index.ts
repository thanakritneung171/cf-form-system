/// <reference types="@cloudflare/workers-types" />

import type {
  Submission,
  SubmissionFile,
  DispatchMessage,
  WebhookMessage,
  WebhookEvent,
  FormType,
  Webhook,
} from 'shared/types';
import { FORMS_CONFIG, isValidFormType } from 'shared/forms-config';
import { log, chunkArray } from './helpers';

// ===== Env bindings =====

export interface Env {
  DB: D1Database;
  UPLOADS: R2Bucket;
  WORKER3_URL: string;
  // Dispatch queue producers (10 ตัว — แยกต่อ form type)
  DISPATCH_CONTACT: Queue<DispatchMessage>;
  DISPATCH_JOB_APPLICATION: Queue<DispatchMessage>;
  DISPATCH_COMPLAINT: Queue<DispatchMessage>;
  DISPATCH_EVENT_REGISTRATION: Queue<DispatchMessage>;
  DISPATCH_PRODUCT_INQUIRY: Queue<DispatchMessage>;
  DISPATCH_WARRANTY_CLAIM: Queue<DispatchMessage>;
  DISPATCH_NEWSLETTER: Queue<DispatchMessage>;
  DISPATCH_FEEDBACK: Queue<DispatchMessage>;
  DISPATCH_PARTNERSHIP: Queue<DispatchMessage>;
  DISPATCH_INCIDENT_REPORT: Queue<DispatchMessage>;
  // Webhook queue producer
  WEBHOOK_QUEUE: Queue<WebhookMessage>;
}

// helper: เลือก dispatch queue binding จาก form type
function getDispatchQueue(formType: FormType, env: Env): Queue<DispatchMessage> {
  const bindingName = FORMS_CONFIG[formType].queue.dispatchBinding;
  const queue = (env as unknown as Record<string, Queue<DispatchMessage>>)[bindingName];
  if (!queue) throw new Error(`Dispatch queue binding not found: ${bindingName}`);
  return queue;
}

function generateToken(bytes = 8): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ===== Scheduled: scan pending → group by form_type → dispatch queues =====

async function handleScheduled(env: Env): Promise<void> {
  const now = Date.now();
  log('INFO', 'CRON', `Started at ${new Date(now).toISOString()}`);

  // ===== Recovery: rescue dispatching ที่ค้างนานกว่า 10 นาที =====
  const staleThreshold = now - 10 * 60 * 1000;

  // snapshot จำนวน dispatching ทั้งหมดตอนนี้ก่อน recovery
  const dispatchingCount = await env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM submissions WHERE status='dispatching'`,
  ).first<{ cnt: number }>();
  log('INFO', 'CRON', `Current dispatching count: ${dispatchingCount?.cnt ?? 0}`);

  // retry_count >= 3 → mark failed
  const failedResult = await env.DB.prepare(`
    UPDATE submissions
    SET status='failed', completed_at=?, last_error='Dispatching timeout: max retries exceeded'
    WHERE status='dispatching' AND dispatched_at < ? AND retry_count >= 3
    RETURNING id, form_type, retry_count
  `).bind(now, staleThreshold).all<{ id: string; form_type: string; retry_count: number }>();

  if (failedResult.results.length > 0) {
    log('WARN', 'CRON:RECOVERY', `Marked ${failedResult.results.length} stale dispatching → failed`);
    for (const r of failedResult.results) {
      log('WARN', 'CRON:RECOVERY', `  → failed: ${r.id} [${r.form_type}] retry_count=${r.retry_count}`);
    }
  }

  // retry_count < 3 → reset กลับ pending + นับ retry
  const resetResult = await env.DB.prepare(`
    UPDATE submissions
    SET status='pending', dispatched_at=NULL, retry_count=retry_count+1
    WHERE status='dispatching' AND dispatched_at < ? AND retry_count < 3
    RETURNING id, form_type, retry_count
  `).bind(staleThreshold).all<{ id: string; form_type: string; retry_count: number }>();

  if (resetResult.results.length > 0) {
    log('WARN', 'CRON:RECOVERY', `Reset ${resetResult.results.length} stale dispatching → pending (will retry)`);
    for (const r of resetResult.results) {
      log('WARN', 'CRON:RECOVERY', `  → pending: ${r.id} [${r.form_type}] retry_count now=${r.retry_count}`);
    }
  }

  if (failedResult.results.length === 0 && resetResult.results.length === 0) {
    log('INFO', 'CRON:RECOVERY', 'No stale dispatching found');
  }

  // ===== Scan pending → dispatching =====
  const result = await env.DB.prepare(
    `UPDATE submissions SET status='dispatching', dispatched_at=?
     WHERE id IN (SELECT id FROM submissions WHERE status='pending' LIMIT 1000)
     RETURNING id, form_type`,
  ).bind(now).all<{ id: string; form_type: string }>();

  if (result.results.length === 0) {
    log('INFO', 'CRON', 'No pending submissions to dispatch');
    return;
  }

  log('INFO', 'CRON', `Picked up ${result.results.length} pending submissions → dispatching`);

  // group by form_type
  const grouped = new Map<string, string[]>();
  for (const row of result.results) {
    const list = grouped.get(row.form_type) ?? [];
    list.push(row.id);
    grouped.set(row.form_type, list);
  }

  for (const [formType, ids] of grouped) {
    if (!isValidFormType(formType)) {
      log('WARN', 'CRON', `Unknown form type in DB: ${formType} — skipping ${ids.length} submissions`);
      continue;
    }

    const dispatchQueue = getDispatchQueue(formType, env);
    // Cloudflare Queue limit = 100 messages/batch, D1 limit = ~100 SQL variables
    const chunks = chunkArray(ids, 100);

    for (const chunk of chunks) {
      try {
        await dispatchQueue.sendBatch(chunk.map(id => ({ body: { submission_id: id } })));
        log('INFO', 'CRON', `sendBatch OK: ${chunk.length} × [${formType}] → dispatch queue`);
      } catch (err) {
        log('ERROR', 'CRON', `sendBatch FAILED for [${formType}] — reverting ${chunk.length} submissions to pending`, err);
        const placeholders = chunk.map(() => '?').join(',');
        await env.DB.prepare(
          `UPDATE submissions SET status='pending', dispatched_at=NULL WHERE id IN (${placeholders})`,
        ).bind(...chunk).run();
      }
    }
  }

  log('INFO', 'CRON', 'Done');
}

// ===== Queue consumer: dispatch queues (10 queues → same handler) =====

async function handleDispatchQueue(batch: MessageBatch<DispatchMessage>, env: Env): Promise<void> {
  const ctx = `QUEUE:${batch.queue}`;
  log('INFO', ctx, `Consumer triggered — ${batch.messages.length} messages`);

  let ok = 0, retried = 0, failed = 0;

  for (const msg of batch.messages) {
    const submissionId = msg.body.submission_id;
    try {
      const result = await processSubmission(submissionId, env, msg);
      if (result === 'complete') ok++;
      else if (result === 'retry') retried++;
      else if (result === 'failed') failed++;
    } catch (err) {
      log('ERROR', ctx, `Unhandled exception for submission ${submissionId}`, err);
      msg.retry({ delaySeconds: 30 });
      retried++;
    }
  }

  log('INFO', ctx, `Batch done — complete=${ok} retry=${retried} failed=${failed}`);
}

async function processSubmission(
  submissionId: string,
  env: Env,
  msg: Message<DispatchMessage>,
): Promise<'complete' | 'retry' | 'failed'> {
  const ctx = `PROCESS:${submissionId.slice(0, 8)}`;
  const now = Date.now();

  // ===== 1. Load submission =====
  log('INFO', ctx, 'Loading submission from D1');
  const submission = await env.DB.prepare('SELECT * FROM submissions WHERE id=?')
    .bind(submissionId).first<Submission>();

  if (!submission) {
    log('WARN', ctx, 'Submission not found in D1 — ack and skip');
    msg.ack();
    return 'failed';
  }

  log('INFO', ctx, `Loaded: form_type=${submission.form_type} status=${submission.status} retry_count=${submission.retry_count}`);

  // ===== 2. Load files =====
  const files = await env.DB.prepare('SELECT * FROM submission_files WHERE submission_id=?')
    .bind(submissionId).all<SubmissionFile>();

  log('INFO', ctx, `Files in D1: ${files.results.length}`);

  const data = JSON.parse(submission.data);

  // ===== 3. Fetch files from R2 → base64 =====
  const filePayloads: Array<{
    field_name: string;
    original_filename: string;
    content_type: string;
    size_bytes: number;
    content_base64: string;
  }> = [];

  for (const file of files.results) {
    log('INFO', ctx, `Fetching R2: ${file.r2_key}`);
    const obj = await env.UPLOADS.get(file.r2_key);
    if (!obj) {
      log('WARN', ctx, `R2 object not found: ${file.r2_key} — skipping file`);
      continue;
    }
    const bytes = await obj.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(bytes)));
    log('INFO', ctx, `R2 fetched: ${file.original_filename} (${file.size_bytes} bytes → base64 ${base64.length} chars)`);
    filePayloads.push({
      field_name: file.field_name,
      original_filename: file.original_filename,
      content_type: file.content_type,
      size_bytes: file.size_bytes,
      content_base64: base64,
    });
  }

  // ===== 4. POST to Worker 3 =====
  const worker3Url = `${env.WORKER3_URL}/api/receive`;
  const payload = {
    submission_id: submissionId,
    form_type: submission.form_type,
    submitted_at: submission.submitted_at,
    data,
    files: filePayloads,
  };

  log('INFO', ctx, `POST → ${worker3Url} (payload files=${filePayloads.length})`);
  const fetchStart = Date.now();

  let response: Response;
  try {
    response = await fetch(worker3Url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    const elapsed = Date.now() - fetchStart;
    const newRetryCount = (submission.retry_count ?? 0) + 1;
    const errMsg = String(err);
    log('ERROR', ctx, `Network error after ${elapsed}ms (retry_count → ${newRetryCount}): ${errMsg}`);
    await env.DB.prepare("UPDATE submissions SET retry_count=?, last_error=?, status='pending' WHERE id=?")
      .bind(newRetryCount, errMsg, submissionId).run();
    msg.retry({ delaySeconds: 30 });
    return 'retry';
  }

  const elapsed = Date.now() - fetchStart;
  log('INFO', ctx, `Worker 3 responded: HTTP ${response.status} in ${elapsed}ms`);

  // ===== 5. Handle response =====
  if (response.ok) {
    await env.DB.prepare("UPDATE submissions SET status='complete', completed_at=? WHERE id=?")
      .bind(now, submissionId).run();
    msg.ack();
    log('INFO', ctx, `✓ complete [${submission.form_type}]`);
    await fireWebhookEvent('submission.completed', submissionId, submission.form_type as FormType, env);
    return 'complete';
  } else if (response.status >= 500) {
    const errBody = await response.text().catch(() => '');
    const newRetryCount = (submission.retry_count ?? 0) + 1;
    const delay = [30, 60, 300][Math.min(newRetryCount - 1, 2)];
    log('WARN', ctx, `✗ Worker 3 ${response.status} — retry #${newRetryCount} in ${delay}s | body: ${errBody.slice(0, 200)}`);
    await env.DB.prepare('UPDATE submissions SET retry_count=?, last_error=? WHERE id=?')
      .bind(newRetryCount, `HTTP ${response.status}: ${errBody.slice(0, 200)}`, submissionId).run();
    msg.retry({ delaySeconds: delay });
    return 'retry';
  } else {
    const errBody = await response.text().catch(() => '');
    log('ERROR', ctx, `✗ Worker 3 ${response.status} (4xx permanent fail) | body: ${errBody.slice(0, 200)}`);
    await env.DB.prepare("UPDATE submissions SET status='failed', completed_at=?, last_error=? WHERE id=?")
      .bind(now, `HTTP ${response.status}: ${errBody.slice(0, 200)}`, submissionId).run();
    msg.ack();
    await fireWebhookEvent('submission.failed', submissionId, submission.form_type as FormType, env);
    return 'failed';
  }
}

// ===== Fire webhook events =====

async function fireWebhookEvent(eventType: WebhookEvent, submissionId: string, formType: FormType, env: Env): Promise<void> {
  try {
    const webhooks = await env.DB.prepare('SELECT * FROM webhooks WHERE is_active=1').all<Webhook>();

    for (const wh of webhooks.results) {
      const events: string[] = JSON.parse(wh.events);
      if (!events.includes(eventType)) continue;
      if (wh.form_types) {
        const allowed: string[] = JSON.parse(wh.form_types);
        if (!allowed.includes(formType)) continue;
      }

      const deliveryId = 'del_' + generateToken(8);
      await env.DB.prepare(
        "INSERT INTO webhook_deliveries (id, webhook_id, event_type, submission_id, status, attempt_count, created_at) VALUES (?,?,?,?,'pending',0,?)",
      ).bind(deliveryId, wh.id, eventType, submissionId, Date.now()).run();

      await env.WEBHOOK_QUEUE.send({ webhook_id: wh.id, event_type: eventType, submission_id: submissionId, delivery_id: deliveryId, attempt: 0 });
      log('INFO', `WEBHOOK:${submissionId.slice(0, 8)}`, `Queued ${eventType} → webhook ${wh.id}`);
    }
  } catch (err) {
    log('ERROR', 'WEBHOOK', 'fireWebhookEvent error', err);
  }
}

// ===== Exports =====

export default {
  async fetch(req: Request, _env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ ok: true, worker: 'worker2-dispatcher' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('Not Found', { status: 404 });
  },

  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    await handleScheduled(env);
  },

  async queue(batch: MessageBatch<DispatchMessage>, env: Env): Promise<void> {
    if (batch.queue.startsWith('dispatch-')) {
      await handleDispatchQueue(batch, env);
    } else {
      log('WARN', 'QUEUE', `Unknown queue: ${batch.queue} — ackAll`);
      batch.ackAll();
    }
  },
} satisfies ExportedHandler<Env>;
