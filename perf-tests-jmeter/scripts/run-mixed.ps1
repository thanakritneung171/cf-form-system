# Run 06-mixed-forms.jmx — Mixed Forms (10 thread groups, 5 min)
$ErrorActionPreference = "Stop"
Push-Location "$PSScriptRoot\.."

$ts = Get-Date -Format "yyyyMMdd-HHmmss"

jmeter -n `
  -t plans/06-mixed-forms.jmx `
  -q env.properties `
  -l "results/mixed-$ts.jtl" `
  -e -o "results/mixed-report-$ts" `
  @args

Write-Host ""
Write-Host "Results: results/mixed-$ts.jtl"
Write-Host "Report:  results/mixed-report-$ts/index.html"

Pop-Location
