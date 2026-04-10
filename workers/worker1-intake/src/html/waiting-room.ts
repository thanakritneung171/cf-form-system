import { BASE_CSS } from './layout';
import { esc } from '../validators';

export interface WaitingRoomData {
  formType: string;
  position: number;
  activeCount: number;
  limit: number;
  retryAfter: number; // วินาที
}

export function waitingRoomPage(data?: WaitingRoomData): string {
  const hasData = !!data;
  const pct = hasData ? Math.min(100, Math.round((data!.activeCount / data!.limit) * 100)) : 100;
  const formTypeEncoded = hasData ? encodeURIComponent(data!.formType) : '';
  const formTypeEsc = hasData ? esc(data!.formType) : '';
  const pollInterval = hasData ? (data!.retryAfter * 1000) : 30000;
  const redirectTarget = hasData ? `/form/${formTypeEncoded}` : '/';

  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
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
      width: min(calc(100% - 2rem), 640px);
      text-align: center;
      overflow: hidden;
      word-break: break-word;
      box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 12px 48px rgba(127,99,21,0.1);
    }

    /* ── Icon ── */
    .icon-wrap {
      position: relative; width: 96px; height: 96px;
      margin: 0 auto 2.25rem;
    }
    .icon-ring {
      position: absolute; inset: 0; border-radius: 50%;
      border: 3px solid #f0e6c8;
    }
    .icon-spin {
      position: absolute; inset: 0; border-radius: 50%;
      border: 3px solid transparent;
      border-top-color: #fa520f;
      animation: spin 1.2s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .icon-face {
      position: absolute; inset: 10px; border-radius: 50%;
      background: linear-gradient(145deg, #fff5d6, #ffe090);
      display: flex; align-items: center; justify-content: center;
      font-size: 32px;
    }

    /* ── Text ── */
    .tag {
      display: inline-block;
      background: #fff3db; border: 1px solid #ffd06a; color: #c45a00;
      font-size: 11px; font-weight: 700; letter-spacing: 0.08em;
      text-transform: uppercase; border-radius: 999px;
      padding: 0.25rem 0.85rem; margin-bottom: 1.1rem;
    }
    h1 {
      font-size: 2rem; font-weight: 800; color: #1f1f1f;
      letter-spacing: -0.02em; line-height: 1.25; margin-bottom: 0.75rem;
    }
    .sub {
      font-size: 1rem; color: #8a6f3e; line-height: 1.9; margin-bottom: 2rem;
    }
    hr { border: none; border-top: 1px solid #f0e6c8; margin-bottom: 1.5rem; }

    /* ── Queue info ── */
    .queue-info {
      display: grid; grid-template-columns: 1fr 1fr;
      gap: 0.75rem; margin-bottom: 1.5rem;
    }
    .qi-box {
      background: #fdf8ec; border: 1px solid #e8d5a8; border-radius: 12px;
      padding: 0.75rem; text-align: center;
    }
    .qi-label { font-size: 11px; color: #b8a07a; text-transform: uppercase; letter-spacing: 0.06em; }
    .qi-value { font-size: 1.5rem; font-weight: 800; color: #1f1f1f; margin-top: 0.2rem; }

    /* ── Progress bar ── */
    .progress-wrap {
      background: #f0e6c8; border-radius: 999px; height: 8px;
      overflow: hidden; margin-bottom: 1.5rem;
    }
    .progress-bar {
      height: 100%; border-radius: 999px;
      background: linear-gradient(90deg, #ffa110, #fa520f);
      transition: width 0.5s ease;
    }

    /* ── Bottom row ── */
    .bottom-row {
      display: flex; align-items: center; justify-content: space-between;
      gap: 0.75rem; flex-wrap: wrap;
    }
    .refresh-row {
      display: flex; align-items: center; gap: 0.5rem;
      font-size: 14px; color: #b8a07a;
    }
    .refresh-row svg {
      width: 15px; height: 15px; flex-shrink: 0;
      animation: spin 4s linear infinite;
    }
    .dot-live {
      display: inline-block; width: 7px; height: 7px;
      border-radius: 50%; background: #fa520f;
      animation: blink 1.3s ease-in-out infinite;
    }
    @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.2} }
    .btn-exit {
      font-size: 13px; color: #b8a07a; border: 1px solid #e8d5a8;
      border-radius: 8px; padding: 0.3rem 0.85rem;
      background: none; cursor: pointer; text-decoration: none;
      transition: color .15s, border-color .15s;
    }
    .btn-exit:hover { color: #fa520f; border-color: #fa520f; }

    /* ── Dark mode ── */
    @media (prefers-color-scheme: dark) {
      html, body { background: #1a1209; }
      .topbar { background: rgba(26,18,9,0.9); border-bottom-color: #3a2c18; }
      .tb-name { color: #f5e6c8; }
      .card { background: #231a0d; border-color: #3a2c18; color: #f5e6c8; }
      .tag { background: #3a2200; border-color: #7a4a00; color: #ffa110; }
      h1 { color: #f5e6c8; }
      .sub { color: #c8a86b; }
      hr { border-top-color: #3a2c18; }
      .qi-box { background: #1a1209; border-color: #3a2c18; }
      .qi-value { color: #f5e6c8; }
      .progress-wrap { background: #3a2c18; }
      .refresh-row { color: #7a5830; }
      .btn-exit { color: #7a5830; border-color: #3a2c18; }
      .btn-exit:hover { color: #ffa110; border-color: #ffa110; }
    }

    /* ── Responsive ── */
    @media (max-width: 480px) {
      .topbar { height: 48px; padding: 0 1rem; }
      .card { border-radius: 20px; padding: 2rem 1.25rem 1.75rem; }
      .icon-wrap { width: 72px; height: 72px; margin-bottom: 1.5rem; }
      .icon-face { inset: 8px; font-size: 24px; }
      h1 { font-size: 1.4rem; }
      .sub { font-size: 0.875rem; }
      .qi-value { font-size: 1.25rem; }
    }
    @media (min-width: 769px) { body { padding-top: 54px; } }
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
      ขณะนี้มีผู้ใช้งานเต็มจำนวนแล้ว<br>
      ${hasData ? `ฟอร์ม <strong>${formTypeEsc}</strong> — ` : ''}ระบบจะพาคุณเข้าอัตโนมัติ<br>เมื่อมีที่ว่าง <strong>ห้ามปิดหน้านี้</strong>
    </p>

    ${hasData ? `
    <div class="queue-info">
      <div class="qi-box">
        <div class="qi-label">ลำดับคิวของคุณ</div>
        <div class="qi-value" id="pos">${data!.position}</div>
      </div>
      <div class="qi-box">
        <div class="qi-label">กำลังใช้งาน / สูงสุด</div>
        <div class="qi-value" id="occ">${data!.activeCount.toLocaleString()} / ${data!.limit.toLocaleString()}</div>
      </div>
    </div>
    <div class="progress-wrap">
      <div class="progress-bar" id="pbar" style="width:${pct}%"></div>
    </div>
    ` : ''}

    <hr>

    <div class="bottom-row">
      <div class="refresh-row">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
          <path d="M21 3v5h-5"/>
        </svg>
        <span id="status-txt">กำลังตรวจสอบทุก ${hasData ? data!.retryAfter : 30} วินาที…</span>
      </div>
      <a href="/" class="btn-exit">ออกจากคิว</a>
    </div>

  </div>

${hasData ? `
<script>
(function() {
  'use strict';
  var FORM_TYPE   = ${JSON.stringify(data!.formType)};
  var REDIRECT    = ${JSON.stringify(redirectTarget)};
  var ACQUIRE_INT = ${pollInterval};
  var POS_INT     = 2000;
  var statusTxt   = document.getElementById('status-txt');
  var posEl       = document.getElementById('pos');
  var occEl       = document.getElementById('occ');
  var pbar        = document.getElementById('pbar');
  var entering    = false;

  /* ── poll ตำแหน่งคิว (ทุก 2 วิ) ── */
  function pollPosition() {
    if (entering) return;
    fetch('/api/waiting-room/position?formType=' + encodeURIComponent(FORM_TYPE))
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (!d.inQueue) return; // ออกจากคิวแล้ว (หรือ not enabled) — รอ acquire
        if (posEl) posEl.textContent = d.position;
        if (occEl && d.activeCount !== undefined && d.limit) {
          occEl.textContent = d.activeCount.toLocaleString() + ' / ' + d.limit.toLocaleString();
        }
        if (pbar && d.activeCount !== undefined && d.limit) {
          var pct = Math.min(100, Math.round((d.activeCount / d.limit) * 100));
          pbar.style.width = pct + '%';
        }
      })
      .catch(function() {});
  }

  /* ── poll acquire slot (ทุก retryAfter วิ) ── */
  function pollAcquire() {
    if (entering) return;
    fetch('/api/waiting-room/acquire?formType=' + encodeURIComponent(FORM_TYPE))
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d.ok) {
          entering = true;
          if (statusTxt) statusTxt.textContent = 'กำลังเข้าสู่แบบฟอร์ม…';
          window.location.href = REDIRECT;
          return;
        }
        if (statusTxt) statusTxt.textContent = 'กำลังตรวจสอบทุก ${data!.retryAfter} วินาที…';
      })
      .catch(function() {});
  }

  setTimeout(pollAcquire, 1000);
  setInterval(pollPosition, POS_INT);
  setInterval(pollAcquire, ACQUIRE_INT);
})();
</script>
` : ''}

</body>
</html>`;
}
