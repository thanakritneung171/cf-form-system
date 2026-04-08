import type { User, UserRole } from 'shared/types';

// ===== Env type (subset ที่ใช้ใน auth) =====
export interface AuthEnv {
  DB: D1Database;
  SESSION_SECRET: string;
}

// ===== Crypto helpers =====

/** แปลง ArrayBuffer เป็น hex string */
function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/** สร้าง random hex string ขนาด bytes bytes */
export function generateToken(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return bufToHex(arr.buffer);
}

/** PBKDF2-SHA256 100k iterations */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    256,
  );
  return bufToHex(bits);
}

/** HMAC-SHA256 → hex */
export async function hmacSha256(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return bufToHex(sig);
}

/** ลายเซ็น HMAC สำหรับ webhook payload */
export async function signWebhookPayload(body: string, secret: string): Promise<string> {
  const hex = await hmacSha256(body, secret);
  return `sha256=${hex}`;
}

// ===== CSRF =====

/**
 * สร้าง CSRF token โดย derive จาก sessionId + ชั่วโมงปัจจุบัน
 * ทำให้ token หมดอายุทุก 1 ชั่วโมง และผูกกับ session
 */
export async function generateCsrfToken(sessionId: string, secret: string): Promise<string> {
  const hour = Math.floor(Date.now() / 3_600_000);
  return hmacSha256(`csrf:${sessionId}:${hour}`, secret);
}

/** ตรวจ CSRF token — ยอมรับทั้งชั่วโมงปัจจุบันและก่อนหน้า 1 ชั่วโมง */
export async function verifyCsrfToken(
  token: string,
  sessionId: string,
  secret: string,
): Promise<boolean> {
  const hour = Math.floor(Date.now() / 3_600_000);
  for (const h of [hour, hour - 1]) {
    const expected = await hmacSha256(`csrf:${sessionId}:${h}`, secret);
    if (token === expected) return true;
  }
  return false;
}

// ===== Session management =====

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 ชั่วโมง
const COOKIE_NAME = 'admin_session';

/** สร้าง session ใหม่ใน D1 และ return token */
export async function createSession(
  userId: string,
  ip: string | null,
  userAgent: string | null,
  env: AuthEnv,
): Promise<string> {
  const sessionId = generateToken(32);
  const now = Date.now();
  const expiresAt = now + SESSION_DURATION_MS;

  await env.DB.prepare(
    `INSERT INTO sessions (id, user_id, created_at, expires_at, ip, user_agent)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(sessionId, userId, now, expiresAt, ip, userAgent)
    .run();

  return sessionId;
}

/** สร้าง Set-Cookie header value */
export function makeSessionCookie(sessionId: string, maxAgeSeconds = SESSION_DURATION_MS / 1000): string {
  return `${COOKIE_NAME}=${sessionId}; HttpOnly; Secure; SameSite=Strict; Path=/admin; Max-Age=${maxAgeSeconds}`;
}

/** ดึง session cookie จาก request */
export function getSessionId(req: Request): string | null {
  const cookie = req.headers.get('Cookie') ?? '';
  for (const part of cookie.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === COOKIE_NAME) return rest.join('=').trim();
  }
  return null;
}

/** ลบ session จาก D1 */
export async function deleteSession(sessionId: string, env: AuthEnv): Promise<void> {
  await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
}

/** ดึง User ปัจจุบันจาก session cookie — null ถ้าไม่ผ่าน */
export async function getCurrentUser(req: Request, env: AuthEnv): Promise<User | null> {
  const sessionId = getSessionId(req);
  if (!sessionId) return null;

  const now = Date.now();
  const row = await env.DB.prepare(
    `SELECT u.* FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at > ? AND u.is_active = 1`,
  )
    .bind(sessionId, now)
    .first<User>();

  return row ?? null;
}

/**
 * Middleware: require login
 * Return null ถ้าผ่าน, Response (redirect) ถ้าไม่ผ่าน
 */
export async function requireAuth(req: Request, env: AuthEnv): Promise<User | Response> {
  const user = await getCurrentUser(req, env);
  if (!user) {
    const loginUrl = '/admin/login?next=' + encodeURIComponent(new URL(req.url).pathname);
    return Response.redirect(new URL(loginUrl, req.url).toString(), 302);
  }
  return user;
}

/**
 * Middleware: require specific roles
 * Return null ถ้าผ่าน, Response (403 หรือ redirect) ถ้าไม่ผ่าน
 */
export async function requireRole(
  req: Request,
  env: AuthEnv,
  roles: UserRole[],
): Promise<User | Response> {
  const result = await requireAuth(req, env);
  if (result instanceof Response) return result;
  if (!roles.includes(result.role)) {
    return new Response('Forbidden', { status: 403 });
  }
  return result;
}

// ===== Rate limiting =====

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 นาที
const RATE_LIMIT_MAX = 5; // สูงสุด 5 ครั้ง

/**
 * ตรวจสอบ rate limit สำหรับ login
 * Return true = ยังทำได้, false = โดน block
 */
export async function checkLoginRateLimit(ip: string, env: AuthEnv): Promise<boolean> {
  const windowStart = Date.now() - RATE_LIMIT_WINDOW_MS;
  const result = await env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM login_attempts
     WHERE ip = ? AND attempted_at > ? AND success = 0`,
  )
    .bind(ip, windowStart)
    .first<{ cnt: number }>();

  return (result?.cnt ?? 0) < RATE_LIMIT_MAX;
}

/** บันทึก login attempt */
export async function recordLoginAttempt(
  ip: string,
  success: boolean,
  env: AuthEnv,
): Promise<void> {
  await env.DB.prepare(
    'INSERT INTO login_attempts (ip, attempted_at, success) VALUES (?, ?, ?)',
  )
    .bind(ip, Date.now(), success ? 1 : 0)
    .run();
}

/** ลบ login attempts เก่า (เรียกโดย scheduled handler) */
export async function cleanupLoginAttempts(env: AuthEnv): Promise<void> {
  const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS * 2;
  await env.DB.prepare('DELETE FROM login_attempts WHERE attempted_at < ?').bind(cutoff).run();
}

/** ลบ sessions หมดอายุ */
export async function cleanupExpiredSessions(env: AuthEnv): Promise<void> {
  await env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(Date.now()).run();
  await cleanupLoginAttempts(env);
}
