#!/usr/bin/env bash
# run-waiting-room.sh — รัน Cloudflare Waiting Room load test (07-waiting-room.js)
# ใช้บน Linux/macOS/WSL
#
# Usage:
#   bash perf-tests/scripts/run-waiting-room.sh
#   TARGET_URL=https://formsystem.softdebut.online bash perf-tests/scripts/run-waiting-room.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PERF_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULT_FILE="$PERF_ROOT/results/waiting-room_$TIMESTAMP.json"

cd "$PERF_ROOT"

# โหลด .env ถ้ามี
if [ -f ".env" ]; then
  echo "Loading .env..."
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

# Default URL
TARGET_URL="${TARGET_URL:-https://formsystem.softdebut.online}"

echo "============================================================"
echo "  Cloudflare Waiting Room Load Test"
echo "============================================================"
echo "  Target : $TARGET_URL"
echo "  Output : $RESULT_FILE"
echo "============================================================"
echo ""

# รัน k6 พร้อม export JSON result
k6 run \
  -e TARGET_URL="$TARGET_URL" \
  --out "json=$RESULT_FILE" \
  scenarios/07-waiting-room.js

echo ""
echo "Result saved to: $RESULT_FILE"
