/// <reference types="@cloudflare/workers-types" />

// ── Result types exported for use in index.ts ─────────────────────────────

export type AcquireResult =
  | { ok: true;  tokenId: string; reused: boolean; expiresAt: number }
  | { ok: false; position: number; retryAfter: number; activeCount: number; limit: number };

// ── Internal token shape stored in DO storage ──────────────────────────────

interface TokenData {
  fingerprint: string;
  expiresAt: number;
  formType: string;
  createdAt: number;
  submitCount: number;
  maxSubmits: number;
}

// ── Minimal Env type (avoids circular import with index.ts) ────────────────

interface DoEnv {
  WAITING_ROOM_DEFAULT_LIMIT?: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// WaitingRoom Durable Object
//
// 1 instance ต่อ form type (หรือต่อ shard ถ้าใช้ sharding)
// ชื่อ DO: room-{formType} หรือ room-{formType}-shard-{N}
//
// Storage keys:
//   count              → activeCount (number)
//   limit              → per-shard limit (number)
//   token:{uuid}       → TokenData
//   fp:{fingerprint}   → tokenId (string)
// ══════════════════════════════════════════════════════════════════════════════

export class WaitingRoom {
  private activeCount: number = 0;
  private limit: number;
  private readonly state: DurableObjectState;

  constructor(state: DurableObjectState, env: DoEnv) {
    this.state = state;
    this.limit = parseInt(env.WAITING_ROOM_DEFAULT_LIMIT ?? '10000', 10);

    // โหลด count + limit จาก storage ก่อน handle request ใดๆ
    state.blockConcurrencyWhile(async () => {
      const stored = await state.storage.get<number>('count');
      if (stored !== undefined) this.activeCount = stored;
      const storedLimit = await state.storage.get<number>('limit');
      if (storedLimit !== undefined) this.limit = storedLimit;
    });
  }

  // ── HTTP router ────────────────────────────────────────────────────────────

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    // pathname: /acquire → action: acquire
    const action = url.pathname.replace(/^\//, '');

    switch (action) {
      case 'acquire': {
        const body = await req.json() as {
          fingerprint: string;
          formType: string;
          limit?: number;
          tokenTtlMs?: number;
          maxSubmits?: number;
        };
        // อัปเดต per-shard limit ถ้า caller ส่งมา
        if (body.limit !== undefined && body.limit !== this.limit) {
          this.limit = body.limit;
          await this.state.storage.put('limit', this.limit);
        }
        const ttl = body.tokenTtlMs ?? 10 * 60 * 1000;
        const maxSubmits = body.maxSubmits ?? 5;
        return Response.json(await this.acquire(body.fingerprint, body.formType, ttl, maxSubmits));
      }

      case 'release': {
        const body = await req.json() as { tokenId: string };
        await this.release(body.tokenId);
        return Response.json({ ok: true });
      }

      case 'verify': {
        const body = await req.json() as { tokenId: string };
        return Response.json(await this.verify(body.tokenId));
      }

      case 'use-submit': {
        const body = await req.json() as { tokenId: string };
        return Response.json(await this.useSubmit(body.tokenId));
      }

      case 'heartbeat': {
        const body = await req.json() as { tokenId: string; tokenTtlMs?: number };
        await this.heartbeat(body.tokenId, body.tokenTtlMs ?? 10 * 60 * 1000);
        return Response.json({ ok: true });
      }

      case 'status': {
        return Response.json(await this.status());
      }

      case 'reset': {
        await this.forceReset();
        return Response.json({ ok: true });
      }

      default:
        return new Response('Not found', { status: 404 });
    }
  }

  // ── acquire ────────────────────────────────────────────────────────────────
  //
  // ขอ slot:
  //   - ถ้า fingerprint นี้มี token อยู่แล้วและยังไม่หมดอายุ → return token เดิม (reused)
  //   - ถ้าเต็ม → return { ok: false, position }
  //   - ถ้าว่าง → สร้าง token ใหม่, +1 count, ตั้ง alarm

  private async acquire(
    fingerprint: string,
    formType: string,
    tokenTtlMs: number,
    maxSubmits: number,
  ): Promise<AcquireResult> {
    // ตรวจ fingerprint → token ที่มีอยู่
    const existingTokenId = await this.state.storage.get<string>(`fp:${fingerprint}`);
    if (existingTokenId) {
      const token = await this.state.storage.get<TokenData>(`token:${existingTokenId}`);
      if (token && token.expiresAt > Date.now()) {
        return { ok: true, tokenId: existingTokenId, reused: true, expiresAt: token.expiresAt };
      }
      // fingerprint index เก่าหมดอายุ → ล้างทิ้ง (alarm จะลด count เอง)
      await this.state.storage.delete(`fp:${fingerprint}`);
    }

    // เต็ม?
    if (this.activeCount >= this.limit) {
      return {
        ok: false,
        position: this.activeCount - this.limit + 1,
        retryAfter: 3,
        activeCount: this.activeCount,
        limit: this.limit,
      };
    }

    // ออก token ใหม่
    this.activeCount++;
    await this.state.storage.put('count', this.activeCount);

    const tokenId = crypto.randomUUID();
    const tokenData: TokenData = {
      fingerprint,
      expiresAt: Date.now() + tokenTtlMs,
      formType,
      createdAt: Date.now(),
      submitCount: 0,
      maxSubmits,
    };

    await this.state.storage.put(`token:${tokenId}`, tokenData);
    await this.state.storage.put(`fp:${fingerprint}`, tokenId);

    // ตั้ง alarm ถ้ายังไม่มี
    const currentAlarm = await this.state.storage.getAlarm();
    if (currentAlarm === null) {
      await this.state.storage.setAlarm(Date.now() + 60_000);
    }

    return { ok: true, tokenId, reused: false, expiresAt: tokenData.expiresAt };
  }

  // ── release ────────────────────────────────────────────────────────────────
  // คืน slot ทันที (ใช้ตอน sendBeacon ปิด tab)

  private async release(tokenId: string): Promise<void> {
    const token = await this.state.storage.get<TokenData>(`token:${tokenId}`);
    if (!token) return;

    await this.state.storage.delete([`token:${tokenId}`, `fp:${token.fingerprint}`]);
    this.activeCount = Math.max(0, this.activeCount - 1);
    await this.state.storage.put('count', this.activeCount);
  }

  // ── verify ─────────────────────────────────────────────────────────────────
  // ตรวจว่า token ยังใช้ได้อยู่

  private async verify(tokenId: string): Promise<{
    valid: boolean;
    submitCount?: number;
    maxSubmits?: number;
    remaining?: number;
  }> {
    const token = await this.state.storage.get<TokenData>(`token:${tokenId}`);
    if (!token || token.expiresAt <= Date.now()) return { valid: false };
    return {
      valid: true,
      submitCount: token.submitCount,
      maxSubmits: token.maxSubmits,
      remaining: token.maxSubmits - token.submitCount,
    };
  }

  // ── useSubmit ──────────────────────────────────────────────────────────────
  // นับ submit +1 (เรียกตอน submit สำเร็จ)

  private async useSubmit(tokenId: string): Promise<{ ok: boolean; remaining?: number; error?: string }> {
    const token = await this.state.storage.get<TokenData>(`token:${tokenId}`);
    if (!token || token.expiresAt <= Date.now()) {
      return { ok: false, error: 'token หมดอายุหรือไม่ถูกต้อง' };
    }
    if (token.submitCount >= token.maxSubmits) {
      return { ok: false, error: 'ส่งครบจำนวนแล้ว' };
    }
    token.submitCount++;
    await this.state.storage.put(`token:${tokenId}`, token);
    return { ok: true, remaining: token.maxSubmits - token.submitCount };
  }

  // ── heartbeat ──────────────────────────────────────────────────────────────
  // ต่ออายุ token (เรียกทุก 2 นาทีถ้า user ยังกรอกอยู่)

  private async heartbeat(tokenId: string, tokenTtlMs: number): Promise<void> {
    const token = await this.state.storage.get<TokenData>(`token:${tokenId}`);
    if (!token) return;
    token.expiresAt = Date.now() + tokenTtlMs;
    await this.state.storage.put(`token:${tokenId}`, token);
  }

  // ── status ─────────────────────────────────────────────────────────────────

  private async status(): Promise<{ activeCount: number; limit: number; available: number }> {
    return {
      activeCount: this.activeCount,
      limit: this.limit,
      available: Math.max(0, this.limit - this.activeCount),
    };
  }

  // ── forceReset ─────────────────────────────────────────────────────────────
  // ล้าง tokens ทั้งหมด (admin action)

  private async forceReset(): Promise<void> {
    const allEntries = await this.state.storage.list<unknown>();
    const toDelete: string[] = [];
    for (const [key] of allEntries) {
      if (key.startsWith('token:') || key.startsWith('fp:')) {
        toDelete.push(key);
      }
    }
    if (toDelete.length > 0) {
      await this.state.storage.delete(toDelete);
    }
    this.activeCount = 0;
    await this.state.storage.put('count', 0);
  }

  // ── alarm ──────────────────────────────────────────────────────────────────
  // ทำงานทุก 60 วิ: กวาด token หมดอายุ, ลด activeCount

  async alarm(): Promise<void> {
    const now = Date.now();
    const allEntries = await this.state.storage.list<unknown>();

    let expiredCount = 0;
    const toDelete: string[] = [];

    for (const [key, value] of allEntries) {
      if (!key.startsWith('token:')) continue;
      const token = value as TokenData;
      if (
        typeof token === 'object' &&
        token !== null &&
        'expiresAt' in token &&
        token.expiresAt <= now
      ) {
        toDelete.push(key);
        toDelete.push(`fp:${token.fingerprint}`);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      await this.state.storage.delete(toDelete);
      this.activeCount = Math.max(0, this.activeCount - expiredCount);
      await this.state.storage.put('count', this.activeCount);
    }

    // ตั้ง alarm ครั้งต่อไปถ้ายังมี active token อยู่
    let hasMoreTokens = false;
    for (const [key] of allEntries) {
      if (key.startsWith('token:') && !toDelete.includes(key)) {
        hasMoreTokens = true;
        break;
      }
    }
    if (hasMoreTokens) {
      await this.state.storage.setAlarm(Date.now() + 60_000);
    }
  }
}
