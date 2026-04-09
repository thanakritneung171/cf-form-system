import type { User } from 'shared/types';
import { adminLayout } from './layout';
import { esc } from '../validators';

export interface ClearDataStats {
  submissions: number;
  submissionFiles: number;
  sessions: number;
  loginAttempts: number;
  webhookDeliveries: number;
  r2Objects: number;
}

export function clearDataPage(user: User, stats: ClearDataStats, csrfToken: string, flashMessage?: string): string {
  const content = `
    <style>
      .clear-wrap { max-width: 1100px; margin: 0 auto; }

      /* Two-column grid — equal height */
      .clear-cols {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1.25rem;
        align-items: stretch;
      }
      .clear-cols > .card {
        display: flex;
        flex-direction: column;
      }
      .clear-cols > .card .card-body {
        flex: 1;
        display: flex;
        flex-direction: column;
      }
      /* Right card: push footer to bottom */
      .clear-cols > .card:last-child form {
        flex: 1;
        display: flex;
        flex-direction: column;
      }
      .clear-cols > .card:last-child form > div:first-of-type {
        flex: 1;
      }
      @media (max-width: 768px) {
        .clear-cols { grid-template-columns: 1fr; }
      }

      /* Warning banner */
      .clear-warn {
        display: flex;
        align-items: flex-start;
        gap: 1rem;
        padding: 1rem 1.25rem;
        background: #fff0e8;
        border: 1px solid var(--danger);
        border-left: 4px solid var(--danger);
        border-radius: 14px;
        margin-bottom: 1.5rem;
      }
      .clear-warn-icon { font-size: 1.4rem; flex-shrink: 0; line-height: 1.4; }
      .clear-warn-title { font-weight: 600; color: var(--danger); margin-bottom: 0.25rem; }
      .clear-warn-desc { font-size: 0.85rem; color: #7a2000; line-height: 1.5; }

      /* Checkbox option rows */
      .clear-option {
        display: flex;
        align-items: flex-start;
        gap: 0.875rem;
        padding: 1rem 1.125rem;
        border: 1.5px solid var(--border);
        border-radius: 12px;
        cursor: pointer;
        transition: border-color .1s, background .1s;
        background: #fff;
      }
      .clear-option:hover { border-color: var(--amber); background: #fffbee; }
      .clear-option.is-checked { border-color: var(--danger); background: #fff8f5; }
      .clear-option input[type="checkbox"] {
        width: 16px; height: 16px;
        margin-top: 3px;
        flex-shrink: 0;
        cursor: pointer;
        accent-color: var(--danger);
      }
      .clear-option-title {
        font-size: 0.9rem;
        font-weight: 600;
        color: var(--black);
        margin-bottom: 0.2rem;
      }
      .clear-option-desc {
        font-size: 0.8rem;
        color: var(--text-muted);
        line-height: 1.5;
      }
      .clear-option-desc strong { color: var(--black); }

      /* Footer action row */
      .clear-footer {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding-top: 1.25rem;
        border-top: 1px solid var(--border);
        margin-top: 0.25rem;
      }
      .btn-clear {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.65rem 1.5rem;
        background: var(--danger);
        color: #fff;
        border: none;
        border-radius: 10px;
        font-size: 0.875rem;
        font-weight: 600;
        font-family: Arial, ui-sans-serif, system-ui, sans-serif;
        cursor: pointer;
        transition: background .08s, opacity .08s;
      }
      .btn-clear:hover { background: #e04000; }
      .btn-clear:disabled { opacity: .45; cursor: not-allowed; }
    </style>

    <div class="clear-wrap">

      <!-- Warning -->
      <div class="clear-warn">
        <div class="clear-warn-icon">⚠️</div>
        <div>
          <div class="clear-warn-title">คำเตือน: การดำเนินการนี้ไม่สามารถยกเลิกได้</div>
          <div class="clear-warn-desc">
            การเคลียร์ข้อมูลจะลบข้อมูลออกจากระบบอย่างถาวร
            ควรใช้เฉพาะในสภาพแวดล้อม dev/staging หรือหลังทำ load test เท่านั้น
          </div>
        </div>
      </div>

      <!-- Two-column layout -->
      <div class="clear-cols">

        <!-- Left: Stats -->
        <div class="card">
          <div class="card-header">📊 ข้อมูลปัจจุบันในระบบ</div>
          <div class="card-body">
            <div class="stat-grid" style="grid-template-columns:repeat(2,1fr);margin-bottom:0">
              <div class="stat-card">
                <div class="stat-num" style="color:var(--primary)">${stats.submissions.toLocaleString()}</div>
                <div class="stat-lbl">Submissions (D1)</div>
              </div>
              <div class="stat-card">
                <div class="stat-num" style="color:var(--primary)">${stats.submissionFiles.toLocaleString()}</div>
                <div class="stat-lbl">File Records (D1)</div>
              </div>
              <div class="stat-card">
                <div class="stat-num" style="color:#7c3aed">${stats.r2Objects.toLocaleString()}</div>
                <div class="stat-lbl">Files in R2</div>
              </div>
              <div class="stat-card">
                <div class="stat-num" style="color:var(--text-muted)">${stats.sessions.toLocaleString()}</div>
                <div class="stat-lbl">Sessions (D1)</div>
              </div>
              <div class="stat-card">
                <div class="stat-num" style="color:var(--text-muted)">${stats.loginAttempts.toLocaleString()}</div>
                <div class="stat-lbl">Login Attempts (D1)</div>
              </div>
              <div class="stat-card">
                <div class="stat-num" style="color:var(--text-muted)">${stats.webhookDeliveries.toLocaleString()}</div>
                <div class="stat-lbl">Webhook Deliveries (D1)</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right: Clear options -->
        <div class="card">
          <div class="card-header">🗑️ เลือกข้อมูลที่ต้องการเคลียร์</div>
          <div class="card-body">
            <form method="POST" action="/admin/clear-data" id="clearForm" onsubmit="return confirmClear()">
              <input type="hidden" name="csrf_token" value="${esc(csrfToken)}">

              <div style="display:flex;flex-direction:column;gap:0.75rem;margin-bottom:1.25rem">

                <label class="clear-option is-checked">
                  <input type="checkbox" name="target" value="submissions" checked>
                  <div>
                    <div class="clear-option-title">Submissions + File Records (D1)</div>
                    <div class="clear-option-desc">
                      ลบ <strong>${stats.submissions.toLocaleString()}</strong> submissions และ
                      <strong>${stats.submissionFiles.toLocaleString()}</strong> file records
                      (ตาราง submissions, submission_files)
                    </div>
                  </div>
                </label>

                <label class="clear-option is-checked">
                  <input type="checkbox" name="target" value="r2" checked>
                  <div>
                    <div class="clear-option-title">Files in R2</div>
                    <div class="clear-option-desc">
                      ลบ <strong>${stats.r2Objects.toLocaleString()}</strong> objects จาก R2 bucket (form-system-uploads)
                    </div>
                  </div>
                </label>

                <label class="clear-option">
                  <input type="checkbox" name="target" value="sessions">
                  <div>
                    <div class="clear-option-title">Sessions + Login Attempts (D1)</div>
                    <div class="clear-option-desc">
                      ลบ <strong>${stats.sessions.toLocaleString()}</strong> sessions และ
                      <strong>${stats.loginAttempts.toLocaleString()}</strong> login attempts
                      (ผู้ใช้ทุกคนจะถูก logout)
                    </div>
                  </div>
                </label>

                <label class="clear-option">
                  <input type="checkbox" name="target" value="webhook_deliveries">
                  <div>
                    <div class="clear-option-title">Webhook Deliveries (D1)</div>
                    <div class="clear-option-desc">
                      ลบ <strong>${stats.webhookDeliveries.toLocaleString()}</strong> webhook delivery records
                      (ไม่กระทบ webhook config)
                    </div>
                  </div>
                </label>

              </div>

              <div class="clear-footer">
                <button type="submit" class="btn-clear">
                  🗑️ เคลียร์ข้อมูลที่เลือก
                </button>
                <a href="/admin/submissions" style="font-size:0.875rem;color:var(--text-muted)">ยกเลิก</a>
              </div>
            </form>
          </div>
        </div>

      </div><!-- /.clear-cols -->

    </div>

    <script>
    // Sync visual state with checkbox state
    document.querySelectorAll('.clear-option').forEach(label => {
      const cb = label.querySelector('input[type="checkbox"]');
      function sync() {
        label.classList.toggle('is-checked', cb.checked);
      }
      cb.addEventListener('change', sync);
    });

    function confirmClear() {
      const checked = document.querySelectorAll('input[name="target"]:checked');
      if (checked.length === 0) {
        alert('กรุณาเลือกข้อมูลที่ต้องการเคลียร์อย่างน้อย 1 รายการ');
        return false;
      }
      const labels = Array.from(checked).map(el => {
        const lbl = el.closest('.clear-option');
        return lbl ? lbl.querySelector('.clear-option-title').textContent.trim() : el.value;
      });
      return confirm(
        '⚠️ ยืนยันการเคลียร์ข้อมูล?\n\nรายการที่จะถูกลบ:\n' +
        labels.map(l => '• ' + l).join('\n') +
        '\n\nการดำเนินการนี้ไม่สามารถยกเลิกได้!'
      );
    }
    </script>
  `;

  return adminLayout('เคลียร์ข้อมูล', content, user, 'clear-data', flashMessage);
}
