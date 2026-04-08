/// <reference types="@cloudflare/workers-types" />

import type { FormConfig, FormType, Submission, SubmissionFile, User, Webhook, WebhookDelivery } from 'shared/types';
import { FORMS_CONFIG, FORM_TYPES } from 'shared/forms-config';
import { esc } from './validators';

// ===== สีสำหรับ status badge =====
const STATUS_COLORS: Record<string, string> = {
  pending: '#d97706',
  dispatching: '#2563eb',
  complete: '#16a34a',
  failed: '#dc2626',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'รอดำเนินการ',
  dispatching: 'กำลังส่ง',
  complete: 'สำเร็จ',
  failed: 'ล้มเหลว',
};

function statusBadge(status: string): string {
  const color = STATUS_COLORS[status] ?? '#6b7280';
  return `<span style="background:${color};color:#fff;padding:2px 8px;border-radius:12px;font-size:0.75rem;font-weight:600;">${esc(STATUS_LABELS[status] ?? status)}</span>`;
}

function roleBadge(role: string): string {
  const colors: Record<string, string> = { admin: '#7c3aed', operator: '#0891b2', viewer: '#6b7280' };
  const c = colors[role] ?? '#6b7280';
  return `<span style="background:${c};color:#fff;padding:2px 8px;border-radius:12px;font-size:0.75rem;font-weight:600;">${esc(role)}</span>`;
}

function formatDate(ts: number | null | undefined): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
}

function shortId(id: string): string {
  return id.slice(0, 8) + '…';
}

// ===== Layout admin =====

function adminLayout(
  title: string,
  content: string,
  user: User,
  activePage: string,
  flashMessage?: string,
): string {
  const navItems = [
    { href: '/admin/submissions', label: 'Submissions', page: 'submissions' },
    { href: '/admin/dispatched', label: 'Dispatched', page: 'dispatched' },
    { href: '/admin/queues', label: 'Queues', page: 'queues' },
    ...(user.role === 'admin'
      ? [
          { href: '/admin/users', label: 'Users', page: 'users' },
          { href: '/admin/webhooks', label: 'Webhooks', page: 'webhooks' },
        ]
      : []),
  ];

  const canExport = user.role === 'admin' || user.role === 'operator';

  return `<!DOCTYPE html>
<html lang="th" data-theme="auto">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)} — Form Admin</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css">
  <style>
    :root { --pico-primary: #2563eb; }
    nav a { text-decoration: none; padding: 0.5rem 0.75rem; border-radius: 4px; }
    nav a.active { background: var(--pico-primary); color: #fff; }
    .flash-ok { background:#dcfce7;color:#166534;padding:0.75rem 1rem;border-radius:6px;margin-bottom:1rem; }
    .flash-err { background:#fee2e2;color:#991b1b;padding:0.75rem 1rem;border-radius:6px;margin-bottom:1rem; }
    table { font-size:0.875rem; }
    tr:hover td { background: rgba(0,0,0,0.02); }
    .card-grid { display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:1rem;margin-bottom:1.5rem; }
    .stat-card { background:var(--pico-card-background-color);border:1px solid var(--pico-muted-border-color);border-radius:8px;padding:1rem;text-align:center; }
    .stat-card .num { font-size:2rem;font-weight:700;line-height:1; }
    .stat-card .lbl { font-size:0.8rem;color:var(--pico-muted-color);margin-top:0.25rem; }
    .filter-bar { display:flex;gap:0.5rem;flex-wrap:wrap;align-items:flex-end;margin-bottom:1rem; }
    .filter-bar select, .filter-bar input { margin:0; }
    .actions-bar { display:flex;gap:0.5rem;align-items:center;margin-bottom:0.75rem;flex-wrap:wrap; }
    .btn-sm { font-size:0.8rem;padding:0.25rem 0.75rem; }
    pre { background:var(--pico-code-background-color);padding:0.75rem;border-radius:4px;overflow:auto;font-size:0.8rem; }
    .kv-table td:first-child { font-weight:600;width:200px;white-space:nowrap; }
  </style>
</head>
<body>
<header class="container">
  <nav>
    <ul><li><strong>⚡ Form Admin</strong></li></ul>
    <ul>
      ${navItems.map(n => `<li><a href="${n.href}" class="${activePage === n.page ? 'active' : ''}">${esc(n.label)}</a></li>`).join('')}
      ${canExport ? `<li><a href="/admin/export/submissions.csv">Export CSV</a></li>` : ''}
    </ul>
    <ul>
      <li><a href="/admin/profile">${esc(user.username)}</a></li>
      <li>
        <form method="POST" action="/admin/logout" style="margin:0">
          <button type="submit" class="outline btn-sm">ออกจากระบบ</button>
        </form>
      </li>
    </ul>
  </nav>
</header>
<main class="container" style="margin-top:1.5rem">
  ${flashMessage ? `<div class="${flashMessage.startsWith('✓') ? 'flash-ok' : 'flash-err'}">${esc(flashMessage)}</div>` : ''}
  ${content}
</main>
</body>
</html>`;
}

// ===== Login page =====

export function loginPage(error?: string, next?: string): string {
  return `<!DOCTYPE html>
<html lang="th" data-theme="auto">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Login — Form Admin</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css">
  <style>:root{--pico-primary:#2563eb} body{display:flex;align-items:center;justify-content:center;min-height:100vh;}</style>
</head>
<body>
<article style="width:100%;max-width:400px">
  <hgroup>
    <h2>⚡ Form Admin</h2>
    <p>เข้าสู่ระบบเพื่อจัดการ submissions</p>
  </hgroup>
  ${error ? `<p style="color:#dc2626;background:#fee2e2;padding:0.75rem;border-radius:6px">${esc(error)}</p>` : ''}
  <form method="POST" action="/admin/login">
    <input type="hidden" name="next" value="${esc(next ?? '/admin/submissions')}">
    <label>ชื่อผู้ใช้<input type="text" name="username" required autocomplete="username"></label>
    <label>รหัสผ่าน<input type="password" name="password" required autocomplete="current-password"></label>
    <button type="submit">เข้าสู่ระบบ</button>
  </form>
</article>
</body>
</html>`;
}

// ===== Public index page =====

export function indexPage(): string {
  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>แบบฟอร์มออนไลน์</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,sans-serif;background:#f8fafc;color:#1e293b;padding:2rem 1rem}
    h1{text-align:center;margin-bottom:0.5rem;font-size:1.75rem}
    p.sub{text-align:center;color:#64748b;margin-bottom:2rem}
    .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:1rem;max-width:900px;margin:0 auto}
    .card{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:1.25rem 1.5rem;text-decoration:none;color:inherit;transition:box-shadow .15s,transform .15s;display:block}
    .card:hover{box-shadow:0 4px 16px rgba(0,0,0,.1);transform:translateY(-2px)}
    .card h3{margin-bottom:0.25rem;font-size:1rem;color:#1e40af}
    .card p{font-size:0.85rem;color:#64748b;line-height:1.4}
    .badge{display:inline-block;font-size:0.7rem;background:#dbeafe;color:#1e40af;padding:1px 6px;border-radius:8px;margin-top:0.5rem}
  </style>
</head>
<body>
  <h1>แบบฟอร์มออนไลน์</h1>
  <p class="sub">เลือกแบบฟอร์มที่ต้องการกรอก</p>
  <div class="grid">
    ${FORM_TYPES.map(type => {
      const cfg = FORMS_CONFIG[type];
      return `<a class="card" href="/form/${type}">
        <h3>${esc(cfg.title)}</h3>
        <p>${esc(cfg.description)}</p>
        ${cfg.hasFileUpload ? '<span class="badge">📎 แนบไฟล์ได้</span>' : ''}
      </a>`;
    }).join('\n    ')}
  </div>
</body>
</html>`;
}

// ===== Public form page =====

export function formPage(config: FormConfig): string {
  const fieldsHtml = config.fields.map(field => {
    const id = `f_${field.name}`;
    const req = field.required ? ' required' : '';
    const ph = field.placeholder ? ` placeholder="${esc(field.placeholder)}"` : '';

    if (field.type === 'textarea') {
      return `<label for="${id}">${esc(field.label)}${field.required ? ' <span style="color:#dc2626">*</span>' : ''}
        <textarea id="${id}" name="${field.name}" rows="${field.rows ?? 4}"${req}${ph}></textarea>
      </label>`;
    }

    if (field.type === 'select') {
      const opts = (field.options ?? []).map(o => `<option value="${esc(o)}">${esc(o)}</option>`).join('');
      return `<label for="${id}">${esc(field.label)}${field.required ? ' <span style="color:#dc2626">*</span>' : ''}
        <select id="${id}" name="${field.name}"${req}>
          <option value="">— เลือก —</option>
          ${opts}
        </select>
      </label>`;
    }

    if (field.type === 'multiselect') {
      const opts = (field.options ?? []).map(o =>
        `<label style="display:flex;gap:0.5rem;align-items:center;font-weight:normal;margin-bottom:0.25rem">
          <input type="checkbox" name="${field.name}" value="${esc(o)}"> ${esc(o)}
        </label>`,
      ).join('');
      return `<fieldset>
        <legend>${esc(field.label)}${field.required ? ' <span style="color:#dc2626">*</span>' : ''}</legend>
        ${opts}
      </fieldset>`;
    }

    if (field.type === 'file') {
      const accept = field.accept ? ` accept="${esc(field.accept)}"` : '';
      const multi = field.multiple ? ' multiple' : '';
      return `<label for="${id}">${esc(field.label)}${field.required ? ' <span style="color:#dc2626">*</span>' : ''}
        <input type="file" id="${id}" name="${field.name}"${accept}${multi}${req}>
        <small>ขนาดสูงสุดต่อไฟล์ ${field.maxSizeMB ?? 5} MB${field.maxFiles ? ` · สูงสุด ${field.maxFiles} ไฟล์` : ''}</small>
      </label>`;
    }

    // text, email, tel, number
    const minMax = field.min !== undefined ? ` min="${field.min}"` : '';
    const maxAttr = field.max !== undefined ? ` max="${field.max}"` : '';
    return `<label for="${id}">${esc(field.label)}${field.required ? ' <span style="color:#dc2626">*</span>' : ''}
      <input type="${field.type}" id="${id}" name="${field.name}"${req}${ph}${minMax}${maxAttr}>
    </label>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(config.title)}</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <header>
    <a href="/" class="back">← กลับหน้าหลัก</a>
    <h1>${esc(config.title)}</h1>
    <p>${esc(config.description)}</p>
  </header>
  <main>
    <form id="mainForm" method="POST" action="/submit/${config.type}" enctype="multipart/form-data" novalidate>
      ${fieldsHtml}
      <button type="submit" id="submitBtn">ส่งแบบฟอร์ม</button>
    </form>
    <div id="result" style="display:none"></div>
  </main>
  <script>
    const form = document.getElementById('mainForm');
    const btn = document.getElementById('submitBtn');
    const result = document.getElementById('result');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      btn.disabled = true;
      btn.textContent = 'กำลังส่ง...';
      result.style.display = 'none';
      try {
        const res = await fetch(form.action, { method: 'POST', body: new FormData(form) });
        const json = await res.json();
        if (json.ok) {
          result.style.cssText = 'display:block;background:#dcfce7;color:#166534;padding:1rem;border-radius:8px;margin-top:1rem';
          result.innerHTML = '<strong>✓ ส่งสำเร็จ!</strong> หมายเลขอ้างอิง: <code>' + json.submission_id + '</code>';
          form.reset();
        } else {
          result.style.cssText = 'display:block;background:#fee2e2;color:#991b1b;padding:1rem;border-radius:8px;margin-top:1rem';
          result.innerHTML = '<strong>เกิดข้อผิดพลาด:</strong> ' + (json.errors ? json.errors.map(function(e){return e.message}).join(', ') : json.error);
        }
      } catch(err) {
        result.style.cssText = 'display:block;background:#fee2e2;color:#991b1b;padding:1rem;border-radius:8px;margin-top:1rem';
        result.textContent = 'เกิดข้อผิดพลาดในการเชื่อมต่อ';
      }
      btn.disabled = false;
      btn.textContent = 'ส่งแบบฟอร์ม';
    });
  </script>
</body>
</html>`;
}

// ===== Admin Submissions page =====

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
      <td>${esc(formatDate(s.submitted_at))}</td>
      <td><code title="${esc(s.id)}">${esc(shortId(s.id))}</code></td>
      <td>${esc(s.form_type)}</td>
      <td>${esc(data.fullName ?? '—')}</td>
      <td>${esc(data.email ?? '—')}</td>
      <td>${statusBadge(s.status)}</td>
      <td style="text-align:center">${s.retry_count}</td>
      <td>
        <a href="/admin/submissions/${esc(s.id)}" class="btn-sm outline">ดู</a>
        ${canRetry && s.status === 'failed' ? `<form method="POST" action="/admin/bulk-retry" style="display:inline" onsubmit="return confirm('Retry submission นี้?')">
          <input type="hidden" name="ids" value="${esc(s.id)}">
          <button type="submit" class="btn-sm">Retry</button>
        </form>` : ''}
      </td>
    </tr>`;
  }).join('\n');

  const content = `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem">
    <h2 style="margin:0">Submissions</h2>
    <small>รีเฟรชอัตโนมัติทุก 10 วินาที</small>
  </div>
  <meta http-equiv="refresh" content="10">

  <div class="card-grid">
    <div class="stat-card"><div class="num" style="color:#d97706">${stats.pending}</div><div class="lbl">รอดำเนินการ</div></div>
    <div class="stat-card"><div class="num" style="color:#2563eb">${stats.dispatching}</div><div class="lbl">กำลังส่ง</div></div>
    <div class="stat-card"><div class="num" style="color:#16a34a">${stats.today}</div><div class="lbl">วันนี้</div></div>
    <div class="stat-card"><div class="num" style="color:#dc2626">${stats.failed}</div><div class="lbl">ล้มเหลว</div></div>
  </div>

  <form method="GET" action="/admin/submissions" class="filter-bar">
    <select name="form_type" onchange="this.form.submit()">
      <option value="">ทุกประเภท</option>
      ${FORM_TYPES.map(t => `<option value="${t}" ${filters.form_type === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}
    </select>
    <select name="status" onchange="this.form.submit()">
      <option value="">ทุกสถานะ</option>
      ${['pending','dispatching','complete','failed'].map(s => `<option value="${s}" ${filters.status === s ? 'selected' : ''}>${esc(STATUS_LABELS[s] ?? s)}</option>`).join('')}
    </select>
    <input type="date" name="from" value="${esc(filters.from ?? '')}" title="จากวันที่">
    <input type="date" name="to" value="${esc(filters.to ?? '')}" title="ถึงวันที่">
    <input type="text" name="q" value="${esc(filters.q ?? '')}" placeholder="ค้นหา email/ชื่อ" style="width:200px">
    <button type="submit" class="btn-sm">ค้นหา</button>
    <a href="/admin/submissions" class="btn-sm outline">รีเซ็ต</a>
  </form>

  ${canRetry ? `<div class="actions-bar">
    <button id="bulkRetryBtn" class="btn-sm" disabled onclick="bulkRetry()">Retry ที่เลือก</button>
    <span id="selCount" style="font-size:0.85rem;color:#6b7280"></span>
  </div>` : ''}

  <div style="overflow-x:auto">
  <table>
    <thead><tr>
      <th>เวลา</th><th>ID</th><th>ประเภท</th><th>ชื่อ</th><th>อีเมล</th><th>สถานะ</th><th>Retry</th><th>Actions</th>
      ${canRetry ? '<th><input type="checkbox" id="selAll" onchange="toggleAll(this)"></th>' : ''}
    </tr></thead>
    <tbody id="tableBody">${rows}</tbody>
  </table>
  </div>

  <nav style="display:flex;gap:0.5rem;justify-content:center;margin-top:1rem">
    ${page > 1 ? `<a href="?${new URLSearchParams({ ...filters, page: String(page - 1) })}" class="outline btn-sm">← ก่อนหน้า</a>` : ''}
    <span style="padding:0.25rem 0.75rem">หน้า ${page}/${totalPages} (${total} รายการ)</span>
    ${page < totalPages ? `<a href="?${new URLSearchParams({ ...filters, page: String(page + 1) })}" class="outline btn-sm">ถัดไป →</a>` : ''}
  </nav>

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
      cb.type = 'checkbox'; cb.className = 'row-cb';
      const id = tr.querySelector('a[href*="/admin/submissions/"]')?.href?.split('/').pop();
      if (id) { cb.value = id; }
      const td = document.createElement('td'); td.appendChild(cb);
      tr.appendChild(td);
      cb.addEventListener('change', updateCount);
    });
  </script>` : ''}`;

  return adminLayout('Submissions', content, user, 'submissions', flash);
}

// ===== Admin Dispatched page =====

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
      <td>${esc(formatDate(s.dispatched_at))}</td>
      <td>${esc(formatDate(s.completed_at))}</td>
      <td><code title="${esc(s.id)}">${esc(shortId(s.id))}</code></td>
      <td>${esc(s.form_type)}</td>
      <td>${esc(data.fullName ?? '—')}</td>
      <td>${statusBadge(s.status)}</td>
      <td style="text-align:center">${s.retry_count}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#dc2626">${esc(s.last_error ?? '')}</td>
      <td>${duration}</td>
      <td>
        <a href="/admin/submissions/${esc(s.id)}" class="btn-sm outline">ดู</a>
        ${canRetry && (s.status === 'failed' || s.status === 'complete') ? `<form method="POST" action="/admin/bulk-retry" style="display:inline" onsubmit="return confirm('Retry?')">
          <input type="hidden" name="ids" value="${esc(s.id)}">
          <button type="submit" class="btn-sm">Retry</button>
        </form>` : ''}
      </td>
    </tr>`;
  }).join('\n');

  const content = `
  <h2>Dispatched</h2>
  <div class="card-grid">
    <div class="stat-card"><div class="num" style="color:#16a34a">${stats.complete}</div><div class="lbl">สำเร็จ</div></div>
    <div class="stat-card"><div class="num" style="color:#dc2626">${stats.failed}</div><div class="lbl">ล้มเหลว</div></div>
    <div class="stat-card"><div class="num" style="color:#2563eb">${stats.successRate}%</div><div class="lbl">Success rate</div></div>
    <div class="stat-card"><div class="num">${stats.avgDuration}s</div><div class="lbl">Avg dispatch time</div></div>
  </div>

  <form method="GET" action="/admin/dispatched" class="filter-bar">
    <select name="form_type" onchange="this.form.submit()">
      <option value="">ทุกประเภท</option>
      ${FORM_TYPES.map(t => `<option value="${t}" ${filters.form_type === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}
    </select>
    <select name="status" onchange="this.form.submit()">
      <option value="">ทุกสถานะ</option>
      <option value="complete" ${filters.status === 'complete' ? 'selected' : ''}>สำเร็จ</option>
      <option value="failed" ${filters.status === 'failed' ? 'selected' : ''}>ล้มเหลว</option>
    </select>
    <input type="date" name="from" value="${esc(filters.from ?? '')}">
    <input type="date" name="to" value="${esc(filters.to ?? '')}">
    <button type="submit" class="btn-sm">ค้นหา</button>
    <a href="/admin/dispatched" class="outline btn-sm">รีเซ็ต</a>
    ${canRetry ? `<a href="/admin/export/dispatched.csv?${new URLSearchParams(filters)}" class="outline btn-sm">Export CSV</a>` : ''}
  </form>

  <div style="overflow-x:auto">
  <table>
    <thead><tr>
      <th>Dispatched</th><th>Completed</th><th>ID</th><th>ประเภท</th><th>ชื่อ</th><th>สถานะ</th><th>Retry</th><th>Error</th><th>Duration</th><th>Actions</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  </div>

  <nav style="display:flex;gap:0.5rem;justify-content:center;margin-top:1rem">
    ${page > 1 ? `<a href="?${new URLSearchParams({ ...filters, page: String(page - 1) })}" class="outline btn-sm">← ก่อนหน้า</a>` : ''}
    <span style="padding:0.25rem 0.75rem">หน้า ${page}/${totalPages} (${total} รายการ)</span>
    ${page < totalPages ? `<a href="?${new URLSearchParams({ ...filters, page: String(page + 1) })}" class="outline btn-sm">ถัดไป →</a>` : ''}
  </nav>

  <dialog id="errorDialog">
    <article>
      <header><h4>รายละเอียด Error</h4></header>
      <pre id="errorText"></pre>
      <footer><button onclick="document.getElementById('errorDialog').close()">ปิด</button></footer>
    </article>
  </dialog>
  <script>
    function showError(id, err) { if(err) { document.getElementById('errorText').textContent = err; document.getElementById('errorDialog').showModal(); } }
  </script>`;

  return adminLayout('Dispatched', content, user, 'dispatched', flash);
}

// ===== Submission Detail page =====

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
      <td>${esc(f.content_type)}</td>
      <td>${(f.size_bytes / 1024).toFixed(1)} KB</td>
      <td><a href="/admin/files/${esc(f.id)}" target="_blank">Download</a></td>
    </tr>`,
  ).join('');

  const canRetry = (user.role === 'admin' || user.role === 'operator')
    && (submission.status === 'failed' || submission.status === 'complete');

  const content = `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem">
    <div>
      <a href="/admin/submissions" class="outline btn-sm">← กลับ</a>
      <h2 style="display:inline;margin-left:1rem">Submission Detail</h2>
    </div>
    ${canRetry ? `<form method="POST" action="/admin/bulk-retry" onsubmit="return confirm('Retry submission นี้?')">
      <input type="hidden" name="ids" value="${esc(submission.id)}">
      <button type="submit">🔄 Retry</button>
    </form>` : ''}
  </div>

  <article>
    <table class="kv-table">
      <tr><td>ID</td><td><code>${esc(submission.id)}</code></td></tr>
      <tr><td>Form Type</td><td>${esc(submission.form_type)}</td></tr>
      <tr><td>Status</td><td>${statusBadge(submission.status)}</td></tr>
      <tr><td>Submitted At</td><td>${esc(formatDate(submission.submitted_at))}</td></tr>
      <tr><td>Dispatched At</td><td>${esc(formatDate(submission.dispatched_at))}</td></tr>
      <tr><td>Completed At</td><td>${esc(formatDate(submission.completed_at))}</td></tr>
      <tr><td>Retry Count</td><td>${submission.retry_count}</td></tr>
      ${submission.last_error ? `<tr><td>Last Error</td><td style="color:#dc2626"><pre>${esc(submission.last_error)}</pre></td></tr>` : ''}
    </table>
  </article>

  <h3>ข้อมูลฟอร์ม</h3>
  <article>
    <table class="kv-table"><tbody>${kvRows}</tbody></table>
  </article>

  ${files.length > 0 ? `
  <h3>ไฟล์แนบ</h3>
  <article>
    <table>
      <thead><tr><th>Field</th><th>ชื่อไฟล์</th><th>Type</th><th>ขนาด</th><th></th></tr></thead>
      <tbody>${fileRows}</tbody>
    </table>
  </article>` : ''}`;

  return adminLayout(`Submission ${shortId(submission.id)}`, content, user, 'submissions');
}

// ===== Users page =====

export function usersPage(users: User[], currentUser: User, flash?: string): string {
  const rows = users.map(u =>
    `<tr>
      <td>${esc(u.username)}</td>
      <td>${esc(u.email)}</td>
      <td>${roleBadge(u.role)}</td>
      <td>${u.is_active ? '✓ Active' : '✗ Inactive'}</td>
      <td>${esc(formatDate(u.created_at))}</td>
      <td>${esc(formatDate(u.last_login_at))}</td>
      <td>
        <a href="/admin/users/${esc(u.id)}/edit" class="btn-sm outline">แก้ไข</a>
        ${u.id !== currentUser.id ? `<form method="POST" action="/admin/users/${esc(u.id)}/delete" style="display:inline" onsubmit="return confirm('ลบ user นี้?')">
          <button type="submit" class="btn-sm secondary">ลบ</button>
        </form>` : ''}
      </td>
    </tr>`,
  ).join('');

  const content = `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem">
    <h2 style="margin:0">Users</h2>
    <a href="/admin/users/new">+ สร้าง User</a>
  </div>
  <table>
    <thead><tr><th>Username</th><th>Email</th><th>Role</th><th>Status</th><th>สร้างเมื่อ</th><th>Login ล่าสุด</th><th>Actions</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;

  return adminLayout('Users', content, currentUser, 'users', flash);
}

export function userFormPage(
  currentUser: User,
  editUser?: User,
  error?: string,
  csrfToken?: string,
): string {
  const isEdit = !!editUser;
  const title = isEdit ? `แก้ไข User: ${editUser!.username}` : 'สร้าง User ใหม่';

  const content = `
  <div style="display:flex;gap:1rem;align-items:center;margin-bottom:1.5rem">
    <a href="/admin/users" class="outline btn-sm">← กลับ</a>
    <h2 style="margin:0">${esc(title)}</h2>
  </div>
  ${error ? `<p style="color:#dc2626;background:#fee2e2;padding:0.75rem;border-radius:6px">${esc(error)}</p>` : ''}
  <article style="max-width:500px">
    <form method="POST" action="${isEdit ? `/admin/users/${editUser!.id}` : '/admin/users'}">
      <input type="hidden" name="_csrf" value="${esc(csrfToken ?? '')}">
      <label>Username<input type="text" name="username" value="${esc(editUser?.username ?? '')}" required ${isEdit ? 'readonly' : ''}></label>
      <label>Email<input type="email" name="email" value="${esc(editUser?.email ?? '')}" required></label>
      <label>Role
        <select name="role" required>
          ${(['admin','operator','viewer'] as const).map(r => `<option value="${r}" ${(editUser?.role ?? 'viewer') === r ? 'selected' : ''}>${r}</option>`).join('')}
        </select>
      </label>
      ${!isEdit ? `<label>รหัสผ่าน<input type="password" name="password" required minlength="8"></label>` : ''}
      ${isEdit ? `<label>
        <input type="checkbox" name="is_active" value="1" ${editUser!.is_active ? 'checked' : ''}> Active
      </label>` : ''}
      ${isEdit ? `<details><summary>เปลี่ยนรหัสผ่าน (ไม่บังคับ)</summary>
        <label>รหัสผ่านใหม่<input type="password" name="password" minlength="8"></label>
      </details>` : ''}
      <button type="submit">${isEdit ? 'บันทึก' : 'สร้าง User'}</button>
    </form>
  </article>`;

  return adminLayout(title, content, currentUser, 'users');
}

// ===== Profile page =====

export function profilePage(user: User, error?: string, success?: string, csrfToken?: string): string {
  const content = `
  <h2>โปรไฟล์ของฉัน</h2>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:2rem;max-width:800px">
    <article>
      <h3>ข้อมูลบัญชี</h3>
      <table class="kv-table">
        <tr><td>Username</td><td>${esc(user.username)}</td></tr>
        <tr><td>Email</td><td>${esc(user.email)}</td></tr>
        <tr><td>Role</td><td>${roleBadge(user.role)}</td></tr>
        <tr><td>Login ล่าสุด</td><td>${esc(formatDate(user.last_login_at))}</td></tr>
      </table>
    </article>
    <article>
      <h3>เปลี่ยนรหัสผ่าน</h3>
      ${error ? `<p style="color:#dc2626">${esc(error)}</p>` : ''}
      ${success ? `<p style="color:#16a34a">${esc(success)}</p>` : ''}
      <form method="POST" action="/admin/profile/password">
        <input type="hidden" name="_csrf" value="${esc(csrfToken ?? '')}">
        <label>รหัสผ่านปัจจุบัน<input type="password" name="current_password" required></label>
        <label>รหัสผ่านใหม่<input type="password" name="new_password" required minlength="8"></label>
        <label>ยืนยันรหัสผ่านใหม่<input type="password" name="confirm_password" required minlength="8"></label>
        <button type="submit">เปลี่ยนรหัสผ่าน</button>
      </form>
    </article>
  </div>`;
  return adminLayout('โปรไฟล์', content, user, '');
}

// ===== Webhooks page =====

export function webhooksPage(
  webhooks: (Webhook & { delivery_count?: number; last_delivery?: string })[],
  user: User,
  flash?: string,
): string {
  const rows = webhooks.map(w =>
    `<tr>
      <td><a href="/admin/webhooks/${esc(w.id)}">${esc(w.name)}</a></td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis">${esc(w.url)}</td>
      <td>${JSON.parse(w.events).join(', ')}</td>
      <td>${w.is_active ? '<span style="color:#16a34a">✓ เปิด</span>' : '<span style="color:#6b7280">✗ ปิด</span>'}</td>
      <td>${w.delivery_count ?? 0}</td>
      <td>
        <form method="POST" action="/admin/webhooks/${esc(w.id)}/toggle" style="display:inline">
          <button type="submit" class="btn-sm outline">${w.is_active ? 'ปิด' : 'เปิด'}</button>
        </form>
        <form method="POST" action="/admin/webhooks/${esc(w.id)}/delete" style="display:inline" onsubmit="return confirm('ลบ webhook นี้?')">
          <button type="submit" class="btn-sm secondary">ลบ</button>
        </form>
      </td>
    </tr>`,
  ).join('');

  const content = `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem">
    <h2 style="margin:0">Webhooks</h2>
    <a href="/admin/webhooks/new">+ สร้าง Webhook</a>
  </div>
  <table>
    <thead><tr><th>ชื่อ</th><th>URL</th><th>Events</th><th>Status</th><th>Deliveries</th><th>Actions</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;

  return adminLayout('Webhooks', content, user, 'webhooks', flash);
}

export function webhookFormPage(user: User, error?: string, csrfToken?: string): string {
  const events = ['submission.created', 'submission.completed', 'submission.failed'];
  const content = `
  <div style="display:flex;gap:1rem;align-items:center;margin-bottom:1.5rem">
    <a href="/admin/webhooks" class="outline btn-sm">← กลับ</a>
    <h2 style="margin:0">สร้าง Webhook</h2>
  </div>
  ${error ? `<p style="color:#dc2626;background:#fee2e2;padding:0.75rem;border-radius:6px">${esc(error)}</p>` : ''}
  <article style="max-width:600px">
    <form method="POST" action="/admin/webhooks">
      <input type="hidden" name="_csrf" value="${esc(csrfToken ?? '')}">
      <label>ชื่อ Webhook<input type="text" name="name" required placeholder="เช่น My CRM Webhook"></label>
      <label>URL<input type="url" name="url" required placeholder="https://..."></label>
      <fieldset>
        <legend>Events ที่ต้องการรับ</legend>
        ${events.map(e => `<label style="font-weight:normal"><input type="checkbox" name="events" value="${e}" checked> ${e}</label>`).join('')}
      </fieldset>
      <fieldset>
        <legend>Form Types (ไม่เลือก = ทุกประเภท)</legend>
        ${FORM_TYPES.map(t => `<label style="font-weight:normal"><input type="checkbox" name="form_types" value="${t}"> ${t}</label>`).join('')}
      </fieldset>
      <button type="submit">สร้าง Webhook</button>
    </form>
  </article>`;
  return adminLayout('สร้าง Webhook', content, user, 'webhooks');
}

export function webhookDetailPage(
  webhook: Webhook,
  deliveries: WebhookDelivery[],
  user: User,
  secretVisible: boolean,
  flash?: string,
): string {
  const deliveryRows = deliveries.map(d =>
    `<tr>
      <td>${statusBadge(d.status)}</td>
      <td>${esc(d.event_type)}</td>
      <td>${esc(formatDate(d.created_at))}</td>
      <td>${d.response_code ?? '—'}</td>
      <td>${d.attempt_count}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis">${esc(d.response_body?.slice(0, 100) ?? '—')}</td>
    </tr>`,
  ).join('');

  const content = `
  <div style="display:flex;gap:1rem;align-items:center;margin-bottom:1.5rem">
    <a href="/admin/webhooks" class="outline btn-sm">← กลับ</a>
    <h2 style="margin:0">${esc(webhook.name)}</h2>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem">
    <article>
      <table class="kv-table">
        <tr><td>URL</td><td style="word-break:break-all">${esc(webhook.url)}</td></tr>
        <tr><td>Events</td><td>${esc(JSON.parse(webhook.events).join(', '))}</td></tr>
        <tr><td>Form Types</td><td>${webhook.form_types ? esc(JSON.parse(webhook.form_types).join(', ')) : 'ทุกประเภท'}</td></tr>
        <tr><td>Status</td><td>${webhook.is_active ? '✓ เปิด' : '✗ ปิด'}</td></tr>
        <tr><td>Secret</td><td>
          ${secretVisible ? `<code>${esc(webhook.secret)}</code>` : '••••••••'}
        </td></tr>
      </table>
      <div style="display:flex;gap:0.5rem;margin-top:1rem">
        <form method="POST" action="/admin/webhooks/${esc(webhook.id)}/toggle">
          <button type="submit" class="outline btn-sm">${webhook.is_active ? 'ปิด' : 'เปิด'} Webhook</button>
        </form>
        <form method="POST" action="/admin/webhooks/${esc(webhook.id)}/test">
          <button type="submit" class="btn-sm">Test Webhook</button>
        </form>
      </div>
    </article>
    <article>
      <h4>Deliveries ล่าสุด</h4>
      <table>
        <thead><tr><th>Status</th><th>Event</th><th>เวลา</th><th>Code</th><th>Attempts</th><th>Response</th></tr></thead>
        <tbody>${deliveryRows || '<tr><td colspan="6" style="text-align:center">ยังไม่มี delivery</td></tr>'}</tbody>
      </table>
    </article>
  </div>`;

  return adminLayout(`Webhook: ${webhook.name}`, content, user, 'webhooks', flash);
}

// ===== Queue Status page =====

interface QueueRow {
  form_type: string;
  pending: number;
  dispatching: number;
  complete_24h: number;
  failed_24h: number;
  avg_duration_s: number | null;
}

export function queueStatusPage(rows: QueueRow[], user: User, flash?: string): string {
  // เติม form_type ที่ยังไม่มี record ใน D1
  const allTypes = new Set(FORM_TYPES as string[]);
  const existing = new Set(rows.map(r => r.form_type));
  const missing: QueueRow[] = [...allTypes]
    .filter(t => !existing.has(t))
    .map(t => ({ form_type: t, pending: 0, dispatching: 0, complete_24h: 0, failed_24h: 0, avg_duration_s: null }));

  const allRows = [...rows, ...missing].sort((a, b) => a.form_type.localeCompare(b.form_type));

  const tableRows = allRows.map(r => {
    const successRate = (r.complete_24h + r.failed_24h) > 0
      ? Math.round((r.complete_24h / (r.complete_24h + r.failed_24h)) * 100)
      : null;
    const hasProblem = r.failed_24h > 0 || r.pending > 500;
    return `<tr style="${hasProblem ? 'background:rgba(220,38,38,.04)' : ''}">
      <td><strong>${esc(r.form_type)}</strong></td>
      <td style="text-align:center">
        <code style="background:${r.pending > 0 ? '#fef3c7' : 'transparent'};padding:1px 6px;border-radius:4px">${r.pending}</code>
      </td>
      <td style="text-align:center">
        <code style="background:${r.dispatching > 0 ? '#dbeafe' : 'transparent'};padding:1px 6px;border-radius:4px">${r.dispatching}</code>
      </td>
      <td style="text-align:center;color:#16a34a">${r.complete_24h}</td>
      <td style="text-align:center;color:${r.failed_24h > 0 ? '#dc2626' : 'inherit'}">${r.failed_24h}</td>
      <td style="text-align:center">${successRate !== null ? successRate + '%' : '—'}</td>
      <td style="text-align:center">${r.avg_duration_s !== null ? r.avg_duration_s + 's' : '—'}</td>
      <td>
        <a href="/admin/submissions?form_type=${esc(r.form_type)}&status=pending" class="btn-sm outline">Pending</a>
        ${r.failed_24h > 0 ? `<a href="/admin/dispatched?form_type=${esc(r.form_type)}&status=failed" class="btn-sm" style="background:#dc2626;color:#fff;border:none">Failed</a>` : ''}
      </td>
    </tr>`;
  }).join('\n');

  // totals
  const totPending    = allRows.reduce((s, r) => s + r.pending, 0);
  const totDispatching = allRows.reduce((s, r) => s + r.dispatching, 0);
  const totComplete   = allRows.reduce((s, r) => s + r.complete_24h, 0);
  const totFailed     = allRows.reduce((s, r) => s + r.failed_24h, 0);

  const content = `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem">
    <h2 style="margin:0">Queue Status</h2>
    <small>สถิติ 24 ชั่วโมงล่าสุด · รีเฟรชทุก 30 วินาที</small>
  </div>
  <meta http-equiv="refresh" content="30">

  <div class="card-grid">
    <div class="stat-card"><div class="num" style="color:#d97706">${totPending}</div><div class="lbl">รอ (pending)</div></div>
    <div class="stat-card"><div class="num" style="color:#2563eb">${totDispatching}</div><div class="lbl">กำลังส่ง</div></div>
    <div class="stat-card"><div class="num" style="color:#16a34a">${totComplete}</div><div class="lbl">สำเร็จ (24h)</div></div>
    <div class="stat-card"><div class="num" style="color:#dc2626">${totFailed}</div><div class="lbl">ล้มเหลว (24h)</div></div>
  </div>

  <p style="font-size:0.85rem;color:#6b7280;margin-bottom:0.75rem">
    แต่ละ form type มี queue แยกอิสระ — backlog ของฟอร์มหนึ่งจะไม่กระทบฟอร์มอื่น
  </p>

  <div style="overflow-x:auto">
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
      <tr style="font-weight:600;border-top:2px solid var(--pico-muted-border-color)">
        <td>รวม</td>
        <td style="text-align:center">${totPending}</td>
        <td style="text-align:center">${totDispatching}</td>
        <td style="text-align:center">${totComplete}</td>
        <td style="text-align:center">${totFailed}</td>
        <td style="text-align:center">
          ${(totComplete + totFailed) > 0 ? Math.round((totComplete / (totComplete + totFailed)) * 100) + '%' : '—'}
        </td>
        <td></td>
        <td></td>
      </tr>
    </tfoot>
  </table>
  </div>

  <details style="margin-top:1.5rem">
    <summary style="cursor:pointer;font-size:0.9rem;color:#6b7280">Queue config (batch size / concurrency per form type)</summary>
    <table style="margin-top:0.75rem;font-size:0.8rem">
      <thead><tr><th>Form Type</th><th>Intake Batch</th><th>Intake Concurrency</th><th>Dispatch Batch</th><th>Dispatch Concurrency</th></tr></thead>
      <tbody>
        ${FORM_TYPES.map(t => {
          const q = FORMS_CONFIG[t].queue;
          return `<tr>
            <td>${esc(t)}</td>
            <td>${q.intakeConfig.maxBatchSize}</td>
            <td>${q.intakeConfig.maxConcurrency}</td>
            <td>${q.dispatchConfig.maxBatchSize}</td>
            <td>${q.dispatchConfig.maxConcurrency}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </details>`;

  return adminLayout('Queue Status', content, user, 'queues', flash);
}
