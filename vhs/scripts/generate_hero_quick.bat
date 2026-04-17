@echo off
REM ─── Quick Hero Video Generator (No VHS Required) ────────────────────────
REM
REM Generates the hero launch video using FFmpeg ONLY
REM Perfect if VHS isn't installed yet
REM
REM Creates: Terminal animation + text overlays + CTA
REM Output: vhs/output/hero_quick.mp4 (ready in 2 minutes)
REM ───────────────────────────────────────────────────────────────────────────

setlocal enabledelayedexpansion

echo ═══════════════════════════════════════════════════════
echo  WINLAB HERO VIDEO - QUICK GENERATOR
echo  (FFmpeg only, no VHS required)
echo ═══════════════════════════════════════════════════════
echo.

REM Check FFmpeg
where ffmpeg >nul 2>&1
if errorlevel 1 (
    echo [ERROR] FFmpeg not found. Install with: scoop install ffmpeg
    exit /b 1
)

echo [1/3] Creating terminal animation...

REM Generate a simulated terminal session using FFmpeg drawtext
ffmpeg -y ^
    -f lavfi ^
    -i "color=c=0x0a0a0a:s=1280x720:d=25" ^
    -filter_complex "
    ── Terminal window background ──
    [0:v]drawbox=x=190:y=90:w=900:h=540:c=0x111111@0.95:r=14[tbg];

    ── Header bar ──
    [tbg]drawbox=x=190:y=90:w=900:h=42:c=0x1e1e1e:r=14[hdr];

    ── Traffic lights ──
    [hdr]drawbox=x=214:y=105:w=12:h=12:c=0xff5f57:r=6[dot1];
    [dot1]drawbox=x=232:y=105:w=12:h=12:c=0xfebc2e:r=6[dot2];
    [dot2]drawbox=x=250:y=105:w=12:h=12:c=0x28c840:r=6[dot3];

    ── Window title ──
    [dot3]drawtext=text='winlab — terminal':
        fontsize=13:fontcolor=0x9ca3af:
        x=(w-text_w)/2:y=110:
        fontfile=arial.ttf[wtitle];

    ── Terminal body ──
    [wtitle]drawbox=x=192:y=134:w=896:h=494:c=0x000000@0.4:r=10[tbody];

    ── Command 1 (0-3s): curl ──
    [tbody]drawtext=text='$ curl -I http://localhost':
        fontsize=24:fontcolor=0x60a5fa:
        x=214:y=175:
        fontfile=consolas.ttf:
        enable='between(t,0.5,25)'[cmd1];

    ── Error (3-8s) ──
    [cmd1]drawtext=text='curl: (7) Failed to connect to localhost port 80':
        fontsize=24:fontcolor=0xef4444:
        x=214:y=211:
        fontfile=consolas.ttf:
        enable='between(t,3,25)'[err1];
    [err1]drawtext=text='Connection refused':
        fontsize=24:fontcolor=0xef4444:
        x=214:y=247:
        fontfile=consolas.ttf:
        enable='between(t,4,25)'[err2];

    ── Command 2 (8-12s): systemctl ──
    [err2]drawtext=text='$ systemctl status httpd':
        fontsize=24:fontcolor=0x60a5fa:
        x=214:y=283:
        fontfile=consolas.ttf:
        enable='between(t,8,25)'[cmd2];
    [cmd2]drawtext=text='   Active: inactive (dead)':
        fontsize=24:fontcolor=0xef4444:
        x=214:y=319:
        fontfile=consolas.ttf:
        enable='between(t,9,25)'[err3];

    ── Command 3 (12-20s): fix ──
    [err3]drawtext=text='$ sudo systemctl start httpd':
        fontsize=24:fontcolor=0x60a5fa:
        x=214:y=355:
        fontfile=consolas.ttf:
        enable='between(t,12,25)'[cmd3];
    [cmd3]drawtext=text='Started httpd.service':
        fontsize=24:fontcolor=0x22c55e:
        x=214:y=391:
        fontfile=consolas.ttf:
        enable='between(t,13,25)'[ok1];

    ── Success (15-20s) ──
    [ok1]drawtext=text='$ curl -I http://localhost 2>&1 | head -1':
        fontsize=24:fontcolor=0x60a5fa:
        x=214:y=427:
        fontfile=consolas.ttf:
        enable='between(t,15,25)'[cmd4];
    [cmd4]drawtext=text='HTTP/1.1 200 OK':
        fontsize=24:fontcolor=0x22c55e:
        x=214:y=463:
        fontfile=consolas.ttf:
        enable='between(t,16,25)'[ok2];
    [ok2]drawtext=text='   Active: running':
        fontsize=24:fontcolor=0x22c55e:
        x=214:y=499:
        fontfile=consolas.ttf:
        enable='between(t,17,25)'[ok3];
    [ok3]drawtext=text='✓ Scenario resolved':
        fontsize=24:fontcolor=0x22c55e:
        x=214:y=535:
        fontfile=consolas.ttf:
        enable='between(t,18,25)'[ok4];

    ── Solution overlays (12-20s) ──
    [ok4]drawtext=text='✓ Works on GSM':
        fontsize=32:fontcolor=0x22c55e:
        x=50:y=580:
        fontfile=arial.ttf:
        enable='between(t,12,25)'[sol1];
    [sol1]drawtext=text='✓ Works offline':
        fontsize=32:fontcolor=0x22c55e:
        x=50:y=620:
        fontfile=arial.ttf:
        enable='between(t,13,25)'[sol2];
    [sol2]drawtext=text='✓ Works anywhere':
        fontsize=32:fontcolor=0x22c55e:
        x=50:y=660:
        fontfile=arial.ttf:
        enable='between(t,14,25)'[sol3];

    ── HOOK (0-3s) ──
    [sol3]drawtext=text='Same skills. Different outcome.':
        fontsize=64:fontcolor=white:
        x=(w-text_w)/2:y=40:
        fontfile=arial.ttf:
        enable='between(t,0,3)'[hook];

    ── PROBLEM (3-8s) ──
    [hook]drawtext=text='Connection dropped.':
        fontsize=48:fontcolor=0xff4444:
        x=(w-text_w)/2:y=680:
        fontfile=arial.ttf:
        enable='between(t,3,8)'[problem];

    ── INSIGHT (8-12s) ──
    [problem]drawtext=text='Because of a SIM card.':
        fontsize=52:fontcolor=0xffaa00:
        x=(w-text_w)/2:y=(h-text_h)/2:
        fontfile=arial.ttf:
        enable='between(t,8,12)'[insight];

    ── CLOSING (20-25s) ──
    [insight]drawtext=text='Same lab. Same chance.':
        fontsize=56:fontcolor=white:
        x=(w-text_w)/2:y=(h-text_h)/2-40:
        fontfile=arial.ttf:
        enable='between(t,20,25)'[closing];
    [closing]drawtext=text='WinLab.cloud':
        fontsize=64:fontcolor=0x3b82f6:
        x=(w-text_w)/2:y=(h-text_h)/2+50:
        fontfile=arial.ttf:
        enable='between(t,22,25)'[final]
    " ^
    -c:v libx264 -preset medium -crf 18 ^
    -t 25 ^
    vhs/output/hero_quick.mp4

if exist "vhs/output/hero_quick.mp4" (
    echo [OK] Video generated: vhs/output/hero_quick.mp4
) else (
    echo [ERROR] Video generation failed
    exit /b 1
)

echo.
echo [2/3] Creating vertical version...

ffmpeg -y ^
    -i vhs/output/hero_quick.mp4 ^
    -vf "crop=ih*9/16:ih:(iw-ih*9/16)/2:0,scale=1080:1920" ^
    -c:v libx264 -preset fast -crf 23 ^
    -c:a aac -b:a 128k ^
    vhs/output/hero_quick_vertical.mp4

if exist "vhs/output/hero_quick_vertical.mp4" (
    echo [OK] Vertical version: vhs/output/hero_quick_vertical.mp4
) else (
    echo [WARN] Vertical version failed (non-critical)
)

echo.
echo [3/3] Generating thumbnail...

ffmpeg -y ^
    -i vhs/output/hero_quick.mp4 ^
    -vf "thumbnail,scale=1280:720" ^
    -frames:v 1 -q:v 2 ^
    vhs/output/hero_thumb.jpg

if exist "vhs/output/hero_thumb.jpg" (
    echo [OK] Thumbnail: vhs/output/hero_thumb.jpg
) else (
    echo [WARN] Thumbnail failed (non-critical)
)

echo.
echo ═══════════════════════════════════════════════════════
echo  VIDEO READY!
echo ═══════════════════════════════════════════════════════
echo.
echo Horizontal:  vhs/output/hero_quick.mp4
echo Vertical:    vhs/output/hero_quick_vertical.mp4
echo Thumbnail:   vhs/output/hero_thumb.jpg
echo.
echo Duration: 25 seconds
echo Resolution: 1280x720 (HD)
echo.
echo Ready to upload to YouTube + LinkedIn!
echo.

pause
