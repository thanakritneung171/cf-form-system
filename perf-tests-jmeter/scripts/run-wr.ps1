# Run 11-waiting-room-first-hit.jmx — CF Waiting Room burst test
$ErrorActionPreference = "Stop"
Push-Location "$PSScriptRoot\.."

$ts = Get-Date -Format "yyyyMMdd-HHmmss"

jmeter -n `
  -t plans/11-waiting-room-first-hit.jmx `
  -q env.properties `
  -l "results/wr-$ts.jtl" `
  @args

Write-Host ""
Write-Host "Results:    results/wr-$ts.jtl"
Write-Host "WR Summary: results/wr-summary-*.txt (latest)"

Pop-Location
