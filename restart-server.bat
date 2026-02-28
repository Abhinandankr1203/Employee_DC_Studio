@echo off
echo Stopping existing server...
taskkill /F /IM node.exe /T 2>nul
timeout /t 2 /nobreak >nul
echo Starting server...
cd /d E:\Employee_Login_DC_Studio
node server.js
