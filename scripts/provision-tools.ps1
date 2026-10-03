# Provisions the portable toolchain on a fresh clone (no admin rights needed).
# Idempotent: safe to rerun. See skills/skill-provisioning.md
$ErrorActionPreference = 'Continue'
$root = 'C:\Users\ACER\.zcode\workspace\default\orchardcare'
if (Test-Path 'C:\oc') { $root = 'C:\oc' }
$dl = "$root\tools\downloads"
New-Item -ItemType Directory -Force $dl | Out-Null

function Download($url, $out) {
    if (Test-Path $out) { Write-Host "have: $(Split-Path -Leaf $out)"; return }
    Write-Host "downloading $(Split-Path -Leaf $out) ..."
    curl.exe -L --retry 3 -sS -o $out $url
}

Write-Host '== 1/6 Downloads =='
Download 'https://nodejs.org/dist/v22.14.0/node-v22.14.0-win-x64.zip' "$dl\node.zip"
Download 'https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jdk/hotspot/normal/eclipse' "$dl\jdk21.zip"
Download 'https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip' "$dl\android-cmdline-tools.zip"
Download 'https://get.enterprisedb.com/postgresql/postgresql-16.9-1-windows-x64-binaries.zip' "$dl\pgsql.zip"
Download 'https://github.com/git-for-windows/git/releases/download/v2.56.0.windows.1/PortableGit-2.56.0-64-bit.7z.exe' "$dl\portablegit.7z.exe"

Write-Host '== 2/6 Extract =='
if (-not (Test-Path "$root\tools\node\node.exe")) {
    tar -xf "$dl\node.zip" -C "$root\tools"; Move-Item "$root\tools\node-v22.14.0-win-x64" "$root\tools\node" -Force
}
if (-not (Test-Path "$root\tools\jdk21\bin\java.exe")) {
    tar -xf "$dl\jdk21.zip" -C "$root\tools"
    $j = Get-ChildItem "$root\tools" -Directory | Where-Object { $_.Name -like 'jdk-21*' } | Select-Object -First 1
    Move-Item $j.FullName "$root\tools\jdk21" -Force
}
if (-not (Test-Path "$root\tools\android-sdk\cmdline-tools\latest")) {
    New-Item -ItemType Directory -Force "$root\tools\android-sdk\cmdline-tools" | Out-Null
    tar -xf "$dl\android-cmdline-tools.zip" -C "$root\tools\android-sdk\cmdline-tools"
    Move-Item "$root\tools\android-sdk\cmdline-tools\cmdline-tools" "$root\tools\android-sdk\cmdline-tools\latest" -Force
}
if (-not (Test-Path "$root\tools\pgsql\bin\pg_ctl.exe")) { tar -xf "$dl\pgsql.zip" -C "$root\tools" }
if (-not (Test-Path "$root\tools\git\bin\git.exe")) {
    Start-Process -FilePath "$dl\portablegit.7z.exe" -ArgumentList "-o`"$root\tools\git`" -y" -Wait
}

Write-Host '== 3/6 Android SDK packages + licenses =='
@'
8933bad161af4178b1185d1a37fbf41ea5269c55
d56f5187479451eabf01fb78af636cb5fbb0f1f9
24333f8a63b6825ea9c5514f83c2829b004d1fee
'@ | Set-Content "$root\tools\android-sdk\licenses\android-sdk-license"
'84831b9409646a918e30573bab4c9c91346d8abd' | Set-Content "$root\tools\android-sdk\licenses\android-sdk-preview-license"
$env:JAVA_HOME = "$root\tools\jdk21"
& "$root\tools\android-sdk\cmdline-tools\latest\bin\sdkmanager.bat" --sdk_root="$root\tools\android-sdk" 'platform-tools' 'platforms;android-35' 'platforms;android-36' 'build-tools;35.0.0' 'build-tools;36.0.0' | Select-Object -Last 2

Write-Host '== 4/6 PostgreSQL =='
powershell -ExecutionPolicy Bypass -File "$root\scripts\setup-postgres.ps1"

Write-Host '== 5/6 npm install (backend + mobile) =='
$env:PATH = "$root\tools\node;$env:PATH"
Push-Location "$root\backend"; npm install --no-audit --no-fund; Pop-Location
Push-Location "$root\mobile"; npm install --no-audit --no-fund; npx expo install --fix; Pop-Location

Write-Host '== 6/6 .env + junction =='
if (-not (Test-Path "$root\backend\.env")) {
    Copy-Item "$root\backend\.env.example" "$root\backend\.env"
    $secret = -join ((1..64) | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) })
    (Get-Content "$root\backend\.env") -replace 'JWT_SECRET=.*', "JWT_SECRET=$secret" | Set-Content "$root\backend\.env"
}
if (-not (Test-Path 'C:\oc')) { cmd /c mklink /J C:\oc $root }

Write-Host 'PROVISIONING DONE. Next: scripts\start-all.ps1, then scripts\build-apk.ps1'
