# run-all.ps1 — รันทุก scenario ยกเว้น 05-soak.js บน Windows PowerShell
# output JSON ลง results/{scenario}-{timestamp}.json

$ErrorActionPreference = 'Continue'  # ไม่หยุดถ้า scenario fail — เก็บ result ต่อ

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PerfRoot  = Split-Path -Parent $ScriptDir

Set-Location $PerfRoot

# โหลด .env
$EnvFile = Join-Path $PerfRoot '.env'
if (Test-Path $EnvFile) {
  Write-Host 'Loading .env...'
  Get-Content $EnvFile | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+?)\s*=\s*"?([^"]*)"?\s*$') {
      [System.Environment]::SetEnvironmentVariable($Matches[1].Trim(), $Matches[2].Trim(), 'Process')
    }
  }
}

New-Item -ItemType Directory -Force -Path results | Out-Null

$Timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$Scenarios = @(
  '01-smoke',
  '02-load',
  '03-stress',
  '04-spike',
  '06-mixed-forms'
)

Write-Host "=== Starting all scenarios (timestamp: $Timestamp) ==="
Write-Host "Skipping 05-soak.js (2h duration — run manually)"
Write-Host ""

$Failed = @()

foreach ($Scenario in $Scenarios) {
  $Output = "results\${Scenario}-${Timestamp}.json"
  Write-Host "--- Running $Scenario -> $Output"

  k6 run --out "json=$Output" "scenarios\${Scenario}.js"

  if ($LASTEXITCODE -eq 0) {
    Write-Host "v $Scenario passed"
  } else {
    Write-Host "x $Scenario FAILED"
    $Failed += $Scenario
  }
  Write-Host ""
}

Write-Host "=== Summary ==="
Write-Host "Completed: $($Scenarios.Count) scenarios"
if ($Failed.Count -eq 0) {
  Write-Host "All passed!"
} else {
  Write-Host "Failed scenarios: $($Failed -join ', ')"
  exit 1
}

Write-Host ""
Write-Host "Result files:"
Get-ChildItem "results\*-${Timestamp}.json" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name
