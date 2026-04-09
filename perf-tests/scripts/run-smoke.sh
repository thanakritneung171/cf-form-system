#!/usr/bin/env bash
# run-smoke.sh — รัน smoke test (01-smoke.js)
# ใช้บน Linux/macOS/WSL

set -e

# หา root ของ perf-tests จาก script location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PERF_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PERF_ROOT"

# โหลด .env ถ้ามี
if [ -f ".env" ]; then
  echo "Loading .env..."
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

echo "BASE_URL=${BASE_URL:-http://localhost:8787}"
echo "Running smoke test..."
echo "---"

k6 run scenarios/01-smoke.js
