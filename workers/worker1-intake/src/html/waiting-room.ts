import { BASE_CSS } from './layout';

export function waitingRoomPage(): string {
  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>กำลังรอ — Form System</title>
  <style>
    ${BASE_CSS}
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      min-height: 100vh;
      background: var(--ivory);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: Arial, ui-sans-serif, system-ui, sans-serif;
      word-break: break-word;
      overflow-wrap: break-word;
    }

    /* ── Topbar ── */
    .topbar {
      position: fixed; top: 0; left: 0; right: 0;
      height: 52px;
      background: var(--ivory);
      border-bottom: 2px solid var(--amber-light);
      display: flex; align-items: center;
      padding: 0 1.5rem; gap: 0.75rem;
      box-shadow: 0 2px 12px rgba(127,99,21,0.08);
      z-index: 10;
    }
    .tb-dots { display: flex; gap: 5px; }
    .tb-dots span {
      width: 10px; height: 10px; border-radius: 50%;
      display: inline-block;
    }
    .tb-name { font-size: 14px; color: var(--black); font-weight: 600; letter-spacing: 0.01em; }

    /* ── Card ── */
    .wr-card {
      background: #fff;
      border: 1px solid var(--border);
      border-radius: 20px;
      box-shadow: 0 6px 48px rgba(127,99,21,0.13);
      padding: 2.5rem 2rem;
      max-width: 400px;
      width: calc(100% - 2rem);
      text-align: center;
      margin: 72px auto 1.5rem;
    }

    /* ── Icon area ── */
    .wr-icon-wrap {
      width: 80px; height: 80px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--cream) 0%, #ffe8a0 100%);
      border: 2px solid var(--amber-light);
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 1.5rem;
      position: relative;
    }
    .wr-spinner {
      position: absolute; inset: -6px;
      border: 3px solid transparent;
      border-top-color: var(--orange);
      border-right-color: var(--amber);
      border-radius: 50%;
      animation: spin 1s cubic-bezier(0.4,0,0.6,1) infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .wr-icon-svg {
      font-size: 2rem;
      line-height: 1;
    }

    /* ── Typography ── */
    .wr-title {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--black);
      margin-bottom: 0.5rem;
      letter-spacing: -0.01em;
      line-height: 1.4;
    }
    .wr-sub {
      font-size: 0.85rem;
      color: var(--text-muted);
      line-height: 1.8;
      margin-bottom: 1.75rem;
    }

    /* ── Divider ── */
    .wr-divider {
      height: 1px;
      background: var(--border);
      margin: 0 -0.5rem 1.5rem;
    }

    /* ── Steps ── */
    .wr-steps {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      text-align: left;
    }
    .wr-step {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      font-size: 0.8rem;
      color: var(--text-muted);
      line-height: 1.5;
    }
    .wr-step-dot {
      flex-shrink: 0;
      width: 20px; height: 20px;
      border-radius: 50%;
      background: var(--cream);
      border: 1.5px solid var(--amber-light);
      display: flex; align-items: center; justify-content: center;
      font-size: 0.65rem;
      font-weight: 700;
      color: var(--orange);
      margin-top: 1px;
    }
    .wr-step-dot.active {
      background: var(--orange);
      border-color: var(--orange);
      color: #fff;
    }

    /* ── Footer note ── */
    .wr-note {
      margin-top: 1.5rem;
      font-size: 0.75rem;
      color: #b8a07a;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.35rem;
    }
    .wr-dot-blink {
      display: inline-block;
      width: 6px; height: 6px;
      border-radius: 50%;
      background: var(--orange);
      animation: blink 1.4s ease-in-out infinite;
    }
    @keyframes blink {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.2; }
    }
  </style>
</head>
<body>

  <div class="topbar">
    <div class="tb-dots">
      <span style="background:#ffd900"></span>
      <span style="background:#ffa110"></span>
      <span style="background:#fa520f"></span>
    </div>
    <span class="tb-name">Form System</span>
  </div>

  <div class="wr-card">

    <div class="wr-icon-wrap">
      <div class="wr-spinner"></div>
      <span class="wr-icon-svg">⏳</span>
    </div>

    <div class="wr-title">กรุณารอสักครู่</div>
    <div class="wr-sub">
      ระบบกำลังดำเนินการตรวจสอบ<br>
      โปรดอย่าปิดหรือรีเฟรชหน้าต่างนี้
    </div>

    <div class="wr-divider"></div>

    <div class="wr-steps">
      <div class="wr-step">
        <div class="wr-step-dot active">✓</div>
        <span>รับข้อมูลการสมัครเรียบร้อยแล้ว</span>
      </div>
      <div class="wr-step">
        <div class="wr-step-dot active">2</div>
        <span>กำลังตรวจสอบและประมวลผลข้อมูล…</span>
      </div>
      <div class="wr-step">
        <div class="wr-step-dot">3</div>
        <span>ยืนยันผลและแจ้งสถานะให้ทราบ</span>
      </div>
    </div>

    <div class="wr-note">
      <span class="wr-dot-blink"></span>
      ระบบกำลังทำงานอยู่เบื้องหลัง
    </div>

  </div>

</body>
</html>`;
}
