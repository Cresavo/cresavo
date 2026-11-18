@echo off
rem Double-click to run the concept demo on Windows. Keep the window open.
cd /d "%~dp0..\.." || exit /b 1
git pull --ff-only
node scripts\demo.mjs
pause
