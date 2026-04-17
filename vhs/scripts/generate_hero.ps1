# Generate WinLab Hero Launch Video
$ErrorActionPreference = "Stop"

New-Item -ItemType Directory -Force -Path "vhs\output" | Out-Null

Write-Host "Generating hero launch video..." -ForegroundColor Cyan

$FILTER = Get-Content "vhs\scripts\hero_filter.txt" -Raw

ffmpeg -y -f lavfi -i "color=c=0x0a0a0a:s=1280x720:d=25" `
    -filter_complex $FILTER `
    -c:v libx264 -pix_fmt yuv420p -t 25 `
    "vhs\output\hero_launch.mp4"

if (Test-Path "vhs\output\hero_launch.mp4") {
    Write-Host "OK Video: vhs\output\hero_launch.mp4" -ForegroundColor Green
} else {
    Write-Host "FAILED" -ForegroundColor Red
}
