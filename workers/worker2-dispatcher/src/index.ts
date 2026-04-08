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

// ===== Crypto helpers =====

function generateToken(bytes = 8): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ===== Scheduled: scan pending → group by form_type → dispatch queues =====

async function handleScheduled(env: Env): Promise<void> {
  const now = Date.now();
  console.log('Dispatcher cron at', new Date(now).toISOString());

  // อัพเดต status และ RETURNING id + form_type เพื่อ route ไป queue ที่ถูก
  const result = await env.DB.prepare(`
  WITH cte AS (
    SELECT id
    FROM submissions
    WHERE 
      status = 'pending'
      OR (
        status = 'dispatching'
        AND dispatched_at < datetime('now', '-5 minutes')
      )
    LIMIT 1000
  )
  UPDATE submissions
  SET 
    status = 'dispatching',
    dispatched_at = ?
  WHERE id IN (SELECT id FROM cte)
  AND status != 'done'
  RETURNING id, form_type
`)
.bind(now)
.all<{ id: string; form_type: string }>();

  if (result.results.length === 0) {
    console.log('No pending submissions');
    return;
  }

  console.log(`Dispatching ${result.results.length} submissions`);

  // group by form_type เพื่อ sendBatch ไปยัง queue ที่ตรงกัน
  const grouped = new Map<string, string[]>();
  for (const row of result.results) {
    const list = grouped.get(row.form_type) ?? [];
    list.push(row.id);
    grouped.set(row.form_type, list);
  }

  for (const [formType, ids] of grouped) {
    if (!isValidFormType(formType)) {
      console.warn(`Unknown form type in DB: ${formType}`);
      continue;
    }

    try {
      const dispatchQueue = getDispatchQueue(formType, env);
      // ใช้ sendBatch เพื่อ efficiency — ส่งหลาย message ในรอบเดียว
      await dispatchQueue.sendBatch(ids.map(id => ({ body: { submission_id: id } })));
      console.log(`Sent ${ids.length} ${formType} submissions to dispatch queue`);
    } catch (err) {
      console.error(`Failed to send ${formType} to dispatch queue:`, err);
      // revert status กลับ pending เพื่อให้ cron รอบหน้า retry
      const placeholders = ids.map(() => '?').join(',');
      await env.DB.prepare(
        `UPDATE submissions SET status='pending', dispatched_at=NULL WHERE id IN (${placeholders})`,
      ).bind(...ids).run();
    }
  }
}

// ===== Queue consumer: dispatch queues (10 queues → same handler) =====

async function handleDispatchQueue(batch: MessageBatch<DispatchMessage>, env: Env): Promise<void> {
  // แยก form type จากชื่อ queue: "dispatch-job-application" → "job-application"
  const formTypeFromQueue = batch.queue.replace(/^dispatch-/, '');
  console.log(`Processing dispatch batch [${batch.queue}]: ${batch.messages.length} messages`);

  for (const msg of batch.messages) {
    try {
      await processSubmission(msg.body.submission_id, env, msg);
    } catch (err) {
      console.error(`Error processing submission ${msg.body.submission_id} [${formTypeFromQueue}]:`, err);
      msg.retry({ delaySeconds: 30 });
    }
  }
}

async function processSubmission(
  submissionId: string,
  env: Env,
  msg: Message<DispatchMessage>,
): Promise<void> {
  const now = Date.now();

  const submission = await env.DB.prepare('SELECT * FROM submissions WHERE id=?')
    .bind(submissionId).first<Submission>();

  if (!submission) {
    console.error(`Submission ${submissionId} not found`);
    msg.ack();
    return;
  }

  const files = await env.DB.prepare('SELECT * FROM submission_files WHERE submission_id=?')
    .bind(submissionId).all<SubmissionFile>();

  const data = JSON.parse(submission.data);

  // แปลงไฟล์เป็น base64 เพื่อส่งใน JSON payload
  const filePayloads: Array<{
    field_name: string;
    original_filename: string;
    content_type: string;
    size_bytes: number;
    content_base64: string;
  }> = [];

  for (const file of files.results) {
    const obj = await env.UPLOADS.get(file.r2_key);
    if (!obj) {
      console.warn(`File ${file.r2_key} not found in R2, skipping`);
      continue;
    }
    const bytes = await obj.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(bytes)));
    filePayloads.push({
      field_name: file.field_name,
      original_filename: file.original_filename,
      content_type: file.content_type,
      size_bytes: file.size_bytes,
      content_base64: base64,
    });
  }

  const payload = {
    submission_id: submissionId,
    form_type: submission.form_type,
    submitted_at: submission.submitted_at,
    data,
    files: filePayloads,
  };

  // POST ไปยัง Worker 3
  let response: Response;
  try {
    response = await fetch(`${env.WORKER3_URL}/api/receive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    const newRetryCount = (submission.retry_count ?? 0) + 1;
    await env.DB.prepare("UPDATE submissions SET retry_count=?, last_error=?, status='pending' WHERE id=?")
      .bind(newRetryCount, String(err), submissionId).run();
    console.error(`Network error for ${submissionId} [${submission.form_type}]:`, err);
    msg.retry({ delaySeconds: 30 });
    return;
  }

  if (response.ok) {
    await env.DB.prepare("UPDATE submissions SET status='complete', completed_at=? WHERE id=?")
      .bind(now, submissionId).run();
    msg.ack();
    console.log(`✓ ${submissionId} [${submission.form_type}] completed`);
    await fireWebhookEvent('submission.completed', submissionId, submission.form_type as FormType, env);
  } else if (response.status >= 500) {
    const errBody = await response.text().catch(() => '');
    const newRetryCount = (submission.retry_count ?? 0) + 1;
    await env.DB.prepare('UPDATE submissions SET retry_count=?, last_error=? WHERE id=?')
      .bind(newRetryCount, `HTTP ${response.status}: ${errBody.slice(0, 200)}`, submissionId).run();
    const delay = [30, 60, 300][Math.min(newRetryCount - 1, 2)];
    console.warn(`✗ ${submissionId} [${submission.form_type}] got ${response.status}, retry in ${delay}s`);
    msg.retry({ delaySeconds: delay });
  } else {
    const errBody = await response.text().catch(() => '');
    await env.DB.prepare("UPDATE submissions SET status='failed', completed_at=?, last_error=? WHERE id=?")
      .bind(now, `HTTP ${response.status}: ${errBody.slice(0, 200)}`, submissionId).run();
    msg.ack();
    console.error(`✗ ${submissionId} [${submission.form_type}] failed with ${response.status}`);
    await fireWebhookEvent('submission.failed', submissionId, submission.form_type as FormType, env);
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
    }
  } catch (err) {
    console.error('fireWebhookEvent error:', err);
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

  // queue handler รองรับ 10 dispatch queues
  // batch.queue = "dispatch-contact", "dispatch-newsletter", etc.
  async queue(batch: MessageBatch<DispatchMessage>, env: Env): Promise<void> {
    if (batch.queue.startsWith('dispatch-')) {
      await handleDispatchQueue(batch, env);
    } else {
      console.warn('Unknown queue in Worker 2:', batch.queue);
      batch.ackAll();
    }
  },
} satisfies ExportedHandler<Env>;
