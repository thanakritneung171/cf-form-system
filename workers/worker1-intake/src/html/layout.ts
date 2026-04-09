import type { User } from 'shared/types';
import { esc } from '../validators';

// ===== Color constants =====

export const STATUS_COLORS: Record<string, string> = {
  pending: '#d97706',
  dispatching: '#2563eb',
  complete: '#16a34a',
  failed: '#dc2626',
};

export const STATUS_LABELS: Record<string, string> = {
  pending: 'รอดำเนินการ',
  dispatching: 'กำลังส่ง',
  complete: 'สำเร็จ',
  failed: 'ล้มเหลว',
};

// ===== Shared helpers =====

export function statusBadge(status: string): string {
  const color = STATUS_COLORS[status] ?? '#78716c';
  const label = STATUS_LABELS[status] ?? status;
  return `<span class="badge" style="--badge-color:${color}">${esc(label)}</span>`;
}

export function roleBadge(role: string): string {
  const colors: Record<string, string> = {
    admin: '#7c3aed',
    operator: '#0891b2',
    viewer: '#78716c',
  };
  const c = colors[role] ?? '#78716c';
  return `<span class="badge" style="--badge-color:${c}">${esc(role)}</span>`;
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
    --bg: #f7f3ee;
    --bg-card: #ffffff;
    --bg-card-hover: #fdf9f5;
    --border: #e3d9ce;
    --border-focus: #b45309;
    --text: #1c1917;
    --text-muted: #78716c;
    --text-light: #a8a29e;
    --primary: #2563eb;
    --primary-hover: #1d4ed8;
    --danger: #dc2626;
    --danger-bg: #fef2f2;
    --success: #16a34a;
    --success-bg: #f0fdf4;
    --warning: #d97706;
    --warning-bg: #fffbeb;
    --nav-bg: #1c1917;
    --nav-text: #e7e5e4;
    --nav-muted: #78716c;
    --nav-active-bg: #292524;
    --nav-active-text: #fbbf24;
    --radius: 8px;
    --radius-sm: 4px;
    --shadow-sm: 0 1px 3px rgba(28,25,23,.08), 0 1px 2px rgba(28,25,23,.04);
    --shadow: 0 4px 12px rgba(28,25,23,.10), 0 2px 4px rgba(28,25,23,.06);
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { font-size: 15px; }
  body {
    font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
  }
  a { color: var(--primary); text-decoration: none; }
  a:hover { text-decoration: underline; }
  code {
    font-family: ui-monospace, 'Cascadia Code', monospace;
    font-size: 0.85em;
    background: #f0ece6;
    padding: 1px 5px;
    border-radius: 3px;
    color: #92400e;
  }
  pre {
    background: #f0ece6;
    padding: 0.75rem 1rem;
    border-radius: var(--radius-sm);
    overflow: auto;
    font-size: 0.8rem;
    color: #92400e;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 9px;
    border-radius: 99px;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: .02em;
    background: var(--badge-color);
    color: #fff;
  }
`;

export const ADMIN_CSS = `
  ${BASE_CSS}
  /* Layout */
  .layout { display: flex; min-height: 100vh; }
  .sidebar {
    width: 220px;
    flex-shrink: 0;
    background: var(--nav-bg);
    display: flex;
    flex-direction: column;
    position: fixed;
    top: 0; left: 0; bottom: 0;
    overflow-y: auto;
    z-index: 100;
  }
  .sidebar-logo {
    padding: 1.25rem 1.25rem 0.75rem;
    border-bottom: 1px solid #292524;
  }
  .sidebar-logo .logo-mark {
    font-size: 1.1rem;
    font-weight: 700;
    color: #fbbf24;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .sidebar-logo .logo-sub {
    font-size: 0.72rem;
    color: var(--nav-muted);
    margin-top: 2px;
  }
  .sidebar-nav {
    flex: 1;
    padding: 0.75rem 0.625rem;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .sidebar-nav a {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.55rem 0.75rem;
    border-radius: var(--radius-sm);
    color: var(--nav-text);
    font-size: 0.875rem;
    font-weight: 500;
    text-decoration: none;
    transition: background .12s, color .12s;
  }
  .sidebar-nav a:hover { background: #292524; }
  .sidebar-nav a.active { background: var(--nav-active-bg); color: var(--nav-active-text); }
  .sidebar-nav .nav-icon { font-size: 1rem; width: 1.25rem; text-align: center; }
  .sidebar-nav .nav-section {
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: .08em;
    text-transform: uppercase;
    color: var(--nav-muted);
    padding: 0.75rem 0.75rem 0.25rem;
  }
  .sidebar-footer {
    padding: 0.75rem 0.625rem;
    border-top: 1px solid #292524;
  }
  .sidebar-footer .user-info {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.5rem 0.75rem;
    border-radius: var(--radius-sm);
    margin-bottom: 4px;
  }
  .sidebar-footer .avatar {
    width: 28px; height: 28px;
    border-radius: 50%;
    background: #44403c;
    color: #fbbf24;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.75rem; font-weight: 700;
    flex-shrink: 0;
  }
  .sidebar-footer .user-name { font-size: 0.8rem; font-weight: 600; color: var(--nav-text); }
  .sidebar-footer .user-role { font-size: 0.68rem; color: var(--nav-muted); }
  .sidebar-footer .logout-btn {
    width: 100%;
    padding: 0.45rem 0.75rem;
    background: transparent;
    border: 1px solid #44403c;
    border-radius: var(--radius-sm);
    color: var(--nav-muted);
    font-size: 0.78rem;
    cursor: pointer;
    text-align: left;
    transition: border-color .12s, color .12s;
  }
  .sidebar-footer .logout-btn:hover { border-color: #dc2626; color: #dc2626; }

  /* Main content */
  .main { margin-left: 220px; min-height: 100vh; display: flex; flex-direction: column; }
  .topbar {
    background: var(--bg-card);
    border-bottom: 1px solid var(--border);
    padding: 0.875rem 1.75rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: sticky; top: 0; z-index: 50;
  }
  .topbar h1 { font-size: 1.05rem; font-weight: 600; color: var(--text); }
  .topbar .topbar-meta { font-size: 0.78rem; color: var(--text-muted); }
  .content { padding: 1.5rem 1.75rem; flex: 1; max-width: 1200px; }

  /* Cards */
  .card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-sm);
  }
  .card-body { padding: 1.25rem 1.5rem; }
  .card-header {
    padding: 0.875rem 1.5rem;
    border-bottom: 1px solid var(--border);
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: .04em;
  }

  /* Stat cards */
  .stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
  }
  .stat-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1.1rem 1.25rem;
    box-shadow: var(--shadow-sm);
  }
  .stat-card .stat-num {
    font-size: 1.9rem;
    font-weight: 700;
    line-height: 1;
    margin-bottom: 0.3rem;
  }
  .stat-card .stat-lbl {
    font-size: 0.75rem;
    color: var(--text-muted);
    font-weight: 500;
  }

  /* Table */
  .table-wrap { overflow-x: auto; border-radius: var(--radius); border: 1px solid var(--border); }
  table { width: 100%; border-collapse: collapse; font-size: 0.85rem; background: var(--bg-card); }
  thead th {
    background: #f0ece6;
    padding: 0.65rem 1rem;
    text-align: left;
    font-size: 0.72rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: .05em;
    color: var(--text-muted);
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
  }
  tbody td { padding: 0.7rem 1rem; border-bottom: 1px solid #f0ece6; vertical-align: middle; }
  tbody tr:last-child td { border-bottom: none; }
  tbody tr:hover td { background: #faf7f3; }
  tfoot td {
    padding: 0.65rem 1rem;
    border-top: 2px solid var(--border);
    font-weight: 600;
    background: #f7f3ee;
  }

  /* Buttons */
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.5rem 1rem;
    border-radius: var(--radius-sm);
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid transparent;
    transition: background .12s, border-color .12s, color .12s;
    text-decoration: none;
  }
  .btn-primary { background: var(--primary); color: #fff; border-color: var(--primary); }
  .btn-primary:hover { background: var(--primary-hover); border-color: var(--primary-hover); text-decoration: none; color: #fff; }
  .btn-outline { background: transparent; color: var(--text); border-color: var(--border); }
  .btn-outline:hover { background: #f0ece6; text-decoration: none; }
  .btn-danger { background: transparent; color: var(--danger); border-color: #fca5a5; }
  .btn-danger:hover { background: var(--danger-bg); text-decoration: none; }
  .btn-sm { padding: 0.3rem 0.65rem; font-size: 0.78rem; }
  .btn-xs { padding: 0.2rem 0.5rem; font-size: 0.72rem; }

  /* Alerts */
  .alert { padding: 0.75rem 1rem; border-radius: var(--radius-sm); font-size: 0.875rem; margin-bottom: 1rem; }
  .alert-success { background: var(--success-bg); color: #166534; border: 1px solid #bbf7d0; }
  .alert-danger { background: var(--danger-bg); color: #991b1b; border: 1px solid #fecaca; }
  .alert-warning { background: var(--warning-bg); color: #92400e; border: 1px solid #fde68a; }

  /* Forms */
  label { display: block; font-size: 0.82rem; font-weight: 600; color: #44403c; margin-bottom: 0.25rem; }
  input, select, textarea {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-card);
    color: var(--text);
    font-size: 0.875rem;
    transition: border-color .12s, box-shadow .12s;
  }
  input:focus, select:focus, textarea:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(37,99,235,.12);
  }
  .form-group { margin-bottom: 1rem; }

  /* Filter bar */
  .filter-bar {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    align-items: flex-end;
    margin-bottom: 1rem;
    background: var(--bg-card);
    border: 1px solid var(--border);
    padding: 0.875rem 1rem;
    border-radius: var(--radius);
  }
  .filter-bar select, .filter-bar input[type=date], .filter-bar input[type=text] { width: auto; margin: 0; }
  .filter-bar input[type=text] { min-width: 180px; }

  /* Pagination */
  .pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    margin-top: 1.25rem;
    font-size: 0.82rem;
    color: var(--text-muted);
  }

  /* Page header */
  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.25rem;
  }
  .page-title { font-size: 1.2rem; font-weight: 700; }
  .kv-table td:first-child { font-weight: 600; color: var(--text-muted); width: 180px; white-space: nowrap; padding-right: 1.5rem; }
  .kv-table td { padding: 0.6rem 0; border-bottom: 1px solid #f0ece6; }
  .kv-table tr:last-child td { border-bottom: none; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
  @media (max-width: 768px) { .two-col { grid-template-columns: 1fr; } .sidebar { display: none; } .main { margin-left: 0; } }
`;

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
    ? `<div class="alert ${flashMessage.startsWith('✓') ? 'alert-success' : 'alert-danger'}" style="margin-bottom:1.25rem">${esc(flashMessage)}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)} — Form Admin</title>
  <style>${ADMIN_CSS}</style>
</head>
<body>
<div class="layout">

  <aside class="sidebar">
    <div class="sidebar-logo">
      <div class="logo-mark">⚡ Form Admin</div>
      <div class="logo-sub">Cloudflare Workers</div>
    </div>

    <nav class="sidebar-nav">
      <div class="nav-section">เมนูหลัก</div>
      ${navItems.map(n => `<a href="${n.href}" class="${activePage === n.page ? 'active' : ''}">
        <span class="nav-icon">${n.icon}</span> ${esc(n.label)}
      </a>`).join('')}
      ${canExport ? `<div class="nav-section" style="margin-top:0.5rem">Export</div>
      <a href="/admin/export/submissions.csv">
        <span class="nav-icon">⬇️</span> Export CSV
      </a>` : ''}
    </nav>

    <div class="sidebar-footer">
      <a href="/admin/profile" style="text-decoration:none">
        <div class="user-info">
          <div class="avatar">${avatarChar}</div>
          <div>
            <div class="user-name">${esc(user.username)}</div>
            <div class="user-role">${esc(user.role)}</div>
          </div>
        </div>
      </a>
      <form method="POST" action="/admin/logout">
        <button type="submit" class="logout-btn">↩ ออกจากระบบ</button>
      </form>
    </div>
  </aside>

  <div class="main">
    <div class="topbar">
      <h1>${esc(title)}</h1>
      <span class="topbar-meta">${new Date().toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</span>
    </div>
    <div class="content">
      ${flash}
      ${content}
    </div>
  </div>

</div>
</body>
</html>`;
}
