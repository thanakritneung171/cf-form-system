import type { User } from 'shared/types';
import { esc } from '../validators';
import { adminLayout, roleBadge, formatDate } from './layout';

export function usersPage(users: User[], currentUser: User, flash?: string): string {
  const rows = users.map(u =>
    `<tr>
      <td>
        <div style="font-weight:600">${esc(u.username)}</div>
        <div style="font-size:0.75rem;color:var(--text-muted)">${esc(u.email)}</div>
      </td>
      <td>${roleBadge(u.role)}</td>
      <td>
        ${u.is_active
          ? '<span style="color:#16a34a;font-size:0.82rem;font-weight:500">● Active</span>'
          : '<span style="color:#78716c;font-size:0.82rem;font-weight:500">○ Inactive</span>'}
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
  </div>`;

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
  <div class="page-header">
    <div style="display:flex;align-items:center;gap:1rem">
      <a href="/admin/users" class="btn btn-outline btn-sm">← กลับ</a>
      <div class="page-title">${esc(title)}</div>
    </div>
  </div>
  ${error ? `<div class="alert alert-danger">${esc(error)}</div>` : ''}
  <div class="card" style="max-width:520px">
    <div class="card-body">
      <form method="POST" action="${isEdit ? `/admin/users/${editUser!.id}` : '/admin/users'}">
        <input type="hidden" name="_csrf" value="${esc(csrfToken ?? '')}">
        <div class="form-group">
          <label>Username</label>
          <input type="text" name="username" value="${esc(editUser?.username ?? '')}" required ${isEdit ? 'readonly style="background:#f0ece6;cursor:not-allowed"' : ''}>
        </div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" name="email" value="${esc(editUser?.email ?? '')}" required>
        </div>
        <div class="form-group">
          <label>Role</label>
          <select name="role" required>
            ${(['admin','operator','viewer'] as const).map(r =>
              `<option value="${r}" ${(editUser?.role ?? 'viewer') === r ? 'selected' : ''}>${r}</option>`
            ).join('')}
          </select>
        </div>
        ${!isEdit ? `<div class="form-group">
          <label>รหัสผ่าน</label>
          <input type="password" name="password" required minlength="8" placeholder="อย่างน้อย 8 ตัวอักษร">
        </div>` : ''}
        ${isEdit ? `<div class="form-group" style="display:flex;align-items:center;gap:0.5rem">
          <input type="checkbox" name="is_active" value="1" id="is_active" ${editUser!.is_active ? 'checked' : ''} style="width:auto">
          <label for="is_active" style="margin:0;font-weight:500">Active</label>
        </div>` : ''}
        ${isEdit ? `<details style="margin-bottom:1rem">
          <summary style="cursor:pointer;font-size:0.82rem;color:var(--text-muted)">เปลี่ยนรหัสผ่าน (ไม่บังคับ)</summary>
          <div class="form-group" style="margin-top:0.75rem">
            <label>รหัสผ่านใหม่</label>
            <input type="password" name="password" minlength="8" placeholder="อย่างน้อย 8 ตัวอักษร">
          </div>
        </details>` : ''}
        <button type="submit" class="btn btn-primary" style="width:100%">${isEdit ? 'บันทึกการเปลี่ยนแปลง' : 'สร้าง User'}</button>
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
          <div style="width:52px;height:52px;border-radius:50%;background:#1c1917;color:#fbbf24;display:flex;align-items:center;justify-content:center;font-size:1.4rem;font-weight:700;flex-shrink:0">
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
