import type { FormConfig } from 'shared/types';
import { FORMS_CONFIG, FORM_TYPES } from 'shared/forms-config';
import { esc } from '../validators';
import { BASE_CSS } from './layout';

export function indexPage(): string {
  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>แบบฟอร์มออนไลน์</title>
  <style>
    ${BASE_CSS}
    body { padding: 2.5rem 1rem; }
    .page-head { text-align: center; margin-bottom: 2.5rem; }
    .page-head h1 { font-size: 1.9rem; font-weight: 700; margin-bottom: 0.4rem; }
    .page-head p { color: var(--text-muted); font-size: 0.95rem; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(268px, 1fr));
      gap: 1rem;
      max-width: 960px;
      margin: 0 auto;
    }
    .form-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 1.25rem 1.5rem;
      text-decoration: none;
      color: inherit;
      display: block;
      transition: box-shadow .15s, transform .15s, border-color .15s;
      box-shadow: var(--shadow-sm);
    }
    .form-card:hover {
      box-shadow: var(--shadow);
      transform: translateY(-2px);
      border-color: #c6b8a8;
      text-decoration: none;
    }
    .form-card h3 { font-size: 0.95rem; font-weight: 600; color: #1e40af; margin-bottom: 0.35rem; }
    .form-card p { font-size: 0.82rem; color: var(--text-muted); line-height: 1.5; }
    .form-card .file-badge {
      display: inline-block;
      font-size: 0.68rem;
      background: #dbeafe;
      color: #1e40af;
      padding: 2px 7px;
      border-radius: 99px;
      margin-top: 0.6rem;
      font-weight: 500;
    }
  </style>
</head>
<body>
  <div class="page-head">
    <h1>📄 แบบฟอร์มออนไลน์</h1>
    <p>เลือกแบบฟอร์มที่ต้องการกรอก</p>
  </div>
  <div class="grid">
    ${FORM_TYPES.map(type => {
      const cfg = FORMS_CONFIG[type];
      return `<a class="form-card" href="/form/${type}">
        <h3>${esc(cfg.title)}</h3>
        <p>${esc(cfg.description)}</p>
        ${cfg.hasFileUpload ? '<span class="file-badge">📎 แนบไฟล์ได้</span>' : ''}
      </a>`;
    }).join('\n    ')}
  </div>
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
