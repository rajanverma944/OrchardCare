@echo off
set ADB=C:\oc\tools\android-sdk\platform-tools\adb.exe
set S=127.0.0.1:5555
echo === ANDROID RUNTIME CRASHES ===
"%ADB%" -s %S% logcat -d -s AndroidRuntime:E 2>&1 | findstr /R "FATAL Process com.rajanverma944 orchardcare Caused at ^$" 
echo.
echo === LAST FATAL BLOCK ===
"%ADB%" -s %S% logcat -d 2>&1 | findstr /C:"FATAL EXCEPTION" /C:"com.rajanverma944.orchardcare" | more +0
echo.
echo === REACT NATIVE JS ===
"%ADB%" -s %S% logcat -d -s ReactNativeJS:E ReactNativeJS:W 2>&1
