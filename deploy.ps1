# WinLab — Deploy to VPS
# Run from: C:\Users\johns\Desktop\winw\lab
# Usage: right-click → "Run with PowerShell"  OR  .\deploy.ps1

$VPS = "root@89.167.59.14"
$REMOTE = "/var/www/simulator"

Write-Host "`n=== WinLab Deploy ===" -ForegroundColor Cyan

# 1. Build frontend
Write-Host "`n[1/4] Building frontend..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "Build failed!" -ForegroundColor Red; exit 1 }

# 2. Upload dist
Write-Host "`n[2/4] Uploading dist/..." -ForegroundColor Yellow
scp -r dist/* "${VPS}:${REMOTE}/dist/"

# 3. Upload backend + landing page
Write-Host "`n[3/4] Uploading server + landing..." -ForegroundColor Yellow
scp win_lab_full_backend_frontend_starter.js "${VPS}:${REMOTE}/server.js"
scp coming-soon/index.html "${VPS}:${REMOTE}/coming-soon/index.html"

# 4. Restart PM2
Write-Host "`n[4/4] Restarting PM2..." -ForegroundColor Yellow
ssh $VPS "pm2 restart winlab && pm2 status"

Write-Host "`n=== Done! https://winlab.cloud ===" -ForegroundColor Green
