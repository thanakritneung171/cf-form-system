import { adminLayout } from './layout';
import { esc } from '../validators';
import type { User } from 'shared/types';

export interface WaitingRoomStatusData {
  formType: string;
  enabled: boolean;
  activeCount: number;
  limit: number;
  available: number;
  tokenTtlMinutes: number;
  shards: number;
}

export function wrDashboardPage(
  statuses: WaitingRoomStatusData[],
  user: User,
  flash?: string,
): string {
  const rows = statuses.map(s => {
    const pct = s.enabled && s.limit > 0
      ? Math.min(100, Math.round((s.activeCount / s.limit) * 100))
      : 0;
    const isWarning = s.enabled && s.limit > 0 && s.available < s.limit * 0.1;
    const rowBg = isWarning ? 'background:#fff8e6' : '';
    const availStyle = isWarning
      ? 'color:#dc2626;font-weight:700'
      : 'color:#15803d;font-weight:600';

    return `<tr style="${rowBg}">
      <td style="padding:0.7rem 1rem"><code style="font-size:0.85rem">${esc(s.formType)}</code></td>
      <td style="padding:0.7rem 1rem">${s.enabled
        ? '<span style="color:#15803d;font-weight:600">✅ เปิด</span>'
        : '<span style="color:#94a3b8">❌ ปิด</span>'}</td>
      <td style="padding:0.7rem 1rem">${s.enabled
        ? `${s.activeCount.toLocaleString()} / ${s.limit.toLocaleString()}`
        : '—'}</td>
      <td style="padding:0.7rem 1rem"><span style="${s.enabled ? availStyle : ''}">${s.enabled
        ? s.available.toLocaleString()
        : '—'}</span></td>
      <td style="padding:0.7rem 1rem">${s.enabled
        ? `<div style="background:#f0e6c8;border-radius:999px;height:6px;width:80px;overflow:hidden">
             <div style="background:linear-gradient(90deg,#ffa110,#fa520f);height:100%;width:${pct}%;border-radius:999px"></div>
           </div>
           <span style="font-size:11px;color:#8a6f3e">${pct}%</span>`
        : '—'}</td>
      <td style="padding:0.7rem 1rem">${s.enabled ? `${s.tokenTtlMinutes} นาที` : '—'}</td>
      <td style="padding:0.7rem 1rem">${s.shards}</td>
      <td style="padding:0.7rem 1rem">${s.enabled
        ? `<form method="POST" action="/admin/wr-dashboard/reset?formType=${encodeURIComponent(s.formType)}"
             style="display:inline"
             onsubmit="return confirm('Reset waiting room สำหรับ ${esc(s.formType)} ใช่ไหม?\\nผู้ใช้ทุกคนจะต้องขอ token ใหม่')">
             <button type="submit" class="btn btn-danger btn-xs">Reset</button>
           </form>`
        : '—'}</td>
    </tr>`;
  }).join('');

  const enabledCount = statuses.filter(s => s.enabled).length;
  const warnCount = statuses.filter(s => s.enabled && s.limit > 0 && s.available < s.limit * 0.1).length;

  const content = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1.5rem;flex-wrap:wrap;gap:0.75rem">
      <div>
        <h1 style="font-size:1.4rem;font-weight:700;color:var(--black)">🚦 Waiting Room Dashboard</h1>
        <p style="color:var(--text-muted);font-size:0.85rem;margin-top:0.3rem">
          สถานะ Waiting Room ทุก form type
          — <span style="color:#fa520f;font-weight:600" id="refresh-label">อัปเดตอัตโนมัติทุก 5 วินาที</span>
        </p>
      </div>
      <div style="display:flex;gap:0.75rem;align-items:center;flex-wrap:wrap">
        <span style="font-size:13px;color:var(--text-muted)">
          เปิด: <strong>${enabledCount}</strong>
          ${warnCount > 0 ? `&nbsp;|&nbsp; <span style="color:#dc2626;font-weight:700">⚠️ แน่น: ${warnCount}</span>` : ''}
        </span>
        <button onclick="location.reload()" style="border:1px solid var(--border);border-radius:8px;padding:0.35rem 0.85rem;font-size:13px;background:none;cursor:pointer;color:var(--text-muted)">🔄 Refresh</button>
      </div>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Form Type</th>
            <th>สถานะ</th>
            <th>Active / Limit</th>
            <th>ว่าง</th>
            <th>การใช้งาน</th>
            <th>Token TTL</th>
            <th>Shards</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>

    <script>
      var t = 5;
      var lbl = document.getElementById('refresh-label');
      setInterval(function() {
        t--;
        if (lbl) lbl.textContent = 'อัปเดตใน ' + t + ' วินาที…';
        if (t <= 0) location.reload();
      }, 1000);
    </script>
  `;

  return adminLayout('Waiting Room Dashboard', content, user, 'wr-dashboard', flash);
}
