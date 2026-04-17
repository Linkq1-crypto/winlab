# ──────────────────────────────────────────────────────────────────────
# Stripe CLI Setup Script for WinLab (Windows PowerShell)
# Run this to configure local webhook testing with Stripe CLI
# ──────────────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"

Write-Host "🔶 WinLab Stripe CLI Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Check if Stripe CLI is installed
$stripeCmd = Get-Command stripe -ErrorAction SilentlyContinue
if (-not $stripeCmd) {
    Write-Host ""
    Write-Host "❌ Stripe CLI not found. Install it first:" -ForegroundColor Red
    Write-Host "   winget install Stripe.stripe-cli" -ForegroundColor Yellow
    Write-Host "   OR download from: https://docs.stripe.com/stripe-cli" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host "✅ Stripe CLI found: $($stripeCmd.Source)" -ForegroundColor Green

# Check if logged in
Write-Host "`n📡 Checking Stripe CLI login status..." -ForegroundColor Cyan
$loginStatus = stripe config --list 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Not logged in to Stripe CLI." -ForegroundColor Red
    Write-Host "   Run: stripe login" -ForegroundColor Yellow
    Write-Host "   Then re-run this script." -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host "✅ Stripe CLI is authenticated" -ForegroundColor Green

# Get account mode (test or live)
Write-Host "`n🔍 Detecting account mode..." -ForegroundColor Cyan
$account = stripe account retrieve --json 2>$null | ConvertFrom-Json
$chargesEnabled = $account.charges_enabled
Write-Host "   Account ID: $($account.id)" -ForegroundColor Gray
Write-Host "   Mode: $(if (-not $chargesEnabled) { 'TEST MODE' } else { 'LIVE MODE' })" -ForegroundColor $(if (-not $chargesEnabled) { 'Yellow' } else { 'Red' })

if ($chargesEnabled) {
    Write-Host ""
    Write-Host "⚠️  WARNING: You are in LIVE MODE! This script is for testing only." -ForegroundColor Red
    Write-Host "   Press Ctrl+C to cancel, or wait 5 seconds to continue..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
}

# Forward webhooks to local server
$PORT = 3000
$WEBHOOK_URL = "http://localhost:$PORT/api/billing/webhook"

Write-Host ""
Write-Host "🔌 Forwarding webhooks to: $WEBHOOK_URL" -ForegroundColor Cyan
Write-Host ""
Write-Host "Starting Stripe CLI webhook forwarding..." -ForegroundColor Green
Write-Host "----------------------------------------" -ForegroundColor DarkGray
Write-Host " Press Ctrl+C to stop" -ForegroundColor DarkGray
Write-Host "----------------------------------------" -ForegroundColor DarkGray
Write-Host ""

# Start webhook forwarding
stripe listen --forward-to $WEBHOOK_URL
