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
    <div style="max-width:720px">

      <div class="card" style="margin-bottom:1.5rem;border-left:4px solid var(--danger)">
        <div class="card-body">
          <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem">
            <span style="font-size:1.5rem">⚠️</span>
            <strong style="color:var(--danger);font-size:1rem">คำเตือน: การดำเนินการนี้ไม่สามารถยกเลิกได้</strong>
          </div>
          <p style="color:var(--text-muted);font-size:0.875rem">
            การเคลียร์ข้อมูลจะลบข้อมูลออกจากระบบอย่างถาวร ควรใช้เฉพาะในสภาพแวดล้อม dev/staging หรือหลังทำ load test เท่านั้น
          </p>
        </div>
      </div>

      <!-- Current stats -->
      <div class="card" style="margin-bottom:1.5rem">
        <div class="card-header">📊 ข้อมูลปัจจุบันในระบบ</div>
        <div class="card-body">
          <div class="stat-grid" style="grid-template-columns:repeat(3,1fr)">
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

      <!-- Clear options -->
      <div class="card">
        <div class="card-header">🗑️ เลือกข้อมูลที่ต้องการเคลียร์</div>
        <div class="card-body">
          <form method="POST" action="/admin/clear-data" id="clearForm"
                onsubmit="return confirmClear()">
            <input type="hidden" name="csrf_token" value="${esc(csrfToken)}">

            <div style="display:flex;flex-direction:column;gap:1rem;margin-bottom:1.5rem">

              <label class="clear-option" style="display:flex;align-items:flex-start;gap:0.75rem;padding:1rem;border:1px solid var(--border);border-radius:var(--radius);cursor:pointer">
                <input type="checkbox" name="target" value="submissions" checked
                       style="margin-top:2px;width:1rem;height:1rem;cursor:pointer">
                <div>
                  <div style="font-weight:600;margin-bottom:0.2rem">Submissions + File Records (D1)</div>
                  <div style="font-size:0.8rem;color:var(--text-muted)">
                    ลบข้อมูล <strong>${stats.submissions.toLocaleString()}</strong> submissions และ
                    <strong>${stats.submissionFiles.toLocaleString()}</strong> file records จาก D1
                    (ตาราง submissions, submission_files)
                  </div>
                </div>
              </label>

              <label class="clear-option" style="display:flex;align-items:flex-start;gap:0.75rem;padding:1rem;border:1px solid var(--border);border-radius:var(--radius);cursor:pointer">
                <input type="checkbox" name="target" value="r2" checked
                       style="margin-top:2px;width:1rem;height:1rem;cursor:pointer">
                <div>
                  <div style="font-weight:600;margin-bottom:0.2rem">Files in R2</div>
                  <div style="font-size:0.8rem;color:var(--text-muted)">
                    ลบ <strong>${stats.r2Objects.toLocaleString()}</strong> objects จาก R2 bucket (form-system-uploads)
                  </div>
                </div>
              </label>

              <label class="clear-option" style="display:flex;align-items:flex-start;gap:0.75rem;padding:1rem;border:1px solid var(--border);border-radius:var(--radius);cursor:pointer">
                <input type="checkbox" name="target" value="sessions"
                       style="margin-top:2px;width:1rem;height:1rem;cursor:pointer">
                <div>
                  <div style="font-weight:600;margin-bottom:0.2rem">Sessions + Login Attempts (D1)</div>
                  <div style="font-size:0.8rem;color:var(--text-muted)">
                    ลบ <strong>${stats.sessions.toLocaleString()}</strong> sessions และ
                    <strong>${stats.loginAttempts.toLocaleString()}</strong> login attempts
                    (ผู้ใช้ทุกคนจะถูก logout)
                  </div>
                </div>
              </label>

              <label class="clear-option" style="display:flex;align-items:flex-start;gap:0.75rem;padding:1rem;border:1px solid var(--border);border-radius:var(--radius);cursor:pointer">
                <input type="checkbox" name="target" value="webhook_deliveries"
                       style="margin-top:2px;width:1rem;height:1rem;cursor:pointer">
                <div>
                  <div style="font-weight:600;margin-bottom:0.2rem">Webhook Deliveries (D1)</div>
                  <div style="font-size:0.8rem;color:var(--text-muted)">
                    ลบ <strong>${stats.webhookDeliveries.toLocaleString()}</strong> webhook delivery records
                    (ไม่กระทบ webhook config)
                  </div>
                </div>
              </label>

            </div>

            <div style="display:flex;align-items:center;gap:1rem;padding-top:1rem;border-top:1px solid var(--border)">
              <button type="submit" class="btn btn-danger" style="background:var(--danger);color:#fff;border:none;padding:0.6rem 1.5rem;border-radius:var(--radius-sm);font-weight:600;cursor:pointer;font-size:0.9rem">
                🗑️ เคลียร์ข้อมูลที่เลือก
              </button>
              <a href="/admin/submissions" style="color:var(--text-muted);font-size:0.875rem;text-decoration:none">ยกเลิก</a>
            </div>
          </form>
        </div>
      </div>

    </div>

    <script>
    function confirmClear() {
      const checked = document.querySelectorAll('input[name="target"]:checked');
      if (checked.length === 0) {
        alert('กรุณาเลือกข้อมูลที่ต้องการเคลียร์อย่างน้อย 1 รายการ');
        return false;
      }
      const labels = Array.from(checked).map(el => {
        const label = el.closest('label');
        return label ? label.querySelector('div > div:first-child').textContent.trim() : el.value;
      });
      return confirm(
        '⚠️ ยืนยันการเคลียร์ข้อมูล?\\n\\nรายการที่จะถูกลบ:\\n' +
        labels.map(l => '• ' + l).join('\\n') +
        '\\n\\nการดำเนินการนี้ไม่สามารถยกเลิกได้!'
      );
    }
    // highlight checked rows
    document.querySelectorAll('input[name="target"]').forEach(cb => {
      const label = cb.closest('label');
      function update() {
        if (cb.checked) {
          label.style.borderColor = 'var(--danger)';
          label.style.background = 'var(--danger-bg)';
        } else {
          label.style.borderColor = 'var(--border)';
          label.style.background = '';
        }
      }
      update();
      cb.addEventListener('change', update);
    });
    </script>
  `;

  return adminLayout('เคลียร์ข้อมูล', content, user, 'clear-data', flashMessage);
}
