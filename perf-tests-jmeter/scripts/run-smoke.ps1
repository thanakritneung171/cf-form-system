# Run 01-smoke.jmx — Smoke Test (1 VU, 1 min, contact form)
$ErrorActionPreference = "Stop"
Push-Location "$PSScriptRoot\.."

$ts = Get-Date -Format "yyyyMMdd-HHmmss"

jmeter -n `
  -t plans/01-smoke.jmx `
  -q env.properties `
  -l "results/smoke-$ts.jtl" `
  -e -o "results/smoke-report-$ts" `
  @args

Write-Host ""
Write-Host "Results: results/smoke-$ts.jtl"
Write-Host "Report:  results/smoke-report-$ts/index.html"

Pop-Location
