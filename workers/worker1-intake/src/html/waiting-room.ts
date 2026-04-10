import { BASE_CSS } from './layout';

export function waitingRoomPage(): string {
  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="refresh" content="30">
  <title>ผู้เข้าใช้เต็ม — Form System</title>
  <style>
    ${BASE_CSS}
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    html, body {
      min-height: 100vh;
      background: #fdf8ec;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: Arial, ui-sans-serif, system-ui, sans-serif;
    }

    /* ── Topbar ── */
    .topbar {
      position: fixed; top: 0; left: 0; right: 0; z-index: 100;
      height: 54px;
      background: rgba(253,248,236,0.9);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid #e8d5a8;
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 1.5rem;
    }
    .tb-left { display: flex; align-items: center; gap: 0.6rem; }
    .tb-dots { display: flex; gap: 5px; }
    .tb-dots span { width: 10px; height: 10px; border-radius: 50%; display: block; }
    .tb-name { font-size: 13px; font-weight: 700; color: #1f1f1f; }

    /* ── Card ── */
    .card {
      background: #ffffff;
      border: 1px solid #e8d5a8;
      border-radius: 32px;
      padding: clamp(2.5rem, 7vw, 5rem) clamp(2rem, 7vw, 4.5rem);
      width: calc(100% - -4rem);
      max-width: 640px;
      text-align: center;
      overflow: hidden;
      word-break: break-word;
      overflow-wrap: break-word;
      box-shadow:
        0 1px 2px rgba(0,0,0,0.04),
        0 12px 48px rgba(127,99,21,0.1);
    }

    /* ── Icon ── */
    .icon-wrap {
      position: relative;
      width: 96px; height: 96px;
      margin: 0 auto 2.25rem;
    }
    .icon-ring {
      position: absolute; inset: 0;
      border-radius: 50%;
      border: 3px solid #f0e6c8;
    }
    .icon-spin {
      position: absolute; inset: 0;
      border-radius: 50%;
      border: 3px solid transparent;
      border-top-color: #fa520f;
      animation: spin 1.2s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .icon-face {
      position: absolute;
      inset: 10px;
      border-radius: 50%;
      background: linear-gradient(145deg, #fff5d6, #ffe090);
      display: flex; align-items: center; justify-content: center;
      font-size: 32px;
    }

    /* ── Text ── */
    .tag {
      display: inline-block;
      background: #fff3db;
      border: 1px solid #ffd06a;
      color: #c45a00;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      border-radius: 999px;
      padding: 0.25rem 0.85rem;
      margin-bottom: 1.1rem;
    }

    h1 {
      font-size: 2rem;
      font-weight: 800;
      color: #1f1f1f;
      letter-spacing: -0.02em;
      line-height: 1.25;
      margin-bottom: 0.75rem;
    }

    .sub {
      font-size: 1rem;
      color: #8a6f3e;
      line-height: 1.9;
      margin-bottom: 2.25rem;
    }

    /* ── Divider ── */
    hr {
      border: none;
      border-top: 1px solid #f0e6c8;
      margin-bottom: 1.5rem;
    }

    /* ── Refresh row ── */
    .refresh-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      font-size: 14px;
      color: #b8a07a;
    }
    .refresh-row svg {
      width: 15px; height: 15px; flex-shrink: 0;
      animation: spin 4s linear infinite;
    }
    .dot-live {
      display: inline-block;
      width: 7px; height: 7px;
      border-radius: 50%;
      background: #fa520f;
      animation: blink 1.3s ease-in-out infinite;
    }
    @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.2} }

    /* ── Responsive ── */
    @media (max-width: 480px) {
      .topbar { height: 48px; padding: 0 1rem; }
      .tb-dots span { width: 8px; height: 8px; }
      .tb-name { font-size: 12px; }

      .card {
        width: calc(100% - -4rem);
        border-radius: 20px;
        padding: 2rem 1.25rem 1.75rem;
      }

      .icon-wrap { width: 72px; height: 72px; margin-bottom: 1.5rem; }
      .icon-face { inset: 8px; font-size: 24px; }

      h1 { font-size: 1.4rem; }
      .sub { font-size: 0.875rem; line-height: 1.8; margin-bottom: 1.75rem; }
      .refresh-row { font-size: 12px; }
      .refresh-row svg { width: 13px; height: 13px; }
    }

    @media (min-width: 481px) and (max-width: 768px) {
      .card { padding: 3rem 2.5rem; }
      h1 { font-size: 1.75rem; }
    }

    @media (min-width: 769px) {
      body { padding-top: 54px; }
    }
  </style>
</head>
<body>

  <div class="topbar">
    <div class="tb-left">
      <div class="tb-dots">
        <span style="background:#ffd900"></span>
        <span style="background:#ffa110"></span>
        <span style="background:#fa520f"></span>
      </div>
      <span class="tb-name">Form System</span>
    </div>
    <span class="dot-live"></span>
  </div>

  <div class="card">

    <div class="icon-wrap">
      <div class="icon-ring"></div>
      <div class="icon-spin"></div>
      <div class="icon-face">🚦</div>
    </div>

    <div class="tag">ระบบยุ่ง</div>

    <h1>ผู้เข้าใช้เต็ม<br>กรุณารอสักครู่</h1>

    <p class="sub">
      ขณะนี้มีผู้ใช้งานเต็มแล้ว<br>
      ระบบจะพาคุณเข้าหน้าหลักอัตโนมัติ<br>
      เมื่อมีที่ว่าง — <strong>ห้ามปิดหน้านี้</strong>
    </p>

    <hr>

    <div class="refresh-row">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
           stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
        <path d="M21 3v5h-5"/>
      </svg>
      อัปเดตอัตโนมัติทุก 30 วินาที
    </div>

  </div>

</body>
</html>`;
}
