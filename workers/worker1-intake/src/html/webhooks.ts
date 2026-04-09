import type { User, Webhook, WebhookDelivery } from 'shared/types';
import { FORM_TYPES } from 'shared/forms-config';
import { esc } from '../validators';
import { adminLayout, statusBadge, formatDate, paginationHtml } from './layout';

export function webhooksPage(
  webhooks: (Webhook & { delivery_count?: number; last_delivery?: string })[],
  total: number,
  page: number,
  perPage: number,
  user: User,
  flash?: string,
): string {
  const totalPages = Math.ceil(total / perPage);

  const rows = webhooks.map(w =>
    `<tr>
      <td>
        <a href="/admin/webhooks/${esc(w.id)}" style="font-weight:600">${esc(w.name)}</a>
      </td>
      <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-muted);font-size:0.82rem" title="${esc(w.url)}">${esc(w.url)}</td>
      <td style="font-size:0.78rem;color:var(--text-muted)">${JSON.parse(w.events).join(', ')}</td>
      <td>
        ${w.is_active
          ? '<span style="color:#7a4a00;font-size:13px">● เปิด</span>'
          : '<span style="color:#c8a86b;font-size:13px">○ ปิด</span>'}
      </td>
      <td style="text-align:center;color:var(--text-muted)">${w.delivery_count ?? 0}</td>
      <td>
        <div style="display:flex;gap:0.35rem">
          <form method="POST" action="/admin/webhooks/${esc(w.id)}/toggle" style="margin:0">
            <button type="submit" class="btn btn-outline btn-xs">${w.is_active ? 'ปิด' : 'เปิด'}</button>
          </form>
          <a href="/admin/webhooks/${esc(w.id)}" class="btn btn-outline btn-xs">ดู</a>
          <form method="POST" action="/admin/webhooks/${esc(w.id)}/delete" style="margin:0" onsubmit="return confirm('ลบ webhook นี้?')">
            <button type="submit" class="btn btn-danger btn-xs">ลบ</button>
          </form>
        </div>
      </td>
    </tr>`,
  ).join('');

  const content = `
  <div class="page-header">
    <div class="page-title">Webhooks</div>
    <a href="/admin/webhooks/new" class="btn btn-primary btn-sm">+ สร้าง Webhook</a>
  </div>
  ${total === 0 ? `
  <div class="card">
    <div class="card-body" style="text-align:center;padding:3rem;color:var(--text-muted)">
      <div style="font-size:2rem;margin-bottom:0.5rem">🔗</div>
      <div>ยังไม่มี Webhook</div>
      <a href="/admin/webhooks/new" class="btn btn-primary btn-sm" style="margin-top:1rem;display:inline-flex">+ สร้าง Webhook แรก</a>
    </div>
  </div>` : `
  <div class="table-wrap">
    <table>
      <thead><tr><th>ชื่อ</th><th>URL</th><th>Events</th><th>Status</th><th style="text-align:center">Deliveries</th><th>Actions</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  ${paginationHtml(page, totalPages, total, p => `?page=${p}`)}`}`;

  return adminLayout('Webhooks', content, user, 'webhooks', flash);
}

export function webhookFormPage(user: User, error?: string, csrfToken?: string): string {
  const events = ['submission.created', 'submission.completed', 'submission.failed'];
  const content = `
  <div class="page-header">
    <div style="display:flex;align-items:center;gap:1rem">
      <a href="/admin/webhooks" class="btn btn-outline btn-sm">← กลับ</a>
      <div class="page-title">สร้าง Webhook</div>
    </div>
  </div>
  ${error ? `<div class="alert alert-danger">${esc(error)}</div>` : ''}
  <div class="card" style="max-width:600px">
    <div class="card-body">
      <form method="POST" action="/admin/webhooks">
        <input type="hidden" name="_csrf" value="${esc(csrfToken ?? '')}">
        <div class="form-group">
          <label>ชื่อ Webhook</label>
          <input type="text" name="name" required placeholder="เช่น My CRM Webhook">
        </div>
        <div class="form-group">
          <label>URL</label>
          <input type="url" name="url" required placeholder="https://...">
        </div>
        <div class="form-group">
          <label style="margin-bottom:0.5rem">Events ที่ต้องการรับ</label>
          <div style="display:flex;flex-direction:column;gap:0.4rem">
            ${events.map(e => `<label style="display:flex;align-items:center;gap:0.5rem;font-weight:400;font-size:0.875rem;cursor:pointer">
              <input type="checkbox" name="events" value="${e}" checked style="width:auto"> ${e}
            </label>`).join('')}
          </div>
        </div>
        <div class="form-group">
          <label style="margin-bottom:0.5rem">Form Types <span style="font-weight:400;color:var(--text-muted)">(ไม่เลือก = ทุกประเภท)</span></label>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:0.35rem">
            ${FORM_TYPES.map(t => `<label style="display:flex;align-items:center;gap:0.5rem;font-weight:400;font-size:0.82rem;cursor:pointer">
              <input type="checkbox" name="form_types" value="${t}" style="width:auto"> ${t}
            </label>`).join('')}
          </div>
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%">สร้าง Webhook</button>
      </form>
    </div>
  </div>`;

  return adminLayout('สร้าง Webhook', content, user, 'webhooks');
}

export function webhookDetailPage(
  webhook: Webhook,
  deliveries: WebhookDelivery[],
  deliveryTotal: number,
  deliveryPage: number,
  deliveryPerPage: number,
  user: User,
  secretVisible: boolean,
  flash?: string,
): string {
  const deliveryTotalPages = Math.ceil(deliveryTotal / deliveryPerPage);

  const deliveryRows = deliveries.map(d =>
    `<tr>
      <td>${statusBadge(d.status)}</td>
      <td style="font-size:0.78rem">${esc(d.event_type)}</td>
      <td style="font-size:0.78rem;color:var(--text-muted);white-space:nowrap">${esc(formatDate(d.created_at))}</td>
      <td style="text-align:center">${d.response_code ?? '—'}</td>
      <td style="text-align:center;color:var(--text-muted)">${d.attempt_count}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;font-size:0.78rem;color:var(--text-muted)">${esc(d.response_body?.slice(0, 100) ?? '—')}</td>
    </tr>`,
  ).join('');

  const deliveryPagination = deliveryTotal > deliveryPerPage
    ? paginationHtml(deliveryPage, deliveryTotalPages, deliveryTotal, p => `?delivery_page=${p}`, 'delivery_page')
    : '';

  const content = `
  <div class="page-header">
    <div style="display:flex;align-items:center;gap:1rem">
      <a href="/admin/webhooks" class="btn btn-outline btn-sm">← กลับ</a>
      <div>
        <div class="page-title">${esc(webhook.name)}</div>
        <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px">
          ${webhook.is_active ? '<span style="color:#7a4a00">● Active</span>' : '<span style="color:#c8a86b">○ Inactive</span>'}
        </div>
      </div>
    </div>
    <div style="display:flex;gap:0.5rem">
      <form method="POST" action="/admin/webhooks/${esc(webhook.id)}/toggle" style="margin:0">
        <button type="submit" class="btn btn-outline btn-sm">${webhook.is_active ? 'ปิด' : 'เปิด'} Webhook</button>
      </form>
      <form method="POST" action="/admin/webhooks/${esc(webhook.id)}/test" style="margin:0">
        <button type="submit" class="btn btn-primary btn-sm">▶ Test</button>
      </form>
    </div>
  </div>

  <div class="two-col" style="margin-bottom:1.5rem">
    <div class="card">
      <div class="card-header">การตั้งค่า</div>
      <div class="card-body">
        <table class="kv-table" style="width:100%">
          <tr><td>URL</td><td style="word-break:break-all;font-size:0.82rem">${esc(webhook.url)}</td></tr>
          <tr><td>Events</td><td style="font-size:0.82rem">${esc(JSON.parse(webhook.events).join(', '))}</td></tr>
          <tr><td>Form Types</td><td style="font-size:0.82rem">${webhook.form_types ? esc(JSON.parse(webhook.form_types).join(', ')) : 'ทุกประเภท'}</td></tr>
          <tr><td>Secret</td><td>
            ${secretVisible ? `<code>${esc(webhook.secret)}</code>` : `<span style="color:var(--text-muted)">••••••••</span> <a href="?show_secret=1" style="font-size:0.78rem">แสดง</a>`}
          </td></tr>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="card-header">Deliveries (${deliveryTotal})</div>
      ${deliveryTotal === 0
        ? '<div class="card-body" style="color:var(--text-muted);font-size:0.875rem">ยังไม่มี delivery</div>'
        : `<div class="table-wrap" style="border:none;border-radius:0">
            <table>
              <thead><tr><th>Status</th><th>Event</th><th>เวลา</th><th style="text-align:center">Code</th><th style="text-align:center">Attempts</th><th>Response</th></tr></thead>
              <tbody>${deliveryRows}</tbody>
            </table>
          </div>
          ${deliveryPagination}`}
    </div>
  </div>`;

  return adminLayout(`Webhook: ${webhook.name}`, content, user, 'webhooks', flash);
}
