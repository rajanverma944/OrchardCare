# Starts the full OrchardCare stack: portable PostgreSQL + backend API.
# Run from anywhere: powershell -ExecutionPolicy Bypass -File start-all.ps1
$ErrorActionPreference = 'Continue'
$root = 'C:\Users\ACER\.zcode\workspace\default\orchardcare'
$node = "$root\tools\node"

Write-Host '== 1/2 Starting PostgreSQL (port 5433) =='
& "$root\tools\pgsql\bin\pg_ctl.exe" -D "$root\tools\pgdata" -o "-p 5433 -c listen_addresses=127.0.0.1" -l "$root\tools\pg.log" -w start

Write-Host '== 2/2 Starting OrchardCare API on port 5092 =='
Write-Host "Mobile app / BlueStacks connects to: http://192.168.1.7:5092  (health: /health)"
$env:PATH = "$node;$env:PATH"
Set-Location "$root\backend"
node dist\src\index.js
