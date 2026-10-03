$ErrorActionPreference = 'Stop'
$root = 'C:\Users\ACER\.zcode\workspace\default\orchardcare'
$pgbin = "$root\tools\pgsql\bin"
$data = "$root\tools\pgdata"

if (Test-Path "$data\PG_VERSION") {
    Write-Output 'PGDATA already initialised.'
} else {
    Write-Output 'Running initdb...'
    $pwfile = "$root\tools\pgpass.txt"
    Set-Content -Path $pwfile -Value 'orchard-super-local'
    & "$pgbin\initdb.exe" -D $data -U postgres -A scram-sha-256 --pwfile=$pwfile -E UTF8 --no-locale 2>&1 | Select-Object -Last 3
    Remove-Item $pwfile -Force
}

Write-Output 'Starting PostgreSQL on port 5433 (5432 is occupied by another service)...'
& "$pgbin\pg_ctl.exe" -D $data -o "-p 5433 -c listen_addresses=127.0.0.1" -l "$root\tools\pg.log" -w start
Start-Sleep -Seconds 2

$env:PGPASSWORD = 'orchard-super-local'
Write-Output 'Creating role and databases (idempotent)...'
$roleExists = (& "$pgbin\psql.exe" -U postgres -h 127.0.0.1 -p 5433 -t -A -c "SELECT 1 FROM pg_roles WHERE rolname='orchard'")
if ($roleExists -ne '1') {
    & "$pgbin\psql.exe" -U postgres -h 127.0.0.1 -p 5433 -c "CREATE ROLE orchard LOGIN PASSWORD 'orchard_local_dev'"
}
foreach ($db in @('orchardcare', 'orchardcare_test')) {
    $dbExists = (& "$pgbin\psql.exe" -U postgres -h 127.0.0.1 -p 5433 -t -A -c "SELECT 1 FROM pg_database WHERE datname='$db'")
    if ($dbExists -ne '1') {
        & "$pgbin\psql.exe" -U postgres -h 127.0.0.1 -p 5433 -c "CREATE DATABASE $db OWNER orchard"
    }
}
Write-Output 'POSTGRES_READY'
