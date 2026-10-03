$ErrorActionPreference = 'Continue'
$root = 'C:\Users\ACER\.zcode\workspace\default\orchardcare'

# Build from a short junction path: CMake/ninja fail on Windows when object
# paths exceed MAX_PATH (260 chars) from the real project location.
if (-not (Test-Path 'C:\oc')) {
    cmd /c mklink /J C:\oc $root | Out-Null
    Write-Host 'Created junction C:\oc'
}

Write-Host '== Building release APK (from C:\oc) =='
$env:JAVA_HOME = 'C:\oc\tools\jdk21'
$env:ANDROID_HOME = 'C:\oc\tools\android-sdk'
$env:PATH = "C:\oc\tools\node;C:\oc\tools\jdk21\bin;$env:PATH"
Set-Location 'C:\oc\mobile\android'
& .\gradlew.bat assembleRelease --no-daemon
if ($LASTEXITCODE -ne 0) {
    Write-Host "BUILD FAILED (exit $LASTEXITCODE) - NOT copying a stale APK."
    exit 1
}
Write-Host ''
Write-Host 'APK output:'
Get-ChildItem 'C:\oc\mobile\android\app\build\outputs\apk\release\*.apk' | ForEach-Object {
    Copy-Item $_.FullName 'C:\oc\OrchardCare.apk' -Force
    Write-Host $_.FullName ' -> C:\oc\OrchardCare.apk'
}
