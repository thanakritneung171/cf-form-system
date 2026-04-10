import type { User } from 'shared/types';
import { FORM_TYPES, FORMS_CONFIG } from 'shared/forms-config';
import { esc } from '../validators';
import { adminLayout, refreshBarHtml, queueCountBadge } from './layout';

interface QueueRow {
  form_type: string;
  pending: number;
  dispatching: number;
  complete_24h: number;
  failed_24h: number;
  avg_duration_s: number | null;
}

export function queueStatusPage(
  rows: QueueRow[],
  filters: { from: string; to: string },
  user: User,
  flash?: string,
): string {
  const allTypes = new Set(FORM_TYPES as string[]);
  const existing = new Set(rows.map(r => r.form_type));
  const missing: QueueRow[] = [...allTypes]
    .filter(t => !existing.has(t))
    .map(t => ({ form_type: t, pending: 0, dispatching: 0, complete_24h: 0, failed_24h: 0, avg_duration_s: null }));

  const allRows = [...rows, ...missing].sort((a, b) => a.form_type.localeCompare(b.form_type));

  const totPending     = allRows.reduce((s, r) => s + r.pending, 0);
  const totDispatching = allRows.reduce((s, r) => s + r.dispatching, 0);
  const totComplete    = allRows.reduce((s, r) => s + r.complete_24h, 0);
  const totFailed      = allRows.reduce((s, r) => s + r.failed_24h, 0);

  const tableRows = allRows.map(r => {
    const successRate = (r.complete_24h + r.failed_24h) > 0
      ? Math.round((r.complete_24h / (r.complete_24h + r.failed_24h)) * 100)
      : null;
    const hasProblem = r.failed_24h > 0 || r.pending > 500;

    return `<tr style="${hasProblem ? 'background:#fff8e6' : ''}">
      <td style="font-size:14px">${esc(r.form_type)}</td>
      <td style="text-align:center">${queueCountBadge(r.pending, 'pending')}</td>
      <td style="text-align:center">${queueCountBadge(r.dispatching, 'dispatching')}</td>
      <td style="text-align:center;color:#15803d;font-size:14px">${r.complete_24h}</td>
      <td style="text-align:center;font-size:14px">${r.failed_24h > 0
        ? `<span style="color:#b91c1c;font-weight:600">${r.failed_24h}</span>`
        : `<span style="color:#94a3b8">${r.failed_24h}</span>`}</td>
      <td style="text-align:center">
        ${successRate !== null
          ? `<span style="color:${successRate >= 90 ? '#15803d' : successRate >= 70 ? '#b45309' : '#b91c1c'};font-size:14px;font-weight:600">${successRate}%</span>`
          : '<span style="color:#94a3b8">—</span>'}
      </td>
      <td style="text-align:center;color:var(--text-muted);font-size:13px">${r.avg_duration_s !== null ? r.avg_duration_s + 's' : '—'}</td>
      <td>
        <div style="display:flex;gap:0.35rem">
          <a href="/admin/submissions?form_type=${esc(r.form_type)}&status=pending" class="btn btn-outline btn-xs">Pending</a>
          ${r.failed_24h > 0 ? `<a href="/admin/dispatched?form_type=${esc(r.form_type)}&status=failed" class="btn btn-danger btn-xs">Failed</a>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('\n');

  const overallRate = (totComplete + totFailed) > 0
    ? Math.round((totComplete / (totComplete + totFailed)) * 100)
    : null;

  const rangeLabel = (filters.from || filters.to)
    ? `${filters.from ? filters.from.replace('T', ' ') : '…'} — ${filters.to ? filters.to.replace('T', ' ') : '…'}`
    : '24h ล่าสุด';
  const isCustom = !!(filters.from || filters.to);

  const content = `
  <div class="page-header">
    <div>
      <div class="page-title">Queue Status</div>
      <div class="page-subtitle">${esc(rangeLabel)}${isCustom ? '' : ' · รีเฟรชทุก 30 วินาที'}</div>
    </div>
  </div>
  <div class="filter-bar">
    <form method="GET" action="/admin/queues" style="display:contents">
      <label style="font-size:12px;color:var(--text-muted);white-space:nowrap;text-transform:uppercase;letter-spacing:.04em">ตั้งแต่</label>
      <input type="datetime-local" name="from" value="${esc(filters.from)}" style="width:auto">
      <label style="font-size:12px;color:var(--text-muted);white-space:nowrap;text-transform:uppercase;letter-spacing:.04em">ถึง</label>
      <input type="datetime-local" name="to" value="${esc(filters.to)}" style="width:auto">
      <button type="submit" class="btn btn-primary btn-sm">ดู</button>
      <a href="/admin/queues" class="btn btn-outline btn-sm">รีเซ็ต (24h)</a>
    </form>
  </div>

  <div class="stat-grid">
    <div class="stat-card" style="background:#eff6ff;border-color:#93c5fd">
      <div class="stat-accent" style="background:#3b82f6"></div>
      <div class="stat-num" style="color:#1d4ed8">${totPending}</div>
      <div class="stat-lbl" style="color:#2563eb">รอดำเนินการ</div>
    </div>
    <div class="stat-card" style="background:#fffbeb;border-color:#fbbf24">
      <div class="stat-accent" style="background:#f59e0b"></div>
      <div class="stat-num" style="color:#b45309">${totDispatching}</div>
      <div class="stat-lbl" style="color:#92400e">กำลังส่ง</div>
    </div>
    <div class="stat-card" style="background:#f0fdf4;border-color:#86efac">
      <div class="stat-accent" style="background:#22c55e"></div>
      <div class="stat-num" style="color:#15803d">${totComplete}</div>
      <div class="stat-lbl" style="color:#166534">สำเร็จ</div>
    </div>
    <div class="stat-card" style="background:#fff1f2;border-color:#fda4af">
      <div class="stat-accent" style="background:#ef4444"></div>
      <div class="stat-num" style="color:#be123c">${totFailed}</div>
      <div class="stat-lbl" style="color:#9f1239">ล้มเหลว</div>
    </div>
    ${overallRate !== null ? `<div class="stat-card" style="background:${overallRate >= 90 ? '#eff6ff' : '#fff1f2'};border-color:${overallRate >= 90 ? '#93c5fd' : '#fda4af'}">
      <div class="stat-accent" style="background:${overallRate >= 90 ? '#3b82f6' : '#ef4444'}"></div>
      <div class="stat-num" style="color:${overallRate >= 90 ? '#1d4ed8' : '#be123c'}">${overallRate}%</div>
      <div class="stat-lbl" style="color:${overallRate >= 90 ? '#2563eb' : '#9f1239'}">Overall Success Rate</div>
    </div>` : ''}
  </div>

  ${refreshBarHtml()}
  <p style="font-size:0.78rem;color:var(--text-muted);margin-bottom:0.875rem">
    แต่ละ form type มี queue แยกอิสระ — backlog ของฟอร์มหนึ่งจะไม่กระทบฟอร์มอื่น
  </p>

  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Form Type</th>
          <th style="text-align:center">Pending</th>
          <th style="text-align:center">Dispatching</th>
          <th style="text-align:center">Complete (${esc(rangeLabel)})</th>
          <th style="text-align:center">Failed (${esc(rangeLabel)})</th>
          <th style="text-align:center">Success Rate</th>
          <th style="text-align:center">Avg Duration</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
      <tfoot>
        <tr>
          <td>รวมทั้งหมด</td>
          <td style="text-align:center">${totPending}</td>
          <td style="text-align:center">${totDispatching}</td>
          <td style="text-align:center">${totComplete}</td>
          <td style="text-align:center">${totFailed}</td>
          <td style="text-align:center">${overallRate !== null ? overallRate + '%' : '—'}</td>
          <td></td>
          <td></td>
        </tr>
      </tfoot>
    </table>
  </div>

  <details style="margin-top:1.5rem">
    <summary style="cursor:pointer;font-size:0.85rem;color:var(--text-muted);user-select:none">
      ⚙️ Queue config (batch size / concurrency per form type)
    </summary>
    <div class="table-wrap" style="margin-top:0.75rem">
      <table style="font-size:0.8rem">
        <thead><tr>
          <th>Form Type</th>
          <th style="text-align:center">Intake Batch</th>
          <th style="text-align:center">Intake Concurrency</th>
          <th style="text-align:center">Dispatch Batch</th>
          <th style="text-align:center">Dispatch Concurrency</th>
        </tr></thead>
        <tbody>
          ${FORM_TYPES.map(t => {
            const q = FORMS_CONFIG[t].queue;
            return `<tr>
              <td>${esc(t)}</td>
              <td style="text-align:center">${q.intakeConfig.maxBatchSize}</td>
              <td style="text-align:center">${q.intakeConfig.maxConcurrency}</td>
              <td style="text-align:center">${q.dispatchConfig.maxBatchSize}</td>
              <td style="text-align:center">${q.dispatchConfig.maxConcurrency}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </details>`;

  return adminLayout('Queue Status', content, user, 'queues', flash);
}
