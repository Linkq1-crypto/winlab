# 🚀 Deploy WINLAB 72H Launch to Server
# Run from: C:\Users\johns\Desktop\winw\lab
# Server: root@89.167.59.14

Write-Host "`n=== WINLAB 72H LAUNCH DEPLOY ===" -ForegroundColor Cyan

# ── Configuration ──
$VPS = "root@89.167.59.14"
$REMOTE_DIR = "/var/www/simulator"
$LOCAL_DIR = "C:\Users\johns\Desktop\winw\lab"

# ── Step 1: Build Frontend ──
Write-Host "`n[1/5] Building frontend..." -ForegroundColor Yellow
Set-Location $LOCAL_DIR
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Build successful" -ForegroundColor Green

# ── Step 2: Verify new files exist ──
Write-Host "`n[2/5] Verifying new launch files..." -ForegroundColor Yellow

$requiredFiles = @(
    "src\LaunchLanding.jsx",
    "src\components\TerminalDemo.jsx",
    "src\components\PressureMode.jsx",
    "src\OnboardingPage.jsx",
    "src\FirstMission.jsx",
    "src\services\posthog.js",
    "src\utils\demoProgress.js"
)

$allExist = $true
foreach ($file in $requiredFiles) {
    $fullPath = Join-Path $LOCAL_DIR $file
    if (Test-Path $fullPath) {
        Write-Host "  ✓ $file" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $file MISSING!" -ForegroundColor Red
        $allExist = $false
    }
}

if (-not $allExist) {
    Write-Host "`n❌ Some files are missing!" -ForegroundColor Red
    exit 1
}

# ── Step 3: Upload to server ──
Write-Host "`n[3/5] Uploading to server $VPS..." -ForegroundColor Yellow

# Upload built frontend
Write-Host "  Uploading dist/ folder..." -ForegroundColor Cyan
scp -r "$LOCAL_DIR\dist\*" "${VPS}:${REMOTE_DIR}/dist/"

# Upload backend server
Write-Host "  Uploading server.js..." -ForegroundColor Cyan
scp "$LOCAL_DIR\win_lab_full_backend_frontend_starter.js" "${VPS}:${REMOTE_DIR}/server.js"

# Upload ecosystem config
Write-Host "  Uploading PM2 config..." -ForegroundColor Cyan
scp "$LOCAL_DIR\ecosystem.config.js" "${VPS}:${REMOTE_DIR}/ecosystem.config.js"

# Upload package.json (for dependencies)
Write-Host "  Uploading package.json..." -ForegroundColor Cyan
scp "$LOCAL_DIR\package.json" "${VPS}:${REMOTE_DIR}/package.json"

Write-Host "✅ Upload complete" -ForegroundColor Green

# ── Step 4: Install dependencies & restart ──
Write-Host "`n[4/5] Installing dependencies on server..." -ForegroundColor Yellow
ssh $VPS @"
cd $REMOTE_DIR
npm install --production
"@

Write-Host "`n[5/5] Restarting PM2..." -ForegroundColor Yellow
ssh $VPS @"
cd $REMOTE_DIR
pm2 reload winlab || pm2 start ecosystem.config.js
pm2 status
"@

# ── Done ──
Write-Host "`n=== DEPLOY COMPLETE ===" -ForegroundColor Green
Write-Host "Test URLs:" -ForegroundColor Cyan
Write-Host "  Main site:     https://winlab.cloud" -ForegroundColor White
Write-Host "  Launch page:   https://winlab.cloud/launch" -ForegroundColor White
Write-Host "  Alternative:   https://winlab.cloud/72h" -ForegroundColor White
Write-Host "  With query:    https://winlab.cloud/?launch=1" -ForegroundColor White
Write-Host "`nDon't forget to set environment variables:" -ForegroundColor Yellow
Write-Host "  STRIPE_PRICE_EARLY_ACCESS=price_xxxxxxxx" -ForegroundColor White
Write-Host "  VITE_POSTHOG_KEY=phc_xxxxxxxx" -ForegroundColor White
Write-Host "  BASE_URL=https://winlab.cloud" -ForegroundColor White
