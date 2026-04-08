import type { User } from 'shared/types';
import { FORMS_CONFIG } from 'shared/forms-config';
import { esc } from '../validators';
import { adminLayout } from './layout';

export function loadtestPage(user: User): string {
  const formsConfigJson = JSON.stringify(FORMS_CONFIG);

  const content = `
<div class="alert alert-danger" style="margin-bottom:1.5rem;font-weight:600">
  ⚠️ หน้านี้สำหรับทดสอบ development/staging เท่านั้น ห้ามใช้กับ production
</div>

<div class="card" style="margin-bottom:1.5rem">
  <h2 style="font-size:1rem;font-weight:700;margin-bottom:1.25rem">ตั้งค่า Load Test</h2>

  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem;margin-bottom:1rem">
    <div>
      <label style="display:block;font-size:0.82rem;font-weight:600;margin-bottom:0.35rem">ประเภทฟอร์ม</label>
      <select id="formType" style="width:100%;padding:0.55rem 0.75rem;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:0.875rem">
        ${Object.entries(FORMS_CONFIG).map(([k, v]) =>
          `<option value="${esc(k)}">${esc(v.title)}${v.hasFileUpload ? ' 📎' : ''}</option>`
        ).join('\n        ')}
      </select>
    </div>
    <div>
      <label style="display:block;font-size:0.82rem;font-weight:600;margin-bottom:0.35rem">จำนวน Submissions</label>
      <select id="totalCount" style="width:100%;padding:0.55rem 0.75rem;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:0.875rem">
        <option value="10">10</option>
        <option value="50">50</option>
        <option value="100" selected>100</option>
        <option value="500">500</option>
        <option value="1000">1,000</option>
        <option value="5000">5,000</option>
        <option value="10000">10,000</option>
        <option value="50000">50,000</option>
        <option value="100000">100,000</option>
        <option value="500000" id="opt500k">500,000</option>
        <option value="1000000" id="opt1m">1,000,000</option>
      </select>
    </div>
    <div>
      <label style="display:block;font-size:0.82rem;font-weight:600;margin-bottom:0.35rem">Concurrency (max 200)</label>
      <input type="number" id="concurrency" value="50" min="1" max="200"
        style="width:100%;padding:0.55rem 0.75rem;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:0.875rem">
    </div>
  </div>

  <div style="display:flex;align-items:center;gap:1.5rem;margin-bottom:1rem;flex-wrap:wrap">
    <label style="display:flex;align-items:center;gap:0.5rem;font-size:0.875rem;cursor:pointer">
      <input type="checkbox" id="includeFiles" checked>
      Include file uploads (generates tiny mock files ~70–90 bytes each)
    </label>
    <span id="uploadSizeEstimate" style="font-size:0.8rem;color:var(--text-muted)"></span>
  </div>

  <div style="display:flex;gap:0.75rem;flex-wrap:wrap">
    <button id="btnStart" class="btn btn-primary" onclick="startTest()">▶ Start</button>
    <button id="btnStop" class="btn btn-outline" onclick="stopTest()" disabled>⬛ Stop</button>
    <button id="btnCleanup" class="btn btn-danger" onclick="cleanupData()" style="margin-left:auto">🗑 Cleanup Load Test Data</button>
  </div>
</div>

<div class="card" style="margin-bottom:1.5rem">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem">
    <span style="font-size:0.875rem;font-weight:600" id="progressLabel">รอเริ่ม...</span>
    <span style="font-size:0.8rem;color:var(--text-muted)" id="progressFraction">0 / 0</span>
  </div>
  <div style="background:#f0ece6;border-radius:99px;height:10px;overflow:hidden">
    <div id="progressBar" style="height:100%;width:0%;background:var(--primary);border-radius:99px;transition:width .15s"></div>
  </div>
</div>

<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:1rem;margin-bottom:1.5rem">
  <div class="stat-card">
    <div class="stat-label">✓ Success</div>
    <div class="stat-value" id="statSuccess" style="color:#16a34a">0</div>
  </div>
  <div class="stat-card">
    <div class="stat-label">✗ Failed</div>
    <div class="stat-value" id="statFailed" style="color:#dc2626">0</div>
  </div>
  <div class="stat-card">
    <div class="stat-label">Req/sec</div>
    <div class="stat-value" id="statRps">—</div>
  </div>
  <div class="stat-card">
    <div class="stat-label">Elapsed</div>
    <div class="stat-value" id="statElapsed">—</div>
  </div>
  <div class="stat-card">
    <div class="stat-label">ETA</div>
    <div class="stat-value" id="statEta">—</div>
  </div>
</div>

<div id="errorPanel" class="card" style="display:none">
  <h3 style="font-size:0.875rem;font-weight:700;margin-bottom:0.75rem;color:#dc2626">Error Log (last 20)</h3>
  <div id="errorLog" style="font-family:monospace;font-size:0.78rem;line-height:1.6;color:#7c3aed;white-space:pre-wrap;max-height:240px;overflow-y:auto"></div>
</div>

<script>
const FORM_CONFIGS = ${formsConfigJson};

// ── Mock file generators ──────────────────────────────────────────────────

const MINIMAL_PDF = new Uint8Array([
  0x25,0x50,0x44,0x46,0x2d,0x31,0x2e,0x34,0x0a,
  0x25,0xe2,0xe3,0xcf,0xd3,0x0a,
  ...new TextEncoder().encode('1 0 obj<</Type/Catalog>>endobj\\ntrailer<</Root 1 0 R>>\\n%%EOF'),
]);

const MINIMAL_PNG = new Uint8Array([
  0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,
  0x00,0x00,0x00,0x0d,0x49,0x48,0x44,0x52,
  0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x01,
  0x08,0x02,0x00,0x00,0x00,0x90,0x77,0x53,
  0xde,0x00,0x00,0x00,0x0c,0x49,0x44,0x41,
  0x54,0x08,0x99,0x63,0xf8,0xcf,0xc0,0x00,
  0x00,0x00,0x03,0x00,0x01,0x5b,0xb6,0xee,
  0x56,0x00,0x00,0x00,0x00,0x49,0x45,0x4e,
  0x44,0xae,0x42,0x60,0x82,
]);

function generateMockFile(fieldName, runNumber, timestamp) {
  const isPdf = /resume|profile|receipt|document/i.test(fieldName);
  if (isPdf) {
    return new File([MINIMAL_PDF], 'mock-' + fieldName + '-' + timestamp + '-' + runNumber + '.pdf', { type: 'application/pdf' });
  }
  return new File([MINIMAL_PNG], 'mock-' + fieldName + '-' + timestamp + '-' + runNumber + '.png', { type: 'image/png' });
}

// ── Mock payload builder ──────────────────────────────────────────────────

function buildFormData(formType, timestamp, runNumber, includeFiles) {
  const config = FORM_CONFIGS[formType];
  const fd = new FormData();

  for (const field of config.fields) {
    if (field.type === 'file') {
      if (!includeFiles) continue;
      if (field.multiple) {
        fd.append(field.name, generateMockFile(field.name, runNumber, timestamp));
        fd.append(field.name, generateMockFile(field.name, runNumber + 10000, timestamp));
      } else {
        fd.append(field.name, generateMockFile(field.name, runNumber, timestamp));
      }
      continue;
    }

    if (field.name === 'fullName') { fd.append(field.name, 'LoadTest User ' + timestamp + '-' + runNumber); continue; }
    if (field.name === 'email')    { fd.append(field.name, 'loadtest-' + timestamp + '-' + runNumber + '@test.local'); continue; }
    if (field.name === 'phone')    { fd.append(field.name, '0800000000'); continue; }

    if (field.type === 'textarea') { fd.append(field.name, 'This is mock content for load testing. Run ' + runNumber + '.'); continue; }
    if (field.type === 'text' || field.type === 'email' || field.type === 'tel') { fd.append(field.name, 'Load test data #' + runNumber); continue; }
    if (field.type === 'select')      { fd.append(field.name, field.options && field.options[0] ? field.options[0] : 'test'); continue; }
    if (field.type === 'multiselect') { fd.append(field.name, field.options && field.options[0] ? field.options[0] : 'test'); continue; }
    if (field.type === 'number')      { fd.append(field.name, String(field.name === 'rating' ? (Math.floor(Math.random() * 5) + 1) : runNumber)); continue; }
    fd.append(field.name, 'test');
  }

  return fd;
}

// ── UI helpers ────────────────────────────────────────────────────────────

function fmt(n) { return n.toLocaleString(); }
function fmtTime(ms) {
  if (ms < 60000) return (ms / 1000).toFixed(1) + 's';
  const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000);
  return m + 'm ' + s + 's';
}

function updateUI(sent, total, success, failed, startTime, errors) {
  const pct = total > 0 ? (sent / total) * 100 : 0;
  document.getElementById('progressBar').style.width = pct + '%';
  document.getElementById('progressFraction').textContent = fmt(sent) + ' / ' + fmt(total);
  document.getElementById('progressLabel').textContent = sent >= total ? '✓ เสร็จสิ้น' : 'กำลังทดสอบ...';
  document.getElementById('statSuccess').textContent = fmt(success);
  document.getElementById('statFailed').textContent = fmt(failed);

  const elapsed = performance.now() - startTime;
  document.getElementById('statElapsed').textContent = fmtTime(elapsed);

  if (sent > 0 && elapsed > 0) {
    const rps = (sent / elapsed) * 1000;
    document.getElementById('statRps').textContent = rps.toFixed(1);
    const remaining = total - sent;
    const eta = remaining / rps * 1000;
    document.getElementById('statEta').textContent = sent >= total ? '—' : fmtTime(eta);
  }

  if (errors.length > 0) {
    document.getElementById('errorPanel').style.display = '';
    document.getElementById('errorLog').textContent = errors.join('\\n');
  }
}

// ── Load test state ───────────────────────────────────────────────────────

let stopped = false;
let running = false;

function stopTest() {
  stopped = true;
  document.getElementById('btnStop').disabled = true;
  document.getElementById('progressLabel').textContent = '⬛ กำลังหยุด...';
}

async function startTest() {
  if (running) return;

  const formType   = document.getElementById('formType').value;
  const total      = parseInt(document.getElementById('totalCount').value, 10);
  const concurrency = Math.min(200, Math.max(1, parseInt(document.getElementById('concurrency').value, 10)));
  const includeFiles = document.getElementById('includeFiles').checked;

  if (total >= 10000) {
    const estSec = total / concurrency;
    if (!confirm('จะยิง ' + fmt(total) + ' requests (concurrency ' + concurrency + ') ประมาณ ' + fmtTime(estSec * 1000) + ' ดำเนินการต่อ?')) return;
  }

  const config = FORM_CONFIGS[formType];
  const hasFiles = includeFiles && config.hasFileUpload;
  if (hasFiles && total >= 1000) {
    const fileCount = total * (config.fields.filter(f => f.type === 'file').reduce((a, f) => a + (f.multiple ? 2 : 1), 0));
    const estKb = Math.ceil(fileCount * 80 / 1024);
    if (!confirm('จะสร้างและอัปโหลด ' + fmt(fileCount) + ' ไฟล์จำลองไปยัง R2 (รวม ~' + estKb + ' KB) — R2 storage จะมีไฟล์ test หลงเหลือ ต้องการดำเนินการต่อ?')) return;
  }

  // reset state
  stopped = false;
  running = true;
  let sent = 0, success = 0, failed = 0;
  const errors = [];
  const startTime = performance.now();
  const timestamp = Date.now();

  document.getElementById('btnStart').disabled = true;
  document.getElementById('btnStop').disabled = false;
  document.getElementById('errorPanel').style.display = 'none';
  document.getElementById('errorLog').textContent = '';
  document.getElementById('statSuccess').textContent = '0';
  document.getElementById('statFailed').textContent = '0';
  document.getElementById('statRps').textContent = '—';
  document.getElementById('statElapsed').textContent = '—';
  document.getElementById('statEta').textContent = '—';
  document.getElementById('progressBar').style.width = '0%';
  document.getElementById('progressFraction').textContent = '0 / ' + fmt(total);
  document.getElementById('progressLabel').textContent = 'กำลังทดสอบ...';

  async function worker() {
    while (sent < total && !stopped) {
      const runNumber = ++sent;
      const fd = buildFormData(formType, timestamp, runNumber, includeFiles);
      try {
        const res = await fetch('/submit/' + formType, { method: 'POST', body: fd });
        if (res.ok) { success++; }
        else {
          failed++;
          if (errors.length < 20) errors.push('#' + runNumber + ': HTTP ' + res.status);
        }
      } catch (err) {
        failed++;
        if (errors.length < 20) errors.push('#' + runNumber + ': ' + err.message);
      }
      updateUI(sent, total, success, failed, startTime, errors);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  running = false;
  document.getElementById('btnStart').disabled = false;
  document.getElementById('btnStop').disabled = true;
  document.getElementById('progressLabel').textContent = stopped ? '⬛ หยุดแล้ว (' + fmt(sent) + '/' + fmt(total) + ')' : '✓ เสร็จสิ้น — ' + fmt(success) + ' สำเร็จ, ' + fmt(failed) + ' ล้มเหลว';
}

async function cleanupData() {
  if (!confirm('ลบ submissions และไฟล์ทั้งหมดที่มีชื่อ "LoadTest User ..." ออกจาก D1 และ R2?\\nการดำเนินการนี้ไม่สามารถยกเลิกได้')) return;
  const btn = document.getElementById('btnCleanup');
  btn.disabled = true;
  btn.textContent = 'กำลังลบ...';
  try {
    const res = await fetch('/admin/loadtest/cleanup', { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      alert('✓ ลบเสร็จสิ้น\\n- Submissions: ' + data.deleted.submissions + '\\n- Files: ' + data.deleted.files + '\\n- R2 objects: ' + data.deleted.r2Objects);
    } else {
      alert('เกิดข้อผิดพลาด: ' + (data.error || res.status));
    }
  } catch (e) {
    alert('เกิดข้อผิดพลาด: ' + e.message);
  }
  btn.disabled = false;
  btn.textContent = '🗑 Cleanup Load Test Data';
}

// ── Dynamic option disabling ──────────────────────────────────────────────

function updateCountOptions() {
  const conc = parseInt(document.getElementById('concurrency').value, 10);
  const disable = conc < 100;
  document.getElementById('opt500k').disabled = disable;
  document.getElementById('opt1m').disabled = disable;
  if (disable && (document.getElementById('totalCount').value === '500000' || document.getElementById('totalCount').value === '1000000')) {
    document.getElementById('totalCount').value = '100000';
  }
}

function updateUploadEstimate() {
  const formType = document.getElementById('formType').value;
  const total = parseInt(document.getElementById('totalCount').value, 10);
  const includeFiles = document.getElementById('includeFiles').checked;
  const config = FORM_CONFIGS[formType];
  const el = document.getElementById('uploadSizeEstimate');

  if (!includeFiles || !config.hasFileUpload) { el.textContent = ''; return; }
  const fileFields = config.fields.filter(f => f.type === 'file');
  const filesPerSubmission = fileFields.reduce((a, f) => a + (f.multiple ? 2 : 1), 0);
  const totalFiles = total * filesPerSubmission;
  const estBytes = totalFiles * 80;
  el.textContent = 'Estimated upload: ~' + (estBytes < 1024 ? estBytes + ' B' : estBytes < 1048576 ? Math.ceil(estBytes/1024) + ' KB' : (estBytes/1048576).toFixed(1) + ' MB') + ' (' + totalFiles.toLocaleString() + ' files)';
}

document.getElementById('concurrency').addEventListener('input', () => { updateCountOptions(); updateUploadEstimate(); });
document.getElementById('totalCount').addEventListener('change', updateUploadEstimate);
document.getElementById('formType').addEventListener('change', updateUploadEstimate);
document.getElementById('includeFiles').addEventListener('change', updateUploadEstimate);
updateCountOptions();
updateUploadEstimate();
</script>
`;

  return adminLayout('Load Test', content, user, 'loadtest');
}
