@echo off
REM ===  Poker Night launcher  =====================================
REM Double-click this file to start both servers and open the game.
REM Two console windows open (server + client); close them to stop.
REM ================================================================
setlocal
set "NODE=C:\Program Files\nodejs"
set "PATH=%NODE%;%PATH%"
cd /d "%~dp0"

echo === Poker Night ===
echo.

REM Install dependencies the first time only.
if not exist "server\node_modules" (
  echo Installing server dependencies ^(first run^)...
  pushd server & call npm install & popd
)
if not exist "client\node_modules" (
  echo Installing client dependencies ^(first run^)...
  pushd client & call npm install & popd
)

echo Starting server ^(port 3001^)...
start "Poker Night - Server" /D "%~dp0server" cmd /k "set PATH=%NODE%;%PATH% & npm start"

echo Starting client ^(port 3000^)...
start "Poker Night - Client" /D "%~dp0client" cmd /k "set PATH=%NODE%;%PATH% & npm run dev"

echo Waiting for the client to come up...
timeout /t 6 /nobreak >nul
start "" http://localhost:3000

echo.
echo Poker Night is running in two windows.
echo Browser opened at http://localhost:3000
echo (Open more tabs for more players.)
echo Close the two server windows to stop the game.
echo.
timeout /t 4 /nobreak >nul
endlocal
