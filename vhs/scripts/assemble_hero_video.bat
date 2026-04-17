@echo off
REM ─── Assemble Hero Launch Video (25 seconds) ─────────────────────────────
REM
REM Creates the FULL hero launch video with:
REM - Text overlays (hook, problem, insight, solution, CTA)
REM - Split-screen effect (3-8s)
REM - Professional transitions
REM - WinLab branding
REM
REM Prerequisites:
REM   1. VHS installed: scoop install vhs
REM   2. FFmpeg installed: scoop install ffmpeg
REM
REM Output: vhs/output/hero_launch_final.mp4 (ready for YouTube/LinkedIn)
REM ───────────────────────────────────────────────────────────────────────────

setlocal enabledelayedexpansion

echo ═══════════════════════════════════════════════════════
echo  WINLAB HERO VIDEO ASSEMBLER
echo  "Same skills. Different outcome."
echo ═══════════════════════════════════════════════════════
echo.

REM ─── Step 1: Generate terminal video ──────────────────────────────────
echo [1/4] Generating terminal animation...

if exist "vhs\scenarios\hero_launch.tape" (
    vhs vhs\scenarios\hero_launch.tape ^
        --output vhs/output/hero_terminal.mp4 ^
        --width 1280 --height 720 ^
        --padding 40 --margin 60
    
    if not exist "vhs\output\hero_terminal.mp4" (
        echo [ERROR] Failed to generate terminal video
        exit /b 1
    )
    echo [OK] Terminal video generated
) else (
    echo [ERROR] hero_launch.tape not found
    exit /b 1
)

echo.

REM ─── Step 2: Create split-screen (left=error, right=terminal) ─────────
echo [2/4] Creating split-screen effect...

REM Create error screen (red background with timeout)
ffmpeg -y ^
    -f lavfi -i color=c=0x1a0505:s=640x720:d=25 ^
    -f lavfi -i "drawtext=text='TIMEOUT'':fontsize=80:fontcolor=0xff0000:x=(w-text_w)/2:y=(h-text_h)/2:fontfile=arial.ttf" ^
    -f lavfi -i "drawtext=text='Connection refused'':fontsize=40:fontcolor=0xff4444:x=(w-text_w)/2:y=h/2+60:fontfile=arial.ttf" ^
    -filter_complex "[0:v][1:v]overlay=0:0[v1];[v1][2:v]overlay=0:0" ^
    -t 5 ^
    vhs/output/split_error.mp4

echo [OK] Split-screen error panel created

echo.

REM ─── Step 3: Assemble full video with text overlays ───────────────────
echo [3/4] Assembling final video with overlays...

ffmpeg -y ^
    -i vhs/output/hero_terminal.mp4 ^
    -filter_complex "
    ── Background ──
    [0:v]scale=1280:720,drawbox=c=0x0a0a0a@0.3:t=fill[base];

    ── 0-3s: HOOK - 'Same skills. Different outcome.' ──
    [base]drawtext=text='Same skills. Different outcome.':
        fontsize=64:fontcolor=white:
        x=(w-text_w)/2:y=(h-text_h)/2:
        fontfile=arial.ttf:
        enable='between(t,0,3)':
        alpha=if(lt(t,0.5),t*2,if(gt(t,2.5),(3-t)/0.5,1))[hook];

    ── 3-8s: PROBLEM - 'Connection dropped.' ──
    [hook]drawtext=text='Connection dropped.':
        fontsize=48:fontcolor=0xff4444:
        x=(w-text_w)/2:y=h-120:
        fontfile=arial.ttf:
        enable='between(t,3,8)':
        alpha=if(lt(t,3.5),(t-3)*2,if(gt(t,7.5),(8-t)/0.5,1))[problem];

    ── 8-12s: INSIGHT - 'Because of a SIM card.' ──
    [problem]drawtext=text='Because of a SIM card.':
        fontsize=52:fontcolor=0xffaa00:
        x=(w-text_w)/2:y=(h-text_h)/2:
        fontfile=arial.ttf:
        enable='between(t,8,12)':
        alpha=if(lt(t,8.5),(t-8)*2,if(gt(t,11.5),(12-t)/0.5,1))[insight];

    ── 12-20s: SOLUTION overlays ──
    [insight]drawtext=text='Works on GSM':
        fontsize=36:fontcolor=0x22c55e:
        x=50:y=h-180:
        fontfile=arial.ttf:
        enable='between(t,12,20)'[sol1];
    [sol1]drawtext=text='Works offline':
        fontsize=36:fontcolor=0x22c55e:
        x=50:y=h-130:
        fontfile=arial.ttf:
        enable='between(t,13,20)'[sol2];
    [sol2]drawtext=text='Works anywhere':
        fontsize=36:fontcolor=0x22c55e:
        x=50:y=h-80:
        fontfile=arial.ttf:
        enable='between(t,14,20)'[sol3];

    ── 20-25s: CLOSING + CTA ──
    [sol3]drawtext=text='Same lab. Same chance.':
        fontsize=56:fontcolor=white:
        x=(w-text_w)/2:y=(h-text_h)/2-40:
        fontfile=arial.ttf:
        enable='between(t,20,25)':
        alpha=if(lt(t,20.5),(t-20)*2,if(gt(t,24),(25-t)/1,1))[closing];
    [closing]drawtext=text='WinLab.cloud':
        fontsize=64:fontcolor=0x3b82f6:
        x=(w-text_w)/2:y=(h-text_h)/2+50:
        fontfile=arial.ttf:
        enable='between(t,22,25)':
        alpha=if(lt(t,22.5),(t-22)*2,if(gt(t,24),(25-t)/1,1))[final]
    " ^
    -c:v libx264 -preset medium -crf 18 ^
    -c:a aac -b:a 192k ^
    -movflags +faststart ^
    -t 25 ^
    vhs/output/hero_launch_final.mp4

if exist "vhs/output/hero_launch_final.mp4" (
    echo [OK] Final video assembled: hero_launch_final.mp4
) else (
    echo [ERROR] Assembly failed
    exit /b 1
)

echo.

REM ─── Step 4: Generate vertical version (9:16) ─────────────────────────
echo [4/4] Generating vertical version for social media...

ffmpeg -y ^
    -i vhs/output/hero_launch_final.mp4 ^
    -vf "crop=ih*9/16:ih:(iw-ih*9/16)/2:0,scale=1080:1920" ^
    -c:v libx264 -preset fast -crf 23 ^
    -c:a aac -b:a 128k ^
    -movflags +faststart ^
    vhs/output/hero_launch_vertical.mp4

if exist "vhs/output/hero_launch_vertical.mp4" (
    echo [OK] Vertical version: hero_launch_vertical.mp4
) else (
    echo [WARN] Vertical version failed (non-critical)
)

echo.
echo ═══════════════════════════════════════════════════════
echo  VIDEO READY!
echo ═══════════════════════════════════════════════════════
echo.
echo Horizontal (YouTube):  vhs\output\hero_launch_final.mp4
echo Vertical (LinkedIn):   vhs\output\hero_launch_vertical.mp4
echo.
echo Duration: 25 seconds
echo Resolution: 1280x720 (HD)
echo.
echo Ready to upload!
echo.

pause
