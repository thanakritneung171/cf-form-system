import { esc } from '../validators';
import { BASE_CSS } from './layout';

export function loginPage(error?: string, next?: string): string {
  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>เข้าสู่ระบบ — Form Admin</title>
  <style>
    ${BASE_CSS}
    body {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: var(--bg);
    }
    .login-wrap {
      width: 100%;
      max-width: 380px;
      padding: 1rem;
    }
    .login-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(28,25,23,.12);
      overflow: hidden;
    }
    .login-header {
      background: #1c1917;
      padding: 2rem 2rem 1.75rem;
      text-align: center;
    }
    .login-logo {
      font-size: 2rem;
      margin-bottom: 0.5rem;
    }
    .login-title {
      font-size: 1.15rem;
      font-weight: 700;
      color: #fbbf24;
    }
    .login-sub {
      font-size: 0.78rem;
      color: #78716c;
      margin-top: 4px;
    }
    .login-body {
      padding: 1.75rem 2rem 2rem;
    }
    .form-group { margin-bottom: 1.1rem; }
    label {
      display: block;
      font-size: 0.8rem;
      font-weight: 600;
      color: #44403c;
      margin-bottom: 0.35rem;
    }
    input {
      width: 100%;
      padding: 0.6rem 0.875rem;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: #faf7f4;
      color: var(--text);
      font-size: 0.9rem;
      transition: border-color .12s, box-shadow .12s;
    }
    input:focus {
      outline: none;
      border-color: #d97706;
      box-shadow: 0 0 0 3px rgba(217,119,6,.12);
      background: var(--bg-card);
    }
    .submit-btn {
      width: 100%;
      padding: 0.7rem 1rem;
      background: #1c1917;
      color: #fbbf24;
      border: none;
      border-radius: var(--radius-sm);
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      margin-top: 0.5rem;
      transition: background .12s;
    }
    .submit-btn:hover { background: #292524; }
    .error-box {
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #991b1b;
      padding: 0.65rem 0.875rem;
      border-radius: var(--radius-sm);
      font-size: 0.82rem;
      margin-bottom: 1.1rem;
    }
  </style>
</head>
<body>
  <div class="login-wrap">
    <div class="login-card">
      <div class="login-header">
        <div class="login-logo">⚡</div>
        <div class="login-title">Form Admin</div>
        <div class="login-sub">Cloudflare Workers · Form System</div>
      </div>
      <div class="login-body">
        ${error ? `<div class="error-box">⚠️ ${esc(error)}</div>` : ''}
        <form method="POST" action="/admin/login">
          <input type="hidden" name="next" value="${esc(next ?? '/admin/submissions')}">
          <div class="form-group">
            <label for="username">ชื่อผู้ใช้</label>
            <input type="text" id="username" name="username" required autocomplete="username" placeholder="admin">
          </div>
          <div class="form-group">
            <label for="password">รหัสผ่าน</label>
            <input type="password" id="password" name="password" required autocomplete="current-password" placeholder="••••••••">
          </div>
          <button type="submit" class="submit-btn">เข้าสู่ระบบ →</button>
        </form>
      </div>
    </div>
  </div>
</body>
</html>`;
}
