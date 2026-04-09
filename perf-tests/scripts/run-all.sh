#!/usr/bin/env bash
# run-all.sh — รันทุก scenario ยกเว้น 05-soak.js (นาน 2 ชม.)
# output JSON ลง results/{scenario}-{timestamp}.json

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PERF_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PERF_ROOT"

# โหลด .env ถ้ามี
if [ -f ".env" ]; then
  echo "Loading .env..."
  set -a
  source .env
  set +a
fi

mkdir -p results

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
SCENARIOS=(
  "01-smoke"
  "02-load"
  "03-stress"
  "04-spike"
  "06-mixed-forms"
)

echo "=== Starting all scenarios (timestamp: $TIMESTAMP) ==="
echo "Skipping 05-soak.js (2h duration — run manually)"
echo ""

FAILED=()

for SCENARIO in "${SCENARIOS[@]}"; do
  OUTPUT="results/${SCENARIO}-${TIMESTAMP}.json"
  echo "--- Running $SCENARIO → $OUTPUT"
  if k6 run \
    --out "json=$OUTPUT" \
    "scenarios/${SCENARIO}.js"; then
    echo "✓ $SCENARIO passed"
  else
    echo "✗ $SCENARIO FAILED"
    FAILED+=("$SCENARIO")
  fi
  echo ""
done

echo "=== Summary ==="
echo "Completed: ${#SCENARIOS[@]} scenarios"
if [ ${#FAILED[@]} -eq 0 ]; then
  echo "All passed!"
else
  echo "Failed scenarios: ${FAILED[*]}"
  exit 1
fi

echo ""
echo "Result files:"
ls -1 "results/"*"-${TIMESTAMP}.json" 2>/dev/null || true
