#!/usr/bin/env bash
# run-journey.sh — รัน 07-user-journey.js
#
# วิธีใช้:
#   bash scripts/run-journey.sh              → ramp profile (default)
#   bash scripts/run-journey.sh conn_200     → 200 VU คงที่ 2 นาที
#   bash scripts/run-journey.sh wr_flood     → 300 VU ไม่มี jitter/think time → บังคับ CF WR
#   bash scripts/run-journey.sh all          → รันทุก scenario พร้อมกัน

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

# รับ argument: ramp | conn_200 | shared_200 | shared_250 | wr_flood | all (default = ramp)
SCENARIO="${1:-ramp}"
BASE_URL="${BASE_URL:-http://localhost:8787}"

# ปรับ WR timeout / retry / jitter / think_scale ตาม scenario
case "$SCENARIO" in
  wr_flood)   WR_TIMEOUT=600; WR_RETRY=20; JITTER=0;  THINK_SCALE=0.0 ;;
  shared_250) WR_TIMEOUT=600; WR_RETRY=20; JITTER=60; THINK_SCALE=1.0 ;;
  shared_200) WR_TIMEOUT=480; WR_RETRY=15; JITTER=45; THINK_SCALE=1.0 ;;
  conn_200)   WR_TIMEOUT=480; WR_RETRY=15; JITTER=45; THINK_SCALE=1.0 ;;
  *)          WR_TIMEOUT=300; WR_RETRY=15; JITTER=30; THINK_SCALE=1.0 ;;
esac

echo ""
echo "========================================="
echo " 07-user-journey — scenario : $SCENARIO"
echo " BASE_URL    : $BASE_URL"
echo " WR_TIMEOUT  : ${WR_TIMEOUT}s"
echo " WR_RETRY    : ${WR_RETRY}s"
echo " JITTER      : 0–${JITTER}s"
echo " THINK_SCALE : ${THINK_SCALE}  (0=ไม่มี think time)"
echo "========================================="
echo ""

k6 run \
  -e SCENARIO="$SCENARIO" \
  -e WR_TIMEOUT="$WR_TIMEOUT" \
  -e WR_RETRY="$WR_RETRY" \
  -e JITTER="$JITTER" \
  -e THINK_SCALE="$THINK_SCALE" \
  scenarios/07-user-journey.js
