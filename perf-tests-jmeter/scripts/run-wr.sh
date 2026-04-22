#!/usr/bin/env bash
# Run 11-waiting-room-first-hit.jmx — CF Waiting Room burst test
set -euo pipefail
cd "$(dirname "$0")/.."

TS=$(date +%Y%m%d-%H%M%S)

jmeter -n \
  -t plans/11-waiting-room-first-hit.jmx \
  -q env.properties \
  -l "results/wr-${TS}.jtl" \
  "$@"

echo ""
echo "Results:    results/wr-${TS}.jtl"
echo "WR Summary: results/wr-summary-*.txt (latest)"
