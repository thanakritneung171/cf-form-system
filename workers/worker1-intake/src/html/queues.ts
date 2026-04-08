import type { User } from 'shared/types';
import { FORM_TYPES, FORMS_CONFIG } from 'shared/forms-config';
import { esc } from '../validators';
import { adminLayout } from './layout';

interface QueueRow {
  form_type: string;
  pending: number;
  dispatching: number;
  complete_24h: number;
  failed_24h: number;
  avg_duration_s: number | null;
}

export function queueStatusPage(rows: QueueRow[], user: User, flash?: string): string {
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

    return `<tr style="${hasProblem ? 'background:rgba(220,38,38,.03)' : ''}">
      <td><strong style="font-size:0.85rem">${esc(r.form_type)}</strong></td>
      <td style="text-align:center">
        ${r.pending > 0
          ? `<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:4px;font-size:0.82rem;font-weight:600">${r.pending}</span>`
          : `<span style="color:var(--text-light)">${r.pending}</span>`}
      </td>
      <td style="text-align:center">
        ${r.dispatching > 0
          ? `<span style="background:#dbeafe;color:#1e40af;padding:2px 8px;border-radius:4px;font-size:0.82rem;font-weight:600">${r.dispatching}</span>`
          : `<span style="color:var(--text-light)">${r.dispatching}</span>`}
      </td>
      <td style="text-align:center;color:#16a34a;font-weight:600">${r.complete_24h}</td>
      <td style="text-align:center;${r.failed_24h > 0 ? 'color:#dc2626;font-weight:600' : 'color:var(--text-light)'}">${r.failed_24h}</td>
      <td style="text-align:center">
        ${successRate !== null
          ? `<span style="font-weight:600;color:${successRate >= 90 ? '#16a34a' : successRate >= 70 ? '#d97706' : '#dc2626'}">${successRate}%</span>`
          : '<span style="color:var(--text-light)">—</span>'}
      </td>
      <td style="text-align:center;color:var(--text-muted)">${r.avg_duration_s !== null ? r.avg_duration_s + 's' : '—'}</td>
      <td>
        <div style="display:flex;gap:0.35rem">
          <a href="/admin/submissions?form_type=${esc(r.form_type)}&status=pending" class="btn btn-outline btn-xs">Pending</a>
          ${r.failed_24h > 0 ? `<a href="/admin/dispatched?form_type=${esc(r.form_type)}&status=failed" class="btn btn-xs" style="background:#dc2626;color:#fff;border-color:#dc2626">Failed</a>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('\n');

  const overallRate = (totComplete + totFailed) > 0
    ? Math.round((totComplete / (totComplete + totFailed)) * 100)
    : null;

  const content = `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.25rem">
    <div class="page-title">Queue Status</div>
    <span style="font-size:0.78rem;color:var(--text-muted)">สถิติ 24h ล่าสุด · รีเฟรชทุก 30 วินาที</span>
  </div>
  <meta http-equiv="refresh" content="30">

  <div class="stat-grid">
    <div class="stat-card">
      <div class="stat-num" style="color:#d97706">${totPending}</div>
      <div class="stat-lbl">รอดำเนินการ</div>
    </div>
    <div class="stat-card">
      <div class="stat-num" style="color:#2563eb">${totDispatching}</div>
      <div class="stat-lbl">กำลังส่ง</div>
    </div>
    <div class="stat-card">
      <div class="stat-num" style="color:#16a34a">${totComplete}</div>
      <div class="stat-lbl">สำเร็จ (24h)</div>
    </div>
    <div class="stat-card">
      <div class="stat-num" style="color:#dc2626">${totFailed}</div>
      <div class="stat-lbl">ล้มเหลว (24h)</div>
    </div>
    ${overallRate !== null ? `<div class="stat-card">
      <div class="stat-num" style="color:${overallRate >= 90 ? '#16a34a' : overallRate >= 70 ? '#d97706' : '#dc2626'}">${overallRate}%</div>
      <div class="stat-lbl">Overall Success Rate</div>
    </div>` : ''}
  </div>

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
          <th style="text-align:center">Complete (24h)</th>
          <th style="text-align:center">Failed (24h)</th>
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
