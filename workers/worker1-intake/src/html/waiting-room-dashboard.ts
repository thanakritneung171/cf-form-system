import type { User } from 'shared/types';
import { adminLayout } from './layout';
import { esc } from '../validators';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WrDbStats {
  /** submissions ใน 1 ชั่วโมงล่าสุด */
  lastHour: number;
  /** submissions ใน 24 ชั่วโมงล่าสุด */
  last24h: number;
  /** สรุปต่อ form_type (1 ชั่วโมงล่าสุด) */
  byFormType: Array<{ form_type: string; count: number }>;
  /** submission timeline — 12 ช่วง ๆ ละ 5 นาที (ย้อนหลัง 1 ชั่วโมง) */
  timeline: Array<{ slot: string; count: number }>;
}

export interface CfWrApiStatus {
  status: 'queueing' | 'not_queueing' | 'unknown';
  estimatedQueuedUsers: number;
  estimatedTotalActiveUsers: number;
  maxEstimatedTimeMinutes: number;
  fetchedAt: number;
}

// ─── HTML helpers ─────────────────────────────────────────────────────────────

function statCard(num: number | string, label: string, accent: string, sub?: string): string {
  return `
  <div class="stat-card" style="cursor:default">
    <div class="stat-accent" style="background:${accent}"></div>
    <div class="stat-num">${num}</div>
    <div class="stat-lbl">${esc(label)}</div>
    ${sub ? `<div style="font-size:12px;color:var(--text-muted);margin-top:4px">${esc(sub)}</div>` : ''}
  </div>`;
}

function statusBadgeCf(status: CfWrApiStatus['status']): string {
  if (status === 'queueing') {
    return `<span class="badge" style="background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;font-size:12px">
      <span style="width:7px;height:7px;border-radius:50%;background:#f97316;display:inline-block;margin-right:5px;animation:pulse 1.5s ease-in-out infinite"></span>
      Queueing</span>`;
  }
  if (status === 'not_queueing') {
    return `<span class="badge" style="background:#f0fdf4;color:#15803d;border:1px solid #86efac;font-size:12px">
      <span style="width:7px;height:7px;border-radius:50%;background:#22c55e;display:inline-block;margin-right:5px"></span>
      Active (ไม่ติดคิว)</span>`;
  }
  return `<span class="badge" style="background:#f8fafc;color:#64748b;border:1px solid #cbd5e1;font-size:12px">ไม่ทราบสถานะ</span>`;
}

function sparkBar(values: number[], labels: string[]): string {
  const max = Math.max(...values, 1);
  const bars = values.map((v, i) => {
    const pct = Math.round((v / max) * 100);
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex:1">
      <div style="font-size:10px;color:var(--text-muted);min-height:14px">${v > 0 ? v : ''}</div>
      <div title="${esc(labels[i])}: ${v}" style="width:100%;background:var(--amber);opacity:${0.35 + 0.65 * pct / 100};height:${Math.max(4, pct)}px;border-radius:2px 2px 0 0;transition:height .3s"></div>
      <div style="font-size:9px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%">${esc(labels[i])}</div>
    </div>`;
  }).join('');
  return `<div style="display:flex;align-items:flex-end;gap:4px;height:80px;padding-top:16px">${bars}</div>`;
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export function waitingRoomDashboardPage(
  user: User,
  db: WrDbStats,
  cf: CfWrApiStatus | null,
  flashMessage?: string,
): string {
  const now = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });

  // ── CF status panel ──────────────────────────────────────────────────────
  const cfPanel = cf
    ? `
    <div class="card" style="margin-bottom:1.5rem">
      <div class="card-header" style="display:flex;align-items:center;gap:0.75rem">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style="flex-shrink:0">
          <path d="M18.36 6.64A9 9 0 1 1 5.63 5.64" stroke="var(--orange)" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M12 2v10" stroke="var(--orange)" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <span style="font-weight:500">Cloudflare Waiting Room — Live Status</span>
        <span style="margin-left:auto;font-size:12px;color:var(--text-muted)">อัปเดต: ${esc(new Date(cf.fetchedAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }))}</span>
      </div>
      <div class="card-body">
        <div style="margin-bottom:1rem">${statusBadgeCf(cf.status)}</div>
        <div class="stat-grid" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr))">
          ${statCard(cf.estimatedTotalActiveUsers.toLocaleString(), 'Active Users', '#22c55e')}
          ${statCard(cf.estimatedQueuedUsers.toLocaleString(), 'Queued Users', cf.estimatedQueuedUsers > 0 ? '#f97316' : '#94a3b8')}
          ${statCard(cf.maxEstimatedTimeMinutes > 0 ? cf.maxEstimatedTimeMinutes + ' นาที' : '—', 'Est. Wait Time', '#3b82f6')}
          ${statCard(cf.status === 'queueing' ? 'Queueing' : 'Open', 'สถานะ', cf.status === 'queueing' ? '#f97316' : '#22c55e')}
        </div>
      </div>
    </div>`
    : `
    <div class="alert alert-danger" style="margin-bottom:1.5rem">
      <strong>CF API ไม่ได้ตั้งค่า</strong> — เพิ่ม <code>CF_API_TOKEN</code>, <code>CF_ZONE_ID</code> และ <code>CF_WAITING_ROOM_ID</code>
      ใน Worker environment เพื่อดู live status จาก Cloudflare API
    </div>`;

  // ── Submission stats ──────────────────────────────────────────────────────
  const timelineValues = db.timeline.map(t => t.count);
  const timelineLabels = db.timeline.map(t => t.slot);

  const formTypeRows = db.byFormType.length === 0
    ? `<tr><td colspan="2" style="color:var(--text-muted);text-align:center;padding:1rem">ไม่มีข้อมูลใน 1 ชั่วโมงล่าสุด</td></tr>`
    : db.byFormType.map(r => `
      <tr>
        <td><span class="badge" style="background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;font-size:11px">${esc(r.form_type)}</span></td>
        <td style="text-align:right;font-variant-numeric:tabular-nums;font-size:14px">${r.count.toLocaleString()}</td>
      </tr>`).join('');

  const content = `
  <style>
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    .card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 16px;
      overflow: hidden;
      box-shadow: var(--shadow-card);
    }
    .card-header {
      padding: 1rem 1.5rem;
      border-bottom: 1px solid var(--border);
      background: var(--ivory);
      font-size: 14px;
    }
    .card-body { padding: 1.5rem; }
    .alert-danger {
      background: #fef2f2;
      border: 1px solid #fca5a5;
      border-radius: 10px;
      padding: 0.875rem 1.25rem;
      color: #991b1b;
      font-size: 14px;
    }
    .section-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
    }
    @media (max-width: 900px) { .section-grid { grid-template-columns: 1fr; } }
  </style>

  <div class="page-header">
    <div>
      <div class="page-title">Waiting Room Dashboard</div>
      <div class="page-subtitle">Cloudflare Waiting Room + Submission Throughput — ${esc(now)}</div>
    </div>
    <form method="get" action="/admin/waiting-room" style="margin:0">
      <button type="submit" class="btn btn-outline btn-sm">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style="margin-right:4px">
          <path d="M4 4v5h5M20 20v-5h-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M4 9a8 8 0 0 1 13.6-3.4L20 9M4 15l2.4 3.4A8 8 0 0 0 20 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        รีเฟรช
      </button>
    </form>
  </div>

  ${cfPanel}

  <!-- Submission throughput KPI -->
  <div class="stat-grid" style="margin-bottom:1.5rem">
    ${statCard(db.lastHour.toLocaleString(), 'Submissions (1 ชม.)', '#ffa110')}
    ${statCard(db.last24h.toLocaleString(), 'Submissions (24 ชม.)', '#fa520f')}
    ${statCard(db.byFormType.length, 'Form Types ที่ active', '#3b82f6', 'ใน 1 ชั่วโมงล่าสุด')}
    ${statCard(
      db.lastHour > 0 ? (db.lastHour / 60).toFixed(1) + '/นาที' : '0',
      'Avg Throughput',
      '#8b5cf6',
      'เฉลี่ยใน 1 ชั่วโมง',
    )}
  </div>

  <div class="section-grid">
    <!-- Timeline chart -->
    <div class="card">
      <div class="card-header">Submissions per 5 นาที (1 ชม. ล่าสุด)</div>
      <div class="card-body" style="padding-bottom:1rem">
        ${sparkBar(timelineValues, timelineLabels)}
        <div style="font-size:11px;color:var(--text-muted);margin-top:8px;text-align:right">แกนเวลา → ปัจจุบัน</div>
      </div>
    </div>

    <!-- Per form type -->
    <div class="card">
      <div class="card-header">Submissions ต่อ Form Type (1 ชม. ล่าสุด)</div>
      <div class="card-body" style="padding:0">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="border-bottom:1px solid var(--border)">
              <th style="padding:0.75rem 1.5rem;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);font-weight:400">Form Type</th>
              <th style="padding:0.75rem 1.5rem;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);font-weight:400">Submissions</th>
            </tr>
          </thead>
          <tbody>
            ${formTypeRows}
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- CF WR Config note -->
  <div style="margin-top:1.5rem;padding:1rem 1.25rem;background:var(--cream);border:1px solid var(--amber-light);border-radius:10px;font-size:13px;color:var(--text-muted)">
    <strong style="color:var(--black)">ข้อมูลอ้างอิง CF Waiting Room</strong><br>
    หน้านี้แสดง Submission Throughput จาก D1 เป็น proxy สำหรับ traffic load
    — สถานะ Live (Active/Queued users) ต้องกำหนด <code>CF_API_TOKEN</code> + <code>CF_ZONE_ID</code> + <code>CF_WAITING_ROOM_ID</code> ใน Worker secrets
    &nbsp;·&nbsp; ดู Waiting Room ได้ที่ <a href="https://dash.cloudflare.com" target="_blank" rel="noopener">Cloudflare Dashboard → Traffic → Waiting Rooms</a>
  </div>`;

  return adminLayout('Waiting Room', content, user, 'waiting-room', flashMessage);
}
