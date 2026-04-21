#!/usr/bin/env bash
# run-journey.sh — รัน 07-user-journey.js
#
# วิธีใช้:
#   bash scripts/run-journey.sh              → ramp profile (default)
#   bash scripts/run-journey.sh conn_200     → 200 VU คงที่ 2 นาที
#   bash scripts/run-journey.sh all          → รันทั้ง 2 scenario พร้อมกัน

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PERF_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PERF_ROOT"

# โหลด .env
if [ -f .env ]; then
  echo 'Loading .env...'
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

# รับ argument: ramp | conn_200 | all (default = ramp)
SCENARIO="${1:-ramp}"
BASE_URL="${BASE_URL:-http://localhost:8787}"

echo ""
echo "========================================="
echo " 07-user-journey — scenario: $SCENARIO"
echo " BASE_URL : $BASE_URL"
echo "========================================="
echo ""

k6 run -e SCENARIO="$SCENARIO" scenarios/07-user-journey.js
