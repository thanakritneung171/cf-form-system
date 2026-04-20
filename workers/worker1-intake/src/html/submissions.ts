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
  const canDelete = user.role === 'admin';
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
          ${canRetry && s.status === 'failed' ? `<button type="button" class="btn btn-primary btn-xs" onclick="openRetryModal('${esc(s.id)}')">Retry</button>` : ''}
          ${canDelete ? `<button type="button" class="btn btn-danger btn-xs" onclick="openDeleteModal('${esc(s.id)}')">ลบ</button>` : ''}
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

  ${canRetry ? `<div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;margin-bottom:0.75rem">
    <button id="bulkRetryBtn" class="btn btn-primary btn-sm" disabled onclick="openBulkRetryModal()">🔄 Retry ที่เลือก</button>
    ${canDelete ? `<button id="bulkDeleteBtn" class="btn btn-danger btn-sm" disabled onclick="openBulkDeleteModal()">🗑️ ลบที่เลือก</button>` : ''}
    <span id="selCount" style="font-size:0.8rem;color:var(--text-muted)"></span>
    ${stats.failed > 0 ? `<button type="button" class="btn btn-danger btn-sm" onclick="openRetryAllModal(${stats.failed})">⚡ Retry All Failed (${stats.failed})</button>` : ''}
  </div>` : ''}

  ${refreshBarHtml()}
  <div class="table-wrap">
    <table>
      <thead><tr>
        ${canRetry ? '<th style="width:40px"><input type="checkbox" id="selAll" onchange="toggleAll(this)" style="width:auto"></th>' : ''}
        <th>เวลา</th><th>ID</th><th>ประเภท</th><th>ชื่อ</th><th>อีเมล</th><th>สถานะ</th><th style="text-align:center">Retry</th><th>Actions</th>
      </tr></thead>
      <tbody id="tableBody">${rows}</tbody>
    </table>
  </div>

  ${paginationHtml(page, totalPages, total, p => '?' + new URLSearchParams({ ...filters, page: String(p) }))}

  <!-- ===== Custom Confirm Modal ===== -->
  <style>
    .cf-overlay {
      position: fixed; inset: 0; z-index: 9998;
      background: rgba(31,16,0,0.45);
      backdrop-filter: blur(3px);
      display: none; align-items: center; justify-content: center;
    }
    .cf-overlay.show { display: flex; animation: cfFadeIn .15s ease; }
    @keyframes cfFadeIn { from { opacity:0 } to { opacity:1 } }
    .cf-dialog {
      background: #fffaeb;
      border: 1px solid #e8d5a8;
      border-radius: 16px;
      box-shadow: 0 8px 40px rgba(127,99,21,0.22), 0 2px 8px rgba(0,0,0,0.12);
      padding: 2rem 2rem 1.5rem;
      width: min(420px, calc(100vw - 2rem));
      animation: cfSlideUp .18s cubic-bezier(.34,1.56,.64,1);
    }
    @keyframes cfSlideUp { from { transform:translateY(12px) scale(.97); opacity:0 } to { transform:none; opacity:1 } }
    .cf-icon {
      width: 48px; height: 48px; border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      font-size: 24px; margin-bottom: 1rem;
    }
    .cf-icon-retry { background: #fff0c2; }
    .cf-icon-danger { background: #fff1f2; }
    .cf-title { font-size: 16px; font-weight: 700; color: #1f1f1f; margin-bottom: 0.4rem; }
    .cf-body  { font-size: 13.5px; color: #6b4f2a; line-height: 1.55; margin-bottom: 1.5rem; }
    .cf-actions { display: flex; gap: 0.6rem; justify-content: flex-end; }
    .cf-cancel {
      background: transparent; color: #6b4f2a;
      border: 1px solid #e8d5a8; border-radius: 9px;
      padding: 0.45rem 1.1rem; font-size: 13px; font-weight: 500;
      cursor: pointer; transition: background .1s, border-color .1s;
    }
    .cf-cancel:hover { background: #fff0c2; border-color: #ffd06a; }
    .cf-confirm {
      border-radius: 9px; padding: 0.45rem 1.25rem;
      font-size: 13px; font-weight: 600; cursor: pointer;
      border: 1px solid transparent; transition: background .12s, box-shadow .12s, transform .06s;
    }
    .cf-confirm:active { transform: scale(0.97); }
    .cf-confirm-retry {
      background: #1c1009; color: #fff; border-color: #1c1009;
    }
    .cf-confirm-retry:hover { background: #fa520f; border-color: #fa520f; box-shadow: 0 2px 8px rgba(250,82,15,.35); }
    .cf-confirm-danger {
      background: #be123c; color: #fff; border-color: #be123c;
    }
    .cf-confirm-danger:hover { background: #9f1239; border-color: #9f1239; box-shadow: 0 2px 8px rgba(190,18,60,.35); }
  </style>

  <!-- Modal HTML -->
  <div class="cf-overlay" id="cfOverlay" onclick="closeCfModal(event)">
    <div class="cf-dialog" role="dialog" aria-modal="true">
      <div class="cf-icon" id="cfIcon"></div>
      <div class="cf-title" id="cfTitle"></div>
      <div class="cf-body"  id="cfBody"></div>
      <div class="cf-actions">
        <button class="cf-cancel" onclick="closeCfModal()">ยกเลิก</button>
        <button class="cf-confirm" id="cfConfirmBtn" onclick="cfDoConfirm()"></button>
      </div>
    </div>
  </div>

  <!-- Hidden forms for POST actions -->
  <form id="cfSingleForm" method="POST" action="/admin/bulk-retry" style="display:none">
    <input type="hidden" name="ids" id="cfSingleId">
  </form>
  <form id="cfBulkForm" method="POST" action="/admin/bulk-retry" style="display:none"></form>
  <form id="cfRetryAllForm" method="POST" action="/admin/retry-all" style="display:none"></form>
  <form id="cfDeleteForm" method="POST" action="/admin/bulk-delete" style="display:none">
    <input type="hidden" name="ids" id="cfDeleteId">
  </form>
  <form id="cfBulkDeleteForm" method="POST" action="/admin/bulk-delete" style="display:none"></form>

  ${canRetry ? `<script>
    /* ── Checkbox helpers ── */
    function toggleAll(cb) {
      document.querySelectorAll('.row-cb').forEach(c => c.checked = cb.checked);
      updateCount();
    }
    function updateCount() {
      const n = document.querySelectorAll('.row-cb:checked').length;
      document.getElementById('selCount').textContent = n > 0 ? 'เลือก ' + n + ' รายการ' : '';
      document.getElementById('bulkRetryBtn').disabled = n === 0;
      var delBtn = document.getElementById('bulkDeleteBtn');
      if (delBtn) delBtn.disabled = n === 0;
    }
    document.querySelectorAll('#tableBody tr').forEach(tr => {
      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.className = 'row-cb'; cb.style.width = 'auto';
      const id = tr.querySelector('a[href*="/admin/submissions/"]')?.href?.split('/').pop();
      if (id) { cb.value = id; }
      const td = document.createElement('td'); td.appendChild(cb);
      tr.prepend(td);
      cb.addEventListener('change', updateCount);
    });

    /* ── Modal core ── */
    var _cfCallback = null;
    function showCfModal(opts) {
      document.getElementById('cfIcon').className = 'cf-icon ' + (opts.iconClass || 'cf-icon-retry');
      document.getElementById('cfIcon').textContent = opts.icon || '🔄';
      document.getElementById('cfTitle').textContent = opts.title;
      document.getElementById('cfBody').innerHTML = opts.body;
      var btn = document.getElementById('cfConfirmBtn');
      btn.textContent = opts.confirmText || 'ยืนยัน';
      btn.className = 'cf-confirm ' + (opts.confirmClass || 'cf-confirm-retry');
      _cfCallback = opts.onConfirm;
      document.getElementById('cfOverlay').classList.add('show');
    }
    function closeCfModal(e) {
      if (e && e.target !== document.getElementById('cfOverlay')) return;
      document.getElementById('cfOverlay').classList.remove('show');
      _cfCallback = null;
    }
    function cfDoConfirm() {
      document.getElementById('cfOverlay').classList.remove('show');
      if (_cfCallback) { _cfCallback(); _cfCallback = null; }
    }
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') document.getElementById('cfOverlay').classList.remove('show');
    });

    /* ── Retry single ── */
    function openRetryModal(id) {
      showCfModal({
        icon: '🔄', iconClass: 'cf-icon-retry',
        title: 'ยืนยัน Retry',
        body: 'ต้องการ Retry submission <code style="background:#fff0c2;padding:1px 5px;border-radius:4px">' + id.slice(0,8) + '…</code> ใช่ไหม?<br><span style="font-size:12px;color:#a07840;margin-top:6px;display:block">สถานะจะถูก reset เป็น Pending</span>',
        confirmText: 'Retry',
        confirmClass: 'cf-confirm-retry',
        onConfirm: function() {
          document.getElementById('cfSingleId').value = id;
          document.getElementById('cfSingleForm').submit();
        }
      });
    }

    /* ── Bulk retry ── */
    function openBulkRetryModal() {
      const ids = Array.from(document.querySelectorAll('.row-cb:checked')).map(c => c.value);
      if (!ids.length) return;
      showCfModal({
        icon: '🔄', iconClass: 'cf-icon-retry',
        title: 'ยืนยัน Retry ที่เลือก',
        body: 'ต้องการ Retry <strong>' + ids.length + ' submission</strong> ที่เลือกไว้ใช่ไหม?<br><span style="font-size:12px;color:#a07840;margin-top:6px;display:block">สถานะทั้งหมดจะถูก reset เป็น Pending</span>',
        confirmText: 'Retry ' + ids.length + ' รายการ',
        confirmClass: 'cf-confirm-retry',
        onConfirm: function() {
          var form = document.getElementById('cfBulkForm');
          form.innerHTML = '';
          ids.forEach(function(id) {
            var inp = document.createElement('input');
            inp.type = 'hidden'; inp.name = 'ids'; inp.value = id;
            form.appendChild(inp);
          });
          form.submit();
        }
      });
    }

    /* ── Retry All Failed ── */
    function openRetryAllModal(count) {
      showCfModal({
        icon: '⚡', iconClass: 'cf-icon-danger',
        title: 'Retry All Failed',
        body: 'ต้องการ Retry <strong>ทุก submission ที่ล้มเหลว (' + count + ' รายการ)</strong> ใช่ไหม?<br><span style="font-size:12px;color:#a07840;margin-top:6px;display:block">สถานะทั้งหมดจะถูก reset เป็น Pending พร้อมกัน</span>',
        confirmText: 'Retry ทั้งหมด ' + count + ' รายการ',
        confirmClass: 'cf-confirm-danger',
        onConfirm: function() { document.getElementById('cfRetryAllForm').submit(); }
      });
    }

    /* ── Delete single ── */
    function openDeleteModal(id) {
      showCfModal({
        icon: '🗑️', iconClass: 'cf-icon-danger',
        title: 'ยืนยันการลบ',
        body: 'ต้องการลบ submission <code style="background:#fff0c2;padding:1px 5px;border-radius:4px">' + id.slice(0,8) + '…</code> ใช่ไหม?<br><span style="font-size:12px;color:#be123c;margin-top:6px;display:block;font-weight:500">⚠️ ไม่สามารถกู้คืนได้ ไฟล์แนบจะถูกลบออกด้วย</span>',
        confirmText: 'ลบ',
        confirmClass: 'cf-confirm-danger',
        onConfirm: function() {
          document.getElementById('cfDeleteId').value = id;
          document.getElementById('cfDeleteForm').submit();
        }
      });
    }

    /* ── Bulk delete ── */
    function openBulkDeleteModal() {
      const ids = Array.from(document.querySelectorAll('.row-cb:checked')).map(c => c.value);
      if (!ids.length) return;
      showCfModal({
        icon: '🗑️', iconClass: 'cf-icon-danger',
        title: 'ยืนยันการลบ',
        body: 'ต้องการลบ <strong>' + ids.length + ' submission</strong> ที่เลือกไว้ใช่ไหม?<br><span style="font-size:12px;color:#be123c;margin-top:6px;display:block;font-weight:500">⚠️ ไม่สามารถกู้คืนได้ ไฟล์แนบทั้งหมดจะถูกลบออกด้วย</span>',
        confirmText: 'ลบ ' + ids.length + ' รายการ',
        confirmClass: 'cf-confirm-danger',
        onConfirm: function() {
          var form = document.getElementById('cfBulkDeleteForm');
          form.innerHTML = '';
          ids.forEach(function(id) {
            var inp = document.createElement('input');
            inp.type = 'hidden'; inp.name = 'ids'; inp.value = id;
            form.appendChild(inp);
          });
          form.submit();
        }
      });
    }
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
  const canDelete = user.role === 'admin';

  const content = `
  <div class="page-header">
    <div style="display:flex;align-items:center;gap:1rem">
      <a href="/admin/submissions" class="btn btn-outline btn-sm">← กลับ</a>
      <div>
        <div class="page-title">Submission Detail</div>
        <div style="font-size:0.78rem;color:var(--text-muted);margin-top:2px"><code>${esc(submission.id)}</code></div>
      </div>
    </div>
    <div style="display:flex;gap:0.5rem">
      ${canRetry ? `<button type="button" class="btn btn-primary" onclick="openDetailRetryModal()">🔄 Retry</button>` : ''}
      ${canDelete ? `<button type="button" class="btn btn-danger" onclick="openDetailDeleteModal()">🗑️ ลบ</button>` : ''}
    </div>
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
  </div>` : ''}

  ${(canRetry || canDelete) ? `
  <!-- Modal -->
  <style>
    .cf-overlay {
      position: fixed; inset: 0; z-index: 9998;
      background: rgba(31,16,0,0.45);
      backdrop-filter: blur(3px);
      display: none; align-items: center; justify-content: center;
    }
    .cf-overlay.show { display: flex; animation: cfFadeIn .15s ease; }
    @keyframes cfFadeIn { from { opacity:0 } to { opacity:1 } }
    .cf-dialog {
      background: #fffaeb; border: 1px solid #e8d5a8; border-radius: 16px;
      box-shadow: 0 8px 40px rgba(127,99,21,0.22), 0 2px 8px rgba(0,0,0,0.12);
      padding: 2rem 2rem 1.5rem; width: min(420px, calc(100vw - 2rem));
      animation: cfSlideUp .18s cubic-bezier(.34,1.56,.64,1);
    }
    @keyframes cfSlideUp { from { transform:translateY(12px) scale(.97); opacity:0 } to { transform:none; opacity:1 } }
    .cf-icon { width:48px;height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px;margin-bottom:1rem; }
    .cf-icon-retry { background:#fff0c2; }
    .cf-icon-danger { background:#fff1f2; }
    .cf-title { font-size:16px;font-weight:700;color:#1f1f1f;margin-bottom:0.4rem; }
    .cf-body  { font-size:13.5px;color:#6b4f2a;line-height:1.55;margin-bottom:1.5rem; }
    .cf-actions { display:flex;gap:0.6rem;justify-content:flex-end; }
    .cf-cancel { background:transparent;color:#6b4f2a;border:1px solid #e8d5a8;border-radius:9px;padding:0.45rem 1.1rem;font-size:13px;font-weight:500;cursor:pointer;transition:background .1s,border-color .1s; }
    .cf-cancel:hover { background:#fff0c2;border-color:#ffd06a; }
    .cf-confirm-retry { background:#1c1009;color:#fff;border:1px solid #1c1009;border-radius:9px;padding:0.45rem 1.25rem;font-size:13px;font-weight:600;cursor:pointer;transition:background .12s,box-shadow .12s,transform .06s; }
    .cf-confirm-retry:hover { background:#fa520f;border-color:#fa520f;box-shadow:0 2px 8px rgba(250,82,15,.35); }
    .cf-confirm-danger { background:#be123c;color:#fff;border:1px solid #be123c;border-radius:9px;padding:0.45rem 1.25rem;font-size:13px;font-weight:600;cursor:pointer;transition:background .12s,box-shadow .12s,transform .06s; }
    .cf-confirm-danger:hover { background:#9f1239;border-color:#9f1239;box-shadow:0 2px 8px rgba(190,18,60,.35); }
  </style>
  <div class="cf-overlay" id="cfOverlay" onclick="if(event.target===this)this.classList.remove('show')">
    <div class="cf-dialog" role="dialog" aria-modal="true">
      <div class="cf-icon" id="cfIcon"></div>
      <div class="cf-title" id="cfTitle"></div>
      <div class="cf-body"  id="cfBody"></div>
      <div class="cf-actions">
        <button class="cf-cancel" onclick="document.getElementById('cfOverlay').classList.remove('show')">ยกเลิก</button>
        <button id="cfConfirmBtn" onclick="cfDoConfirm()"></button>
      </div>
    </div>
  </div>
  <form id="cfRetryForm" method="POST" action="/admin/bulk-retry" style="display:none">
    <input type="hidden" name="ids" value="${esc(submission.id)}">
  </form>
  <form id="cfDeleteForm" method="POST" action="/admin/bulk-delete" style="display:none">
    <input type="hidden" name="ids" value="${esc(submission.id)}">
  </form>
  <script>
    var _cfCb = null;
    function showModal(opts) {
      var icon = document.getElementById('cfIcon');
      icon.className = 'cf-icon ' + (opts.iconClass || 'cf-icon-retry');
      icon.textContent = opts.icon || '';
      document.getElementById('cfTitle').textContent = opts.title;
      document.getElementById('cfBody').innerHTML = opts.body;
      var btn = document.getElementById('cfConfirmBtn');
      btn.textContent = opts.confirmText || 'ยืนยัน';
      btn.className = opts.confirmClass || 'cf-confirm-retry';
      _cfCb = opts.onConfirm;
      document.getElementById('cfOverlay').classList.add('show');
    }
    function cfDoConfirm() {
      document.getElementById('cfOverlay').classList.remove('show');
      if (_cfCb) { _cfCb(); _cfCb = null; }
    }
    function openDetailRetryModal() {
      showModal({
        icon: '🔄', iconClass: 'cf-icon-retry',
        title: 'ยืนยัน Retry',
        body: 'ต้องการ Retry submission นี้ใช่ไหม?<br><span style="font-size:12px;color:#a07840;margin-top:6px;display:block">สถานะจะถูก reset เป็น Pending</span>',
        confirmText: 'Retry', confirmClass: 'cf-confirm-retry',
        onConfirm: function() { document.getElementById('cfRetryForm').submit(); }
      });
    }
    function openDetailDeleteModal() {
      showModal({
        icon: '🗑️', iconClass: 'cf-icon-danger',
        title: 'ยืนยันการลบ',
        body: 'ต้องการลบ submission นี้ใช่ไหม?<br><span style="font-size:12px;color:#be123c;margin-top:6px;display:block;font-weight:500">⚠️ ไม่สามารถกู้คืนได้ ไฟล์แนบจะถูกลบออกด้วย</span>',
        confirmText: 'ลบ', confirmClass: 'cf-confirm-danger',
        onConfirm: function() { document.getElementById('cfDeleteForm').submit(); }
      });
    }
    document.addEventListener('keydown', function(e) { if(e.key==='Escape') document.getElementById('cfOverlay').classList.remove('show'); });
  </script>` : ''}`;

  return adminLayout(`Submission ${shortId(submission.id)}`, content, user, 'submissions');
}
