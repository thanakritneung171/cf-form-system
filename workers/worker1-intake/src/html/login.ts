import { esc } from '../validators';
import { BASE_CSS } from './layout';

export function loginPage(error?: string, next?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sign In — Form Admin</title>
  <style>
    ${BASE_CSS}

    body {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: linear-gradient(160deg, #fffaeb 0%, #fff4d0 100%);
    }

    .login-wrap {
      width: 100%;
      max-width: 440px;
      padding: 2rem 1.5rem;
    }

    /* ── Gradient identity bar ── */
    .login-blocks {
      display: flex;
      gap: 0;
      margin-bottom: 3rem;
    }
    .login-blocks span {
      display: block;
      height: 6px;
      flex: 1;
    }

    /* ── Avatar ── */
    .login-avatar {
      width: 52px;
      height: 52px;
      background: var(--orange);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1.25rem;
    }

    /* ── Title block (outside card) ── */
    .login-eyebrow {
      text-align: center;
      margin-bottom: 2.25rem;
    }
    .login-title {
      font-size: 56px;
      font-weight: 400;
      color: var(--black);
      letter-spacing: -1.5px;
      line-height: 1.0;
      text-transform: uppercase;
    }
    .login-sub {
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 10px;
      letter-spacing: .1em;
      text-transform: uppercase;
    }

    /* ── Card ── */
    .login-card {
      background: var(--cream);
      border: 1px solid var(--amber-light);
      border-radius: 20px;
      padding: 2.25rem 2.25rem 2rem;
      box-shadow:
        rgba(127,99,21,0.13)  -6px  14px  36px,
        rgba(127,99,21,0.10) -16px  32px  64px,
        rgba(127,99,21,0.07) -32px  64px 100px,
        rgba(127,99,21,0.04) -56px 112px 160px;
    }

    /* ── Form fields ── */
    .form-group { margin-bottom: 1.25rem; }

    label {
      display: block;
      font-size: 10px;
      font-weight: 400;
      color: var(--text-muted);
      margin-bottom: 0.45rem;
      text-transform: uppercase;
      letter-spacing: .1em;
    }

    .input-wrap { position: relative; }

    .input-icon {
      position: absolute;
      left: 0.875rem;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-light);
      pointer-events: none;
      display: flex;
    }

    input[type="text"],
    input[type="password"] {
      width: 100%;
      padding: 0.72rem 0.875rem 0.72rem 2.625rem;
      border: 1px solid var(--border-input);
      border-radius: 10px;
      background: var(--ivory);
      color: var(--black);
      font-size: 14px;
      font-weight: 400;
      font-family: Arial, ui-sans-serif, system-ui, sans-serif;
      transition: border-color .08s, box-shadow .08s, background .08s;
    }
    input[type="text"]:hover,
    input[type="password"]:hover {
      border-color: var(--amber-light);
    }
    input[type="text"]:focus,
    input[type="password"]:focus {
      outline: none;
      border-color: var(--orange);
      box-shadow: 0 0 0 2px rgba(250,82,15,0.13);
      background: #fff;
    }
    input::placeholder { color: var(--text-light); }

    /* ── Gradient divider ── */
    .form-divider {
      height: 2px;
      background: linear-gradient(to right,
        #ffd900, #ffe295, #ffa110, #ff8105, #fb6424, #fa520f);
      margin: 1.75rem 0 1.5rem;
    }

    /* ── Submit button ── */
    .submit-btn {
      width: 100%;
      padding: 0.9rem 1rem;
      background: var(--black);
      color: #fff;
      border: none;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 400;
      font-family: Arial, ui-sans-serif, system-ui, sans-serif;
      cursor: pointer;
      letter-spacing: .14em;
      text-transform: uppercase;
      transition: background .08s;
    }
    .submit-btn:hover { background: #2e1a06; }
    .submit-btn:active { background: var(--orange); }

    /* ── Error state ── */
    .error-box {
      background: #fff0e8;
      border: 1px solid var(--orange);
      border-left: 3px solid var(--orange);
      border-radius: 10px;
      color: #7a2000;
      padding: 0.7rem 0.875rem;
      font-size: 13px;
      margin-bottom: 1.25rem;
    }

    /* ── Footer label ── */
    .login-footer {
      margin-top: 1.75rem;
      text-align: center;
      font-size: 11px;
      color: var(--text-light);
      letter-spacing: .06em;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  <div class="login-wrap">

    <!-- Identity gradient bar -->
    <div class="login-blocks">
      <span style="background:#ffd900"></span>
      <span style="background:#ffe295"></span>
      <span style="background:#ffa110"></span>
      <span style="background:#ff8105"></span>
      <span style="background:#fb6424"></span>
      <span style="background:#fa520f"></span>
    </div>

    <!-- Avatar + title (above card) -->
    <div class="login-eyebrow">
      <div class="login-avatar">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="8" r="3.5" stroke="#fff" stroke-width="1.5"/>
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#fff" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter"/>
        </svg>
      </div>
      <div class="login-title">Sign In</div>
      <div class="login-sub">Secure access to your system</div>
    </div>

    <!-- Card -->
    <div class="login-card">
      ${error ? `<div class="error-box">${esc(error)}</div>` : ''}

      <form method="POST" action="/admin/login">
        <input type="hidden" name="next" value="${esc(next ?? '/admin/submissions')}">

        <div class="form-group">
          <label for="username">Username</label>
          <div class="input-wrap">
            <span class="input-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="8" r="3.5" stroke="currentColor" stroke-width="1.5"/>
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="square"/>
              </svg>
            </span>
            <input type="text" id="username" name="username"
              required autocomplete="username" placeholder="admin">
          </div>
        </div>

        <div class="form-group">
          <label for="password">Password</label>
          <div class="input-wrap">
            <span class="input-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <rect x="5" y="11" width="14" height="10" stroke="currentColor" stroke-width="1.5"/>
                <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="square"/>
              </svg>
            </span>
            <input type="password" id="password" name="password"
              required autocomplete="current-password" placeholder="••••••••">
          </div>
        </div>

        <div class="form-divider"></div>

        <button type="submit" class="submit-btn">Enter System</button>
      </form>
    </div>

    <div class="login-footer">Form Admin &nbsp;·&nbsp; Cloudflare Workers</div>

  </div>
</body>
</html>`;
}
