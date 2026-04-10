import type { User } from 'shared/types';
import { esc } from '../validators';

// ===== Color constants =====

export const STATUS_COLORS: Record<string, string> = {
  pending: '#ffa110',
  dispatching: '#ff8105',
  complete: '#7a6030',
  failed: '#fa520f',
};

export const STATUS_LABELS: Record<string, string> = {
  pending: 'รอดำเนินการ',
  dispatching: 'กำลังส่ง',
  complete: 'สำเร็จ',
  failed: 'ล้มเหลว',
};

// ===== Shared helpers =====

export function statusBadge(status: string): string {
  const styleMap: Record<string, string> = {
    pending:     'background:#fff0c2;color:#92400e;border:1px solid #ffa110',
    dispatching: 'background:#ffe295;color:#7a4a00;border:1px solid #ff8105',
    complete:    'background:#f5ead5;color:#5a4020;border:1px solid #c8a86b',
    failed:      'background:#fa520f;color:#fff;border:1px solid #fa520f',
  };
  const style = styleMap[status] ?? 'background:#fff0c2;color:#92400e;border:1px solid #ffa110';
  const label = STATUS_LABELS[status] ?? status;
  return `<span class="badge" style="${style}">${esc(label)}</span>`;
}

export function roleBadge(role: string): string {
  const styleMap: Record<string, string> = {
    admin:    'background:#fa520f;color:#fff;border:1px solid #fa520f',
    operator: 'background:#ffa110;color:#1f1f1f;border:1px solid #ffa110',
    viewer:   'background:#fff0c2;color:#92400e;border:1px solid #ffd06a',
  };
  const style = styleMap[role] ?? 'background:#fff0c2;color:#92400e;border:1px solid #ffd06a';
  return `<span class="badge" style="${style}">${esc(role)}</span>`;
}

export function formatDate(ts: number | null | undefined): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
}

export function shortId(id: string): string {
  return id.slice(0, 8) + '…';
}

// ===== Base CSS (shared across all pages) =====

export const BASE_CSS = `
  :root {
    /* Mistral warm palette */
    --ivory:        #fffaeb;
    --cream:        #fff0c2;
    --amber-light:  #ffd06a;
    --amber:        #ffa110;
    --amber-deep:   #ff8a00;
    --orange:       #fa520f;
    --flame:        #fb6424;
    --black:        #1f1f1f;
    --text:         #1f1f1f;
    --text-muted:   #6b4f2a;
    --text-light:   #a07840;
    --border:       #e8d5a8;
    --border-input: hsl(240,5.9%,90%);
    --shadow-warm:  rgba(127,99,21,0.14) -4px 8px 24px,
                    rgba(127,99,21,0.09) -12px 24px 48px,
                    rgba(127,99,21,0.05) -24px 48px 80px;
    --shadow-card:  rgba(127,99,21,0.12) -8px 16px 39px,
                    rgba(127,99,21,0.10) -16px 32px 56px,
                    rgba(127,99,21,0.06) -32px 64px 88px;
    /* compat aliases for legacy inline styles */
    --bg:           #fffaeb;
    --bg-card:      #ffffff;
    --radius:       12px;
    --radius-sm:    8px;
    --primary:      #fa520f;
    --primary-hover: #fb6424;
    --danger:       #fa520f;
    --danger-bg:    #fff0e8;
    --success:      #7a6030;
    --success-bg:   #f5ead5;
    --warning:      #ffa110;
    --warning-bg:   #fff0c2;
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { font-size: 15px; }
  body {
    font-family: Arial, ui-sans-serif, system-ui, sans-serif;
    background: var(--ivory);
    color: var(--text);
    line-height: 1.6;
    font-weight: 400;
    -webkit-font-smoothing: antialiased;
  }
  a { color: var(--orange); text-decoration: none; }
  a:hover { text-decoration: underline; }
  code {
    font-family: ui-monospace, 'Cascadia Code', monospace;
    font-size: 0.85em;
    background: var(--cream);
    padding: 1px 6px;
    border-radius: 4px;
    color: #7a4010;
    border: 1px solid var(--amber-light);
  }
  pre {
    background: var(--cream);
    border: 1px solid var(--amber-light);
    padding: 0.75rem 1rem;
    overflow: auto;
    font-size: 0.8rem;
    color: #7a4010;
    border-radius: 10px;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 10px;
    border-radius: 6px;
    font-size: 0.72rem;
    font-weight: 400;
    letter-spacing: .04em;
    text-transform: uppercase;
  }
`;

export const ADMIN_CSS = `
  ${BASE_CSS}

  /* ===== TOP NAV ===== */
  .topnav {
    position: sticky;
    top: 0;
    z-index: 100;
    background: var(--ivory);
    border-bottom: 2px solid var(--amber-light);
    box-shadow: 0 2px 16px rgba(127,99,21,0.10);
    border-radius: 0 0 16px 16px;
  }
  .topnav-inner {
    max-width: 1440px;
    margin: 0 auto;
    padding: 0 2rem;
    display: flex;
    align-items: center;
    gap: 0;
    height: 56px;
  }
  .nav-brand {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-right: 2.5rem;
    text-decoration: none;
    flex-shrink: 0;
  }
  .nav-brand-blocks {
    display: flex;
    gap: 2px;
    height: 20px;
    align-items: center;
  }
  .nav-brand-blocks span {
    display: block;
    width: 7px;
    height: 100%;
  }
  .nav-brand-text {
    font-size: 15px;
    font-weight: 400;
    color: var(--black);
    letter-spacing: -0.02em;
  }
  .nav-brand-sub {
    font-size: 11px;
    color: var(--text-muted);
    letter-spacing: 0;
    margin-left: 2px;
  }
  .nav-links {
    display: flex;
    align-items: stretch;
    gap: 0;
    flex: 1;
    height: 100%;
  }
  .nav-links a {
    display: flex;
    align-items: center;
    padding: 0 1.1rem;
    font-size: 14px;
    font-weight: 400;
    color: var(--text-muted);
    text-decoration: none;
    border-bottom: 3px solid transparent;
    margin-bottom: -2px;
    transition: color .12s, border-color .12s;
    white-space: nowrap;
    letter-spacing: 0.01em;
  }
  .nav-links a:hover { color: var(--black); border-bottom-color: var(--amber); }
  .nav-links a.active { color: var(--orange); border-bottom-color: var(--orange); }
  .nav-right {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-left: auto;
    flex-shrink: 0;
  }
  .nav-search {
    display: flex;
    align-items: center;
    background: var(--cream);
    border: 1px solid var(--amber-light);
    border-radius: 8px;
    padding: 0 0.75rem;
    gap: 0.4rem;
    height: 34px;
  }
  .nav-search input {
    background: transparent;
    border: none;
    outline: none;
    font-size: 13px;
    color: var(--text);
    width: 160px;
    font-weight: 400;
  }
  .nav-search input::placeholder { color: var(--text-light); }
  .nav-user {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0 0.75rem;
    height: 34px;
    background: var(--cream);
    border: 1px solid var(--amber-light);
    border-radius: 8px;
    cursor: pointer;
    text-decoration: none;
  }
  .nav-avatar {
    width: 24px; height: 24px;
    background: var(--orange);
    color: #fff;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px;
    font-weight: 400;
    flex-shrink: 0;
  }
  .nav-username { font-size: 13px; color: var(--black); }
  .nav-user-role { font-size: 11px; color: var(--text-muted); }
  .nav-logout-form { margin: 0; }
  .nav-logout {
    height: 34px;
    padding: 0 0.875rem;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text-muted);
    font-size: 13px;
    font-weight: 400;
    cursor: pointer;
    font-family: Arial, ui-sans-serif, system-ui, sans-serif;
    transition: border-color .12s, color .12s;
  }
  .nav-logout:hover { border-color: var(--orange); color: var(--orange); }

  /* ===== LAYOUT ===== */
  .layout { display: flex; flex-direction: column; min-height: 100vh; }
  .main { flex: 1; }
  .content {
    max-width: 1440px;
    margin: 0 auto;
    padding: 1.75rem 2rem;
    width: 100%;
  }

  /* ===== FLASH / PAGE HEADER ===== */
  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.5rem;
  }
  .page-title {
    font-size: 28px;
    font-weight: 400;
    color: var(--black);
    letter-spacing: -0.03em;
    line-height: 1.1;
  }
  .page-subtitle { font-size: 14px; color: var(--text-muted); margin-top: 4px; }

  /* ===== KPI CARDS ===== */
  .stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 1rem;
    margin-bottom: 1.75rem;
  }
  .stat-card {
    background: var(--cream);
    border: 1px solid var(--amber-light);
    border-radius: 16px;
    padding: 1.25rem 1.5rem 1.1rem;
    box-shadow: var(--shadow-card);
    cursor: pointer;
    transition: box-shadow .15s, transform .12s;
    text-decoration: none;
    display: block;
  }
  .stat-card:hover {
    box-shadow: rgba(127,99,21,0.20) -8px 20px 48px, rgba(127,99,21,0.14) -16px 40px 72px;
    transform: translateY(-2px);
    text-decoration: none;
  }
  .stat-card .stat-num {
    font-size: 40px;
    font-weight: 400;
    line-height: 1;
    margin-bottom: 0.35rem;
    letter-spacing: -0.03em;
    color: var(--black);
  }
  .stat-card .stat-lbl {
    font-size: 13px;
    color: var(--text-muted);
    font-weight: 400;
    text-transform: uppercase;
    letter-spacing: .06em;
  }
  .stat-card .stat-accent { width: 32px; height: 3px; margin-bottom: 0.75rem; }

  /* ===== CARDS ===== */
  .card {
    background: #ffffff;
    border: 1px solid var(--border);
    border-radius: 16px;
    box-shadow: 0 2px 8px rgba(127,99,21,0.08);
    overflow: hidden;
  }
  .card-body { padding: 1.25rem 1.5rem; }
  .card-header {
    padding: 0.875rem 1.5rem;
    border-bottom: 1px solid var(--border);
    font-size: 12px;
    font-weight: 400;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: .07em;
  }

  /* ===== FILTER BAR ===== */
  .filter-bar {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    align-items: center;
    margin-bottom: 1.25rem;
    background: var(--cream);
    border: 1px solid var(--amber-light);
    border-radius: 12px;
    padding: 0.75rem 1rem;
    box-shadow: 0 1px 6px rgba(127,99,21,0.07);
  }
  .filter-bar select, .filter-bar input[type=date], .filter-bar input[type=text] { width: auto; margin: 0; }
  .filter-bar input[type=text] { min-width: 180px; }

  /* ===== TABLE ===== */
  .table-wrap {
    overflow-x: auto;
    border: 1px solid var(--border);
    border-radius: 14px;
    box-shadow: 0 2px 12px rgba(127,99,21,0.08);
    overflow: clip;
  }
  table { width: 100%; border-collapse: collapse; font-size: 14px; background: #ffffff; }
  thead th {
    background: #fff8e0;
    padding: 0.7rem 1rem;
    text-align: left;
    font-size: 11px;
    font-weight: 400;
    text-transform: uppercase;
    letter-spacing: .07em;
    color: var(--text-muted);
    border-bottom: 2px solid var(--amber-light);
    white-space: nowrap;
    position: sticky;
    top: 56px;
    z-index: 10;
  }
  tbody td { padding: 0.72rem 1rem; border-bottom: 1px solid #faefd0; vertical-align: middle; }
  tbody tr:last-child td { border-bottom: none; }
  tbody tr:hover td { background: #fffbee; }
  tfoot td {
    padding: 0.65rem 1rem;
    border-top: 2px solid var(--amber-light);
    font-weight: 400;
    background: #fff8e0;
    font-size: 13px;
    color: var(--text-muted);
  }

  /* ===== BUTTONS ===== */
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 400;
    cursor: pointer;
    border: 1px solid transparent;
    transition: background .08s, border-color .08s, color .08s;
    text-decoration: none;
    font-family: Arial, ui-sans-serif, system-ui, sans-serif;
  }
  .btn-primary { background: var(--black); color: #fff; border-color: var(--black); }
  .btn-primary:hover { background: #333; border-color: #333; text-decoration: none; color: #fff; }
  .btn-outline { background: var(--cream); color: var(--black); border-color: var(--amber-light); }
  .btn-outline:hover { background: #ffe295; border-color: var(--amber); text-decoration: none; }
  .btn-danger { background: transparent; color: var(--orange); border-color: var(--orange); }
  .btn-danger:hover { background: #fff0e8; text-decoration: none; }
  .btn-sm { padding: 0.32rem 0.7rem; font-size: 13px; }
  .btn-xs { padding: 0.2rem 0.5rem; font-size: 12px; }

  /* ===== ALERTS ===== */
  .alert { padding: 0.75rem 1rem; font-size: 14px; margin-bottom: 1rem; border-radius: 10px; }
  .alert-success { background: #f5ead5; color: #5a3a10; border: 1px solid var(--amber-light); }
  .alert-danger  { background: #fff0e8; color: #7a2000; border: 1px solid var(--orange); }
  .alert-warning { background: var(--cream); color: #7a4010; border: 1px solid var(--amber); }

  /* ===== FORMS ===== */
  label { display: block; font-size: 13px; font-weight: 400; color: var(--text-muted); margin-bottom: 0.25rem; text-transform: uppercase; letter-spacing: .04em; }
  input, select, textarea {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border-input);
    border-radius: 8px;
    background: #ffffff;
    color: var(--text);
    font-size: 14px;
    font-weight: 400;
    font-family: Arial, ui-sans-serif, system-ui, sans-serif;
    transition: border-color .08s, box-shadow .08s;
  }
  input:focus, select:focus, textarea:focus {
    outline: none;
    border-color: var(--amber);
    box-shadow: 0 0 0 2px rgba(255,161,16,0.18);
  }
  .form-group { margin-bottom: 1rem; }

  /* ===== PAGINATION ===== */
  .pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.3rem;
    margin-top: 1.25rem;
    flex-wrap: wrap;
    row-gap: 0.5rem;
  }
  .page-numbers { display: flex; gap: 0.2rem; align-items: center; flex-wrap: wrap; justify-content: center; }
  .page-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 32px;
    height: 32px;
    padding: 0 0.5rem;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--cream);
    color: var(--text);
    font-size: 13px;
    font-weight: 400;
    text-decoration: none;
    transition: background .12s, border-color .12s;
    cursor: pointer;
  }
  .page-btn:hover:not(.active):not(.disabled) { background: #ffe295; border-color: var(--amber); text-decoration: none; color: var(--text); }
  .page-btn.active { background: var(--orange); color: #fff; border-color: var(--orange); pointer-events: none; }
  .page-btn.disabled { opacity: 0.35; pointer-events: none; }
  .page-ellipsis { color: var(--text-muted); padding: 0 0.15rem; font-size: 14px; line-height: 32px; }
  .page-jump {
    display: flex; align-items: center; gap: 0.4rem;
    margin-left: 0.5rem;
    border-left: 1px solid var(--border);
    padding-left: 0.75rem;
  }
  .page-jump input[type=number] { width: 52px; height: 32px; padding: 0 0.4rem; font-size: 13px; text-align: center; margin: 0; }
  .page-info { font-size: 13px; color: var(--text-muted); white-space: nowrap; }

  /* ===== MISC ===== */
  .kv-table td:first-child { color: var(--text-muted); width: 180px; white-space: nowrap; padding-right: 1.5rem; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
  .kv-table td { padding: 0.6rem 0; border-bottom: 1px solid #faefd0; font-size: 14px; }
  .kv-table tr:last-child td { border-bottom: none; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }

  /* ===== ERROR HOVER POPUP ===== */
  .err-wrap { position: relative; display: inline-block; max-width: 100%; }
  /* detail page — แสดงหลายบรรทัด */
  .err-preview {
    margin: 0; font-size: 0.75rem; color: #fa520f;
    max-height: 4.5em; overflow: hidden;
    white-space: pre-wrap; word-break: break-all;
    cursor: default;
  }
  /* table cell — แสดงบรรทัดเดียว ellipsis */
  .err-preview-inline {
    display: block;
    font-size: 12px; color: #fa520f;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    max-width: 180px; cursor: default;
  }
  .err-popup {
    display: none;
    position: fixed;
    z-index: 99999;
    background: #fff8e8;
    border: 1px solid #fa520f;
    border-radius: 10px;
    padding: 1rem 1.25rem;
    max-width: min(680px, 90vw);
    max-height: 60vh;
    overflow-y: auto;
    box-shadow: 0 8px 40px rgba(127,99,21,0.22);
    pointer-events: none;
  }
  .err-popup pre {
    margin: 0; font-size: 0.78rem; color: #7a2000;
    white-space: pre-wrap; word-break: break-all;
    font-family: ui-monospace, 'Cascadia Code', monospace;
    line-height: 1.6;
  }
  .err-wrap:hover .err-popup { display: block; }

  @media (max-width: 768px) {
    .two-col { grid-template-columns: 1fr; }
    .nav-links a { padding: 0 0.6rem; font-size: 13px; }
    .nav-search { display: none; }
    .content { padding: 1rem; }
  }
`;

// ===== Shared pagination helper =====

/**
 * Generate a full-featured pagination bar.
 * @param page        current page (1-based)
 * @param totalPages  total number of pages
 * @param total       total record count (for display)
 * @param hrefOf      function that returns the href string for page `p`
 * @param pageParam   query-string param name used for the "go to page" jump form (default: 'page')
 */
export function paginationHtml(
  page: number,
  totalPages: number,
  total: number,
  hrefOf: (p: number) => string,
  pageParam = 'page',
): string {
  if (totalPages <= 1) {
    return `<div class="pagination"><span class="page-info">${total} รายการ</span></div>`;
  }

  // Build page-number list with ellipsis
  const pages: (number | '...')[] = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || (p >= page - 2 && p <= page + 2)) {
      pages.push(p);
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...');
    }
  }

  const pageButtons = pages.map(p => {
    if (p === '...') return `<span class="page-ellipsis">…</span>`;
    const n = p as number;
    return `<a href="${esc(hrefOf(n))}" class="page-btn${n === page ? ' active' : ''}">${n}</a>`;
  }).join('');

  const firstDis = page === 1 ? ' disabled' : '';
  const lastDis  = page === totalPages ? ' disabled' : '';

  // JS for "go to page" — reads/writes URL search params client-side
  const jumpJs = `event.preventDefault();var v=parseInt(this.p.value);if(v>=1&&v<=${totalPages}){var u=new URL(location.href);u.searchParams.set('${pageParam}',v);location.href=u.toString();}`;

  return `
  <div class="pagination">
    <a href="${esc(hrefOf(1))}" class="page-btn${firstDis}" title="หน้าแรก">«</a>
    <a href="${esc(hrefOf(Math.max(1, page - 1)))}" class="page-btn${firstDis}" title="ก่อนหน้า">‹</a>
    <div class="page-numbers">${pageButtons}</div>
    <a href="${esc(hrefOf(Math.min(totalPages, page + 1)))}" class="page-btn${lastDis}" title="ถัดไป">›</a>
    <a href="${esc(hrefOf(totalPages))}" class="page-btn${lastDis}" title="หน้าสุดท้าย">»</a>
    <form class="page-jump" onsubmit="${esc(jumpJs)}">
      <span class="page-info">ไปหน้า</span>
      <input name="p" type="number" min="1" max="${totalPages}" placeholder="${page}">
      <button type="submit" class="btn btn-outline btn-xs">ไป</button>
      <span class="page-info">${page} / ${totalPages} &nbsp;(${total} รายการ)</span>
    </form>
  </div>`;
}

// ===== Refresh bar (place just above .table-wrap) =====

export function refreshBarHtml(): string {
  return `
  <div class="tbl-toolbar">
    <div class="tbl-refresh">
      <button type="button" class="tbl-refresh-btn" title="รีเฟรชเดี๋ยวนี้">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
          <path d="M4 4v5h5M20 20v-5h-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M4 9a8 8 0 0 1 13.6-3.4L20 9M4 15l2.4 3.4A8 8 0 0 0 20 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        รีเฟรช
      </button>
      <select class="tbl-refresh-sel" title="รีเฟรชอัตโนมัติ">
        <option value="0">ปิดอัตโนมัติ</option>
        <option value="10">ทุก 10 วิ</option>
        <option value="30">ทุก 30 วิ</option>
        <option value="60">ทุก 1 นาที</option>
        <option value="120">ทุก 2 นาที</option>
        <option value="300">ทุก 5 นาที</option>
      </select>
    </div>
  </div>`;
}

// ===== Admin layout =====

export function adminLayout(
  title: string,
  content: string,
  user: User,
  activePage: string,
  flashMessage?: string,
): string {
  const navItems = [
    { href: '/admin/submissions', label: 'Submissions', page: 'submissions', icon: '📋' },
    { href: '/admin/dispatched', label: 'Dispatched', page: 'dispatched', icon: '🚀' },
    { href: '/admin/queues', label: 'Queue Status', page: 'queues', icon: '📊' },
    { href: '/admin/waiting-room', label: 'Waiting Room', page: 'waiting-room', icon: '🚦' },
    ...(user.role === 'admin'
      ? [
          { href: '/admin/users', label: 'Users', page: 'users', icon: '👥' },
          { href: '/admin/webhooks', label: 'Webhooks', page: 'webhooks', icon: '🔗' },
          { href: '/admin/clear-data', label: 'เคลียร์ข้อมูล', page: 'clear-data', icon: '🗑️' },
        ]
      : []),
  ];

  const canExport = user.role === 'admin' || user.role === 'operator';
  const avatarChar = user.username.charAt(0).toUpperCase();

  const flash = flashMessage
    ? `<div class="alert ${flashMessage.startsWith('✓') ? 'alert-success' : 'alert-danger'}">${esc(flashMessage)}</div>`
    : '';

  // Gradient accent blocks
  const blocks = [
    { bg: '#ffd900', h: 20 },
    { bg: '#ffa110', h: 20 },
    { bg: '#ff8105', h: 20 },
    { bg: '#fb6424', h: 20 },
    { bg: '#fa520f', h: 20 },
  ];
  const brandBlocks = blocks.map(b => `<span style="background:${b.bg};width:7px;height:${b.h}px;display:block"></span>`).join('');

  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)} — Form Admin</title>
  <style>${ADMIN_CSS}</style>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css">
  <style>
    /* ────────────────────────────────────────────────────────────
       Flatpickr — isolation reset + minimal warm theme
       Root cause: BASE_CSS sets input { width:100%; padding:…; border:… }
       which bleeds into the calendar's internal year/time inputs,
       collapsing the month header and breaking the day grid.
       Fix: override every leaking global rule inside .flatpickr-calendar
       with !important so the calendar is self-contained.
    ──────────────────────────────────────────────────────────── */

    /* 1. Reset global input styles that bleed into the calendar */
    .flatpickr-calendar input,
    .flatpickr-calendar input[type="number"],
    .flatpickr-calendar select {
      all: unset !important;
      font-family: Arial, ui-sans-serif, system-ui, sans-serif !important;
      font-size: 13px !important;
      color: #1f1f1f !important;
      font-weight: 400 !important;
      box-sizing: border-box !important;
    }

    /* 2. Calendar shell
       - position:absolute (ไม่ใช้ fixed — flatpickr ใช้ visibility toggle ซ่อน/แสดง)
       - top/left คำนวณใหม่ใน onOpen JS: rect + scrollY
       - user-select + pointer-events ปกติ (ห้ามให้ calendar follow เมาส์) */
    .flatpickr-calendar {
      position: absolute !important;
      background: #fff !important;
      border: 1px solid #e8d5a8 !important;
      border-radius: 12px !important;
      box-shadow: 0 4px 24px rgba(127,99,21,0.15) !important;
      font-family: Arial, ui-sans-serif, system-ui, sans-serif !important;
      font-size: 13px !important;
      padding: 4px !important;
      width: 308px !important;
      box-sizing: border-box !important;
      z-index: 99999 !important;
      user-select: none !important;
      pointer-events: auto !important;
    }
    .flatpickr-calendar.arrowTop::before { border-bottom-color: #e8d5a8 !important; }
    .flatpickr-calendar.arrowTop::after  { border-bottom-color: #fff !important; }

    /* 3. Month header — must be flex row, not affected by global rules */
    .flatpickr-months {
      display: flex !important;
      align-items: center !important;
      padding: 2px 0 !important;
    }
    .flatpickr-month {
      background: transparent !important;
      height: 36px !important;
      flex: 1 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
    }
    .flatpickr-current-month {
      display: flex !important;
      align-items: center !important;
      gap: 2px !important;
      font-size: 13px !important;
      font-weight: 400 !important;
      color: #1f1f1f !important;
      padding: 0 !important;
      width: auto !important;
    }
    /* Year input — must be narrow, no global border/padding */
    .flatpickr-current-month input.cur-year {
      width: 4ch !important;
      padding: 0 0 0 0.5ch !important;
      border: none !important;
      border-radius: 0 !important;
      background: transparent !important;
      box-shadow: none !important;
      cursor: default !important;
      font-size: 13px !important;
      color: #1f1f1f !important;
    }
    /* Month dropdown */
    .flatpickr-current-month .flatpickr-monthDropdown-months {
      background: transparent !important;
      border: none !important;
      border-radius: 0 !important;
      color: #1f1f1f !important;
      font-size: 13px !important;
      font-weight: 400 !important;
      padding: 0 2px !important;
      cursor: pointer !important;
      appearance: auto !important;
      -webkit-appearance: auto !important;
    }
    .flatpickr-prev-month, .flatpickr-next-month { padding: 8px 10px !important; }
    .flatpickr-prev-month svg, .flatpickr-next-month svg { fill: #a07840 !important; width: 12px !important; height: 12px !important; }
    .flatpickr-prev-month:hover svg, .flatpickr-next-month:hover svg { fill: #fa520f !important; }

    /* 4. Weekday header row */
    .flatpickr-weekdays {
      display: flex !important;
      background: transparent !important;
      width: 300px !important;
    }
    .flatpickr-weekdaycontainer { display: flex !important; flex: 1 !important; }
    span.flatpickr-weekday {
      display: flex !important;
      flex: 1 !important;
      align-items: center !important;
      justify-content: center !important;
      background: transparent !important;
      color: #c8a86b !important;
      font-size: 10px !important;
      font-weight: 400 !important;
      width: auto !important;
      max-width: none !important;
    }

    /* 5. Day grid — enforce 7-column flex wrap */
    .flatpickr-days { width: 300px !important; }
    .dayContainer {
      display: flex !important;
      flex-wrap: wrap !important;
      width: 300px !important;
      min-width: 300px !important;
      max-width: 300px !important;
      padding: 2px 0 !important;
      gap: 0 !important;
    }
    .flatpickr-day {
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      flex-basis: calc(300px / 7) !important;
      max-width: calc(300px / 7) !important;
      height: 36px !important;
      line-height: 1 !important;
      border-radius: 6px !important;
      color: #1f1f1f !important;
      font-weight: 400 !important;
      font-size: 13px !important;
      border: none !important;
      cursor: pointer !important;
      transition: background .08s !important;
      position: relative !important;
      box-sizing: border-box !important;
    }
    .flatpickr-day:hover { background: #fff0c2 !important; }
    .flatpickr-day.today { color: #fa520f !important; }
    .flatpickr-day.today::after {
      content: '' !important; position: absolute !important;
      bottom: 3px !important; left: 50% !important;
      transform: translateX(-50%) !important;
      width: 3px !important; height: 3px !important;
      border-radius: 50% !important; background: #fa520f !important;
    }
    .flatpickr-day.selected, .flatpickr-day.selected:hover { background: #fa520f !important; color: #fff !important; }
    .flatpickr-day.inRange { background: #fff0c2 !important; border-radius: 0 !important; box-shadow: -5px 0 0 #fff0c2, 5px 0 0 #fff0c2 !important; }
    .flatpickr-day.startRange, .flatpickr-day.startRange:hover { background: #fa520f !important; color: #fff !important; border-radius: 6px 0 0 6px !important; }
    .flatpickr-day.endRange,   .flatpickr-day.endRange:hover   { background: #fa520f !important; color: #fff !important; border-radius: 0 6px 6px 0 !important; }
    .flatpickr-day.prevMonthDay, .flatpickr-day.nextMonthDay { color: #d9c5a0 !important; }
    .flatpickr-day.flatpickr-disabled { color: #e8d5a8 !important; cursor: default !important; }

    /* 6. Time picker */
    .numInputWrapper { position: relative !important; width: auto !important; }
    .numInputWrapper span { display: none !important; }
    .numInputWrapper:hover { background: transparent !important; }
    .flatpickr-time {
      display: flex !important;
      align-items: center !important;
      border-top: 1px solid #f0e4c0 !important;
      margin-top: 4px !important;
      padding: 6px 4px 2px !important;
      height: auto !important;
    }
    .flatpickr-time input {
      width: 4ch !important;
      text-align: center !important;
      padding: 4px 2px !important;
      border: 1px solid #e8d5a8 !important;
      border-radius: 6px !important;
      background: #fffaeb !important;
      font-size: 13px !important;
      color: #1f1f1f !important;
      box-shadow: none !important;
    }
    .flatpickr-time input:focus { border-color: #ffa110 !important; outline: none !important; }
    .flatpickr-time .flatpickr-time-separator,
    .flatpickr-time .flatpickr-am-pm { color: #c8a86b !important; padding: 0 2px !important; }

    /* 7. Year input — auto-width so "2025" never truncates */
    .flatpickr-current-month input.cur-year {
      width: auto !important;
      min-width: 3.5ch !important;
    }

    /* 8. altInput (the visible formatted input) inherits global styles — that's fine */
    .flatpickr-input[readonly] { cursor: pointer; }

    /* ── Table refresh bar ── */
    .tbl-toolbar {
      display: flex; align-items: center; justify-content: flex-end;
      margin-bottom: 0.5rem; gap: 0.5rem;
    }
    .tbl-refresh {
      display: flex; align-items: center; gap: 0;
      background: var(--cream); border: 1px solid var(--amber-light); border-radius: 8px;
      height: 32px; overflow: hidden;
    }
    .tbl-refresh-btn {
      display: flex; align-items: center; justify-content: center; gap: 5px;
      padding: 0 0.75rem; height: 32px; background: transparent; border: none;
      border-right: 1px solid var(--amber-light); cursor: pointer;
      color: var(--text-muted); font-size: 12px; font-family: Arial, ui-sans-serif, system-ui, sans-serif;
      transition: background .08s, color .08s; white-space: nowrap;
    }
    .tbl-refresh-btn:hover { background: #ffe295; color: var(--orange); }
    .tbl-refresh-btn.spinning svg { animation: spin .5s linear; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .tbl-refresh-sel {
      height: 30px; border: none; background: transparent;
      color: var(--text-muted); font-size: 12px; padding: 0 0.5rem;
      cursor: pointer; outline: none; font-family: Arial, ui-sans-serif, system-ui, sans-serif;
      width: auto;
    }
    .tbl-refresh-sel:focus { box-shadow: none; }
  </style>
</head>
<body>
<div class="layout">

  <!-- ===== TOP NAVIGATION ===== -->
  <header class="topnav">
    <div class="topnav-inner">

      <!-- Brand -->
      <a href="/admin/submissions" class="nav-brand">
        <div class="nav-brand-blocks">${brandBlocks}</div>
        <span class="nav-brand-text">Form Admin</span>
        <span class="nav-brand-sub">/ CF Workers</span>
      </a>

      <!-- Nav links -->
      <nav class="nav-links">
        ${navItems.map(n => `<a href="${esc(n.href)}" class="${activePage === n.page ? 'active' : ''}">${esc(n.label)}</a>`).join('')}
        ${canExport ? `<a href="/admin/export/submissions.csv" onclick="return confirm('ยืนยันการ Export CSV?\\nข้อมูลทั้งหมดจะถูกดาวน์โหลด')">Export CSV</a>` : ''}
      </nav>

      <!-- Right side -->
      <div class="nav-right">
        <div class="nav-search">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <circle cx="6.5" cy="6.5" r="5" stroke="#a07840" stroke-width="1.5"/>
            <path d="M10 10L14 14" stroke="#a07840" stroke-width="1.5" stroke-linecap="square"/>
          </svg>
          <input type="text" placeholder="ค้นหา…" onkeydown="if(event.key==='Enter'){window.location.href='/admin/submissions?q='+encodeURIComponent(this.value)}">
        </div>
        <a href="/admin/profile" class="nav-user" style="text-decoration:none">
          <div class="nav-avatar">${avatarChar}</div>
          <div>
            <div class="nav-username">${esc(user.username)}</div>
            <div class="nav-user-role">${esc(user.role)}</div>
          </div>
        </a>
        <form method="POST" action="/admin/logout" class="nav-logout-form">
          <button type="submit" class="nav-logout">ออก</button>
        </form>
      </div>

    </div>
  </header>

  <!-- ===== MAIN CONTENT ===== -->
  <div class="main">
    <div class="content">
      ${flash}
      ${content}
    </div>
  </div>

</div>

<script src="https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.js"></script>
<script>
(function () {
  /* ── Flatpickr init ────────────────────────────────────────────────────
     Loaded synchronously before this script so flatpickr is always
     available here — no defer/onload timing issues. */
  if (typeof flatpickr !== 'undefined') {
    var fps = [];

    /* Force-close in capture phase — fires before any stopPropagation */
    function maybeClose(e) {
      fps.forEach(function (fp) {
        if (!fp.isOpen) return;
        var inCal = fp.calendarContainer && fp.calendarContainer.contains(e.target);
        var isInp = e.target === fp.input || (fp.altInput && e.target === fp.altInput);
        if (!inCal && !isInp) fp.close();
      });
    }
    document.addEventListener('mousedown', maybeClose, true);
    document.addEventListener('touchstart', maybeClose, { capture: true, passive: true });

    var base = {
      locale:        { firstDayOfWeek: 1 },
      disableMobile: true,
      closeOnSelect: true,
      onReady: function (d, s, fp) { fps.push(fp); },
    };

    document.querySelectorAll('input[type="date"]:not(.flatpickr-input)').forEach(function (el) {
      if (el._flatpickr) return;
      flatpickr(el, Object.assign({}, base, { dateFormat: 'Y-m-d' }));
    });
    document.querySelectorAll('input[type="datetime-local"]:not(.flatpickr-input)').forEach(function (el) {
      if (el._flatpickr) return;
      flatpickr(el, Object.assign({}, base, { dateFormat: 'Y-m-dTH:i', enableTime: true, time_24hr: true }));
    });
  }

  /* ── Auto-refresh widget ── */
  var KEY = 'adminRefreshSec';
  var _timer = null;

  function applyInterval(sec) {
    clearInterval(_timer);
    localStorage.setItem(KEY, String(sec));
    if (sec > 0) _timer = setInterval(function () { location.reload(); }, sec * 1000);
  }

  var saved = parseInt(localStorage.getItem(KEY) || '0', 10);
  document.querySelectorAll('.tbl-refresh-sel').forEach(function (sel) {
    sel.value = String(saved);
    sel.addEventListener('change', function () { applyInterval(parseInt(this.value, 10)); });
  });
  document.querySelectorAll('.tbl-refresh-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      btn.classList.add('spinning');
      setTimeout(function () { btn.classList.remove('spinning'); }, 500);
      location.reload();
    });
  });
  applyInterval(saved);

  /* ── Error hover popup — ติดตามเมาส์ ── */
  document.querySelectorAll('.err-wrap').forEach(function (wrap) {
    var popup = wrap.querySelector('.err-popup');
    if (!popup) return;
    wrap.addEventListener('mousemove', function (e) {
      var x = e.clientX + 16;
      var y = e.clientY + 16;
      var pw = popup.offsetWidth || 400;
      var ph = popup.offsetHeight || 200;
      if (x + pw > window.innerWidth - 8) x = e.clientX - pw - 8;
      if (y + ph > window.innerHeight - 8) y = e.clientY - ph - 8;
      popup.style.left = x + 'px';
      popup.style.top  = y + 'px';
    });
  });
})();
</script>
</body>
</html>`;
}
