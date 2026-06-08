# Poker Night — one-command startup
# Run this from the poker-night folder: .\start.ps1

Write-Host "=== Poker Night ===" -ForegroundColor Yellow

# Install server deps
Write-Host "`nInstalling server dependencies..." -ForegroundColor Cyan
Set-Location "$PSScriptRoot\server"
npm install

# Install client deps
Write-Host "`nInstalling client dependencies..." -ForegroundColor Cyan
Set-Location "$PSScriptRoot\client"
npm install

# Start server in background
Write-Host "`nStarting server on port 3001..." -ForegroundColor Green
Set-Location "$PSScriptRoot\server"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run dev" -WindowStyle Normal

# Short wait then start client
Start-Sleep -Seconds 2

Write-Host "Starting client on port 3000..." -ForegroundColor Green
Set-Location "$PSScriptRoot\client"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run dev" -WindowStyle Normal

Write-Host "`nPoker Night is starting!" -ForegroundColor Yellow
Write-Host "Open http://localhost:3000 in your browser" -ForegroundColor White
Write-Host "Share your room code with friends on the same network`n" -ForegroundColor White
