#!/usr/bin/env bash
# Run 06-mixed-forms.jmx — Mixed Forms (10 thread groups, 5 min)
set -euo pipefail
cd "$(dirname "$0")/.."

TS=$(date +%Y%m%d-%H%M%S)

jmeter -n \
  -t plans/06-mixed-forms.jmx \
  -q env.properties \
  -l "results/mixed-${TS}.jtl" \
  -e -o "results/mixed-report-${TS}" \
  "$@"

echo ""
echo "Results: results/mixed-${TS}.jtl"
echo "Report:  results/mixed-report-${TS}/index.html"
