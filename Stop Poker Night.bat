@echo off
REM Stops Poker Night by closing all Node processes (server + client).
echo Stopping Poker Night...
taskkill /F /IM node.exe >nul 2>&1
if errorlevel 1 (
  echo No running servers found.
) else (
  echo Stopped.
)
timeout /t 2 /nobreak >nul
