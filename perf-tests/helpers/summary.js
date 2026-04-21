// summary.js — helper สำหรับสร้าง log สรุปผลการทดสอบ k6
// ใช้ร่วมกับ handleSummary ใน scenario ต่าง ๆ
//
// วิธีใช้:
//   import { makeSummary } from '../helpers/summary.js';
//   export function handleSummary(data) { return makeSummary(data, 'smoke'); }

import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';

export function makeSummary(data, scenarioName) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const timeStr = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;

  const logFile    = `logs/${dateStr}_${timeStr}_${scenarioName}.log`;
  const pageStats  = collectPageStats(data.metrics);
  const logContent = buildLogContent(data, scenarioName, dateStr, timeStr, pageStats);

  return {
    stdout:    textSummary(data, { indent: ' ', enableColors: true }),
    [logFile]: logContent,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// collect per-page stats จาก tag `page`
// ──────────────────────────────────────────────────────────────────────────────

function collectPageStats(metrics) {
  const pageMap = {};

  for (const [key, metric] of Object.entries(metrics)) {
    const m = key.match(/\{[^}]*\bpage:([^,}]+)/);
    if (!m) continue;

    const path = m[1].trim();
    if (!pageMap[path]) {
      pageMap[path] = { count: 0, failed: 0, avg: 0, p95: 0, p99: 0, _failedRate: 0 };
    }

    const v = metric.values ?? {};
    if (key.startsWith('http_reqs{'))         pageMap[path].count        = v.count  ?? 0;
    if (key.startsWith('http_req_failed{'))   pageMap[path]._failedRate  = v.rate   ?? 0;
    if (key.startsWith('http_req_duration{')) {
      pageMap[path].avg = Math.round(v.avg       ?? 0);
      pageMap[path].p95 = Math.round(v['p(95)'] ?? 0);
      pageMap[path].p99 = Math.round(v['p(99)'] ?? 0);
    }
  }

  for (const s of Object.values(pageMap)) {
    s.failed = Math.round(s._failedRate * s.count);
    delete s._failedRate;
  }

  return pageMap;
}

// ──────────────────────────────────────────────────────────────────────────────
// build log text
// ──────────────────────────────────────────────────────────────────────────────

function buildLogContent(data, scenarioName, dateStr, timeStr, pageStats) {
  const lines = [];
  const SEP   = '─'.repeat(76);

  // ── Header ──
  lines.push('');
  lines.push('╔════════════════════════════════════════════════════════════════════════════╗');
  lines.push(`║  k6 Load Test Summary — ${scenarioName.toUpperCase().padEnd(50)}║`);
  lines.push('╚════════════════════════════════════════════════════════════════════════════╝');
  lines.push('');
  lines.push(`  วันที่    : ${dateStr}`);
  lines.push(`  เวลา     : ${timeStr.replace(/-/g, ':')}`);
  lines.push(`  Scenario : ${scenarioName}`);
  lines.push('');
  lines.push(SEP);

  // ── Global metrics ──
  const m           = data.metrics;
  const totalReqs   = m.http_reqs?.values?.count          ?? 0;
  const failedRate  = m.http_req_failed?.values?.rate      ?? 0;
  const failedCount = Math.round(failedRate * totalReqs);
  const avgDur      = Math.round(m.http_req_duration?.values?.avg       ?? 0);
  const p95         = Math.round(m.http_req_duration?.values?.['p(95)'] ?? 0);
  const p99         = Math.round(m.http_req_duration?.values?.['p(99)'] ?? 0);
  const maxVUs      = m.vus_max?.values?.max    ?? 0;
  const iterations  = m.iterations?.values?.count ?? 0;

  lines.push('');
  lines.push('  📊 ภาพรวม');
  lines.push('');
  lines.push(`  Requests รวม     : ${totalReqs.toLocaleString()}`);
  lines.push(`  Requests สำเร็จ  : ${(totalReqs - failedCount).toLocaleString()}`);
  lines.push(`  Requests ล้มเหลว : ${failedCount.toLocaleString()} (${(failedRate * 100).toFixed(2)}%)`);
  lines.push(`  Iterations       : ${iterations.toLocaleString()}`);
  lines.push(`  VUs สูงสุด       : ${maxVUs}`);
  lines.push(`  Avg response     : ${avgDur} ms`);
  lines.push(`  p(95) response   : ${p95} ms`);
  lines.push(`  p(99) response   : ${p99} ms`);
  lines.push('');
  lines.push(SEP);

  // ── Page breakdown ──
  lines.push('');
  lines.push('  🌐 หน้าที่เปิด / URL ที่เข้าถึง (ทุก path ที่มีการเปิด)');
  lines.push('');

  const allEntries = Object.entries(pageStats);

  if (allEntries.length === 0) {
    lines.push('  (ไม่มีข้อมูล — request ต้องมี tags: { page: "/path/..." })');
    lines.push('');
  } else {
    // จัดกลุ่มตาม path pattern
    const groups = [
      {
        name:    'หน้า Index',
        entries: allEntries.filter(([p]) => p === '/'),
      },
      {
        name:    'หน้า Form (กดเลือกจาก Index)',
        entries: allEntries.filter(([p]) => p.startsWith('/form/')),
      },
      {
        name:    'Submit Form (ส่งข้อมูล)',
        entries: allEntries.filter(([p]) => p.startsWith('/submit/')),
      },
      {
        // หน้าอื่น ๆ ที่เปิด (catch-all)
        name:    'หน้าอื่น ๆ ที่เปิด',
        entries: allEntries.filter(([p]) =>
          p !== '/' &&
          !p.startsWith('/form/') &&
          !p.startsWith('/submit/')
        ),
      },
    ];

    const C = [42, 8, 8, 9, 8, 8];
    const header = [
      'Path'.padEnd(C[0]),
      'Reqs'.padStart(C[1]),
      'สำเร็จ'.padStart(C[2]),
      'ล้มเหลว'.padStart(C[3]),
      'Avg ms'.padStart(C[4]),
      'p95 ms'.padStart(C[5]),
    ].join('  ');

    for (const { name, entries } of groups) {
      // แสดงเฉพาะ path ที่ถูก request จริง (count > 0)
      const active = entries.filter(([, s]) => s.count > 0).sort((a, b) => b[1].count - a[1].count);
      if (active.length === 0) continue;

      lines.push(`  ── ${name} ${'─'.repeat(Math.max(0, 56 - name.length))}`);
      lines.push('');
      lines.push('  ' + header);
      lines.push('  ' + '─'.repeat(header.length));

      let groupTotal = 0;
      let groupFail  = 0;

      for (const [path, s] of active) {
        groupTotal += s.count;
        groupFail  += s.failed;
        const ok  = s.count - s.failed;
        const row = [
          path.slice(0, C[0]).padEnd(C[0]),
          String(s.count).padStart(C[1]),
          String(ok).padStart(C[2]),
          String(s.failed).padStart(C[3]),
          String(s.avg).padStart(C[4]),
          String(s.p95).padStart(C[5]),
        ].join('  ');
        lines.push('  ' + row);
      }

      if (active.length > 1) {
        const subOk = groupTotal - groupFail;
        lines.push('  ' + '·'.repeat(header.length));
        lines.push('  ' + [
          'รวม'.padEnd(C[0]),
          String(groupTotal).padStart(C[1]),
          String(subOk).padStart(C[2]),
          String(groupFail).padStart(C[3]),
          ''.padStart(C[4]),
          ''.padStart(C[5]),
        ].join('  '));
      }

      lines.push('');
    }
  }

  lines.push(SEP);

  // ── Checks ──
  const checks    = data.root_group?.checks;
  const checkList = Array.isArray(checks) ? checks : (checks ? Object.values(checks) : []);

  if (checkList.length > 0) {
    lines.push('');
    lines.push('  ✅ Checks');
    lines.push('');
    for (const result of checkList) {
      const name  = result.name   ?? '(unknown)';
      const pass  = result.passes ?? 0;
      const fail  = result.fails  ?? 0;
      const total = pass + fail;
      const icon  = fail === 0 ? '  ✓' : '  ✗';
      const pct   = total > 0 ? `${Math.round((pass / total) * 100)}%` : '-';
      lines.push(`${icon}  ${name.padEnd(50)} ${String(pass).padStart(5)} / ${String(total).padStart(5)}  (${pct})`);
    }
    lines.push('');
    lines.push(SEP);
  }

  lines.push('');
  lines.push(`  สร้างเมื่อ: ${new Date().toISOString()}`);
  lines.push('');

  return lines.join('\n');
}
