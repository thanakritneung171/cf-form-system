# run-smoke.ps1 — รัน smoke test (01-smoke.js) บน Windows PowerShell

$ErrorActionPreference = 'Stop'

# หา root ของ perf-tests จาก script location
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PerfRoot  = Split-Path -Parent $ScriptDir

Set-Location $PerfRoot

# โหลด .env ถ้ามี — parse ด้วย regex (รองรับ KEY=VALUE และ KEY="VALUE")
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

$baseUrl = if ($env:BASE_URL) { $env:BASE_URL } else { 'http://localhost:8787' }
Write-Host "BASE_URL=$baseUrl"
Write-Host 'Running smoke test...'
Write-Host '---'

k6 run scenarios/01-smoke.js
