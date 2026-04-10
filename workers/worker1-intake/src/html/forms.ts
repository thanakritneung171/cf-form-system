import type { FormConfig } from 'shared/types';
import { FORMS_CONFIG } from 'shared/forms-config';
import { esc } from '../validators';

// ── Shared brand CSS (forms use own minimal CSS, not ADMIN_CSS) ──────────────
const BRAND_BLOCKS = `
  <div style="display:flex;gap:0">
    <span style="background:#ffd900;width:5px;height:20px;display:block"></span>
    <span style="background:#ffa110;width:5px;height:20px;display:block"></span>
    <span style="background:#ff8105;width:5px;height:20px;display:block"></span>
    <span style="background:#fb6424;width:5px;height:20px;display:block"></span>
    <span style="background:#fa520f;width:5px;height:20px;display:block"></span>
  </div>`;

// ── Base CSS vars shared between index + form pages ──────────────────────────
const BASE = `
  :root {
    --cream:       #fffaeb;
    --ivory:       #fdf8ee;
    --amber:       #ffa110;
    --amber-light: #ffd06a;
    --orange:      #fa520f;
    --black:       #1a1209;
    --text:        #2e1f08;
    --text-muted:  #9c7c4a;
    --text-light:  #c8a86b;
    --border:      #eed9a8;
    --radius:      12px;
    --shadow:      0 4px 20px rgba(127,99,21,.10), 0 1px 4px rgba(127,99,21,.06);
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { font-size: 15px; }
  body {
    font-family: Arial, ui-sans-serif, system-ui, -apple-system, sans-serif;
    background: var(--ivory);
    color: var(--text);
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
  }
  a { color: var(--orange); text-decoration: none; }
  a:hover { text-decoration: underline; }`;

// ═══════════════════════════════════════════════════════════════════════════════
// INDEX PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export function indexPage(): string {
  const categories: { label: string; types: string[] }[] = [
    { label: 'ติดต่อ & สนับสนุน',      types: ['contact', 'complaint', 'feedback', 'incident-report'] },
    { label: 'สมัครงาน & พาร์ทเนอร์', types: ['job-application', 'partnership'] },
    { label: 'สินค้า & บริการ',         types: ['product-inquiry', 'warranty-claim'] },
    { label: 'กิจกรรม & ข่าวสาร',      types: ['event-registration', 'newsletter'] },
  ];

  const icons: Record<string, string> = {
    'contact':            `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
    'job-application':    `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`,
    'complaint':          `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    'event-registration': `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
    'product-inquiry':    `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
    'warranty-claim':     `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    'newsletter':         `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2z"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="12" y2="15"/></svg>`,
    'feedback':           `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    'partnership':        `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    'incident-report':    `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  };

  const catAccent: Record<string, string> = {
    'ติดต่อ & สนับสนุน':      '#fa520f',
    'สมัครงาน & พาร์ทเนอร์':  '#ffa110',
    'สินค้า & บริการ':          '#ff8105',
    'กิจกรรม & ข่าวสาร':       '#fb6424',
  };

  const categorySections = categories.map(cat => {
    const accent = catAccent[cat.label] ?? '#fa520f';
    const cards = cat.types
      .filter(t => FORMS_CONFIG[t as keyof typeof FORMS_CONFIG])
      .map(type => {
        const cfg = FORMS_CONFIG[type as keyof typeof FORMS_CONFIG];
        const icon = icons[type] ?? icons['contact'];
        return `<a class="fc" href="/form/${esc(type)}" data-title="${esc(cfg.title.toLowerCase())} ${esc(type)}">
          <div class="fc-icon" style="color:${accent};background:${accent}18">${icon}</div>
          <div class="fc-body">
            <div class="fc-title">${esc(cfg.title)}</div>
            <div class="fc-desc">${esc(cfg.description)}</div>
            ${cfg.hasFileUpload ? `<span class="fc-chip">📎 แนบไฟล์ได้</span>` : ''}
          </div>
          <svg class="fc-arrow" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12,5 19,12 12,19"/></svg>
        </a>`;
      }).join('');
    return `<section class="cat-section" data-cat="${esc(cat.label)}">
      <div class="cat-label">
        <span class="cat-dot" style="background:${accent}"></span>${esc(cat.label)}
      </div>
      <div class="cat-grid">${cards}</div>
    </section>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>แบบฟอร์มออนไลน์</title>
  <style>
    ${BASE}

    /* ── Topbar ── */
    .topbar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 2rem; height: 52px;
      background: #fff; border-bottom: 1px solid var(--border);
      position: sticky; top: 0; z-index: 10;
    }
    .tb-brand { display: flex; align-items: center; gap: 10px; }
    .tb-name  { font-size: 14px; font-weight: 400; color: var(--black); letter-spacing: -.02em; }
    .tb-link  {
      font-size: 12px; color: var(--text-muted);
      border: 1px solid var(--border); border-radius: 7px;
      padding: 0.28rem 0.8rem; transition: all .1s;
    }
    .tb-link:hover { border-color: var(--amber); color: var(--black); text-decoration: none; }

    /* ── Hero ── */
    .hero { text-align: center; padding: 3.5rem 1rem 2.25rem; max-width: 540px; margin: 0 auto; }
    .hero-eyebrow {
      display: inline-flex; align-items: center; gap: 6px;
      font-size: 11px; color: var(--text-muted); letter-spacing: .1em;
      text-transform: uppercase; margin-bottom: 1rem;
      background: #fff; border: 1px solid var(--border); border-radius: 99px;
      padding: 0.25rem 0.875rem;
    }
    .hero-eyebrow span { width: 6px; height: 6px; border-radius: 50%; background: var(--orange); display: inline-block; }
    .hero-title { font-size: 38px; font-weight: 400; color: var(--black); letter-spacing: -1.5px; line-height: 1.1; margin-bottom: 0.875rem; }
    .hero-sub   { font-size: 14px; color: var(--text-muted); line-height: 1.7; }

    /* ── Search ── */
    .search-wrap { max-width: 420px; margin: 0 auto 2.5rem; padding: 0 1.25rem; position: relative; }
    .search-icon { position: absolute; left: 2.125rem; top: 50%; transform: translateY(-50%); color: var(--text-light); pointer-events: none; }
    .search-input {
      width: 100%; height: 44px;
      padding: 0 1rem 0 2.75rem;
      border: 1px solid var(--border); border-radius: 10px;
      background: #fff; color: var(--black); font-size: 14px;
      font-family: inherit;
      box-shadow: 0 1px 4px rgba(127,99,21,.06);
      transition: border-color .1s, box-shadow .1s;
    }
    .search-input:focus { outline: none; border-color: var(--orange); box-shadow: 0 0 0 3px rgba(250,82,15,.10); }
    .search-input::placeholder { color: var(--text-light); }

    /* ── Content ── */
    .page-content { max-width: 980px; margin: 0 auto; padding: 0 1.5rem 5rem; }

    /* ── Category section ── */
    .cat-section { margin-bottom: 2.25rem; }
    .cat-section.hidden { display: none; }
    .cat-label {
      display: flex; align-items: center; gap: 7px;
      font-size: 11px; font-weight: 400; color: var(--text-muted);
      text-transform: uppercase; letter-spacing: .1em;
      margin-bottom: 0.875rem;
    }
    .cat-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
    .cat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(276px, 1fr)); gap: 0.75rem; }

    /* ── Form card ── */
    .fc {
      display: flex; align-items: center; gap: 1rem;
      background: #fff; border: 1px solid var(--border); border-radius: 14px;
      padding: 1.125rem 1rem 1.125rem 1.25rem;
      text-decoration: none; color: inherit;
      transition: box-shadow .15s, transform .15s, border-color .15s;
    }
    .fc:hover {
      box-shadow: 0 6px 24px rgba(127,99,21,.12), 0 1px 4px rgba(127,99,21,.07);
      transform: translateY(-2px); border-color: var(--amber-light);
      text-decoration: none;
    }
    .fc.hidden { display: none; }
    .fc-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .fc-body { flex: 1; min-width: 0; }
    .fc-title { font-size: 14px; color: var(--black); margin-bottom: 0.2rem; }
    .fc-desc  { font-size: 12px; color: var(--text-muted); line-height: 1.5; }
    .fc-chip  {
      display: inline-block; margin-top: 0.4rem;
      font-size: 10px; color: var(--text-muted);
      background: var(--cream); border: 1px solid var(--border);
      border-radius: 5px; padding: 1px 6px;
    }
    .fc-arrow { color: var(--text-light); flex-shrink: 0; transition: color .1s, transform .15s; }
    .fc:hover .fc-arrow { color: var(--orange); transform: translateX(3px); }

    /* ── No results ── */
    .no-results { text-align: center; padding: 3rem 1rem; color: var(--text-muted); font-size: 14px; display: none; }
    .no-results svg { display: block; margin: 0 auto 0.75rem; opacity: .3; }

    @media (max-width: 600px) {
      .hero-title { font-size: 28px; }
      .topbar { padding: 0 1rem; }
      .page-content { padding: 0 1rem 4rem; }
    }
  </style>
</head>
<body>
  <header class="topbar">
    <div class="tb-brand">
      ${BRAND_BLOCKS}
      <span class="tb-name">Form System</span>
    </div>
    <a href="/admin/login" class="tb-link">Login</a>
  </header>

  <div class="hero">
    <div class="hero-eyebrow"><span></span>ออนไลน์ · ปลอดภัย · รวดเร็ว</div>
    <div class="hero-title">แบบฟอร์มออนไลน์</div>
    <div class="hero-sub">เลือกแบบฟอร์มที่ต้องการ — ระบบจะดำเนินการและแจ้งผลอัตโนมัติ</div>
  </div>

  <div class="search-wrap">
    <span class="search-icon">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    </span>
    <input class="search-input" type="search" id="searchInput" placeholder="ค้นหาแบบฟอร์ม…" autocomplete="off">
  </div>

  <div class="page-content" id="formContent">
    ${categorySections}
    <div class="no-results" id="noResults">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      ไม่พบแบบฟอร์มที่ตรงกับการค้นหา
    </div>
  </div>

  <script>
    var inp = document.getElementById('searchInput');
    var noR = document.getElementById('noResults');
    inp.addEventListener('input', function() {
      var q = this.value.trim().toLowerCase();
      var any = false;
      document.querySelectorAll('.fc').forEach(function(c) {
        var m = !q || ((c.dataset.title||'') + c.textContent).toLowerCase().includes(q);
        c.classList.toggle('hidden', !m);
        if (m) any = true;
      });
      document.querySelectorAll('.cat-section').forEach(function(s) {
        s.classList.toggle('hidden', !s.querySelectorAll('.fc:not(.hidden)').length);
      });
      noR.style.display = any ? 'none' : 'block';
    });
  </script>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORM PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export function formPage(config: FormConfig, wrToken?: string, wrTtlSeconds?: number): string {
  const fieldsHtml = config.fields.map(field => {
    const id  = `f_${field.name}`;
    const req = field.required ? ' required' : '';
    const ph  = field.placeholder ? ` placeholder="${esc(field.placeholder)}"` : '';
    const reqMark = field.required
      ? ` <span class="req-star" aria-hidden="true">*</span>`
      : '';

    if (field.type === 'textarea') {
      return `<div class="fg">
        <label for="${id}">${esc(field.label)}${reqMark}</label>
        <textarea id="${id}" name="${field.name}" rows="${field.rows ?? 4}"${req}${ph}></textarea>
      </div>`;
    }

    if (field.type === 'select') {
      const opts = (field.options ?? []).map(o => `<option value="${esc(o)}">${esc(o)}</option>`).join('');
      return `<div class="fg">
        <label for="${id}">${esc(field.label)}${reqMark}</label>
        <div class="select-wrap">
          <select id="${id}" name="${field.name}"${req}>
            <option value="">— เลือก —</option>
            ${opts}
          </select>
          <svg class="sel-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>`;
    }

    if (field.type === 'multiselect') {
      const opts = (field.options ?? []).map(o =>
        `<label class="cb-label">
          <span class="cb-box"><input type="checkbox" name="${field.name}" value="${esc(o)}"><span class="cb-check"></span></span>
          <span>${esc(o)}</span>
        </label>`,
      ).join('');
      return `<div class="fg">
        <div class="field-legend">${esc(field.label)}${reqMark}</div>
        <div class="cb-group">${opts}</div>
      </div>`;
    }

    if (field.type === 'file') {
      const accept = field.accept ? ` accept="${esc(field.accept)}"` : '';
      const multi  = field.multiple ? ' multiple' : '';
      return `<div class="fg">
        <label for="${id}">${esc(field.label)}${reqMark}</label>
        <label class="file-drop" for="${id}" id="drop_${id}">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
          <div class="file-drop-text">คลิกหรือลากไฟล์มาวางที่นี่</div>
          <div class="file-drop-hint">ขนาดสูงสุด ${field.maxSizeMB ?? 5} MB${field.maxFiles ? ` · สูงสุด ${field.maxFiles} ไฟล์` : ''}${field.accept ? ` · ${esc(field.accept)}` : ''}</div>
          <div class="file-name" id="fn_${id}"></div>
          <input type="file" id="${id}" name="${field.name}"${accept}${multi}${req} style="display:none">
        </label>
      </div>`;
    }

    const minMax = field.min !== undefined ? ` min="${field.min}"` : '';
    const maxAttr = field.max !== undefined ? ` max="${field.max}"` : '';
    return `<div class="fg">
      <label for="${id}">${esc(field.label)}${reqMark}</label>
      <input type="${field.type}" id="${id}" name="${field.name}"${req}${ph}${minMax}${maxAttr}>
    </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(config.title)}</title>
  <style>
    ${BASE}

    body { background: var(--ivory); min-height: 100vh; }

    /* ── Top bar ── */
    .topbar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 2rem; height: 52px;
      background: #fff; border-bottom: 1px solid var(--border);
      position: sticky; top: 0; z-index: 10;
    }
    .tb-brand { display: flex; align-items: center; gap: 10px; }
    .tb-name  { font-size: 14px; color: var(--black); }
    .back-link {
      display: inline-flex; align-items: center; gap: 6px;
      font-size: 13px; color: var(--text-muted);
      border: 1px solid var(--border); border-radius: 7px;
      padding: 0.28rem 0.8rem; transition: all .1s;
    }
    .back-link:hover { border-color: var(--amber); color: var(--black); text-decoration: none; }

    /* ── Form layout ── */
    .form-outer {
      max-width: 620px; margin: 2.5rem auto 5rem;
      padding: 0 1.25rem;
    }

    /* ── Form hero ── */
    .form-hero {
      text-align: center; margin-bottom: 2rem;
    }
    .form-icon-wrap {
      display: inline-flex; align-items: center; justify-content: center;
      width: 60px; height: 60px; border-radius: 16px;
      background: #fa520f18; color: var(--orange);
      margin-bottom: 1rem;
    }
    .form-hero-title { font-size: 24px; font-weight: 400; color: var(--black); letter-spacing: -.5px; margin-bottom: 0.4rem; }
    .form-hero-desc  { font-size: 13px; color: var(--text-muted); }

    /* ── Card ── */
    .form-card {
      background: #fff;
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 2rem 2rem 1.75rem;
      box-shadow: var(--shadow);
    }

    /* ── Required indicator ── */
    .req-note { font-size: 12px; color: var(--text-muted); margin-bottom: 1.5rem; }
    .req-star { color: var(--orange); font-style: normal; margin-left: 2px; }

    /* ── Field group ── */
    .fg { margin-bottom: 1.25rem; }
    label {
      display: block; font-size: 12px; font-weight: 400;
      color: var(--text-muted); text-transform: uppercase; letter-spacing: .05em;
      margin-bottom: 0.4rem;
    }
    input[type=text], input[type=email], input[type=tel], input[type=number],
    input[type=url], input[type=date], input[type=datetime-local], select, textarea {
      width: 100%; padding: 0.65rem 0.9rem;
      border: 1px solid #e8d5a8; border-radius: 10px;
      background: #fffdf7; color: var(--text);
      font-size: 14px; font-family: inherit;
      transition: border-color .1s, box-shadow .1s;
    }
    input:focus, select:focus, textarea:focus {
      outline: none; border-color: var(--amber);
      box-shadow: 0 0 0 3px rgba(255,161,16,.15);
      background: #fff;
    }
    textarea { resize: vertical; min-height: 100px; }

    /* ── Select wrapper ── */
    .select-wrap { position: relative; }
    .select-wrap select { appearance: none; padding-right: 2.25rem; cursor: pointer; }
    .sel-arrow { position: absolute; right: 0.875rem; top: 50%; transform: translateY(-50%); color: var(--text-muted); pointer-events: none; }

    /* ── Checkbox group ── */
    .field-legend { font-size: 12px; color: var(--text-muted); text-transform: uppercase; letter-spacing: .05em; margin-bottom: 0.6rem; }
    .cb-group { display: flex; flex-direction: column; gap: 0.5rem; }
    .cb-label {
      display: flex; align-items: center; gap: 0.625rem;
      font-size: 14px; color: var(--text); cursor: pointer;
      padding: 0.5rem 0.75rem; border-radius: 8px;
      border: 1px solid transparent; transition: background .1s, border-color .1s;
    }
    .cb-label:hover { background: var(--cream); border-color: var(--border); }
    .cb-box { position: relative; flex-shrink: 0; }
    .cb-box input { position: absolute; opacity: 0; width: 0; height: 0; }
    .cb-check {
      display: block; width: 18px; height: 18px;
      border: 1.5px solid #e8d5a8; border-radius: 5px;
      background: #fffdf7; transition: background .1s, border-color .1s;
    }
    .cb-box input:checked ~ .cb-check {
      background: var(--orange); border-color: var(--orange);
      background-image: url("data:image/svg+xml,%3Csvg width='11' height='8' viewBox='0 0 11 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 4L4 7L10 1' stroke='white' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
      background-repeat: no-repeat; background-position: center;
    }

    /* ── File drop zone ── */
    .file-drop {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 0.4rem; padding: 2rem 1rem;
      border: 1.5px dashed #e8d5a8; border-radius: 12px;
      background: #fffdf7; cursor: pointer;
      transition: background .1s, border-color .1s;
      text-align: center;
    }
    .file-drop:hover, .file-drop.drag-over { background: var(--cream); border-color: var(--amber); }
    .file-drop svg { color: var(--text-light); }
    .file-drop-text { font-size: 13px; color: var(--text-muted); }
    .file-drop-hint { font-size: 11px; color: var(--text-light); }
    .file-name { font-size: 12px; color: var(--orange); font-weight: 400; min-height: 1.2em; margin-top: 0.25rem; }

    /* ── Divider ── */
    .form-divider { height: 1px; background: var(--border); margin: 1.5rem 0; }

    /* ── Submit button ── */
    .submit-btn {
      width: 100%; padding: 0.875rem 1rem;
      background: linear-gradient(135deg, #ff8105 0%, #fa520f 100%);
      color: #fff; border: none; border-radius: 10px;
      font-size: 15px; font-family: inherit;
      cursor: pointer; letter-spacing: -.01em;
      transition: opacity .1s, transform .1s;
      display: flex; align-items: center; justify-content: center; gap: 8px;
    }
    .submit-btn:hover:not(:disabled) { opacity: .92; transform: translateY(-1px); }
    .submit-btn:active:not(:disabled) { transform: translateY(0); }
    .submit-btn:disabled { opacity: .5; cursor: not-allowed; transform: none; }
    .submit-spinner {
      width: 16px; height: 16px; border: 2px solid rgba(255,255,255,.4);
      border-top-color: #fff; border-radius: 50%;
      animation: spin .6s linear infinite; display: none;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Error box (inline) ── */
    .err-box {
      display: none; padding: 0.875rem 1rem;
      background: #fff5f0; border: 1px solid #fbbf9a; border-radius: 10px;
      color: #7a2800; font-size: 13px; margin-top: 1rem;
      display: flex; align-items: flex-start; gap: 0.5rem;
    }
    .err-box svg { flex-shrink: 0; margin-top: 1px; }

    /* ══════════════════════════════════════════════
       SUCCESS POPUP OVERLAY
    ══════════════════════════════════════════════ */
    .popup-backdrop {
      display: none;
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(26,18,9,.45);
      backdrop-filter: blur(4px);
      align-items: center; justify-content: center;
      padding: 1.5rem;
    }
    .popup-backdrop.show { display: flex; animation: fadeIn .2s ease; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    .popup-card {
      background: #fff;
      border: 1px solid var(--border);
      border-radius: 22px;
      padding: 2.5rem 2rem 2rem;
      max-width: 420px; width: 100%;
      text-align: center;
      box-shadow: 0 20px 60px rgba(127,99,21,.20), 0 4px 12px rgba(127,99,21,.10);
      animation: slideUp .25s cubic-bezier(.34,1.3,.64,1);
    }
    @keyframes slideUp { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

    /* ── Animated checkmark ── */
    .popup-check-wrap {
      width: 72px; height: 72px; margin: 0 auto 1.5rem;
      border-radius: 50%;
      background: linear-gradient(135deg, #ff8105 0%, #fa520f 100%);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 8px 24px rgba(250,82,15,.30);
      animation: popIn .35s cubic-bezier(.34,1.5,.64,1) .1s both;
    }
    @keyframes popIn { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    .popup-check { color: #fff; animation: drawCheck .3s ease .4s both; }
    @keyframes drawCheck { from { opacity: 0; transform: scale(.6); } to { opacity: 1; transform: scale(1); } }

    .popup-title { font-size: 22px; font-weight: 400; color: var(--black); letter-spacing: -.5px; margin-bottom: 0.4rem; }
    .popup-sub   { font-size: 13px; color: var(--text-muted); line-height: 1.6; margin-bottom: 1.25rem; }
    .popup-ref   {
      display: inline-block;
      background: var(--cream); border: 1px solid var(--border);
      border-radius: 8px; padding: 0.5rem 1rem;
      font-size: 12px; color: var(--text-muted);
      margin-bottom: 1.75rem; word-break: break-all;
    }
    .popup-ref code { font-family: ui-monospace, monospace; color: var(--orange); font-size: 12px; }

    /* ── Countdown ring ── */
    .popup-countdown-wrap {
      display: flex; flex-direction: column; align-items: center;
      margin-bottom: 1.5rem; gap: 0.5rem;
    }
    .countdown-ring { position: relative; width: 48px; height: 48px; }
    .countdown-ring svg { transform: rotate(-90deg); }
    .ring-bg   { fill: none; stroke: #f0e4c0; stroke-width: 3; }
    .ring-fill { fill: none; stroke: var(--orange); stroke-width: 3; stroke-linecap: round;
                 stroke-dasharray: 125.6; stroke-dashoffset: 0; transition: stroke-dashoffset 1s linear; }
    .countdown-num {
      position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
      font-size: 15px; font-weight: 400; color: var(--orange);
    }
    .countdown-label { font-size: 11px; color: var(--text-light); }

    .popup-btn-wrap { display: flex; gap: 0.75rem; }
    .popup-btn-go {
      flex: 1; padding: 0.75rem 1rem;
      background: linear-gradient(135deg, #ff8105 0%, #fa520f 100%);
      color: #fff; border: none; border-radius: 10px;
      font-size: 14px; font-family: inherit; cursor: pointer;
      transition: opacity .1s, transform .1s;
    }
    .popup-btn-go:hover { opacity: .9; transform: translateY(-1px); }
    .popup-btn-stay {
      padding: 0.75rem 1rem;
      background: transparent; color: var(--text-muted);
      border: 1px solid var(--border); border-radius: 10px;
      font-size: 14px; font-family: inherit; cursor: pointer;
      transition: all .1s;
    }
    .popup-btn-stay:hover { background: var(--cream); border-color: var(--amber-light); color: var(--black); }

    /* ── Token TTL bar ── */
    .ttl-bar-wrap {
      display: flex; align-items: center; gap: 0.75rem;
      padding: 0.55rem 2rem;
      background: #fffbf2; border-bottom: 1px solid var(--border);
      transition: background .3s;
    }
    .ttl-bar-wrap.ttl-warn   { background: #fff8f0; border-bottom-color: #fbbf9a; }
    .ttl-bar-wrap.ttl-danger { background: #fff0f0; border-bottom-color: #f87171; }
    .ttl-bar-icon { flex-shrink: 0; color: var(--text-muted); }
    .ttl-bar-wrap.ttl-warn   .ttl-bar-icon { color: #fb923c; }
    .ttl-bar-wrap.ttl-danger .ttl-bar-icon { color: #dc2626; }
    .ttl-bar-track {
      flex: 1; height: 5px; background: #eed9a8; border-radius: 3px; overflow: hidden;
    }
    .ttl-bar-fill {
      height: 100%; width: 100%; border-radius: 3px;
      background: var(--amber); transition: width 1s linear, background .5s;
    }
    .ttl-bar-wrap.ttl-warn   .ttl-bar-fill { background: #fb923c; }
    .ttl-bar-wrap.ttl-danger .ttl-bar-fill { background: #dc2626; }
    .ttl-bar-text {
      font-size: 11px; color: var(--text-muted); white-space: nowrap; min-width: 80px; text-align: right;
    }
    .ttl-bar-wrap.ttl-danger .ttl-bar-text { color: #dc2626; font-weight: 600; }

    @media (max-width: 600px) {
      .form-card { padding: 1.5rem 1.25rem; }
      .popup-btn-wrap { flex-direction: column-reverse; }
      .ttl-bar-wrap { padding: 0.5rem 1rem; }
    }
  </style>
</head>
<body>

  <!-- Top bar -->
  <header class="topbar">
    <div class="tb-brand">
      ${BRAND_BLOCKS}
      <span class="tb-name">Form System</span>
    </div>
    <a href="/" class="back-link">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      กลับหน้าหลัก
    </a>
  </header>

${wrToken && wrTtlSeconds ? `
  <!-- Token TTL bar -->
  <div class="ttl-bar-wrap" id="ttlBar">
    <svg class="ttl-bar-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
    <div class="ttl-bar-track"><div class="ttl-bar-fill" id="ttlFill"></div></div>
    <div class="ttl-bar-text" id="ttlText">เหลือ — วินาที</div>
  </div>` : ''}

  <!-- Form hero -->
  <div class="form-outer">
    <div class="form-hero">
      <div class="form-icon-wrap">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
      </div>
      <div class="form-hero-title">${esc(config.title)}</div>
      <div class="form-hero-desc">${esc(config.description)}</div>
    </div>

    <!-- Form card -->
    <div class="form-card">
      <p class="req-note">ช่องที่มีเครื่องหมาย <span class="req-star">*</span> จำเป็นต้องกรอก</p>

      <form id="mainForm" method="POST" action="/submit/${config.type}" enctype="multipart/form-data" novalidate>
        ${fieldsHtml}
        <div class="form-divider"></div>
        <button type="submit" id="submitBtn" class="submit-btn">
          <span class="submit-spinner" id="spinner"></span>
          <span id="btnText">ส่งแบบฟอร์ม</span>
        </button>
      </form>

      <!-- Error box -->
      <div class="err-box" id="errBox" style="display:none">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span id="errMsg"></span>
      </div>
    </div>
  </div>

  <!-- ══════════════════════════════════════
       SUCCESS POPUP
  ══════════════════════════════════════ -->
  <div class="popup-backdrop" id="successPopup" role="dialog" aria-modal="true" aria-labelledby="popupTitle">
    <div class="popup-card">

      <div class="popup-check-wrap">
        <svg class="popup-check" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>

      <div class="popup-title" id="popupTitle">ส่งแบบฟอร์มสำเร็จ!</div>
      <div class="popup-sub">ข้อมูลของคุณได้รับการบันทึกเรียบร้อยแล้ว<br>ระบบจะดำเนินการและแจ้งผลตามขั้นตอน</div>

      <div class="popup-ref">
        หมายเลขอ้างอิง: <code id="popupRef">—</code>
      </div>

      <div class="popup-countdown-wrap">
        <div class="countdown-ring">
          <svg width="48" height="48" viewBox="0 0 48 48">
            <circle class="ring-bg"   cx="24" cy="24" r="20"/>
            <circle class="ring-fill" cx="24" cy="24" r="20" id="ringFill"/>
          </svg>
          <div class="countdown-num" id="countNum">5</div>
        </div>
        <div class="countdown-label">วินาที แล้วจะไปหน้าหลัก</div>
      </div>

      <div class="popup-btn-wrap">
        <button class="popup-btn-go"   id="popupGo"   onclick="goHome()">ไปหน้าหลักเลย</button>
        <button class="popup-btn-stay" id="popupStay" onclick="stayHere()">กรอกฟอร์มใหม่</button>
      </div>

    </div>
  </div>

  <script>
    /* ── File input labels ── */
    document.querySelectorAll('input[type="file"]').forEach(function(inp) {
      var drop = document.getElementById('drop_' + inp.id);
      var nm   = document.getElementById('fn_'   + inp.id);
      if (!drop || !nm) return;

      inp.addEventListener('change', function() {
        var files = Array.from(this.files);
        nm.textContent = files.length ? files.map(function(f){return f.name}).join(', ') : '';
      });

      drop.addEventListener('dragover',  function(e){ e.preventDefault(); drop.classList.add('drag-over'); });
      drop.addEventListener('dragleave', function()  { drop.classList.remove('drag-over'); });
      drop.addEventListener('drop', function(e) {
        e.preventDefault(); drop.classList.remove('drag-over');
        if (e.dataTransfer.files.length) {
          inp.files = e.dataTransfer.files;
          inp.dispatchEvent(new Event('change'));
        }
      });
    });

    /* ── Form submit ── */
    var form     = document.getElementById('mainForm');
    var btn      = document.getElementById('submitBtn');
    var btnText  = document.getElementById('btnText');
    var spinner  = document.getElementById('spinner');
    var errBox   = document.getElementById('errBox');
    var errMsg   = document.getElementById('errMsg');

    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      btn.disabled = true;
      spinner.style.display = 'block';
      btnText.textContent = 'กำลังส่ง…';
      errBox.style.display = 'none';

      try {
        var res  = await fetch(form.action, { method: 'POST', body: new FormData(form) });
        var json = await res.json();

        if (json.ok) {
          form.reset();
          showSuccess(json.submission_id);
        } else {
          var msg = json.errors
            ? json.errors.map(function(er){return er.message}).join(' · ')
            : (json.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
          errMsg.textContent = msg;
          errBox.style.display = 'flex';
          errBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      } catch(_) {
        errMsg.textContent = 'เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาตรวจสอบอินเทอร์เน็ตและลองใหม่';
        errBox.style.display = 'flex';
      }

      btn.disabled = false;
      spinner.style.display = 'none';
      btnText.textContent = 'ส่งแบบฟอร์ม';
    });

    /* ── Success popup ── */
    var popup      = document.getElementById('successPopup');
    var popupRef   = document.getElementById('popupRef');
    var countNum   = document.getElementById('countNum');
    var ringFill   = document.getElementById('ringFill');
    var countdown  = 5;
    var countTimer = null;
    var CIRCUMF    = 125.6; /* 2π × r=20 */

    function showSuccess(submissionId) {
      popupRef.textContent = submissionId || '—';
      countdown = 5;
      countNum.textContent = countdown;
      ringFill.style.strokeDashoffset = '0';
      popup.classList.add('show');
      startCountdown();
    }

    function startCountdown() {
      clearInterval(countTimer);
      countTimer = setInterval(function() {
        countdown--;
        countNum.textContent = countdown;
        /* Animate ring: offset goes from 0 → CIRCUMF over 5 steps */
        ringFill.style.strokeDashoffset = String(CIRCUMF * (1 - countdown / 5));
        if (countdown <= 0) { clearInterval(countTimer); goHome(); }
      }, 1000);
    }

    function goHome() {
      clearInterval(countTimer);
      popup.classList.remove('show');
      window.location.href = '/';
    }

    function stayHere() {
      clearInterval(countTimer);
      popup.classList.remove('show');
    }

    /* Close on backdrop click */
    popup.addEventListener('click', function(e) {
      if (e.target === popup) stayHere();
    });

    /* Close on Escape */
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && popup.classList.contains('show')) stayHere();
    });
  </script>
${wrToken ? `<script>
/* ── Waiting Room heartbeat + TTL countdown ── */
(function() {
  'use strict';
  var FORM_TYPE   = ${JSON.stringify(config.type)};
  var SAVE_KEY    = 'wr_form_data_' + FORM_TYPE;
  var formDirty   = false;

  // ── บันทึก / กู้คืนข้อมูลฟอร์ม ──────────────────────────────────────────
  function saveFormData() {
    var data = {};
    document.querySelectorAll('#mainForm [name]').forEach(function(el) {
      var e = el;
      if (e.type === 'checkbox') {
        if (!data[e.name]) data[e.name] = [];
        if (e.checked) data[e.name].push(e.value);
      } else if (e.type === 'file') {
        // ไม่สามารถบันทึก file input ได้
      } else {
        data[e.name] = e.value;
      }
    });
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch(_) {}
  }

  function restoreFormData() {
    var raw;
    try { raw = localStorage.getItem(SAVE_KEY); } catch(_) { return; }
    if (!raw) return;
    var data;
    try { data = JSON.parse(raw); } catch(_) { return; }
    document.querySelectorAll('#mainForm [name]').forEach(function(el) {
      var e = el;
      var val = data[e.name];
      if (val === undefined) return;
      if (e.type === 'checkbox') {
        e.checked = Array.isArray(val) && val.indexOf(e.value) !== -1;
      } else if (e.type !== 'file') {
        e.value = val;
      }
    });
    try { localStorage.removeItem(SAVE_KEY); } catch(_) {}
  }

  // กู้คืนข้อมูลที่บันทึกไว้ (ถ้ามี) ทันทีที่โหลดหน้า
  restoreFormData();

  // ติดตามว่า user กรอกอยู่จริง
  document.querySelectorAll('input, textarea, select').forEach(function(el) {
    el.addEventListener('input', function() { formDirty = true; });
  });

  // Heartbeat ทุก 2 นาที — ยิงเฉพาะเมื่อกรอกอยู่
  setInterval(function() {
    if (!formDirty) return;
    formDirty = false;
    fetch('/api/waiting-room/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formType: FORM_TYPE }),
      keepalive: true,
    }).catch(function() {});
  }, 2 * 60 * 1000);

  // ปิด tab → คืน slot ทันที (best-effort)
  window.addEventListener('beforeunload', function() {
    navigator.sendBeacon(
      '/api/waiting-room/release',
      JSON.stringify({ formType: FORM_TYPE })
    );
  });

  ${wrTtlSeconds ? `
  // ── TTL Countdown bar ────────────────────────────────────────────────────
  var ttlBar  = document.getElementById('ttlBar');
  var ttlFill = document.getElementById('ttlFill');
  var ttlText = document.getElementById('ttlText');
  var ttlTotal   = ${wrTtlSeconds};
  var ttlRemain  = ttlTotal;

  function updateTtlBar() {
    var pct = ttlTotal > 0 ? (ttlRemain / ttlTotal) * 100 : 0;
    ttlFill.style.width = pct + '%';

    var m = Math.floor(ttlRemain / 60);
    var s = ttlRemain % 60;
    ttlText.textContent = m > 0
      ? 'เหลือ ' + m + ':' + (s < 10 ? '0' : '') + s + ' นาที'
      : 'เหลือ ' + ttlRemain + ' วินาที';

    ttlBar.classList.remove('ttl-warn', 'ttl-danger');
    if (ttlRemain <= 30)      ttlBar.classList.add('ttl-danger');
    else if (ttlRemain <= 60) ttlBar.classList.add('ttl-warn');
  }

  function onTtlExpired() {
    saveFormData();
    ttlText.textContent = 'หมดเวลา — กำลังเข้าคิวใหม่…';
    ttlFill.style.width = '0%';
    ttlBar.classList.add('ttl-danger');
    // redirect กลับหน้าฟอร์ม (เข้าคิวใหม่) หลัง 1.5 วินาที
    setTimeout(function() {
      window.location.href = '/form/' + encodeURIComponent(FORM_TYPE);
    }, 1500);
  }

  updateTtlBar();
  var ttlTimer = setInterval(function() {
    ttlRemain--;
    if (ttlRemain <= 0) {
      clearInterval(ttlTimer);
      onTtlExpired();
    } else {
      updateTtlBar();
    }
  }, 1000);
  ` : ''}
})();
</script>` : ''}
</body>
</html>`;
}
