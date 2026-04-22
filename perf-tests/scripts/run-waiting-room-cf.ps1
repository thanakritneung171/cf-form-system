# run-waiting-room-cf.ps1 — รัน 10-waiting-room-cf.js บน Windows
#
# Usage:
#   .\perf-tests\scripts\run-waiting-room-cf.ps1
#   $env:VUS = "300"; .\perf-tests\scripts\run-waiting-room-cf.ps1

$ErrorActionPreference = 'Stop'

$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$PerfRoot   = Split-Path -Parent $ScriptDir
$Timestamp  = Get-Date -Format 'yyyyMMdd_HHmmss'
$ResultFile = Join-Path $PerfRoot "results\waiting-room-cf_$Timestamp.json"

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

# Defaults (ถ้า .env ไม่ได้ตั้งไว้)
$targetUrl       = if ($env:TARGET_URL)       { $env:TARGET_URL }       else { 'https://formsystem.softdebut.online/' }
$vus             = if ($env:VUS)              { $env:VUS }              else { '250' }
$sessionSeconds  = if ($env:SESSION_SECONDS)  { $env:SESSION_SECONDS }  else { '60' }
$pollTimeoutSec  = if ($env:POLL_TIMEOUT_SEC) { $env:POLL_TIMEOUT_SEC } else { '600' }
$logDir          = if ($env:LOG_DIR)          { $env:LOG_DIR }          else { 'logs' }

# สร้าง directory ที่ต้องใช้ (k6 ไม่ mkdir ให้)
$ResultsDir = Join-Path $PerfRoot 'results'
if (-not (Test-Path $ResultsDir)) { New-Item -ItemType Directory -Path $ResultsDir | Out-Null }
$LogDirAbs  = Join-Path $PerfRoot $logDir
if (-not (Test-Path $LogDirAbs))  { New-Item -ItemType Directory -Path $LogDirAbs  | Out-Null }

Write-Host '============================================================'
Write-Host '  Cloudflare Waiting Room Wave Test (scenario 10)'
Write-Host '============================================================'
Write-Host "  Target URL      : $targetUrl"
Write-Host "  VUs             : $vus"
Write-Host "  Session         : ${sessionSeconds}s"
Write-Host "  Poll timeout    : ${pollTimeoutSec}s"
Write-Host "  Log dir         : $logDir"
Write-Host "  JSON output     : $ResultFile"
Write-Host '============================================================'
Write-Host ''

k6 run `
  -e "TARGET_URL=$targetUrl" `
  -e "VUS=$vus" `
  -e "SESSION_SECONDS=$sessionSeconds" `
  -e "POLL_TIMEOUT_SEC=$pollTimeoutSec" `
  -e "LOG_DIR=$logDir" `
  --out "json=$ResultFile" `
  scenarios/10-waiting-room-cf.js

Write-Host ''
Write-Host "Result saved to: $ResultFile"
Write-Host "Summary log    : $LogDirAbs"
