# RippleRead Deploy Script
# Usage: .\deploy.ps1
# Pulls latest from GitHub, rebuilds and restarts Docker containers.

$ErrorActionPreference = "Stop"

Write-Host "= RippleRead Deploy ="
Write-Host ""

# Pull latest code
Write-Host "[1/3] git pull..."
git pull origin master
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: git pull failed" -ForegroundColor Red
    exit 1
}

# Rebuild and restart
Write-Host "[2/3] docker compose build..."
docker compose build --no-cache
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: docker build failed" -ForegroundColor Red
    exit 1
}

Write-Host "[3/3] docker compose up..."
docker compose up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: docker compose up failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Deploy complete! https://rippleread.me" -ForegroundColor Green
