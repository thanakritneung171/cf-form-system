import type { Submission, User } from 'shared/types';
import { FORM_TYPES } from 'shared/forms-config';
import { esc } from '../validators';
import { adminLayout, statusBadge, formatDate, shortId } from './layout';

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
      <td><span style="font-size:0.78rem;background:#f0ece6;padding:2px 7px;border-radius:4px">${esc(s.form_type)}</span></td>
      <td>${esc(data.fullName ?? '—')}</td>
      <td>${statusBadge(s.status)}</td>
      <td style="text-align:center;color:var(--text-muted)">${s.retry_count}</td>
      <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#dc2626;font-size:0.78rem">${esc(s.last_error ?? '')}</td>
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
  <div class="stat-grid">
    <div class="stat-card">
      <div class="stat-num" style="color:#16a34a">${stats.complete}</div>
      <div class="stat-lbl">สำเร็จ</div>
    </div>
    <div class="stat-card">
      <div class="stat-num" style="color:#dc2626">${stats.failed}</div>
      <div class="stat-lbl">ล้มเหลว</div>
    </div>
    <div class="stat-card">
      <div class="stat-num" style="color:#2563eb">${stats.successRate}%</div>
      <div class="stat-lbl">Success Rate</div>
    </div>
    <div class="stat-card">
      <div class="stat-num">${stats.avgDuration}s</div>
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
      ${canRetry ? `<a href="/admin/export/dispatched.csv?${new URLSearchParams(filters)}" class="btn btn-outline btn-sm">⬇️ Export CSV</a>` : ''}
    </form>
  </div>

  <p style="font-size:0.78rem;color:var(--text-muted);margin-bottom:0.75rem">คลิกแถวเพื่อดู error details</p>

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

  <div class="pagination">
    ${page > 1 ? `<a href="?${new URLSearchParams({ ...filters, page: String(page - 1) })}" class="btn btn-outline btn-sm">← ก่อนหน้า</a>` : ''}
    <span>หน้า ${page}/${totalPages} (${total} รายการ)</span>
    ${page < totalPages ? `<a href="?${new URLSearchParams({ ...filters, page: String(page + 1) })}" class="btn btn-outline btn-sm">ถัดไป →</a>` : ''}
  </div>

  <dialog id="errorDialog" style="border:1px solid var(--border);border-radius:var(--radius);padding:0;max-width:600px;width:90%">
    <div style="background:#1c1917;padding:1rem 1.25rem;border-radius:var(--radius) var(--radius) 0 0;display:flex;justify-content:space-between;align-items:center">
      <span style="font-weight:600;color:#fbbf24">รายละเอียด Error</span>
      <button onclick="document.getElementById('errorDialog').close()" style="background:transparent;border:none;color:#78716c;cursor:pointer;font-size:1.1rem">✕</button>
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
