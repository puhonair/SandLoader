@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title SandLoader
REM Double-click this. Node.js is downloaded only when it is missing or older than 18.
REM Drag Sandustry.exe onto this file if the game is not found on its own.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\easy-install.ps1" %*
echo.
echo   Press any key to close this window.
pause >nul
endlocal
