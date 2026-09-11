param(
  [switch]$Prod,
  [switch]$SkipInstall,
  [switch]$SkipDoctor
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $root

Write-Host ""
Write-Host "  RepoDeck launcher" -ForegroundColor White
Write-Host "  ----------------" -ForegroundColor DarkGray

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "  Node.js is required. Install Node.js 22.12+ from https://nodejs.org" -ForegroundColor Red
  exit 1
}

if (-not (Test-Path -LiteralPath ".env")) {
  Write-Host "  First run detected: creating .env and generating AUTH_SECRET..." -ForegroundColor Yellow
  node scripts/setup.mjs
}

if (-not $SkipDoctor) {
  node scripts/doctor.mjs
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

if (-not $SkipInstall -and -not (Test-Path -LiteralPath "node_modules")) {
  Write-Host "  Installing dependencies..." -ForegroundColor Yellow
  npm install --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

if ($Prod) {
  Write-Host "  Building production bundle..." -ForegroundColor Yellow
  npm run build
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  Write-Host "  Starting RepoDeck on http://localhost:3000" -ForegroundColor Green
  npm run start
} else {
  Write-Host "  Starting RepoDeck in development on http://localhost:3000" -ForegroundColor Green
  npm run dev
}
