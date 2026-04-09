import type { FormConfig } from 'shared/types';
import { FORMS_CONFIG } from 'shared/forms-config';
import { esc } from '../validators';
import { BASE_CSS } from './layout';

export function indexPage(): string {
  // ── Categories ──────────────────────────────────────────────────
  const categories: { label: string; types: string[] }[] = [
    { label: 'ติดต่อ & สนับสนุน',      types: ['contact', 'complaint', 'feedback', 'incident-report'] },
    { label: 'สมัครงาน & พาร์ทเนอร์', types: ['job-application', 'partnership'] },
    { label: 'สินค้า & บริการ',         types: ['product-inquiry', 'warranty-claim'] },
    { label: 'กิจกรรม & ข่าวสาร',      types: ['event-registration', 'newsletter'] },
  ];

  // ── Icons per form type (24×24 Feather-style SVG) ───────────────
  const icons: Record<string, string> = {
    'contact':            `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
    'job-application':    `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`,
    'complaint':          `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    'event-registration': `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
    'product-inquiry':    `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
    'warranty-claim':     `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    'newsletter':         `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2z"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="12" y2="15"/></svg>`,
    'feedback':           `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    'partnership':        `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    'incident-report':    `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  };

  // ── Category icon colors ─────────────────────────────────────────
  const catColors: Record<string, string> = {
    'ติดต่อ & สนับสนุน':      '#fa520f',
    'สมัครงาน & พาร์ทเนอร์':  '#ffa110',
    'สินค้า & บริการ':          '#ff8105',
    'กิจกรรม & ข่าวสาร':       '#fb6424',
  };

  const categorySections = categories.map(cat => {
    const cards = cat.types
      .filter(t => FORMS_CONFIG[t as keyof typeof FORMS_CONFIG])
      .map(type => {
        const cfg = FORMS_CONFIG[type as keyof typeof FORMS_CONFIG];
        const color = catColors[cat.label] ?? '#fa520f';
        const icon = icons[type] ?? icons['contact'];
        return `<a class="fc" href="/form/${esc(type)}" data-title="${esc(cfg.title.toLowerCase())} ${esc(type)}">
          <div class="fc-icon" style="color:${color};background:${color}18">${icon}</div>
          <div class="fc-body">
            <div class="fc-title">${esc(cfg.title)}</div>
            <div class="fc-desc">${esc(cfg.description)}</div>
            ${cfg.hasFileUpload ? `<span class="fc-badge">แนบไฟล์ได้</span>` : ''}
          </div>
          <div class="fc-arrow">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12,5 19,12 12,19"/></svg>
          </div>
        </a>`;
      }).join('\n');

    return `<section class="cat-section" data-cat="${esc(cat.label)}">
      <div class="cat-label">${esc(cat.label)}</div>
      <div class="cat-grid">${cards}</div>
    </section>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>แบบฟอร์มออนไลน์</title>
  <style>
    ${BASE_CSS}

    *, *::before, *::after { box-sizing: border-box; }
    body {
      min-height: 100vh;
      background: var(--ivory);
      padding: 0 0 4rem;
    }

    /* ── Top bar ── */
    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.875rem 2rem;
      border-bottom: 1px solid var(--border);
      background: #fff;
    }
    .topbar-brand {
      display: flex; align-items: center; gap: 8px;
    }
    .topbar-blocks { display: flex; gap: 0; }
    .topbar-blocks span { display: block; width: 5px; height: 18px; }
    .topbar-name { font-size: 14px; font-weight: 400; color: var(--black); letter-spacing: -.02em; }
    .topbar-link {
      font-size: 12px; color: var(--text-light); text-decoration: none;
      border: 1px solid var(--border); border-radius: 6px;
      padding: 0.3rem 0.75rem; transition: border-color .08s, color .08s;
    }
    .topbar-link:hover { border-color: var(--amber-light); color: var(--black); text-decoration: none; }

    /* ── Hero ── */
    .hero {
      text-align: center;
      padding: 3.5rem 1rem 2.5rem;
      max-width: 560px;
      margin: 0 auto;
    }
    .hero-title {
      font-size: 40px; font-weight: 400; color: var(--black);
      letter-spacing: -1px; line-height: 1.1; margin-bottom: 0.75rem;
    }
    .hero-sub {
      font-size: 15px; color: var(--text-muted); line-height: 1.6;
    }

    /* ── Search ── */
    .search-wrap {
      max-width: 440px; margin: 0 auto 2.5rem; padding: 0 1rem;
      position: relative;
    }
    .search-icon {
      position: absolute; left: 1.875rem; top: 50%; transform: translateY(-50%);
      color: var(--text-light); pointer-events: none;
    }
    .search-input {
      width: 100%; height: 44px;
      padding: 0 1rem 0 2.75rem;
      border: 1px solid var(--border); border-radius: 10px;
      background: #fff; color: var(--black); font-size: 14px;
      font-family: Arial, ui-sans-serif, system-ui, sans-serif;
      transition: border-color .08s, box-shadow .08s;
      box-shadow: 0 1px 4px rgba(127,99,21,0.06);
    }
    .search-input:focus {
      outline: none; border-color: var(--orange);
      box-shadow: 0 0 0 3px rgba(250,82,15,0.10);
    }
    .search-input::placeholder { color: var(--text-light); }

    /* ── Content ── */
    .content { max-width: 1000px; margin: 0 auto; padding: 0 1.5rem; }

    /* ── Category ── */
    .cat-section { margin-bottom: 2.25rem; }
    .cat-section.hidden { display: none; }
    .cat-label {
      font-size: 11px; font-weight: 400; color: var(--text-light);
      text-transform: uppercase; letter-spacing: .1em;
      margin-bottom: 0.75rem; padding-left: 2px;
    }
    .cat-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 0.75rem;
    }

    /* ── Form card ── */
    .fc {
      display: flex; align-items: flex-start; gap: 1rem;
      background: #fff; border: 1px solid var(--border); border-radius: 14px;
      padding: 1.25rem 1rem 1.25rem 1.25rem;
      text-decoration: none; color: inherit;
      transition: box-shadow .15s, transform .15s, border-color .15s;
      cursor: pointer;
    }
    .fc:hover {
      box-shadow: 0 6px 24px rgba(127,99,21,0.11), 0 1px 4px rgba(127,99,21,0.07);
      transform: translateY(-2px);
      border-color: var(--amber-light);
      text-decoration: none;
    }
    .fc.hidden { display: none; }

    .fc-icon {
      width: 40px; height: 40px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .fc-body { flex: 1; min-width: 0; }
    .fc-title {
      font-size: 14px; font-weight: 400; color: var(--black);
      margin-bottom: 0.25rem; letter-spacing: -.01em;
    }
    .fc-desc {
      font-size: 12px; color: var(--text-muted); line-height: 1.5;
    }
    .fc-badge {
      display: inline-block; margin-top: 0.5rem;
      font-size: 10px; color: var(--text-muted);
      background: var(--cream); border: 1px solid var(--amber-light);
      border-radius: 4px; padding: 1px 6px;
      letter-spacing: .03em;
    }
    .fc-arrow {
      color: var(--text-light); flex-shrink: 0; margin-top: 2px;
      transition: color .08s, transform .15s;
    }
    .fc:hover .fc-arrow { color: var(--orange); transform: translateX(2px); }

    /* ── No results ── */
    .no-results {
      text-align: center; padding: 3rem 1rem;
      color: var(--text-muted); font-size: 14px;
      display: none;
    }

    @media (max-width: 600px) {
      .hero-title { font-size: 28px; }
      .topbar { padding: 0.75rem 1rem; }
      .content { padding: 0 1rem; }
    }
  </style>
</head>
<body>

  <!-- Top bar -->
  <header class="topbar">
    <div class="topbar-brand">
      <div class="topbar-blocks">
        <span style="background:#ffd900"></span>
        <span style="background:#ffa110"></span>
        <span style="background:#ff8105"></span>
        <span style="background:#fb6424"></span>
        <span style="background:#fa520f"></span>
      </div>
      <span class="topbar-name">Form System</span>
    </div>
    <a href="/loadtest" class="topbar-link">Load Test</a>
  </header>

  <!-- Hero -->
  <div class="hero">
    <div class="hero-title">แบบฟอร์มออนไลน์</div>
    <div class="hero-sub">เลือกแบบฟอร์มที่ต้องการกรอก — ระบบจะดำเนินการและแจ้งผลอัตโนมัติ</div>
  </div>

  <!-- Search -->
  <div class="search-wrap">
    <span class="search-icon">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    </span>
    <input class="search-input" type="search" id="searchInput" placeholder="ค้นหาแบบฟอร์ม…" autocomplete="off">
  </div>

  <!-- Categories -->
  <div class="content" id="formContent">
    ${categorySections}
    <div class="no-results" id="noResults">ไม่พบแบบฟอร์มที่ตรงกับการค้นหา</div>
  </div>

  <script>
    var searchInput = document.getElementById('searchInput');
    var noResults   = document.getElementById('noResults');
    searchInput.addEventListener('input', function () {
      var q = this.value.trim().toLowerCase();
      var anyVisible = false;
      document.querySelectorAll('.fc').forEach(function (card) {
        var text = (card.dataset.title || '') + ' ' + (card.textContent || '');
        var match = !q || text.toLowerCase().includes(q);
        card.classList.toggle('hidden', !match);
        if (match) anyVisible = true;
      });
      document.querySelectorAll('.cat-section').forEach(function (sec) {
        var hasVisible = sec.querySelectorAll('.fc:not(.hidden)').length > 0;
        sec.classList.toggle('hidden', !hasVisible);
      });
      noResults.style.display = anyVisible ? 'none' : 'block';
    });
  </script>
</body>
</html>`;
}

export function formPage(config: FormConfig): string {
  const fieldsHtml = config.fields.map(field => {
    const id = `f_${field.name}`;
    const req = field.required ? ' required' : '';
    const ph = field.placeholder ? ` placeholder="${esc(field.placeholder)}"` : '';
    const reqMark = field.required ? ' <span style="color:#dc2626">*</span>' : '';

    if (field.type === 'textarea') {
      return `<div class="form-group">
        <label for="${id}">${esc(field.label)}${reqMark}</label>
        <textarea id="${id}" name="${field.name}" rows="${field.rows ?? 4}"${req}${ph}></textarea>
      </div>`;
    }

    if (field.type === 'select') {
      const opts = (field.options ?? []).map(o => `<option value="${esc(o)}">${esc(o)}</option>`).join('');
      return `<div class="form-group">
        <label for="${id}">${esc(field.label)}${reqMark}</label>
        <select id="${id}" name="${field.name}"${req}>
          <option value="">— เลือก —</option>
          ${opts}
        </select>
      </div>`;
    }

    if (field.type === 'multiselect') {
      const opts = (field.options ?? []).map(o =>
        `<label class="checkbox-label">
          <input type="checkbox" name="${field.name}" value="${esc(o)}"> ${esc(o)}
        </label>`,
      ).join('');
      return `<div class="form-group">
        <div class="field-legend">${esc(field.label)}${reqMark}</div>
        <div class="checkbox-group">${opts}</div>
      </div>`;
    }

    if (field.type === 'file') {
      const accept = field.accept ? ` accept="${esc(field.accept)}"` : '';
      const multi = field.multiple ? ' multiple' : '';
      return `<div class="form-group">
        <label for="${id}">${esc(field.label)}${reqMark}</label>
        <input type="file" id="${id}" name="${field.name}"${accept}${multi}${req}>
        <div class="field-hint">ขนาดสูงสุดต่อไฟล์ ${field.maxSizeMB ?? 5} MB${field.maxFiles ? ` · สูงสุด ${field.maxFiles} ไฟล์` : ''}</div>
      </div>`;
    }

    const minMax = field.min !== undefined ? ` min="${field.min}"` : '';
    const maxAttr = field.max !== undefined ? ` max="${field.max}"` : '';
    return `<div class="form-group">
      <label for="${id}">${esc(field.label)}${reqMark}</label>
      <input type="${field.type}" id="${id}" name="${field.name}"${req}${ph}${minMax}${maxAttr}>
    </div>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(config.title)}</title>
  <link rel="stylesheet" href="/style.css">
  <style>
    ${BASE_CSS}
    body { padding: 0; background: var(--bg); }
    .form-header {
      background: #1c1917;
      padding: 1.5rem 1.75rem;
      color: #fbbf24;
    }
    .form-header .back-link { font-size: 0.82rem; color: #a8a29e; text-decoration: none; display: inline-block; margin-bottom: 0.5rem; }
    .form-header .back-link:hover { color: #fbbf24; }
    .form-header h1 { font-size: 1.35rem; font-weight: 700; margin-bottom: 0.25rem; }
    .form-header p { font-size: 0.85rem; color: #a8a29e; }
    .form-body { max-width: 640px; margin: 2rem auto; padding: 0 1.25rem 3rem; }
    .form-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 1.75rem 2rem;
      box-shadow: var(--shadow-sm);
    }
    .form-group { margin-bottom: 1.1rem; }
    label { display: block; font-size: 0.82rem; font-weight: 600; color: #44403c; margin-bottom: 0.35rem; }
    input, select, textarea {
      width: 100%; padding: 0.6rem 0.875rem;
      border: 1px solid var(--border); border-radius: var(--radius-sm);
      background: #faf7f4; color: var(--text); font-size: 0.9rem;
      transition: border-color .12s, box-shadow .12s;
    }
    input:focus, select:focus, textarea:focus {
      outline: none; border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(37,99,235,.12); background: var(--bg-card);
    }
    input[type=file] { padding: 0.5rem; background: #faf7f4; }
    .field-hint { font-size: 0.75rem; color: var(--text-muted); margin-top: 0.3rem; }
    .field-legend { font-size: 0.82rem; font-weight: 600; color: #44403c; margin-bottom: 0.5rem; }
    .checkbox-group { display: flex; flex-direction: column; gap: 0.35rem; }
    .checkbox-label { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; font-weight: 400; cursor: pointer; }
    .checkbox-label input { width: auto; }
    .submit-btn {
      width: 100%; padding: 0.75rem 1rem;
      background: var(--primary); color: #fff;
      border: none; border-radius: var(--radius-sm);
      font-size: 0.95rem; font-weight: 600;
      cursor: pointer; margin-top: 0.5rem;
      transition: background .12s;
    }
    .submit-btn:hover { background: var(--primary-hover); }
    .submit-btn:disabled { opacity: .6; cursor: not-allowed; }
    .result-box { padding: 1rem; border-radius: var(--radius-sm); margin-top: 1rem; font-size: 0.875rem; }
    .result-ok { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; }
    .result-err { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
  </style>
</head>
<body>
  <div class="form-header">
    <a href="/" class="back-link">← กลับหน้าหลัก</a>
    <h1>${esc(config.title)}</h1>
    <p>${esc(config.description)}</p>
  </div>
  <div class="form-body">
    <div class="form-card">
      <form id="mainForm" method="POST" action="/submit/${config.type}" enctype="multipart/form-data" novalidate>
        ${fieldsHtml}
        <button type="submit" id="submitBtn" class="submit-btn">ส่งแบบฟอร์ม</button>
      </form>
      <div id="result" style="display:none"></div>
    </div>
  </div>
  <script>
    const form = document.getElementById('mainForm');
    const btn = document.getElementById('submitBtn');
    const result = document.getElementById('result');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      btn.disabled = true;
      btn.textContent = 'กำลังส่ง...';
      result.style.display = 'none';
      try {
        const res = await fetch(form.action, { method: 'POST', body: new FormData(form) });
        const json = await res.json();
        if (json.ok) {
          result.className = 'result-box result-ok';
          result.innerHTML = '<strong>✓ ส่งสำเร็จ!</strong> หมายเลขอ้างอิง: <code>' + json.submission_id + '</code>';
          result.style.display = 'block';
          form.reset();
        } else {
          result.className = 'result-box result-err';
          result.innerHTML = '<strong>เกิดข้อผิดพลาด:</strong> ' + (json.errors ? json.errors.map(function(e){return e.message}).join(', ') : json.error);
          result.style.display = 'block';
        }
      } catch(err) {
        result.className = 'result-box result-err';
        result.textContent = 'เกิดข้อผิดพลาดในการเชื่อมต่อ';
        result.style.display = 'block';
      }
      btn.disabled = false;
      btn.textContent = 'ส่งแบบฟอร์ม';
    });
  </script>
</body>
</html>`;
}
