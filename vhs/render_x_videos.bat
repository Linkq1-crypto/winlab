@echo off
echo ====================================================
echo   WINLAB X VIDEO RENDERER - BATCH MODE
echo   Rendering 20 videos for X (Twitter)
echo ====================================================
echo.

cd /d C:\Users\johns\Desktop\winw\lab\vhs

echo Starting video rendering...
echo.

python scripts/x_video_renderer.py --batch --output output

echo.
echo ====================================================
echo   Rendering complete!
echo   Check output directory for videos
echo ====================================================
pause
