import type { Submission, User } from 'shared/types';
import { FORM_TYPES } from 'shared/forms-config';
import { esc } from '../validators';
import { adminLayout, statusBadge, formatDate, shortId, paginationHtml, refreshBarHtml, formTypeBadge } from './layout';

function sortLink(label: string, col: string, filters: Record<string, string>): string {
  const active = (filters.sort ?? 'dispatched_at') === col;
  const nextDir = active && filters.dir !== 'asc' ? 'asc' : 'desc';
  const arrow = active ? (filters.dir === 'asc' ? ' ▲' : ' ▼') : '';
  const p = new URLSearchParams({ ...filters, sort: col, dir: nextDir, page: '1' });
  return `<a href="?${p}" style="color:inherit;text-decoration:none;white-space:nowrap">${label}${arrow}</a>`;
}

export function dispatchedPage(
  submissions: Submission[],
  total: number,
  page: number,
  perPage: number,
  stats: { complete: number; failed: number; successRate: number; avgDuration: number },
  filters: Record<string, string>,
  user: User,
  flash?: string,
): string {
  const canRetry = user.role === 'admin' || user.role === 'operator';
  const totalPages = Math.ceil(total / perPage);

  const rows = submissions.map(s => {
    const data = JSON.parse(s.data);
    const duration = s.dispatched_at && s.completed_at
      ? ((s.completed_at - s.dispatched_at) / 1000).toFixed(1) + 's'
      : '—';
    return `<tr style="cursor:pointer" onclick="showError('${esc(s.id)}','${esc(s.last_error ?? '')}')">
      <td style="font-size:0.78rem;color:var(--text-muted);white-space:nowrap">${esc(formatDate(s.dispatched_at))}</td>
      <td style="font-size:0.78rem;color:var(--text-muted);white-space:nowrap">${esc(formatDate(s.completed_at))}</td>
      <td><code title="${esc(s.id)}">${esc(shortId(s.id))}</code></td>
      <td>${formTypeBadge(s.form_type)}</td>
      <td>${esc(data.fullName ?? '—')}</td>
      <td>${statusBadge(s.status)}</td>
      <td style="text-align:center;color:var(--text-muted)">${s.retry_count}</td>
      <td style="max-width:180px">${s.last_error
        ? `<div class="err-wrap">
            <span class="err-preview-inline">${esc(s.last_error)}</span>
            <div class="err-popup"><pre>${esc(s.last_error)}</pre></div>
          </div>`
        : '—'
      }</td>
      <td style="color:var(--text-muted);font-size:0.82rem">${duration}</td>
      <td onclick="event.stopPropagation()">
        <div style="display:flex;gap:0.35rem">
          <a href="/admin/submissions/${esc(s.id)}" class="btn btn-outline btn-xs">ดู</a>
          ${canRetry && (s.status === 'failed' || s.status === 'complete') ? `<form method="POST" action="/admin/bulk-retry" style="margin:0" onsubmit="return confirm('Retry?')">
            <input type="hidden" name="ids" value="${esc(s.id)}">
            <button type="submit" class="btn btn-primary btn-xs">Retry</button>
          </form>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('\n');

  const content = `
  <div class="page-header">
    <div>
      <div class="page-title">Dispatched</div>
      <div class="page-subtitle">ประวัติการส่งข้อมูล · ${total.toLocaleString()} รายการ</div>
    </div>
  </div>

  <div class="stat-grid">
    <a href="/admin/dispatched?status=complete" class="stat-card" style="text-decoration:none">
      <div class="stat-accent" style="background:#c8a86b"></div>
      <div class="stat-num" style="color:#3d2800">${stats.complete}</div>
      <div class="stat-lbl">สำเร็จ</div>
    </a>
    <a href="/admin/dispatched?status=failed" class="stat-card" style="text-decoration:none">
      <div class="stat-accent" style="background:#fa520f"></div>
      <div class="stat-num" style="color:#fa520f">${stats.failed}</div>
      <div class="stat-lbl">ล้มเหลว</div>
    </a>
    <div class="stat-card">
      <div class="stat-accent" style="background:#ffa110"></div>
      <div class="stat-num" style="color:#7a4a00">${stats.successRate}%</div>
      <div class="stat-lbl">Success Rate</div>
    </div>
    <div class="stat-card">
      <div class="stat-accent" style="background:#ff8a00"></div>
      <div class="stat-num" style="color:#3d2800">${stats.avgDuration}s</div>
      <div class="stat-lbl">Avg Dispatch Time</div>
    </div>
  </div>

  <div class="filter-bar">
    <form method="GET" action="/admin/dispatched" style="display:contents">
      <select name="form_type" onchange="this.form.submit()" style="width:auto">
        <option value="">ทุกประเภท</option>
        ${FORM_TYPES.map(t => `<option value="${t}" ${filters.form_type === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}
      </select>
      <select name="status" onchange="this.form.submit()" style="width:auto">
        <option value="">ทุกสถานะ</option>
        <option value="complete" ${filters.status === 'complete' ? 'selected' : ''}>สำเร็จ</option>
        <option value="failed" ${filters.status === 'failed' ? 'selected' : ''}>ล้มเหลว</option>
      </select>
      <input type="date" name="from" value="${esc(filters.from ?? '')}" style="width:auto">
      <input type="date" name="to" value="${esc(filters.to ?? '')}" style="width:auto">
      <button type="submit" class="btn btn-primary btn-sm">ค้นหา</button>
      <a href="/admin/dispatched" class="btn btn-outline btn-sm">รีเซ็ต</a>
      ${canRetry ? `<a href="/admin/export/dispatched.csv?${new URLSearchParams(filters)}" class="btn btn-outline btn-sm" onclick="return confirm('ยืนยันการ Export CSV?\\nข้อมูลที่กรองอยู่จะถูกดาวน์โหลด')">⬇️ Export CSV</a>` : ''}
    </form>
  </div>

  <p style="font-size:0.78rem;color:var(--text-muted);margin-bottom:0.75rem">คลิกแถวเพื่อดู error details</p>

  ${refreshBarHtml()}
  <div class="table-wrap">
    <table>
      <thead><tr>
        <th>${sortLink('Dispatched', 'dispatched_at', filters)}</th>
        <th>${sortLink('Completed', 'completed_at', filters)}</th>
        <th>ID</th>
        <th>${sortLink('ประเภท', 'form_type', filters)}</th>
        <th>ชื่อ</th>
        <th>${sortLink('สถานะ', 'status', filters)}</th>
        <th style="text-align:center">${sortLink('Retry', 'retry_count', filters)}</th>
        <th>Error</th><th>Duration</th><th>Actions</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>

  ${paginationHtml(page, totalPages, total, p => '?' + new URLSearchParams({ ...filters, page: String(p) }))}

  <dialog id="errorDialog" style="border:1px solid var(--border);border-radius:16px;padding:0;max-width:600px;width:90%">
    <div style="background:#1c1917;padding:1rem 1.25rem;border-radius:16px 16px 0 0;display:flex;justify-content:space-between;align-items:center">
      <span style="font-weight:600;color:#fbbf24">รายละเอียด Error</span>
      <button onclick="document.getElementById('errorDialog').close()" style="background:transparent;border:none;color:#a07840;cursor:pointer;font-size:1.1rem">✕</button>
    </div>
    <div style="padding:1.25rem">
      <pre id="errorText" style="margin:0;white-space:pre-wrap;word-break:break-word"></pre>
    </div>
  </dialog>
  <script>
    function showError(id, err) {
      if(err) {
        document.getElementById('errorText').textContent = err;
        document.getElementById('errorDialog').showModal();
      }
    }
  </script>`;

  return adminLayout('Dispatched', content, user, 'dispatched', flash);
}
