#!/bin/bash
set -e

echo "=== Cloudflare Form System Setup ==="
echo ""

FORM_TYPES=(
  "contact"
  "job-application"
  "complaint"
  "event-registration"
  "product-inquiry"
  "warranty-claim"
  "newsletter"
  "feedback"
  "partnership"
  "incident-report"
)

# สร้าง D1 database
echo "[1/6] Creating D1 database..."
wrangler d1 create form-system-db
echo ""

# สร้าง R2 bucket
echo "[2/6] Creating R2 bucket..."
wrangler r2 bucket create form-system-uploads
echo ""

# สร้าง Queues — แยกต่อ form type (20 intake + 20 dispatch + 1 webhook + DLQs = 42 queues)
echo "[3/6] Creating queues (42 total)..."
for form in "${FORM_TYPES[@]}"; do
  echo "  Creating intake-${form} + dlq..."
  wrangler queues create "intake-${form}"
  wrangler queues create "intake-${form}-dlq"
  echo "  Creating dispatch-${form} + dlq..."
  wrangler queues create "dispatch-${form}"
  wrangler queues create "dispatch-${form}-dlq"
done

echo "  Creating webhook-queue + dlq..."
wrangler queues create webhook-queue
wrangler queues create webhook-dlq
echo ""

# Apply schema + seed
echo "[4/6] Applying schema to remote D1..."
wrangler d1 execute form-system-db --file=./schema/d1-schema.sql --remote
echo ""

# สร้าง admin user คนแรก
echo "[5/6] Generating admin user seed..."
SEED_SQL=$(node -e "
const crypto = require('crypto');
const salt = crypto.randomBytes(16).toString('hex');
// PBKDF2-SHA256 100k iterations — ตรงกับ auth.ts hashPassword()
crypto.pbkdf2('admin1234', salt, 100000, 32, 'sha256', (err, key) => {
  const hash = key.toString('hex');
  const id = 'user_' + crypto.randomBytes(8).toString('hex');
  const now = Date.now();
  console.log(\"INSERT OR IGNORE INTO users (id, username, email, password_hash, password_salt, role, is_active, created_at) VALUES ('\" + id + \"', 'admin', 'admin@local.dev', '\" + hash + \"', '\" + salt + \"', 'admin', 1, \" + now + \");\");
});
")
echo "Seed SQL: $SEED_SQL"
wrangler d1 execute form-system-db --command="$SEED_SQL" --remote
echo ""

# Setup SESSION_SECRET
echo "[6/6] Setting SESSION_SECRET for Worker 1..."
SESSION_SECRET=$(node -e "const crypto = require('crypto'); console.log(crypto.randomBytes(32).toString('hex'));")
echo "$SESSION_SECRET" | (cd workers/worker1-intake && wrangler secret put SESSION_SECRET)
echo ""

echo "=== Setup Complete! ==="
echo ""
echo "ขั้นตอนต่อไป:"
echo "1. คัดลอก database_id จากผลลัพธ์ด้านบน แล้วแก้ไข:"
echo "   - workers/worker1-intake/wrangler.toml"
echo "   - workers/worker2-dispatcher/wrangler.toml"
echo "   แทนที่ 'REPLACE_WITH_DATABASE_ID' ด้วย database_id จริง"
echo ""
echo "2. Deploy Worker 3 ก่อน:"
echo "   pnpm --filter worker3-external-api deploy"
echo ""
echo "3. อัพเดต WORKER3_URL ใน workers/worker2-dispatcher/wrangler.toml"
echo ""
echo "4. Deploy ที่เหลือ:"
echo "   pnpm --filter worker2-dispatcher deploy"
echo "   pnpm --filter worker1-intake deploy"
echo ""
echo "5. Login:"
echo "   URL: https://worker1-intake.<subdomain>.workers.dev/admin/login"
echo "   Username: admin  |  Password: admin1234"
echo ""
echo "⚠️  เปลี่ยน password admin ทันทีหลัง login ครั้งแรก!"
