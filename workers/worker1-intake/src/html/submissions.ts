import type { Submission, SubmissionFile, User } from 'shared/types';
import { FORM_TYPES } from 'shared/forms-config';
import { esc } from '../validators';
import { adminLayout, statusBadge, formatDate, shortId, STATUS_LABELS, paginationHtml, refreshBarHtml, formTypeBadge } from './layout';

export function submissionsPage(
  submissions: Submission[],
  total: number,
  page: number,
  perPage: number,
  stats: { pending: number; dispatching: number; today: number; failed: number },
  filters: Record<string, string>,
  user: User,
  flash?: string,
): string {
  const canRetry = user.role === 'admin' || user.role === 'operator';
  const totalPages = Math.ceil(total / perPage);

  const rows = submissions.map(s => {
    const data = JSON.parse(s.data);
    return `<tr>
      <td style="color:var(--text-muted);font-size:0.78rem;white-space:nowrap">${esc(formatDate(s.submitted_at))}</td>
      <td><code title="${esc(s.id)}">${esc(shortId(s.id))}</code></td>
      <td>${formTypeBadge(s.form_type)}</td>
      <td>${esc(data.fullName ?? '—')}</td>
      <td style="color:var(--text-muted)">${esc(data.email ?? '—')}</td>
      <td>${statusBadge(s.status)}</td>
      <td style="text-align:center;color:var(--text-muted)">${s.retry_count}</td>
      <td>
        <div style="display:flex;gap:0.35rem;align-items:center">
          <a href="/admin/submissions/${esc(s.id)}" class="btn btn-outline btn-xs">ดู</a>
          ${canRetry && s.status === 'failed' ? `<form method="POST" action="/admin/bulk-retry" style="margin:0" onsubmit="return confirm('Retry submission นี้?')">
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
      <div class="page-title">Submissions</div>
      <div class="page-subtitle">ข้อมูลทั้งหมด ${total.toLocaleString()} รายการ · อัปเดตอัตโนมัติทุก 10 วินาที</div>
    </div>
  </div>

  <div class="stat-grid">
    <a href="/admin/submissions?status=pending" class="stat-card" style="text-decoration:none;background:#eff6ff;border-color:#93c5fd">
      <div class="stat-accent" style="background:#3b82f6"></div>
      <div class="stat-num" style="color:#1d4ed8">${stats.pending}</div>
      <div class="stat-lbl" style="color:#2563eb">รอดำเนินการ</div>
    </a>
    <a href="/admin/submissions?status=dispatching" class="stat-card" style="text-decoration:none;background:#fffbeb;border-color:#fbbf24">
      <div class="stat-accent" style="background:#f59e0b"></div>
      <div class="stat-num" style="color:#b45309">${stats.dispatching}</div>
      <div class="stat-lbl" style="color:#92400e">กำลังส่ง</div>
    </a>
    <a href="/admin/submissions" class="stat-card" style="text-decoration:none;background:#f0fdf4;border-color:#86efac">
      <div class="stat-accent" style="background:#22c55e"></div>
      <div class="stat-num" style="color:#15803d">${stats.today}</div>
      <div class="stat-lbl" style="color:#166534">วันนี้ทั้งหมด</div>
    </a>
    <a href="/admin/submissions?status=failed" class="stat-card" style="text-decoration:none;background:#fff1f2;border-color:#fda4af">
      <div class="stat-accent" style="background:#ef4444"></div>
      <div class="stat-num" style="color:#be123c">${stats.failed}</div>
      <div class="stat-lbl" style="color:#9f1239">ล้มเหลว</div>
    </a>
  </div>

  <div class="filter-bar">
    <form method="GET" action="/admin/submissions" style="display:contents">
      <select name="form_type" onchange="this.form.submit()" style="width:auto">
        <option value="">ทุกประเภท</option>
        ${FORM_TYPES.map(t => `<option value="${t}" ${filters.form_type === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}
      </select>
      <select name="status" onchange="this.form.submit()" style="width:auto">
        <option value="">ทุกสถานะ</option>
        ${['pending','dispatching','complete','failed'].map(s => `<option value="${s}" ${filters.status === s ? 'selected' : ''}>${esc(STATUS_LABELS[s] ?? s)}</option>`).join('')}
      </select>
      <input type="date" name="from" value="${esc(filters.from ?? '')}" title="จากวันที่" style="width:auto">
      <input type="date" name="to" value="${esc(filters.to ?? '')}" title="ถึงวันที่" style="width:auto">
      <input type="text" name="q" value="${esc(filters.q ?? '')}" placeholder="ค้นหา email/ชื่อ">
      <button type="submit" class="btn btn-primary btn-sm">ค้นหา</button>
      <a href="/admin/submissions" class="btn btn-outline btn-sm">รีเซ็ต</a>
    </form>
  </div>

  ${canRetry ? `<div style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.75rem">
    <button id="bulkRetryBtn" class="btn btn-primary btn-sm" disabled onclick="bulkRetry()">🔄 Retry ที่เลือก</button>
    <span id="selCount" style="font-size:0.8rem;color:var(--text-muted)"></span>
  </div>` : ''}

  ${refreshBarHtml()}
  <div class="table-wrap">
    <table>
      <thead><tr>
        <th>เวลา</th><th>ID</th><th>ประเภท</th><th>ชื่อ</th><th>อีเมล</th><th>สถานะ</th><th style="text-align:center">Retry</th><th>Actions</th>
        ${canRetry ? '<th style="width:40px"><input type="checkbox" id="selAll" onchange="toggleAll(this)" style="width:auto"></th>' : ''}
      </tr></thead>
      <tbody id="tableBody">${rows}</tbody>
    </table>
  </div>

  ${paginationHtml(page, totalPages, total, p => '?' + new URLSearchParams({ ...filters, page: String(p) }))}

  ${canRetry ? `<script>
    function toggleAll(cb) {
      document.querySelectorAll('.row-cb').forEach(c => c.checked = cb.checked);
      updateCount();
    }
    function updateCount() {
      const n = document.querySelectorAll('.row-cb:checked').length;
      document.getElementById('selCount').textContent = n > 0 ? 'เลือก ' + n + ' รายการ' : '';
      document.getElementById('bulkRetryBtn').disabled = n === 0;
    }
    function bulkRetry() {
      const ids = Array.from(document.querySelectorAll('.row-cb:checked')).map(c => c.value);
      if (!ids.length) return;
      if (!confirm('Retry ' + ids.length + ' submissions?')) return;
      const form = document.createElement('form');
      form.method = 'POST'; form.action = '/admin/bulk-retry';
      ids.forEach(id => { const inp = document.createElement('input'); inp.type='hidden'; inp.name='ids'; inp.value=id; form.appendChild(inp); });
      document.body.appendChild(form); form.submit();
    }
    document.querySelectorAll('#tableBody tr').forEach(tr => {
      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.className = 'row-cb'; cb.style.width = 'auto';
      const id = tr.querySelector('a[href*="/admin/submissions/"]')?.href?.split('/').pop();
      if (id) { cb.value = id; }
      const td = document.createElement('td'); td.appendChild(cb);
      tr.appendChild(td);
      cb.addEventListener('change', updateCount);
    });
  </script>` : ''}`;

  return adminLayout('Submissions', content, user, 'submissions', flash);
}

export function submissionDetailPage(
  submission: Submission,
  files: SubmissionFile[],
  user: User,
): string {
  const data = JSON.parse(submission.data);
  const kvRows = Object.entries(data).map(([k, v]) =>
    `<tr><td>${esc(k)}</td><td>${esc(Array.isArray(v) ? v.join(', ') : String(v))}</td></tr>`,
  ).join('');

  const fileRows = files.map(f =>
    `<tr>
      <td>${esc(f.field_name)}</td>
      <td>${esc(f.original_filename)}</td>
      <td style="color:var(--text-muted)">${esc(f.content_type)}</td>
      <td style="color:var(--text-muted)">${(f.size_bytes / 1024).toFixed(1)} KB</td>
      <td><a href="/admin/files/${esc(f.id)}" target="_blank" class="btn btn-outline btn-xs">⬇️ Download</a></td>
    </tr>`,
  ).join('');

  const canRetry = (user.role === 'admin' || user.role === 'operator')
    && (submission.status === 'failed' || submission.status === 'complete');

  const content = `
  <div class="page-header">
    <div style="display:flex;align-items:center;gap:1rem">
      <a href="/admin/submissions" class="btn btn-outline btn-sm">← กลับ</a>
      <div>
        <div class="page-title">Submission Detail</div>
        <div style="font-size:0.78rem;color:var(--text-muted);margin-top:2px"><code>${esc(submission.id)}</code></div>
      </div>
    </div>
    ${canRetry ? `<form method="POST" action="/admin/bulk-retry" onsubmit="return confirm('Retry submission นี้?')" style="margin:0">
      <input type="hidden" name="ids" value="${esc(submission.id)}">
      <button type="submit" class="btn btn-primary">🔄 Retry</button>
    </form>` : ''}
  </div>

  <div class="two-col" style="margin-bottom:1.5rem">
    <div class="card">
      <div class="card-header">ข้อมูล Submission</div>
      <div class="card-body">
        <table class="kv-table" style="width:100%">
          <tr><td>Form Type</td><td>${esc(submission.form_type)}</td></tr>
          <tr><td>สถานะ</td><td>${statusBadge(submission.status)}</td></tr>
          <tr><td>ส่งเมื่อ</td><td>${esc(formatDate(submission.submitted_at))}</td></tr>
          <tr><td>Dispatched At</td><td>${esc(formatDate(submission.dispatched_at))}</td></tr>
          <tr><td>Completed At</td><td>${esc(formatDate(submission.completed_at))}</td></tr>
          <tr><td>Retry Count</td><td>${submission.retry_count}</td></tr>
          ${submission.last_error ? `<tr><td>Last Error</td><td>
            <div class="err-wrap">
              <pre class="err-preview">${esc(submission.last_error)}</pre>
              <div class="err-popup"><pre>${esc(submission.last_error)}</pre></div>
            </div>
          </td></tr>` : ''}
        </table>
      </div>
    </div>

    <div class="card">
      <div class="card-header">ข้อมูลฟอร์ม</div>
      <div class="card-body">
        <table class="kv-table" style="width:100%"><tbody>${kvRows}</tbody></table>
      </div>
    </div>
  </div>

  ${files.length > 0 ? `
  <div class="card">
    <div class="card-header">ไฟล์แนบ (${files.length} ไฟล์)</div>
    <div class="table-wrap" style="border:none;border-radius:0">
      <table>
        <thead><tr><th>Field</th><th>ชื่อไฟล์</th><th>Type</th><th>ขนาด</th><th></th></tr></thead>
        <tbody>${fileRows}</tbody>
      </table>
    </div>
  </div>` : ''}`;

  return adminLayout(`Submission ${shortId(submission.id)}`, content, user, 'submissions');
}
