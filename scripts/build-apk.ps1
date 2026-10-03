$ErrorActionPreference = 'Continue'
$root = 'C:\Users\ACER\.zcode\workspace\default\orchardcare'

Write-Host '== Building release APK =='
$env:JAVA_HOME = "$root\tools\jdk21"
$env:ANDROID_HOME = "$root\tools\android-sdk"
$env:PATH = "$root\tools\node;$root\tools\jdk21\bin;$env:PATH"
Set-Location "$root\mobile\android"
& .\gradlew.bat assembleRelease --no-daemon
Write-Host ''
Write-Host 'APK output (if BUILD SUCCESSFUL):'
Get-ChildItem "$root\mobile\android\app\build\outputs\apk\release\*.apk" | ForEach-Object { $_.FullName }
