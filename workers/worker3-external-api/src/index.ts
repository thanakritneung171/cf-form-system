/// <reference types="@cloudflare/workers-types" />

// ===== Worker 3: Mock External API =====
// จำลอง API ปลายทางที่รับข้อมูลจาก Worker 2
// - 90% ตอบ 200
// - 5% ตอบ 500 (ให้ retry ได้)
// - 5% ตอบ 400 (permanent fail)

export interface Env {
  // Worker 3 ไม่มี bindings พิเศษ
}

interface ReceivePayload {
  submission_id: string;
  form_type: string;
  submitted_at: number;
  data: Record<string, unknown>;
  files: Array<{
    field_name: string;
    original_filename: string;
    content_type: string;
    size_bytes: number;
    content_base64: string;
  }>;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

async function handleReceive(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  let payload: ReceivePayload;
  try {
    payload = await req.json() as ReceivePayload;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  // ตรวจ required fields
  if (!payload.submission_id || !payload.form_type) {
    return json({ error: 'Missing required fields: submission_id, form_type' }, 400);
  }

  // log ข้อมูลที่ได้รับ
  console.log(`[Worker3] Received submission: ${payload.submission_id}`, {
    form_type: payload.form_type,
    submitted_at: new Date(payload.submitted_at).toISOString(),
    data_keys: Object.keys(payload.data ?? {}),
    files_count: payload.files?.length ?? 0,
    files: payload.files?.map(f => ({ field: f.field_name, name: f.original_filename, size: f.size_bytes })),
  });

  // สุ่มผลลัพธ์: 90% success, 5% server error, 5% client error
  const rand = Math.random();

  if (rand < 0.90) {
    // 90% → 200 OK
    const externalId = crypto.randomUUID();
    console.log(`[Worker3] Accepted submission ${payload.submission_id} → external_id: ${externalId}`);
    return json({
      received: true,
      external_id: externalId,
      processed_at: new Date().toISOString(),
    });
  } else if (rand < 0.95) {
    // 5% → 500 Internal Server Error (retry-able)
    console.warn(`[Worker3] Simulated 500 for submission ${payload.submission_id}`);
    return json({
      error: 'Internal server error (simulated)',
      submission_id: payload.submission_id,
    }, 500);
  } else {
    // 5% → 400 Bad Request (permanent fail)
    console.error(`[Worker3] Simulated 400 for submission ${payload.submission_id}`);
    return json({
      error: 'Bad request (simulated)',
      submission_id: payload.submission_id,
    }, 400);
  }
}

async function handleHealth(): Promise<Response> {
  return json({
    ok: true,
    service: 'worker3-external-api',
    timestamp: new Date().toISOString(),
  });
}

export default {
  async fetch(req: Request, _env: Env): Promise<Response> {
    const url = new URL(req.url);

    // CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    if (url.pathname === '/api/receive') return handleReceive(req);
    if (url.pathname === '/health') return handleHealth();

    return json({ error: 'Not found' }, 404);
  },
} satisfies ExportedHandler<Env>;
