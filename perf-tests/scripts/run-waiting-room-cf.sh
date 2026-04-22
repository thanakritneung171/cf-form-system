#!/usr/bin/env bash
# run-waiting-room-cf.sh — รัน 10-waiting-room-cf.js (Cloudflare native Waiting Room wave)
# ใช้บน Linux/macOS/WSL
#
# Usage:
#   bash perf-tests/scripts/run-waiting-room-cf.sh
#   TARGET_URL=https://example.com/ VUS=300 bash perf-tests/scripts/run-waiting-room-cf.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PERF_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULT_FILE="$PERF_ROOT/results/waiting-room-cf_$TIMESTAMP.json"

cd "$PERF_ROOT"

# โหลด .env ถ้ามี
if [ -f ".env" ]; then
  echo "Loading .env..."
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

# Defaults (ถ้า .env ไม่ได้ตั้งไว้)
TARGET_URL="${TARGET_URL:-https://formsystem.softdebut.online/}"
VUS="${VUS:-250}"
SESSION_SECONDS="${SESSION_SECONDS:-60}"
POLL_TIMEOUT_SEC="${POLL_TIMEOUT_SEC:-600}"
LOG_DIR="${LOG_DIR:-logs}"

# สร้าง directory ที่ต้องใช้ (k6 ไม่ mkdir ให้)
mkdir -p "$PERF_ROOT/results"
mkdir -p "$PERF_ROOT/$LOG_DIR"

echo "============================================================"
echo "  Cloudflare Waiting Room Wave Test (scenario 10)"
echo "============================================================"
echo "  Target URL      : $TARGET_URL"
echo "  VUs             : $VUS"
echo "  Session         : ${SESSION_SECONDS}s"
echo "  Poll timeout    : ${POLL_TIMEOUT_SEC}s"
echo "  Log dir         : $LOG_DIR"
echo "  JSON output     : $RESULT_FILE"
echo "============================================================"
echo ""

k6 run \
  -e TARGET_URL="$TARGET_URL" \
  -e VUS="$VUS" \
  -e SESSION_SECONDS="$SESSION_SECONDS" \
  -e POLL_TIMEOUT_SEC="$POLL_TIMEOUT_SEC" \
  -e LOG_DIR="$LOG_DIR" \
  --out "json=$RESULT_FILE" \
  scenarios/10-waiting-room-cf.js

echo ""
echo "Result saved to: $RESULT_FILE"
echo "Summary log    : $PERF_ROOT/$LOG_DIR/"
