@echo off
setlocal enabledelayedexpansion

REM ─── CONFIG ─────────────────────────────────────────────
set SCENARIOS_DIR=vhs\scenarios
set OUTPUT_DIR=vhs\output
set VERTICAL_DIR=vhs\output\vertical
set THUMB_DIR=vhs\output\thumbnails
set LOG_FILE=render.log

REM Parallel jobs (numero core - 1 consigliato)
set MAX_JOBS=4

REM Retry config
set RETRIES=2

REM ─── INIT ───────────────────────────────────────────────
echo ==== WINLAB PIPELINE START ==== > %LOG_FILE%

for %%D in ("%OUTPUT_DIR%" "%VERTICAL_DIR%" "%THUMB_DIR%") do (
    if not exist "%%~D" mkdir "%%~D"
)

where vhs >nul 2>&1 || (echo VHS missing & exit /b 1)
where ffmpeg >nul 2>&1 || (echo FFmpeg missing & exit /b 1)

echo [OK] Dependencies ready

REM ─── FUNCTION: PROCESS ONE SCENARIO ─────────────────────
:process
set FILE=%1
set NAME=%~n1

echo [INFO] Processing !NAME!

REM Skip se già esiste
if exist "%OUTPUT_DIR%\!NAME!.mp4" (
    echo [SKIP] !NAME! already exists
    goto :eof
)

set TRY=0

:retry_vhs
set /a TRY+=1

echo [VHS] Attempt !TRY! - !NAME! >> %LOG_FILE%

vhs "%FILE%" --output "%OUTPUT_DIR%\!NAME!.mp4" --width 1280 --height 720 --padding 40 --margin 60 >> %LOG_FILE% 2>&1

if exist "%OUTPUT_DIR%\!NAME!.mp4" (
    echo [OK] VHS done: !NAME!
) else (
    if !TRY! LEQ %RETRIES% (
        echo [WARN] Retry VHS !NAME!
        goto retry_vhs
    ) else (
        echo [ERROR] VHS failed: !NAME!
        goto :eof
    )
)

REM ─── VERTICAL ───────────────────────────────────────────
ffmpeg -i "%OUTPUT_DIR%\!NAME!.mp4" ^
-vf "crop=trunc(ih*9/16):ih:trunc((iw-ih*9/16)/2):0,scale=1080:1920" ^
-c:v libx264 -preset fast -crf 23 ^
-c:a aac -b:a 128k ^
-movflags +faststart ^
"%VERTICAL_DIR%\!NAME!_vertical.mp4" -y >> %LOG_FILE% 2>&1

if errorlevel 1 (
    echo [ERROR] FFmpeg vertical failed: !NAME!
) else (
    echo [OK] Vertical done: !NAME!
)

REM ─── THUMBNAIL ──────────────────────────────────────────
ffmpeg -i "%OUTPUT_DIR%\!NAME!.mp4" ^
-vf "thumbnail,scale=1280:720" ^
-frames:v 1 -q:v 2 "%THUMB_DIR%\!NAME!_thumb.jpg" -y >> %LOG_FILE% 2>&1

if errorlevel 1 (
    echo [ERROR] Thumbnail failed: !NAME!
) else (
    echo [OK] Thumbnail done: !NAME!
)

goto :eof

REM ─── PARALLEL DISPATCH ──────────────────────────────────
set JOBS=0

for %%F in ("%SCENARIOS_DIR%\*.tape") do (
    call :wait_for_slot

    start "" /b cmd /c call "%~f0" :process "%%F"
    set /a JOBS+=1
)

call :wait_all

echo ==== DONE ====
exit /b

REM ─── WAIT SLOT ──────────────────────────────────────────
:wait_for_slot
:loop_wait
for /f %%A in ('tasklist ^| find /c "cmd.exe"') do set RUNNING=%%A

if !RUNNING! GEQ %MAX_JOBS% (
    timeout /t 1 >nul
    goto loop_wait
)
exit /b

REM ─── WAIT ALL ───────────────────────────────────────────
:wait_all
:loop_all
for /f %%A in ('tasklist ^| find /c "cmd.exe"') do set RUNNING=%%A

if !RUNNING! GTR 1 (
    timeout /t 1 >nul
    goto loop_all
)
exit /b