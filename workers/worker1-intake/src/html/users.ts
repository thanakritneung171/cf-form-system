import type { User } from 'shared/types';
import { esc } from '../validators';
import { adminLayout, roleBadge, formatDate, paginationHtml } from './layout';

export function usersPage(
  users: User[],
  total: number,
  page: number,
  perPage: number,
  currentUser: User,
  flash?: string,
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
  <div class="page-header">
    <div class="page-title">จัดการ Users</div>
    <a href="/admin/users/new" class="btn btn-primary btn-sm">+ สร้าง User</a>
  </div>
  <div class="table-wrap">
    <table>
      <thead><tr>
        <th>ผู้ใช้</th><th>Role</th><th>Status</th><th>สร้างเมื่อ</th><th>Login ล่าสุด</th><th>Actions</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  ${paginationHtml(page, totalPages, total, p => `?page=${p}`)}`;

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
    .user-form-wrap {
      max-width: 480px;
      margin: 0 auto;
    }
    .user-form-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.75rem;
    }
    .user-form-card {
      background: #fff;
      border: 1px solid var(--border);
      border-radius: 20px;
      box-shadow: var(--shadow-card);
      overflow: hidden;
    }
    .user-form-card-header {
      padding: 1.25rem 1.75rem 0;
      border-bottom: 1px solid var(--border);
      padding-bottom: 1rem;
      margin-bottom: 1.5rem;
    }
    .user-form-card-title {
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--black);
      letter-spacing: -0.02em;
    }
    .user-form-card-sub {
      font-size: 0.8rem;
      color: var(--text-muted);
      margin-top: 2px;
    }
    .user-form-body {
      padding: 0 1.75rem 1.75rem;
    }
    .user-form-divider {
      height: 2px;
      background: linear-gradient(to right, #ffd900, #ffe295, #ffa110, #ff8105, #fb6424, #fa520f);
      margin: 1.25rem 0;
      border-radius: 2px;
    }
    .uf-group {
      margin-bottom: 1.1rem;
    }
    .uf-group label {
      display: block;
      font-size: 10px;
      font-weight: 400;
      color: var(--text-muted);
      margin-bottom: 0.4rem;
      text-transform: uppercase;
      letter-spacing: .1em;
    }
    .uf-group input,
    .uf-group select {
      width: 100%;
      padding: 0.65rem 0.875rem;
      border: 1px solid var(--border-input);
      border-radius: 10px;
      background: var(--ivory);
      color: var(--black);
      font-size: 14px;
      font-family: Arial, ui-sans-serif, system-ui, sans-serif;
      transition: border-color .08s, box-shadow .08s, background .08s;
    }
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
    .uf-check {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      margin-bottom: 1.1rem;
    }
    .uf-check input[type="checkbox"] {
      width: 16px; height: 16px;
      accent-color: var(--orange);
      cursor: pointer;
    }
    .uf-check label {
      margin: 0;
      font-size: 13px;
      color: var(--black);
      cursor: pointer;
      text-transform: none;
      letter-spacing: 0;
    }
    .uf-details summary {
      cursor: pointer;
      font-size: 0.82rem;
      color: var(--text-muted);
      margin-bottom: 0.75rem;
      list-style: none;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
    .uf-details summary::before { content: '▸'; }
    .uf-details[open] summary::before { content: '▾'; }
    .btn-submit {
      width: 100%;
      padding: 0.85rem 1rem;
      background: var(--black);
      color: #fff;
      border: none;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 400;
      font-family: Arial, ui-sans-serif, system-ui, sans-serif;
      cursor: pointer;
      letter-spacing: .1em;
      text-transform: uppercase;
      transition: background .08s;
      margin-top: 0.25rem;
    }
    .btn-submit:hover { background: #2e1a06; }
    .btn-submit:active { background: var(--orange); }
  </style>

  <div class="user-form-wrap">

    <div class="user-form-header">
      <a href="/admin/users" class="btn btn-outline btn-sm">← กลับ</a>
      <div class="page-title">${esc(title)}</div>
    </div>

    ${error ? `<div class="alert alert-danger" style="margin-bottom:1rem">${esc(error)}</div>` : ''}

    <div class="user-form-card">
      <div class="user-form-card-header">
        <div class="user-form-card-title">${isEdit ? 'แก้ไขข้อมูลผู้ใช้' : 'ข้อมูลผู้ใช้ใหม่'}</div>
        <div class="user-form-card-sub">${isEdit ? `แก้ไขข้อมูลของ ${editUser!.username}` : 'กรอกข้อมูลเพื่อสร้างบัญชีใหม่'}</div>
      </div>
      <div class="user-form-body">
        <form method="POST" action="${isEdit ? `/admin/users/${editUser!.id}` : '/admin/users'}">
          <input type="hidden" name="_csrf" value="${esc(csrfToken ?? '')}">

          <div class="uf-group">
            <label>Username</label>
            <input type="text" name="username" value="${esc(editUser?.username ?? '')}" required placeholder="เช่น johndoe" ${isEdit ? 'readonly' : ''}>
          </div>

          <div class="uf-group">
            <label>Email</label>
            <input type="email" name="email" value="${esc(editUser?.email ?? '')}" required placeholder="example@domain.com">
          </div>

          <div class="uf-group">
            <label>Role</label>
            <select name="role" required>
              ${(['admin','operator','viewer'] as const).map(r =>
                `<option value="${r}" ${(editUser?.role ?? 'viewer') === r ? 'selected' : ''}>${r}</option>`
              ).join('')}
            </select>
          </div>

          ${!isEdit ? `
          <div class="uf-group">
            <label>รหัสผ่าน</label>
            <input type="password" name="password" required minlength="8" placeholder="อย่างน้อย 8 ตัวอักษร">
          </div>` : ''}

          ${isEdit ? `
          <div class="uf-check">
            <input type="checkbox" name="is_active" value="1" id="is_active" ${editUser!.is_active ? 'checked' : ''}>
            <label for="is_active">เปิดใช้งาน (Active)</label>
          </div>

          <details class="uf-details" style="margin-bottom:1.1rem">
            <summary>เปลี่ยนรหัสผ่าน (ไม่บังคับ)</summary>
            <div class="uf-group">
              <label>รหัสผ่านใหม่</label>
              <input type="password" name="password" minlength="8" placeholder="อย่างน้อย 8 ตัวอักษร">
            </div>
          </details>` : ''}

          <div class="user-form-divider"></div>

          <button type="submit" class="btn-submit">${isEdit ? 'บันทึกการเปลี่ยนแปลง' : 'สร้าง User'}</button>
        </form>
      </div>
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
