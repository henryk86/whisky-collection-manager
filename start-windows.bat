@echo off
cd /d "%~dp0"
call npm start
set "WCM_EXIT_CODE=%ERRORLEVEL%"
pause
exit /b %WCM_EXIT_CODE%
