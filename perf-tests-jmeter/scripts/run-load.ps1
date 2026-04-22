# Run 02-load.jmx — Load Test (10 VU, 16 min stages)
$ErrorActionPreference = "Stop"
Push-Location "$PSScriptRoot\.."

$ts = Get-Date -Format "yyyyMMdd-HHmmss"

jmeter -n `
  -t plans/02-load.jmx `
  -q env.properties `
  -l "results/load-$ts.jtl" `
  -e -o "results/load-report-$ts" `
  @args

Write-Host ""
Write-Host "Results: results/load-$ts.jtl"
Write-Host "Report:  results/load-report-$ts/index.html"

Pop-Location
