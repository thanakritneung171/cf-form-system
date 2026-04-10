import type { User } from 'shared/types';
import { esc } from '../validators';
import { adminLayout, roleBadge, formatDate, paginationHtml } from './layout';

export function usersPage(
  users: User[],
  total: number,
  page: number,
  perPage: number,
  currentUser: User,
  csrfToken: string,
  flash?: string,
  createError?: string,
  openModal?: boolean,
): string {
  const totalPages = Math.ceil(total / perPage);

  const rows = users.map(u =>
    `<tr>
      <td>
        <div style="font-weight:400">${esc(u.username)}</div>
        <div style="font-size:0.75rem;color:var(--text-muted)">${esc(u.email)}</div>
      </td>
      <td>${roleBadge(u.role)}</td>
      <td>
        ${u.is_active
          ? '<span style="color:#7a4a00;font-size:13px">● Active</span>'
          : '<span style="color:#c8a86b;font-size:13px">○ Inactive</span>'}
      </td>
      <td style="font-size:0.78rem;color:var(--text-muted)">${esc(formatDate(u.created_at))}</td>
      <td style="font-size:0.78rem;color:var(--text-muted)">${esc(formatDate(u.last_login_at))}</td>
      <td>
        <div style="display:flex;gap:0.35rem">
          <a href="/admin/users/${esc(u.id)}/edit" class="btn btn-outline btn-xs">แก้ไข</a>
          ${u.id !== currentUser.id ? `<form method="POST" action="/admin/users/${esc(u.id)}/delete" style="margin:0" onsubmit="return confirm('ลบ user ${esc(u.username)} ?')">
            <button type="submit" class="btn btn-danger btn-xs">ลบ</button>
          </form>` : ''}
        </div>
      </td>
    </tr>`,
  ).join('');

  const content = `
  <style>
    .uf-modal-overlay {
      position: fixed; inset: 0;
      background: rgba(30,15,0,0.45);
      backdrop-filter: blur(2px);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 1rem;
    }
    .uf-modal-box {
      position: relative;
      background: var(--cream);
      border: 1px solid var(--amber-light);
      border-radius: 20px;
      padding: 2rem 2rem 1.75rem;
      width: 100%;
      max-width: 440px;
      box-shadow:
        rgba(127,99,21,0.18) -6px 14px 36px,
        rgba(127,99,21,0.13) -16px 32px 64px,
        rgba(127,99,21,0.08) -32px 64px 100px;
      animation: uf-modal-in .15s ease;
    }
    @keyframes uf-modal-in {
      from { opacity:0; transform: scale(.96) translateY(8px); }
      to   { opacity:1; transform: scale(1)  translateY(0);    }
    }
    .uf-modal-close {
      position: absolute;
      top: 0.9rem; right: 1rem;
      background: none; border: none;
      font-size: 20px; color: var(--text-muted);
      cursor: pointer; line-height: 1;
      padding: 0.2rem 0.4rem;
      border-radius: 6px;
      transition: color .1s, background .1s;
    }
    .uf-modal-close:hover { color: var(--black); background: rgba(0,0,0,0.06); }
    .uf-avatar {
      width: 44px; height: 44px;
      background: var(--orange);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 1rem;
    }
    .uf-card-title {
      font-size: 18px; font-weight: 600;
      color: var(--black); letter-spacing: -0.02em;
      margin-bottom: 0.2rem;
    }
    .uf-card-sub {
      font-size: 12px; color: var(--text-muted);
      margin-bottom: 1.5rem;
    }
    .uf-group { margin-bottom: 1rem; }
    .uf-group label {
      display: block; font-size: 10px;
      color: var(--text-muted); margin-bottom: 0.4rem;
      text-transform: uppercase; letter-spacing: .1em;
    }
    .uf-group input, .uf-group select {
      width: 100%; padding: 0.68rem 0.875rem;
      border: 1px solid var(--border-input);
      border-radius: 10px; background: var(--ivory);
      color: var(--black); font-size: 14px;
      font-family: Arial, ui-sans-serif, system-ui, sans-serif;
      transition: border-color .08s, box-shadow .08s, background .08s;
      box-sizing: border-box;
    }
    .uf-group input:hover, .uf-group select:hover { border-color: var(--amber-light); }
    .uf-group input:focus, .uf-group select:focus {
      outline: none; border-color: var(--orange);
      box-shadow: 0 0 0 2px rgba(250,82,15,0.13); background: #fff;
    }
    .uf-group input::placeholder { color: var(--text-light); font-size: 13px; }
    .uf-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
    .uf-divider {
      height: 2px;
      background: linear-gradient(to right, #ffd900, #ffe295, #ffa110, #ff8105, #fb6424, #fa520f);
      margin: 1.5rem 0 1.25rem; border-radius: 2px;
    }
    .uf-submit {
      width: 100%; padding: 0.875rem 1rem;
      background: var(--black); color: #fff;
      border: none; border-radius: 10px;
      font-size: 12px; font-family: Arial, ui-sans-serif, system-ui, sans-serif;
      cursor: pointer; letter-spacing: .12em; text-transform: uppercase;
      transition: background .08s;
    }
    .uf-submit:hover { background: #2e1a06; }
    .uf-submit:active { background: var(--orange); }
    .uf-error {
      background: #fff0e8; border: 1px solid var(--orange);
      border-left: 3px solid var(--orange); border-radius: 10px;
      color: #7a2000; padding: 0.65rem 0.875rem;
      font-size: 13px; margin-bottom: 1.25rem;
    }
  </style>

  <!-- Create User Modal -->
  <div id="uf-create-overlay" class="uf-modal-overlay" onclick="if(event.target===this)closeCreateModal()">
    <div class="uf-modal-box">
      <button class="uf-modal-close" type="button" onclick="closeCreateModal()" aria-label="ปิด">×</button>
      <div class="uf-avatar">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="8" r="3.5" stroke="#fff" stroke-width="1.5"/>
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#fff" stroke-width="1.5" stroke-linecap="square"/>
        </svg>
      </div>
      <div class="uf-card-title">บัญชีใหม่</div>
      <div class="uf-card-sub">กรอกข้อมูลเพื่อสร้างผู้ใช้งานใหม่</div>
      ${createError ? `<div class="uf-error">${esc(createError)}</div>` : ''}
      <form method="POST" action="/admin/users">
        <input type="hidden" name="_csrf" value="${esc(csrfToken)}">
        <div class="uf-row-2">
          <div class="uf-group">
            <label>Username</label>
            <input type="text" name="username" required placeholder="johndoe">
          </div>
          <div class="uf-group">
            <label>Role</label>
            <select name="role" required>
              <option value="viewer">viewer</option>
              <option value="operator">operator</option>
              <option value="admin">admin</option>
            </select>
          </div>
        </div>
        <div class="uf-group">
          <label>Email</label>
          <input type="email" name="email" required placeholder="example@domain.com">
        </div>
        <div class="uf-group">
          <label>รหัสผ่าน</label>
          <input type="password" name="password" required minlength="8" placeholder="อย่างน้อย 8 ตัวอักษร">
        </div>
        <div class="uf-divider"></div>
        <button type="submit" class="uf-submit">สร้าง User</button>
      </form>
    </div>
  </div>

  <div class="page-header">
    <div class="page-title">จัดการ Users</div>
    <button type="button" class="btn btn-primary btn-sm" onclick="openCreateModal()">+ สร้าง User</button>
  </div>
  <div class="table-wrap">
    <table>
      <thead><tr>
        <th>ผู้ใช้</th><th>Role</th><th>Status</th><th>สร้างเมื่อ</th><th>Login ล่าสุด</th><th>Actions</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  ${paginationHtml(page, totalPages, total, p => `?page=${p}`)}

  <script>
    function openCreateModal() {
      var el = document.getElementById('uf-create-overlay');
      el.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }
    function closeCreateModal() {
      var el = document.getElementById('uf-create-overlay');
      el.style.display = 'none';
      document.body.style.overflow = '';
    }
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeCreateModal();
    });
    ${openModal ? 'openCreateModal();' : ''}
  </script>`;

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
  <style>
    .uf-wrap {
      max-width: 440px;
      margin: 0 auto;
      padding: 0 1rem;
    }
    /* Back link row */
    .uf-back {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      margin-bottom: 1.75rem;
    }
    .uf-back a {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 13px;
      color: var(--text-muted);
      text-decoration: none;
      padding: 0.35rem 0.75rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      transition: border-color .1s, color .1s;
    }
    .uf-back a:hover { border-color: var(--amber); color: var(--black); text-decoration: none; }
    .uf-back-title {
      font-size: 22px;
      font-weight: 400;
      color: var(--black);
      letter-spacing: -0.03em;
    }
    /* Card */
    .uf-card {
      background: var(--cream);
      border: 1px solid var(--amber-light);
      border-radius: 20px;
      padding: 2rem 2rem 1.75rem;
      box-shadow:
        rgba(127,99,21,0.13) -6px 14px 36px,
        rgba(127,99,21,0.10) -16px 32px 64px,
        rgba(127,99,21,0.06) -32px 64px 100px;
    }
    /* Icon avatar */
    .uf-avatar {
      width: 44px; height: 44px;
      background: var(--orange);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 1rem;
    }
    .uf-card-title {
      font-size: 18px;
      font-weight: 600;
      color: var(--black);
      letter-spacing: -0.02em;
      margin-bottom: 0.2rem;
    }
    .uf-card-sub {
      font-size: 12px;
      color: var(--text-muted);
      margin-bottom: 1.5rem;
    }
    /* Fields */
    .uf-group { margin-bottom: 1rem; }
    .uf-group label {
      display: block;
      font-size: 10px;
      color: var(--text-muted);
      margin-bottom: 0.4rem;
      text-transform: uppercase;
      letter-spacing: .1em;
    }
    .uf-group input,
    .uf-group select {
      width: 100%;
      padding: 0.68rem 0.875rem;
      border: 1px solid var(--border-input);
      border-radius: 10px;
      background: var(--ivory);
      color: var(--black);
      font-size: 14px;
      font-family: Arial, ui-sans-serif, system-ui, sans-serif;
      transition: border-color .08s, box-shadow .08s, background .08s;
    }
    .uf-group input:hover,
    .uf-group select:hover { border-color: var(--amber-light); }
    .uf-group input:focus,
    .uf-group select:focus {
      outline: none;
      border-color: var(--orange);
      box-shadow: 0 0 0 2px rgba(250,82,15,0.13);
      background: #fff;
    }
    .uf-group input[readonly] {
      background: #f0ece6;
      cursor: not-allowed;
      color: var(--text-muted);
    }
    .uf-group input::placeholder { color: var(--text-light); font-size: 13px; }
    /* Two-col row for username + role */
    .uf-row-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
    }
    /* Active checkbox */
    .uf-check {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.65rem 0.875rem;
      border: 1px solid var(--border-input);
      border-radius: 10px;
      background: var(--ivory);
      cursor: pointer;
      margin-bottom: 1rem;
      transition: border-color .08s;
    }
    .uf-check:hover { border-color: var(--amber-light); }
    .uf-check input[type="checkbox"] {
      width: 15px; height: 15px;
      accent-color: var(--orange);
      cursor: pointer;
      flex-shrink: 0;
    }
    .uf-check-label {
      font-size: 13px;
      color: var(--black);
      cursor: pointer;
      user-select: none;
    }
    /* Change password accordion */
    .uf-details {
      margin-bottom: 1rem;
    }
    .uf-details summary {
      cursor: pointer;
      font-size: 12px;
      color: var(--text-muted);
      list-style: none;
      display: flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.5rem 0;
      border-top: 1px dashed var(--border);
      user-select: none;
    }
    .uf-details summary::before { content: '▸'; font-size: 10px; }
    .uf-details[open] summary::before { content: '▾'; }
    .uf-details[open] .uf-group { margin-top: 0.75rem; }
    /* Divider */
    .uf-divider {
      height: 2px;
      background: linear-gradient(to right, #ffd900, #ffe295, #ffa110, #ff8105, #fb6424, #fa520f);
      margin: 1.5rem 0 1.25rem;
      border-radius: 2px;
    }
    /* Submit */
    .uf-submit {
      width: 100%;
      padding: 0.875rem 1rem;
      background: var(--black);
      color: #fff;
      border: none;
      border-radius: 10px;
      font-size: 12px;
      font-family: Arial, ui-sans-serif, system-ui, sans-serif;
      cursor: pointer;
      letter-spacing: .12em;
      text-transform: uppercase;
      transition: background .08s;
    }
    .uf-submit:hover { background: #2e1a06; }
    .uf-submit:active { background: var(--orange); }
    /* Error */
    .uf-error {
      background: #fff0e8;
      border: 1px solid var(--orange);
      border-left: 3px solid var(--orange);
      border-radius: 10px;
      color: #7a2000;
      padding: 0.65rem 0.875rem;
      font-size: 13px;
      margin-bottom: 1.25rem;
    }
  </style>

  <div class="uf-wrap">

    <!-- Back + page title -->
    <div class="uf-back">
      <a href="/admin/users">← กลับ</a>
      <span class="uf-back-title">${esc(title)}</span>
    </div>

    <div class="uf-card">

      <!-- Avatar + heading -->
      <div class="uf-avatar">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="8" r="3.5" stroke="#fff" stroke-width="1.5"/>
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#fff" stroke-width="1.5" stroke-linecap="square"/>
        </svg>
      </div>
      <div class="uf-card-title">${isEdit ? `แก้ไข — ${editUser!.username}` : 'บัญชีใหม่'}</div>
      <div class="uf-card-sub">${isEdit ? 'แก้ไขข้อมูลและสิทธิ์การใช้งาน' : 'กรอกข้อมูลเพื่อสร้างผู้ใช้งานใหม่'}</div>

      ${error ? `<div class="uf-error">${esc(error)}</div>` : ''}

      <form method="POST" action="${isEdit ? `/admin/users/${editUser!.id}` : '/admin/users'}">
        <input type="hidden" name="_csrf" value="${esc(csrfToken ?? '')}">

        <!-- Username + Role in 2 cols -->
        <div class="uf-row-2">
          <div class="uf-group">
            <label>Username</label>
            <input type="text" name="username" value="${esc(editUser?.username ?? '')}" required
              placeholder="johndoe" ${isEdit ? 'readonly' : ''}>
          </div>
          <div class="uf-group">
            <label>Role</label>
            <select name="role" required>
              ${(['admin','operator','viewer'] as const).map(r =>
                `<option value="${r}" ${(editUser?.role ?? 'viewer') === r ? 'selected' : ''}>${r}</option>`
              ).join('')}
            </select>
          </div>
        </div>

        <div class="uf-group">
          <label>Email</label>
          <input type="email" name="email" value="${esc(editUser?.email ?? '')}" required
            placeholder="example@domain.com">
        </div>

        ${!isEdit ? `
        <div class="uf-group">
          <label>รหัสผ่าน</label>
          <input type="password" name="password" required minlength="8" placeholder="อย่างน้อย 8 ตัวอักษร">
        </div>` : ''}

        ${isEdit ? `
        <label class="uf-check" for="is_active">
          <input type="checkbox" name="is_active" value="1" id="is_active" ${editUser!.is_active ? 'checked' : ''}>
          <span class="uf-check-label">เปิดใช้งาน (Active)</span>
        </label>

        <details class="uf-details">
          <summary>เปลี่ยนรหัสผ่าน (ไม่บังคับ)</summary>
          <div class="uf-group">
            <label>รหัสผ่านใหม่</label>
            <input type="password" name="password" minlength="8" placeholder="อย่างน้อย 8 ตัวอักษร">
          </div>
        </details>` : ''}

        <div class="uf-divider"></div>
        <button type="submit" class="uf-submit">${isEdit ? 'บันทึกการเปลี่ยนแปลง' : 'สร้าง User'}</button>
      </form>

    </div>
  </div>`;

  return adminLayout(title, content, currentUser, 'users');
}

export function profilePage(user: User, error?: string, success?: string, csrfToken?: string): string {
  const content = `
  <div class="page-title" style="margin-bottom:1.25rem">โปรไฟล์ของฉัน</div>
  <div class="two-col">
    <div class="card">
      <div class="card-header">ข้อมูลบัญชี</div>
      <div class="card-body">
        <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.25rem">
          <div style="width:52px;height:52px;border-radius:50%;background:var(--orange);color:#fff;display:flex;align-items:center;justify-content:center;font-size:1.4rem;font-weight:400;flex-shrink:0">
            ${user.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style="font-size:1rem;font-weight:700">${esc(user.username)}</div>
            <div style="font-size:0.82rem;color:var(--text-muted)">${esc(user.email)}</div>
          </div>
        </div>
        <table class="kv-table" style="width:100%">
          <tr><td>Role</td><td>${roleBadge(user.role)}</td></tr>
          <tr><td>Login ล่าสุด</td><td>${esc(formatDate(user.last_login_at))}</td></tr>
        </table>
      </div>
    </div>
    <div class="card">
      <div class="card-header">เปลี่ยนรหัสผ่าน</div>
      <div class="card-body">
        ${error ? `<div class="alert alert-danger">${esc(error)}</div>` : ''}
        ${success ? `<div class="alert alert-success">${esc(success)}</div>` : ''}
        <form method="POST" action="/admin/profile/password">
          <input type="hidden" name="_csrf" value="${esc(csrfToken ?? '')}">
          <div class="form-group">
            <label>รหัสผ่านปัจจุบัน</label>
            <input type="password" name="current_password" required>
          </div>
          <div class="form-group">
            <label>รหัสผ่านใหม่</label>
            <input type="password" name="new_password" required minlength="8">
          </div>
          <div class="form-group">
            <label>ยืนยันรหัสผ่านใหม่</label>
            <input type="password" name="confirm_password" required minlength="8">
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%">เปลี่ยนรหัสผ่าน</button>
        </form>
      </div>
    </div>
  </div>`;

  return adminLayout('โปรไฟล์', content, user, '');
}
