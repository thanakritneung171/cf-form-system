#!/usr/bin/env bash
# Run 01-smoke.jmx — Smoke Test (1 VU, 1 min, contact form)
set -euo pipefail
cd "$(dirname "$0")/.."

TS=$(date +%Y%m%d-%H%M%S)

jmeter -n \
  -t plans/01-smoke.jmx \
  -q env.properties \
  -l "results/smoke-${TS}.jtl" \
  -e -o "results/smoke-report-${TS}" \
  "$@"

echo ""
echo "Results: results/smoke-${TS}.jtl"
echo "Report:  results/smoke-report-${TS}/index.html"
