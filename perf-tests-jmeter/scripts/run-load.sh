#!/usr/bin/env bash
# Run 02-load.jmx — Load Test (10 VU, 16 min stages)
set -euo pipefail
cd "$(dirname "$0")/.."

TS=$(date +%Y%m%d-%H%M%S)

jmeter -n \
  -t plans/02-load.jmx \
  -q env.properties \
  -l "results/load-${TS}.jtl" \
  -e -o "results/load-report-${TS}" \
  "$@"

echo ""
echo "Results: results/load-${TS}.jtl"
echo "Report:  results/load-report-${TS}/index.html"
