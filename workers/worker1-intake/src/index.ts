/// <reference types="@cloudflare/workers-types" />

import type {
  IntakeMessage,
  WebhookMessage,
  WebhookEvent,
  FormType,
  Submission,
  SubmissionFile,
  User,
  Webhook,
  WebhookDelivery,
} from 'shared/types';
import { FORMS_CONFIG, getFormConfig, isValidFormType } from 'shared/forms-config';
import {
  getCurrentUser,
  requireAuth,
  requireRole,
  createSession,
  deleteSession,
  getSessionId,
  makeSessionCookie,
  hashPassword,
  generateToken,
  checkLoginRateLimit,
  recordLoginAttempt,
  cleanupExpiredSessions,
  generateCsrfToken,
  verifyCsrfToken,
  signWebhookPayload,
} from './auth';
import {
  validateFormData,
  validateFiles,
  makeR2Key,
  esc,
  type FileValidationItem,
} from './validators';
import {
  indexPage,
  formPage,
  loginPage,
  submissionsPage,
  dispatchedPage,
  submissionDetailPage,
  usersPage,
  userFormPage,
  profilePage,
  webhooksPage,
  webhookFormPage,
  webhookDetailPage,
  queueStatusPage,
  loadtestPage,
  clearDataPage,
} from './html';
import type { ClearDataStats } from './html';

// ===== Env bindings =====
// Queue producers แยกต่อ form type เพื่อ isolation และ per-form throughput control

export interface Env {
  DB: D1Database;
  UPLOADS: R2Bucket;
  SESSION_SECRET: string;
  // Intake queue producers (10 ตัว — แยกต่อ form type)
  INTAKE_CONTACT: Queue<IntakeMessage>;
  INTAKE_JOB_APPLICATION: Queue<IntakeMessage>;
  INTAKE_COMPLAINT: Queue<IntakeMessage>;
  INTAKE_EVENT_REGISTRATION: Queue<IntakeMessage>;
  INTAKE_PRODUCT_INQUIRY: Queue<IntakeMessage>;
  INTAKE_WARRANTY_CLAIM: Queue<IntakeMessage>;
  INTAKE_NEWSLETTER: Queue<IntakeMessage>;
  INTAKE_FEEDBACK: Queue<IntakeMessage>;
  INTAKE_PARTNERSHIP: Queue<IntakeMessage>;
  INTAKE_INCIDENT_REPORT: Queue<IntakeMessage>;
  // Webhook queue producer
  WEBHOOK_QUEUE: Queue<WebhookMessage>;

}

// helper: เลือก intake queue binding ตาม form type
function getIntakeQueue(formType: FormType, env: Env): Queue<IntakeMessage> {
  const bindingName = FORMS_CONFIG[formType].queue.intakeBinding;
  const queue = (env as unknown as Record<string, Queue<IntakeMessage>>)[bindingName];
  if (!queue) throw new Error(`Queue binding not found: ${bindingName}`);
  return queue;
}

// ===== Helper =====

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function html(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'Content-Type': 'text/html;charset=utf-8' } });
}

function redirect(url: string): Response {
  return new Response(null, { status: 302, headers: { Location: url } });
}

function getClientIp(req: Request): string {
  return req.headers.get('CF-Connecting-IP') ?? req.headers.get('X-Forwarded-For') ?? 'unknown';
}

function flashRedirect(url: string, msg: string): Response {
  const sep = url.includes('?') ? '&' : '?';
  return new Response(null, {
    status: 302,
    headers: { Location: url + sep + 'flash=' + encodeURIComponent(msg) },
  });
}

// ===== Public handlers =====

async function handleIndex(_req: Request, _env: Env): Promise<Response> {
  return html(indexPage());
}

async function handleFormPage(req: Request, _env: Env): Promise<Response> {
  const url = new URL(req.url);
  const formType = url.pathname.split('/form/')[1];
  if (!isValidFormType(formType)) return new Response('Not found', { status: 404 });
  return html(formPage(FORMS_CONFIG[formType]));
}

async function handleSubmit(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const formType = url.pathname.split('/submit/')[1] as FormType;
  if (!isValidFormType(formType)) return json({ ok: false, error: 'form type ไม่ถูกต้อง' }, 400);

  const config = getFormConfig(formType)!;
  let formData: FormData;

  try {
    formData = await req.formData();
  } catch {
    return json({ ok: false, error: 'ไม่สามารถอ่าน form data ได้' }, 400);
  }

  // รวบรวม field values
  const data: Record<string, string | string[]> = {};
  for (const field of config.fields) {
    if (field.type === 'file') continue;
    if (field.type === 'multiselect') {
      data[field.name] = formData.getAll(field.name).map(String);
    } else {
      const val = formData.get(field.name);
      if (val !== null) data[field.name] = String(val);
    }
  }

  // validate text fields
  const textValidation = validateFormData(config, data);
  if (!textValidation.ok) return json({ ok: false, errors: textValidation.errors }, 422);

  // รวบรวม files
  const filesByField: Record<string, FileValidationItem[]> = {};
  const fileEntries: Array<{ fieldName: string; file: File }> = [];

  for (const field of config.fields) {
    if (field.type !== 'file') continue;
    const files = formData.getAll(field.name) as File[];
    filesByField[field.name] = files.map(f => ({
      fieldName: field.name,
      filename: f.name,
      contentType: f.type,
      sizeByes: f.size,
    }));
    for (const f of files) {
      if (f.size > 0) fileEntries.push({ fieldName: field.name, file: f });
    }
  }

  // validate files
  const fileValidation = validateFiles(config, filesByField);
  if (!fileValidation.ok) return json({ ok: false, errors: fileValidation.errors }, 422);

  // สร้าง submission ID
  const submissionId = crypto.randomUUID();
  const idempotencyKey = crypto.randomUUID();
  const submittedAt = Date.now();

  // upload ไฟล์ขึ้น R2
  const fileMetadata: IntakeMessage['files'] = [];
  const fieldIndexes: Record<string, number> = {};

  for (const { fieldName, file } of fileEntries) {
    const idx = fieldIndexes[fieldName] ?? 0;
    fieldIndexes[fieldName] = idx + 1;
    const r2Key = makeR2Key(submissionId, fieldName, idx, file.name);
    const fileId = crypto.randomUUID();

    try {
      await env.UPLOADS.put(r2Key, file.stream(), {
        httpMetadata: { contentType: file.type },
        customMetadata: { submissionId, fieldName, originalFilename: file.name },
      });
    } catch (err) {
      console.error('R2 upload error:', err);
      return json({ ok: false, error: 'อัปโหลดไฟล์ไม่สำเร็จ' }, 500);
    }

    fileMetadata.push({
      id: fileId,
      field_name: fieldName,
      original_filename: file.name,
      content_type: file.type,
      size_bytes: file.size,
      r2_key: r2Key,
    });
  }

  // ส่งเข้า intake queue ที่ตรงกับ form type
  const message: IntakeMessage = {
    submission_id: submissionId,
    form_type: formType,
    data: data as Record<string, string | string[]>,
    files: fileMetadata,
    idempotency_key: idempotencyKey,
    submitted_at: submittedAt,
  };

  try {
    const intakeQueue = getIntakeQueue(formType, env);
    await intakeQueue.send(message);
  } catch (err) {
    console.error('Queue send error:', err);
    return json({ ok: false, error: 'ไม่สามารถส่งข้อมูลเข้าระบบได้' }, 500);
  }

  return json({ ok: true, submission_id: submissionId });
}

// ===== Admin auth handlers =====

async function handleAdminLogin(req: Request, env: Env): Promise<Response> {
  if (req.method === 'GET') {
    // ถ้า login อยู่แล้ว → ไป submissions โดยตรง (ไม่ต้อง login ซ้ำ)
    const already = await getCurrentUser(req, env).catch(() => null);
    if (already) {
      const url = new URL(req.url);
      const next = url.searchParams.get('next') ?? '/admin/submissions';
      const safeNext = next.startsWith('/admin') ? next : '/admin/submissions';
      return new Response(null, { status: 302, headers: { Location: safeNext } });
    }
    const url = new URL(req.url);
    return html(loginPage(url.searchParams.get('error') ?? undefined, url.searchParams.get('next') ?? undefined));
  }

  const ip = getClientIp(req);
  const allowed = await checkLoginRateLimit(ip, env);
  if (!allowed) {
    await recordLoginAttempt(ip, false, env);
    return html(loginPage('เข้าสู่ระบบผิดพลาดเกินจำนวนครั้ง กรุณารอ 10 นาที'), 429);
  }

  const body = await req.formData();
  const username = String(body.get('username') ?? '').trim();
  const password = String(body.get('password') ?? '');
  const next = String(body.get('next') ?? '/admin/submissions');

  const user = await env.DB.prepare(
    'SELECT * FROM users WHERE username = ? AND is_active = 1',
  ).bind(username).first<User>();

  if (!user) {
    await recordLoginAttempt(ip, false, env);
    return html(loginPage('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', next), 401);
  }

  const hash = await hashPassword(password, user.password_salt);
  if (hash !== user.password_hash) {
    await recordLoginAttempt(ip, false, env);
    return html(loginPage('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', next), 401);
  }

  await recordLoginAttempt(ip, true, env);
  const sessionId = await createSession(user.id, ip, req.headers.get('User-Agent'), env);

  await env.DB.prepare('UPDATE users SET last_login_at = ? WHERE id = ?')
    .bind(Date.now(), user.id)
    .run();

  const safeNext = next.startsWith('/admin') ? next : '/admin/submissions';
  return new Response(null, {
    status: 302,
    headers: {
      Location: safeNext,
      'Set-Cookie': makeSessionCookie(sessionId),
    },
  });
}

async function handleAdminLogout(req: Request, env: Env): Promise<Response> {
  const sessionId = getSessionId(req);
  if (sessionId) await deleteSession(sessionId, env);
  return new Response(null, {
    status: 302,
    headers: {
      Location: '/admin/login',
      'Set-Cookie': `admin_session=; HttpOnly; Secure; SameSite=Strict; Path=/admin; Max-Age=0`,
    },
  });
}

// ===== Admin submissions =====

async function handleAdminSubmissions(req: Request, env: Env): Promise<Response> {
  const result = await requireAuth(req, env);
  if (result instanceof Response) return result;
  const user = result as User;

  const url = new URL(req.url);
  const flash = url.searchParams.get('flash') ?? undefined;
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
  const perPage = 50;
  const offset = (page - 1) * perPage;

  const filters: Record<string, string> = {};
  for (const key of ['form_type', 'status', 'from', 'to', 'q']) {
    const v = url.searchParams.get(key);
    if (v) filters[key] = v;
  }

  const conditions: string[] = ["status IN ('pending','dispatching','failed')"];
  const params: unknown[] = [];

  if (filters.form_type) { conditions.push('form_type = ?'); params.push(filters.form_type); }
  if (filters.status) { conditions[0] = 'status = ?'; params.unshift(filters.status); }
  if (filters.from) { conditions.push('submitted_at >= ?'); params.push(new Date(filters.from + 'T00:00:00+07:00').getTime()); }
  if (filters.to) { conditions.push('submitted_at <= ?'); params.push(new Date(filters.to + 'T23:59:59+07:00').getTime()); }
  if (filters.q) { conditions.push('(data LIKE ? OR data LIKE ?)'); params.push(`%${filters.q}%`, `%${filters.q}%`); }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const [rows, countRow, statsRows] = await Promise.all([
    env.DB.prepare(`SELECT * FROM submissions ${where} ORDER BY submitted_at DESC LIMIT ? OFFSET ?`)
      .bind(...params, perPage, offset).all<Submission>(),
    env.DB.prepare(`SELECT COUNT(*) as cnt FROM submissions ${where}`).bind(...params).first<{ cnt: number }>(),
    env.DB.prepare('SELECT status, COUNT(*) as cnt FROM submissions GROUP BY status').all<{ status: string; cnt: number }>(),
  ]);

  const statMap: Record<string, number> = {};
  for (const r of statsRows.results) statMap[r.status] = r.cnt;

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayCount = await env.DB.prepare('SELECT COUNT(*) as cnt FROM submissions WHERE submitted_at >= ?')
    .bind(todayStart.getTime()).first<{ cnt: number }>();

  return html(submissionsPage(
    rows.results, countRow?.cnt ?? 0, page, perPage,
    { pending: statMap['pending'] ?? 0, dispatching: statMap['dispatching'] ?? 0, today: todayCount?.cnt ?? 0, failed: statMap['failed'] ?? 0 },
    filters, user, flash,
  ));
}

// ===== Admin dispatched =====

async function handleAdminDispatched(req: Request, env: Env): Promise<Response> {
  const result = await requireAuth(req, env);
  if (result instanceof Response) return result;
  const user = result as User;

  const url = new URL(req.url);
  const flash = url.searchParams.get('flash') ?? undefined;
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
  const perPage = 50;
  const offset = (page - 1) * perPage;

  const filters: Record<string, string> = {};
  for (const key of ['form_type', 'status', 'from', 'to', 'sort', 'dir']) {
    const v = url.searchParams.get(key);
    if (v) filters[key] = v;
  }

  const SORT_COLS: Record<string, string> = {
    dispatched_at: 'dispatched_at',
    completed_at: 'completed_at',
    form_type: 'form_type',
    status: 'status',
    retry_count: 'retry_count',
  };
  const sortCol = SORT_COLS[filters.sort ?? ''] ?? 'dispatched_at';
  const sortDir = filters.dir === 'asc' ? 'ASC' : 'DESC';

  const conditions: string[] = ["status IN ('complete','failed')"];
  const params: unknown[] = [];

  if (filters.form_type) { conditions.push('form_type = ?'); params.push(filters.form_type); }
  if (filters.status && ['complete', 'failed'].includes(filters.status)) {
    conditions[0] = 'status = ?'; params.unshift(filters.status);
  }
  if (filters.from) { conditions.push('dispatched_at >= ?'); params.push(new Date(filters.from + 'T00:00:00+07:00').getTime()); }
  if (filters.to) { conditions.push('dispatched_at <= ?'); params.push(new Date(filters.to + 'T23:59:59+07:00').getTime()); }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const [rows, countRow, statsRow] = await Promise.all([
    env.DB.prepare(`SELECT * FROM submissions ${where} ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`)
      .bind(...params, perPage, offset).all<Submission>(),
    env.DB.prepare(`SELECT COUNT(*) as cnt FROM submissions ${where}`).bind(...params).first<{ cnt: number }>(),
    env.DB.prepare(`
      SELECT
        SUM(CASE WHEN status='complete' THEN 1 ELSE 0 END) as complete,
        SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) as failed,
        AVG(CASE WHEN completed_at IS NOT NULL THEN (completed_at - dispatched_at)/1000.0 ELSE NULL END) as avg_duration
      FROM submissions ${where}
    `).bind(...params).first<{ complete: number; failed: number; avg_duration: number }>(),
  ]);

  const complete = statsRow?.complete ?? 0;
  const failed = statsRow?.failed ?? 0;
  const successRate = (complete + failed) > 0 ? Math.round((complete / (complete + failed)) * 100) : 0;

  return html(dispatchedPage(
    rows.results, countRow?.cnt ?? 0, page, perPage,
    { complete, failed, successRate, avgDuration: Math.round(statsRow?.avg_duration ?? 0) },
    filters, user, flash,
  ));
}

// ===== Admin submission detail =====

async function handleAdminSubmissionDetail(req: Request, env: Env, id: string): Promise<Response> {
  const result = await requireAuth(req, env);
  if (result instanceof Response) return result;
  const user = result as User;

  const [submission, files] = await Promise.all([
    env.DB.prepare('SELECT * FROM submissions WHERE id = ?').bind(id).first<Submission>(),
    env.DB.prepare('SELECT * FROM submission_files WHERE submission_id = ?').bind(id).all<SubmissionFile>(),
  ]);

  if (!submission) return new Response('Not found', { status: 404 });
  return html(submissionDetailPage(submission, files.results, user));
}

// ===== Admin file download =====

async function handleAdminFileDownload(req: Request, env: Env, fileId: string): Promise<Response> {
  const result = await requireAuth(req, env);
  if (result instanceof Response) return result;

  const file = await env.DB.prepare('SELECT * FROM submission_files WHERE id = ?')
    .bind(fileId).first<SubmissionFile>();

  if (!file) return new Response('Not found', { status: 404 });

  const obj = await env.UPLOADS.get(file.r2_key);
  if (!obj) return new Response('File not found', { status: 404 });

  return new Response(obj.body, {
    headers: {
      'Content-Type': file.content_type,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(file.original_filename)}"`,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}

// ===== Admin stats =====

async function handleAdminStats(req: Request, env: Env): Promise<Response> {
  const result = await requireAuth(req, env);
  if (result instanceof Response) return result;

  const rows = await env.DB.prepare('SELECT status, COUNT(*) as cnt FROM submissions GROUP BY status')
    .all<{ status: string; cnt: number }>();

  const stats: Record<string, number> = {};
  for (const r of rows.results) stats[r.status] = r.cnt;
  return json(stats);
}

// ===== Admin queue status =====

async function handleAdminQueues(req: Request, env: Env): Promise<Response> {
  const result = await requireAuth(req, env);
  if (result instanceof Response) return result;
  const user = result as User;

  const url = new URL(req.url);
  const flash = url.searchParams.get('flash') ?? undefined;
  const fromParam = url.searchParams.get('from') ?? '';
  const toParam   = url.searchParams.get('to')   ?? '';

  const fromTs = fromParam ? new Date(fromParam + '+07:00').getTime() : Date.now() - 24 * 60 * 60 * 1000;
  const toTs   = toParam   ? new Date(toParam   + '+07:00').getTime() : Date.now();

  const rows = await env.DB.prepare(`
    SELECT
      form_type,
      SUM(CASE WHEN status='pending'     THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN status='dispatching' THEN 1 ELSE 0 END) AS dispatching,
      SUM(CASE WHEN status='complete' AND completed_at >= ? AND completed_at <= ? THEN 1 ELSE 0 END) AS complete_24h,
      SUM(CASE WHEN status='failed'   AND completed_at >= ? AND completed_at <= ? THEN 1 ELSE 0 END) AS failed_24h,
      ROUND(AVG(CASE WHEN status='complete' AND completed_at >= ? AND completed_at <= ?
                THEN (completed_at - dispatched_at)/1000.0 ELSE NULL END), 1) AS avg_duration_s
    FROM submissions
    GROUP BY form_type
    ORDER BY form_type
  `).bind(fromTs, toTs, fromTs, toTs, fromTs, toTs).all<{
    form_type: string;
    pending: number;
    dispatching: number;
    complete_24h: number;
    failed_24h: number;
    avg_duration_s: number | null;
  }>();

  return html(queueStatusPage(rows.results, { from: fromParam, to: toParam }, user, flash));
}

// ===== Admin bulk retry =====

async function handleAdminBulkRetry(req: Request, env: Env): Promise<Response> {
  const result = await requireRole(req, env, ['admin', 'operator']);
  if (result instanceof Response) return result;

  let ids: string[] = [];
  const ct = req.headers.get('Content-Type') ?? '';

  if (ct.includes('application/json')) {
    const body = await req.json() as { ids: string[] };
    ids = body.ids ?? [];
  } else {
    const formData = await req.formData();
    ids = formData.getAll('ids').map(String);
  }

  if (ids.length === 0) return json({ ok: false, error: 'ไม่มี ID ที่ระบุ' }, 400);

  const placeholders = ids.map(() => '?').join(',');
  await env.DB.prepare(
    `UPDATE submissions SET status='pending', retry_count=0, last_error=NULL, dispatched_at=NULL
     WHERE id IN (${placeholders}) AND status IN ('failed','complete')`,
  ).bind(...ids).run();

  const referer = req.headers.get('Referer') ?? '/admin/submissions';
  if (!ct.includes('json')) {
    return flashRedirect(referer, `✓ Retry ${ids.length} submission(s) แล้ว`);
  }
  return json({ ok: true, retried: ids.length });
}

// ===== Admin users =====

async function handleAdminUsers(req: Request, env: Env): Promise<Response> {
  const result = await requireRole(req, env, ['admin']);
  if (result instanceof Response) return result;
  const user = result as User;

  const url = new URL(req.url);
  const flash = url.searchParams.get('flash') ?? undefined;
  const perPage = 50;
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
  const offset = (page - 1) * perPage;

  const [countRow, users] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) as n FROM users').first<{ n: number }>(),
    env.DB.prepare('SELECT * FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?').bind(perPage, offset).all<User>(),
  ]);
  const total = countRow?.n ?? 0;
  return html(usersPage(users.results, total, page, perPage, user, flash));
}

async function handleAdminUserNew(req: Request, env: Env): Promise<Response> {
  const result = await requireRole(req, env, ['admin']);
  if (result instanceof Response) return result;
  const user = result as User;

  // สร้าง CSRF token ก่อนเสมอ — ใช้ทั้ง GET และทุก error response ใน POST
  const freshCsrf = await generateCsrfToken(getSessionId(req) ?? '', env.SESSION_SECRET);

  if (req.method === 'GET') {
    return html(userFormPage(user, undefined, undefined, freshCsrf));
  }

  const body = await req.formData();
  const csrfFromForm = String(body.get('_csrf') ?? '');
  if (!await verifyCsrfToken(csrfFromForm, getSessionId(req) ?? '', env.SESSION_SECRET)) {
    return html(userFormPage(user, undefined, 'CSRF token ไม่ถูกต้อง กรุณา reload แล้วลองใหม่', freshCsrf), 403);
  }

  const username = String(body.get('username') ?? '').trim();
  const email = String(body.get('email') ?? '').trim();
  const password = String(body.get('password') ?? '');
  const role = String(body.get('role') ?? 'viewer');

  if (!username || !email || !password) return html(userFormPage(user, undefined, 'กรุณากรอกข้อมูลให้ครบ', freshCsrf));
  if (password.length < 8) return html(userFormPage(user, undefined, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร', freshCsrf));

  const salt = generateToken(16);
  const hash = await hashPassword(password, salt);
  const newId = 'user_' + generateToken(8);

  try {
    await env.DB.prepare(
      'INSERT INTO users (id, username, email, password_hash, password_salt, role, is_active, created_at, created_by) VALUES (?,?,?,?,?,?,1,?,?)',
    ).bind(newId, username, email, hash, salt, role, Date.now(), user.id).run();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return html(userFormPage(user, undefined, msg.includes('UNIQUE') ? 'Username หรือ Email ซ้ำ' : 'เกิดข้อผิดพลาด', freshCsrf));
  }

  return flashRedirect('/admin/users', `✓ สร้าง user ${username} แล้ว`);
}

async function handleAdminUserEdit(req: Request, env: Env, userId: string): Promise<Response> {
  const result = await requireRole(req, env, ['admin']);
  if (result instanceof Response) return result;
  const user = result as User;

  const editUser = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<User>();
  if (!editUser) return new Response('Not found', { status: 404 });

  const freshCsrf = await generateCsrfToken(getSessionId(req) ?? '', env.SESSION_SECRET);

  if (req.method === 'GET') {
    return html(userFormPage(user, editUser, undefined, freshCsrf));
  }

  const body = await req.formData();
  const csrfFromForm = String(body.get('_csrf') ?? '');
  if (!await verifyCsrfToken(csrfFromForm, getSessionId(req) ?? '', env.SESSION_SECRET)) {
    return html(userFormPage(user, editUser, 'CSRF token ไม่ถูกต้อง กรุณา reload แล้วลองใหม่', freshCsrf), 403);
  }

  const email = String(body.get('email') ?? '').trim();
  const role = String(body.get('role') ?? editUser.role);
  const isActive = body.get('is_active') === '1' ? 1 : 0;
  const newPassword = String(body.get('password') ?? '').trim();

  let hash = editUser.password_hash;
  let salt = editUser.password_salt;

  if (newPassword) {
    if (newPassword.length < 8) return html(userFormPage(user, editUser, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร', freshCsrf));
    salt = generateToken(16);
    hash = await hashPassword(newPassword, salt);
  }

  await env.DB.prepare('UPDATE users SET email=?, role=?, is_active=?, password_hash=?, password_salt=? WHERE id=?')
    .bind(email, role, isActive, hash, salt, userId).run();

  return flashRedirect('/admin/users', `✓ แก้ไข user ${editUser.username} แล้ว`);
}

async function handleAdminUserDelete(req: Request, env: Env, userId: string): Promise<Response> {
  const result = await requireRole(req, env, ['admin']);
  if (result instanceof Response) return result;
  const user = result as User;

  if (userId === user.id) return flashRedirect('/admin/users', 'ไม่สามารถลบตัวเองได้');

  await env.DB.prepare('UPDATE users SET is_active=0 WHERE id=?').bind(userId).run();
  await env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(userId).run();
  return flashRedirect('/admin/users', '✓ ปิดใช้งาน user แล้ว');
}

// ===== Admin profile =====

async function handleAdminProfile(req: Request, env: Env): Promise<Response> {
  const result = await requireAuth(req, env);
  if (result instanceof Response) return result;
  const user = result as User;

  const csrf = await generateCsrfToken(getSessionId(req) ?? '', env.SESSION_SECRET);
  return html(profilePage(user, undefined, undefined, csrf));
}

async function handleAdminProfilePassword(req: Request, env: Env): Promise<Response> {
  const result = await requireAuth(req, env);
  if (result instanceof Response) return result;
  const user = result as User;

  const body = await req.formData();
  const csrf = String(body.get('_csrf') ?? '');
  const csrf2 = await generateCsrfToken(getSessionId(req) ?? '', env.SESSION_SECRET);

  if (!await verifyCsrfToken(csrf, getSessionId(req) ?? '', env.SESSION_SECRET)) {
    return html(profilePage(user, 'CSRF token ไม่ถูกต้อง', undefined, csrf2), 403);
  }

  const currentPw = String(body.get('current_password') ?? '');
  const newPw = String(body.get('new_password') ?? '');
  const confirmPw = String(body.get('confirm_password') ?? '');

  const currentHash = await hashPassword(currentPw, user.password_salt);
  if (currentHash !== user.password_hash) return html(profilePage(user, 'รหัสผ่านปัจจุบันไม่ถูกต้อง', undefined, csrf2));
  if (newPw.length < 8) return html(profilePage(user, 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร', undefined, csrf2));
  if (newPw !== confirmPw) return html(profilePage(user, 'รหัสผ่านใหม่ไม่ตรงกัน', undefined, csrf2));

  const newSalt = generateToken(16);
  const newHash = await hashPassword(newPw, newSalt);

  await env.DB.prepare('UPDATE users SET password_hash=?, password_salt=? WHERE id=?').bind(newHash, newSalt, user.id).run();
  await env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(user.id).run();

  return new Response(null, {
    status: 302,
    headers: {
      Location: '/admin/login?next=/admin/profile',
      'Set-Cookie': `admin_session=; HttpOnly; Secure; SameSite=Strict; Path=/admin; Max-Age=0`,
    },
  });
}

// ===== Admin webhooks =====

async function handleAdminWebhooks(req: Request, env: Env): Promise<Response> {
  const result = await requireRole(req, env, ['admin']);
  if (result instanceof Response) return result;
  const user = result as User;

  const url = new URL(req.url);
  const flash = url.searchParams.get('flash') ?? undefined;
  const perPage = 20;
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
  const offset = (page - 1) * perPage;

  const [countRow, webhooks] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) as n FROM webhooks').first<{ n: number }>(),
    env.DB.prepare(
      'SELECT w.*, COUNT(wd.id) as delivery_count FROM webhooks w LEFT JOIN webhook_deliveries wd ON wd.webhook_id = w.id GROUP BY w.id ORDER BY w.created_at DESC LIMIT ? OFFSET ?',
    ).bind(perPage, offset).all<Webhook & { delivery_count: number }>(),
  ]);
  const total = countRow?.n ?? 0;

  return html(webhooksPage(webhooks.results, total, page, perPage, user, flash));
}

async function handleAdminWebhookNew(req: Request, env: Env): Promise<Response> {
  const result = await requireRole(req, env, ['admin']);
  if (result instanceof Response) return result;
  const user = result as User;

  if (req.method === 'GET') {
    const csrf = await generateCsrfToken(getSessionId(req) ?? '', env.SESSION_SECRET);
    return html(webhookFormPage(user, undefined, csrf));
  }

  const body = await req.formData();
  const csrf = String(body.get('_csrf') ?? '');
  if (!await verifyCsrfToken(csrf, getSessionId(req) ?? '', env.SESSION_SECRET)) {
    return html(webhookFormPage(user, 'CSRF token ไม่ถูกต้อง'), 403);
  }

  const name = String(body.get('name') ?? '').trim();
  const url2 = String(body.get('url') ?? '').trim();
  const events = body.getAll('events').map(String);
  const formTypes = body.getAll('form_types').map(String);

  if (!name || !url2 || events.length === 0) return html(webhookFormPage(user, 'กรุณากรอกข้อมูลให้ครบ'));

  const secret = generateToken(32);
  const id = 'wh_' + generateToken(8);

  await env.DB.prepare(
    'INSERT INTO webhooks (id, name, url, secret, events, form_types, is_active, created_at, created_by) VALUES (?,?,?,?,?,?,1,?,?)',
  ).bind(id, name, url2, secret, JSON.stringify(events), formTypes.length > 0 ? JSON.stringify(formTypes) : null, Date.now(), user.id).run();

  return flashRedirect(`/admin/webhooks/${id}`, `✓ สร้าง webhook "${name}" — Secret: ${secret} (บันทึกไว้ จะไม่แสดงอีก)`);
}

async function handleAdminWebhookDetail(req: Request, env: Env, webhookId: string): Promise<Response> {
  const result = await requireRole(req, env, ['admin']);
  if (result instanceof Response) return result;
  const user = result as User;

  const url = new URL(req.url);
  const flash = url.searchParams.get('flash') ?? undefined;
  const perPage = 25;
  const deliveryPage = Math.max(1, parseInt(url.searchParams.get('delivery_page') ?? '1'));
  const offset = (deliveryPage - 1) * perPage;

  const [webhook, deliveryCountRow, deliveries] = await Promise.all([
    env.DB.prepare('SELECT * FROM webhooks WHERE id=?').bind(webhookId).first<Webhook>(),
    env.DB.prepare('SELECT COUNT(*) as n FROM webhook_deliveries WHERE webhook_id=?').bind(webhookId).first<{ n: number }>(),
    env.DB.prepare('SELECT * FROM webhook_deliveries WHERE webhook_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .bind(webhookId, perPage, offset).all<WebhookDelivery>(),
  ]);

  if (!webhook) return new Response('Not found', { status: 404 });
  const deliveryTotal = deliveryCountRow?.n ?? 0;

  return html(webhookDetailPage(webhook, deliveries.results, deliveryTotal, deliveryPage, perPage, user, flash?.includes('Secret:') ?? false, flash));
}

async function handleAdminWebhookToggle(req: Request, env: Env, webhookId: string): Promise<Response> {
  const result = await requireRole(req, env, ['admin']);
  if (result instanceof Response) return result;

  const webhook = await env.DB.prepare('SELECT is_active FROM webhooks WHERE id=?').bind(webhookId).first<{ is_active: number }>();
  if (!webhook) return new Response('Not found', { status: 404 });

  await env.DB.prepare('UPDATE webhooks SET is_active=? WHERE id=?').bind(webhook.is_active ? 0 : 1, webhookId).run();
  return flashRedirect(`/admin/webhooks/${webhookId}`, `✓ ${webhook.is_active ? 'ปิด' : 'เปิด'} webhook แล้ว`);
}

async function handleAdminWebhookDelete(req: Request, env: Env, webhookId: string): Promise<Response> {
  const result = await requireRole(req, env, ['admin']);
  if (result instanceof Response) return result;

  await env.DB.prepare('DELETE FROM webhooks WHERE id=?').bind(webhookId).run();
  return flashRedirect('/admin/webhooks', '✓ ลบ webhook แล้ว');
}

async function handleAdminWebhookTest(req: Request, env: Env, webhookId: string): Promise<Response> {
  const result = await requireRole(req, env, ['admin']);
  if (result instanceof Response) return result;

  const webhook = await env.DB.prepare('SELECT * FROM webhooks WHERE id=?').bind(webhookId).first<Webhook>();
  if (!webhook) return new Response('Not found', { status: 404 });

  const payload = JSON.stringify({
    event: 'submission.created',
    timestamp: Date.now(),
    data: { submission_id: 'test-' + crypto.randomUUID(), form_type: 'contact', status: 'pending', submitted_at: Date.now(), summary: { email: 'test@example.com', full_name: 'Test User' } },
  });

  const signature = await signWebhookPayload(payload, webhook.secret);
  const deliveryId = 'del_' + generateToken(8);

  try {
    const res = await fetch(webhook.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Webhook-Event': 'submission.created', 'X-Webhook-Signature': signature, 'X-Webhook-Delivery': deliveryId },
      body: payload,
    });
    const responseBody = await res.text();
    await env.DB.prepare(
      'INSERT INTO webhook_deliveries (id, webhook_id, event_type, submission_id, status, response_code, response_body, attempt_count, delivered_at, created_at) VALUES (?,?,?,?,?,?,?,1,?,?)',
    ).bind(deliveryId, webhookId, 'submission.created', 'test', res.ok ? 'success' : 'failed', res.status, responseBody.slice(0, 500), Date.now(), Date.now()).run();

    return flashRedirect(`/admin/webhooks/${webhookId}`, `✓ Test sent — Response: ${res.status}`);
  } catch (err) {
    return flashRedirect(`/admin/webhooks/${webhookId}`, `Test failed: ${err}`);
  }
}

// ===== Export CSV =====

async function handleExportCsv(req: Request, env: Env, type: 'submissions' | 'dispatched'): Promise<Response> {
  const result = await requireRole(req, env, ['admin', 'operator']);
  if (result instanceof Response) return result;

  const url = new URL(req.url);
  const conditions: string[] = type === 'submissions'
    ? ["status IN ('pending','dispatching','failed')"]
    : ["status IN ('complete','failed')"];
  const params: unknown[] = [];

  const form_type = url.searchParams.get('form_type');
  if (form_type) { conditions.push('form_type=?'); params.push(form_type); }
  const from = url.searchParams.get('from');
  if (from) { conditions.push('submitted_at>=?'); params.push(new Date(from + 'T00:00:00+07:00').getTime()); }
  const to = url.searchParams.get('to');
  if (to) { conditions.push('submitted_at<=?'); params.push(new Date(to + 'T23:59:59+07:00').getTime()); }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const rows = await env.DB.prepare(`SELECT * FROM submissions ${where} ORDER BY submitted_at DESC`).bind(...params).all<Submission>();

  function csvEscape(val: unknown): string {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  const headers = ['id', 'form_type', 'status', 'full_name', 'email', 'phone', 'submitted_at', 'dispatched_at', 'completed_at', 'retry_count', 'last_error', 'data'];
  const BOM = '\uFEFF';
  const lines = [
    BOM + headers.map(csvEscape).join(','),
    ...rows.results.map(s => {
      const d = JSON.parse(s.data);
      return [s.id, s.form_type, s.status, d.fullName ?? '', d.email ?? '', d.phone ?? '',
        s.submitted_at ? new Date(s.submitted_at).toISOString() : '',
        s.dispatched_at ? new Date(s.dispatched_at).toISOString() : '',
        s.completed_at ? new Date(s.completed_at).toISOString() : '',
        s.retry_count, s.last_error ?? '', s.data,
      ].map(csvEscape).join(',');
    }),
  ];

  const today = new Date().toISOString().slice(0, 10);
  return new Response(lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv;charset=utf-8',
      'Content-Disposition': `attachment; filename="${type}-${today}.csv"`,
    },
  });
}

// ===== Queue: intake-queue consumers (10 queues → same handler) =====

async function handleIntakeQueue(batch: MessageBatch<IntakeMessage>, env: Env): Promise<void> {
  await Promise.all(batch.messages.map(async (msg) => {
    const m = msg.body;
    try {
      await env.DB.prepare(
        `INSERT OR IGNORE INTO submissions (id, form_type, data, status, submitted_at, idempotency_key)
         VALUES (?, ?, ?, 'pending', ?, ?)`,
      ).bind(m.submission_id, m.form_type, JSON.stringify(m.data), m.submitted_at, m.idempotency_key).run();

      if (m.files.length > 0) {
        // batch INSERT ในครั้งเดียวแทน N round-trips
        const placeholders = m.files.map(() => '(?,?,?,?,?,?,?,?)').join(',');
        const params = m.files.flatMap(f => [
          f.id, m.submission_id, f.field_name, f.original_filename,
          f.content_type, f.size_bytes, f.r2_key, m.submitted_at,
        ]);
        await env.DB.prepare(
          `INSERT OR IGNORE INTO submission_files (id, submission_id, field_name, original_filename, content_type, size_bytes, r2_key, uploaded_at) VALUES ${placeholders}`,
        ).bind(...params).run();
      }

      msg.ack();
      await fireWebhookEvent('submission.created', m.submission_id, m.form_type as FormType, env);
    } catch (err) {
      console.error(`Intake error [${batch.queue}]:`, err);
      msg.retry();
    }
  }));
}

// ===== Queue: webhook-queue consumer =====

async function handleWebhookQueue(batch: MessageBatch<WebhookMessage>, env: Env): Promise<void> {
  await Promise.all(batch.messages.map(async (msg) => {
    const m = msg.body;
    try {
      const webhook = await env.DB.prepare('SELECT * FROM webhooks WHERE id=? AND is_active=1')
        .bind(m.webhook_id).first<Webhook>();
      if (!webhook) { msg.ack(); return; }

      const submission = await env.DB.prepare('SELECT * FROM submissions WHERE id=?')
        .bind(m.submission_id).first<Submission>();
      if (!submission) { msg.ack(); return; }

      const data = JSON.parse(submission.data);
      const payload = JSON.stringify({
        event: m.event_type,
        timestamp: Date.now(),
        data: { submission_id: m.submission_id, form_type: submission.form_type, status: submission.status, submitted_at: submission.submitted_at, summary: { email: data.email, full_name: data.fullName } },
      });

      const signature = await signWebhookPayload(payload, webhook.secret);
      await env.DB.prepare('UPDATE webhook_deliveries SET attempt_count=attempt_count+1 WHERE id=?').bind(m.delivery_id).run();

      const res = await fetch(webhook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Webhook-Event': m.event_type, 'X-Webhook-Signature': signature, 'X-Webhook-Delivery': m.delivery_id },
        body: payload,
        signal: AbortSignal.timeout(10_000),
      });

      const responseBody = await res.text();

      if (res.ok) {
        await env.DB.prepare("UPDATE webhook_deliveries SET status='success', response_code=?, response_body=?, delivered_at=? WHERE id=?")
          .bind(res.status, responseBody.slice(0, 500), Date.now(), m.delivery_id).run();
        msg.ack();
      } else if (res.status >= 500) {
        await env.DB.prepare('UPDATE webhook_deliveries SET response_code=?, response_body=? WHERE id=?')
          .bind(res.status, responseBody.slice(0, 500), m.delivery_id).run();
        msg.retry({ delaySeconds: [10, 60, 300][Math.min(m.attempt, 2)] });
      } else {
        await env.DB.prepare("UPDATE webhook_deliveries SET status='failed', response_code=?, response_body=? WHERE id=?")
          .bind(res.status, responseBody.slice(0, 500), m.delivery_id).run();
        msg.ack();
      }
    } catch (err) {
      console.error('Webhook queue error:', err);
      msg.retry({ delaySeconds: 30 });
    }
  }));
}

// ===== Helper: fire webhook event =====

async function fireWebhookEvent(eventType: WebhookEvent, submissionId: string, formType: FormType, env: Env): Promise<void> {
  try {
    const webhooks = await env.DB.prepare('SELECT * FROM webhooks WHERE is_active=1').all<Webhook>();

    // filter ก่อน แล้วค่อย dispatch ทุก webhook พร้อมกัน
    const applicable = webhooks.results.filter(wh => {
      const events: string[] = JSON.parse(wh.events);
      if (!events.includes(eventType)) return false;
      if (wh.form_types) {
        const allowed: string[] = JSON.parse(wh.form_types);
        if (!allowed.includes(formType)) return false;
      }
      return true;
    });

    await Promise.all(applicable.map(async (wh) => {
      const deliveryId = 'del_' + generateToken(8);
      await env.DB.prepare(
        "INSERT INTO webhook_deliveries (id, webhook_id, event_type, submission_id, status, attempt_count, created_at) VALUES (?,?,?,?,'pending',0,?)",
      ).bind(deliveryId, wh.id, eventType, submissionId, Date.now()).run();
      await env.WEBHOOK_QUEUE.send({ webhook_id: wh.id, event_type: eventType, submission_id: submissionId, delivery_id: deliveryId, attempt: 0 });
    }));
  } catch (err) {
    console.error('fireWebhookEvent error:', err);
  }
}

// ===== CSS =====

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;color:#1e293b;min-height:100vh}
header{background:#fff;border-bottom:1px solid #e2e8f0;padding:1.5rem 1rem;max-width:700px;margin:0 auto}
header .back{color:#2563eb;text-decoration:none;font-size:0.875rem;display:inline-block;margin-bottom:0.75rem}
header h1{margin-bottom:0.25rem;font-size:1.5rem}
header p{color:#64748b;font-size:0.9rem}
main{max-width:700px;margin:2rem auto;padding:0 1rem 3rem}
form{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:1.5rem;display:flex;flex-direction:column;gap:1.25rem;box-shadow:0 1px 3px rgba(0,0,0,.05)}
label{display:flex;flex-direction:column;gap:0.35rem;font-size:0.9rem;font-weight:500}
input,textarea,select{border:1px solid #cbd5e1;border-radius:6px;padding:0.5rem 0.75rem;font-size:0.95rem;font-family:inherit;width:100%;outline:none;transition:border-color .15s}
input:focus,textarea:focus,select:focus{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.1)}
input[type=file]{padding:0.4rem}
input[type=checkbox]{width:auto;margin-right:0.35rem;accent-color:#2563eb}
fieldset{border:1px solid #e2e8f0;border-radius:8px;padding:1rem}
legend{font-weight:600;padding:0 0.5rem;font-size:0.9rem}
button[type=submit]{background:#2563eb;color:#fff;border:none;border-radius:6px;padding:0.75rem 1.5rem;font-size:1rem;font-weight:600;cursor:pointer;transition:background .15s;align-self:flex-start}
button[type=submit]:hover{background:#1d4ed8}
button[type=submit]:disabled{background:#94a3b8;cursor:not-allowed}
small{color:#64748b;font-size:0.8rem}
`.trim();

// ===== Admin clear data =====

async function handleAdminClearData(req: Request, env: Env): Promise<Response> {
  const result = await requireRole(req, env, ['admin']);
  if (result instanceof Response) return result;
  const user = result as User;

  if (req.method === 'GET') {
    const [subCount, fileCount, sessCount, attemptCount, deliveryCount] = await Promise.all([
      env.DB.prepare('SELECT COUNT(*) as n FROM submissions').first<{ n: number }>(),
      env.DB.prepare('SELECT COUNT(*) as n FROM submission_files').first<{ n: number }>(),
      env.DB.prepare('SELECT COUNT(*) as n FROM sessions').first<{ n: number }>(),
      env.DB.prepare('SELECT COUNT(*) as n FROM login_attempts').first<{ n: number }>(),
      env.DB.prepare('SELECT COUNT(*) as n FROM webhook_deliveries').first<{ n: number }>(),
    ]);

    // count R2 objects
    let r2Count = 0;
    let cursor: string | undefined;
    do {
      const listed = await env.UPLOADS.list({ cursor, limit: 1000 });
      r2Count += listed.objects.length;
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);

    const stats: ClearDataStats = {
      submissions: subCount?.n ?? 0,
      submissionFiles: fileCount?.n ?? 0,
      sessions: sessCount?.n ?? 0,
      loginAttempts: attemptCount?.n ?? 0,
      webhookDeliveries: deliveryCount?.n ?? 0,
      r2Objects: r2Count,
    };

    const csrfToken = await generateCsrfToken(getSessionId(req) ?? '', env.SESSION_SECRET);
    return html(clearDataPage(user, stats, csrfToken));
  }

  // POST — perform clear
  const body = await req.formData();
  const csrfToken = body.get('csrf_token') as string;
  if (!await verifyCsrfToken(csrfToken, getSessionId(req) ?? '', env.SESSION_SECRET)) {
    return flashRedirect('/admin/clear-data', '❌ CSRF token ไม่ถูกต้อง');
  }

  const targets = body.getAll('target').map(String);
  if (targets.length === 0) {
    return flashRedirect('/admin/clear-data', '❌ กรุณาเลือกข้อมูลที่ต้องการเคลียร์');
  }

  const cleared: string[] = [];

  if (targets.includes('submissions')) {
    await env.DB.prepare('DELETE FROM submission_files').run();
    await env.DB.prepare('DELETE FROM submissions').run();
    cleared.push('Submissions + File Records (D1)');
  }

  if (targets.includes('r2')) {
    let cursor: string | undefined;
    let r2Deleted = 0;
    do {
      const listed = await env.UPLOADS.list({ cursor, limit: 1000 });
      if (listed.objects.length > 0) {
        await Promise.all(listed.objects.map(o => env.UPLOADS.delete(o.key)));
        r2Deleted += listed.objects.length;
      }
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);
    cleared.push(`R2 Files (${r2Deleted} objects)`);
  }

  if (targets.includes('sessions')) {
    await env.DB.prepare('DELETE FROM sessions').run();
    await env.DB.prepare('DELETE FROM login_attempts').run();
    cleared.push('Sessions + Login Attempts (D1)');
  }

  if (targets.includes('webhook_deliveries')) {
    await env.DB.prepare('DELETE FROM webhook_deliveries').run();
    cleared.push('Webhook Deliveries (D1)');
  }

  // if sessions were cleared, redirect to login
  if (targets.includes('sessions')) {
    return new Response(null, { status: 302, headers: { Location: '/admin/login' } });
  }

  return flashRedirect('/admin/clear-data', `✓ เคลียร์แล้ว: ${cleared.join(', ')}`);
}

// ===== Load Test handlers =====

async function handleLoadTest(req: Request, env: Env): Promise<Response> {
  const result = await requireRole(req, env, ['admin', 'operator']);
  if (result instanceof Response) return result;
  const user = result as User;
  return html(loadtestPage(user));
}

async function handleLoadTestCleanup(req: Request, env: Env): Promise<Response> {
  const result = await requireRole(req, env, ['admin', 'operator']);
  if (result instanceof Response) return result;

  // Find submission IDs matching LoadTest pattern
  const subRows = await env.DB.prepare(
    `SELECT id FROM submissions WHERE json_extract(data, '$.fullName') LIKE 'LoadTest User %'`
  ).all<{ id: string }>();
  const ids = (subRows.results ?? []).map(r => r.id);

  let filesDeleted = 0;
  let r2Deleted = 0;

  if (ids.length > 0) {
    // Get R2 keys before deleting files
    const placeholders = ids.map(() => '?').join(',');
    const fileRows = await env.DB.prepare(
      `SELECT r2_key FROM submission_files WHERE submission_id IN (${placeholders})`
    ).bind(...ids).all<{ r2_key: string }>();
    const r2Keys = (fileRows.results ?? []).map(r => r.r2_key);

    // Delete from D1
    await env.DB.prepare(
      `DELETE FROM submission_files WHERE submission_id IN (${placeholders})`
    ).bind(...ids).run();
    filesDeleted = fileRows.results?.length ?? 0;

    await env.DB.prepare(
      `DELETE FROM submissions WHERE id IN (${placeholders})`
    ).bind(...ids).run();

    // Delete from R2
    for (const key of r2Keys) {
      try {
        await env.UPLOADS.delete(key);
        r2Deleted++;
      } catch {
        // best-effort
      }
    }

    // Also sweep R2 for any mock files by prefix pattern
    let cursor: string | undefined;
    do {
      const list = await env.UPLOADS.list({ prefix: 'submissions/', cursor });
      for (const obj of list.objects) {
        if (obj.key.includes('/mock-')) {
          try { await env.UPLOADS.delete(obj.key); r2Deleted++; } catch { /* ignore */ }
        }
      }
      cursor = list.truncated ? list.cursor : undefined;
    } while (cursor);
  }

  return json({ ok: true, deleted: { submissions: ids.length, files: filesDeleted, r2Objects: r2Deleted } });
}

// ===== Main router =====

async function handleFetch(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  if (path === '/style.css') return new Response(CSS, { headers: { 'Content-Type': 'text/css' } });

  // load test
  if (path === '/loadtest') return handleLoadTest(req, env);
  if (path === '/admin/loadtest/cleanup' && method === 'POST') return handleLoadTestCleanup(req, env);

  // public routes
  if (path === '/') return handleIndex(req, env);
  if (path.startsWith('/form/')) return handleFormPage(req, env);
  if (path.startsWith('/submit/') && method === 'POST') return handleSubmit(req, env);

  // ── Admin login / logout (ไม่ต้องผ่าน auth guard)
  if (path === '/admin/login') return handleAdminLogin(req, env);
  if (path === '/admin/logout' && method === 'POST') return handleAdminLogout(req, env);

  // ── Admin auth guard ───────────────────────────────────────────────────
  // ทุก path ที่ขึ้นต้นด้วย /admin (รวม /admin, /admin/, /admin/*)
  // ถ้าไม่ได้ login → เด้งไป /admin/login?next=<path>
  // ถ้า login แล้ว และเข้า /admin หรือ /admin/ → เด้งไป /admin/submissions
  if (path === '/admin' || path === '/admin/' || path.startsWith('/admin/')) {
    const authUser = await getCurrentUser(req, env).catch(() => null);
    if (!authUser) {
      const next = (path === '/admin' || path === '/admin/') ? '/admin/submissions' : path;
      return new Response(null, {
        status: 302,
        headers: { Location: '/admin/login?next=' + encodeURIComponent(next) },
      });
    }
    // login แล้ว + /admin หรือ /admin/ → ไป submissions โดยตรง
    if (path === '/admin' || path === '/admin/') {
      return new Response(null, { status: 302, headers: { Location: '/admin/submissions' } });
    }
  }

  // admin pages
  if (path === '/admin/submissions') return handleAdminSubmissions(req, env);
  if (path === '/admin/dispatched') return handleAdminDispatched(req, env);
  if (path === '/admin/queues') return handleAdminQueues(req, env);
  if (path === '/admin/api/stats') return handleAdminStats(req, env);
  if (path === '/admin/bulk-retry' && method === 'POST') return handleAdminBulkRetry(req, env);
  if (path === '/admin/profile' && method === 'GET') return handleAdminProfile(req, env);
  if (path === '/admin/profile/password' && method === 'POST') return handleAdminProfilePassword(req, env);
  if (path === '/admin/export/submissions.csv') return handleExportCsv(req, env, 'submissions');
  if (path === '/admin/export/dispatched.csv') return handleExportCsv(req, env, 'dispatched');
  if (path === '/admin/clear-data') return handleAdminClearData(req, env);
  if (path === '/admin/users' && method === 'GET') return handleAdminUsers(req, env);
  if (path === '/admin/users' && method === 'POST') return handleAdminUserNew(req, env);
  if (path === '/admin/users/new') return handleAdminUserNew(req, env);

  // submission detail + file
  const subMatch = path.match(/^\/admin\/submissions\/([^/]+)$/);
  if (subMatch) return handleAdminSubmissionDetail(req, env, subMatch[1]);

  const fileMatch = path.match(/^\/admin\/files\/([^/]+)$/);
  if (fileMatch) return handleAdminFileDownload(req, env, fileMatch[1]);

  // user CRUD
  const userEditMatch = path.match(/^\/admin\/users\/([^/]+)\/edit$/);
  if (userEditMatch) return handleAdminUserEdit(req, env, userEditMatch[1]);

  const userDelMatch = path.match(/^\/admin\/users\/([^/]+)\/delete$/);
  if (userDelMatch && method === 'POST') return handleAdminUserDelete(req, env, userDelMatch[1]);

  const userUpdMatch = path.match(/^\/admin\/users\/([^/]+)$/);
  if (userUpdMatch && method === 'POST') return handleAdminUserEdit(req, env, userUpdMatch[1]);

  // webhooks
  if (path === '/admin/webhooks' && method === 'GET') return handleAdminWebhooks(req, env);
  if (path === '/admin/webhooks/new') return handleAdminWebhookNew(req, env);

  const whToggle = path.match(/^\/admin\/webhooks\/([^/]+)\/toggle$/);
  if (whToggle && method === 'POST') return handleAdminWebhookToggle(req, env, whToggle[1]);

  const whDel = path.match(/^\/admin\/webhooks\/([^/]+)\/delete$/);
  if (whDel && method === 'POST') return handleAdminWebhookDelete(req, env, whDel[1]);

  const whTest = path.match(/^\/admin\/webhooks\/([^/]+)\/test$/);
  if (whTest && method === 'POST') return handleAdminWebhookTest(req, env, whTest[1]);

  const whDetail = path.match(/^\/admin\/webhooks\/([^/]+)$/);
  if (whDetail && method === 'GET') return handleAdminWebhookDetail(req, env, whDetail[1]);

  // ── 404 fallback ──────────────────────────────────────────────────────
  // path เป็น /admin/* แต่ไม่ตรง route → redirect ตาม auth
  // path อื่นๆ ที่ไม่ใช่ admin → กลับหน้า /
  if (path.startsWith('/admin')) {
    const fallbackUser = await getCurrentUser(req, env).catch(() => null);
    return new Response(null, {
      status: 302,
      headers: { Location: fallbackUser ? '/admin/submissions' : '/admin/login' },
    });
  }
  return new Response(null, { status: 302, headers: { Location: '/' } });
}

// ===== Exports =====

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    try {
      return await handleFetch(req, env);
    } catch (err) {
      console.error('Unhandled error:', err);
      return new Response('Internal Server Error', { status: 500 });
    }
  },

  // queue handler รองรับทั้ง 10 intake queues + webhook queue
  // batch.queue บอกชื่อ queue ที่ trigger เช่น "intake-contact", "intake-newsletter"
  async queue(batch: MessageBatch<IntakeMessage | WebhookMessage>, env: Env): Promise<void> {
    if (batch.queue.startsWith('intake-')) {
      await handleIntakeQueue(batch as MessageBatch<IntakeMessage>, env);
    } else if (batch.queue === 'webhook-queue') {
      await handleWebhookQueue(batch as MessageBatch<WebhookMessage>, env);
    } else {
      console.warn('Unknown queue:', batch.queue);
      batch.ackAll();
    }
  },

  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    await cleanupExpiredSessions(env);
    console.log('Session cleanup done');
  },
} satisfies ExportedHandler<Env>;
