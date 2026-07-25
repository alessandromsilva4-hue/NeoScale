@echo off
start "NeoScale Server" /b node "%~dp0iniciar-neoscale.js"
timeout /t 1 /nobreak >nul
start "NeoScale" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app=http://127.0.0.1:4180/quiosque.html --start-fullscreen
