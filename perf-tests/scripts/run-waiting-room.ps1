# run-waiting-room.ps1 — รัน Cloudflare Waiting Room load test (07-waiting-room.js) บน Windows
#
# Usage:
#   .\perf-tests\scripts\run-waiting-room.ps1
#   $env:TARGET_URL = "https://formsystem.softdebut.online"; .\perf-tests\scripts\run-waiting-room.ps1

$ErrorActionPreference = 'Stop'

$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$PerfRoot   = Split-Path -Parent $ScriptDir
$Timestamp  = Get-Date -Format 'yyyyMMdd_HHmmss'
$ResultFile = Join-Path $PerfRoot "results\waiting-room_$Timestamp.json"

Set-Location $PerfRoot

# โหลด .env ถ้ามี
$EnvFile = Join-Path $PerfRoot '.env'
if (Test-Path $EnvFile) {
  Write-Host 'Loading .env...'
  Get-Content $EnvFile | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+?)\s*=\s*"?([^"]*)"?\s*$') {
      $key   = $Matches[1].Trim()
      $value = $Matches[2].Trim()
      [System.Environment]::SetEnvironmentVariable($key, $value, 'Process')
    }
  }
}

$targetUrl = if ($env:TARGET_URL) { $env:TARGET_URL } else { 'https://formsystem.softdebut.online' }

Write-Host '============================================================'
Write-Host '  Cloudflare Waiting Room Load Test'
Write-Host '============================================================'
Write-Host "  Target : $targetUrl"
Write-Host "  Output : $ResultFile"
Write-Host '============================================================'
Write-Host ''

# สร้าง results dir ถ้ายังไม่มี
$ResultsDir = Join-Path $PerfRoot 'results'
if (-not (Test-Path $ResultsDir)) {
  New-Item -ItemType Directory -Path $ResultsDir | Out-Null
}

k6 run `
  -e "TARGET_URL=$targetUrl" `
  --out "json=$ResultFile" `
  scenarios/07-waiting-room.js

Write-Host ""
Write-Host "Result saved to: $ResultFile"
