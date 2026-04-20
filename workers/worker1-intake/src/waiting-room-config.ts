export interface WaitingRoomConfig {
  enabled: boolean;
  limit: number;           // จำนวนคนพร้อมกันสูงสุด (รวมทุก shard)
  tokenTtlMinutes: number; // อายุ token (นาที)
  maxSubmitsPerToken: number; // submit ได้กี่ครั้งต่อ token
  shards: number;          // จำนวน DO shards (default 1, เพิ่มเมื่อ >1000 req/s)
}

export const WAITING_ROOM_CONFIGS: Record<string, WaitingRoomConfig> = {
  // ── ฟอร์มยอดนิยม / burst สูง ─────────────────────────────────────────────
  'event-registration': { enabled: true,  limit: 10000,  tokenTtlMinutes: 1,  maxSubmitsPerToken: 20, shards: 1 },
  'newsletter':         { enabled: true,  limit: 10000, tokenTtlMinutes: 5,  maxSubmitsPerToken: 20, shards: 1 },

  // ── ฟอร์มมีไฟล์แนบ → กรอกนาน → ลด limit ────────────────────────────────
  'job-application':    { enabled: true,  limit: 10000,  tokenTtlMinutes: 5, maxSubmitsPerToken: 20, shards: 1 },
  'incident-report':    { enabled: true,  limit: 10000,  tokenTtlMinutes: 5, maxSubmitsPerToken: 20, shards: 1 },

  // ── ฟอร์มทั่วไป (disabled — เข้าฟอร์มตรง ไม่ผ่าน waiting room) ──────────
  'contact':            { enabled: true, limit: 3, tokenTtlMinutes: 1, maxSubmitsPerToken: 20, shards: 1 },
  'complaint':          { enabled: true, limit: 10000, tokenTtlMinutes: 1, maxSubmitsPerToken: 20, shards: 1 },
  'product-inquiry':    { enabled: true, limit: 10000, tokenTtlMinutes: 1, maxSubmitsPerToken: 20, shards: 1 },
  'warranty-claim':     { enabled: true, limit: 10000, tokenTtlMinutes: 1, maxSubmitsPerToken: 20, shards: 1 },
  'feedback':           { enabled: true, limit: 10000, tokenTtlMinutes: 1, maxSubmitsPerToken: 20, shards: 1 },
  'partnership':        { enabled: true, limit: 10000, tokenTtlMinutes: 1, maxSubmitsPerToken: 20, shards: 1 },

  // ── default สำหรับ form type ที่ไม่ได้กำหนด ──────────────────────────────
  'default':            { enabled: false, limit: 10000, tokenTtlMinutes: 5, maxSubmitsPerToken: 20, shards: 1 },
};

export function getWaitingRoomConfig(formType: string): WaitingRoomConfig {
  return WAITING_ROOM_CONFIGS[formType] ?? WAITING_ROOM_CONFIGS['default'];
}
