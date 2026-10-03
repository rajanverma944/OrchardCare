@echo off
set ANDROID_ADB_SERVER_PORT=5038
set ADB=C:\oc\tools\android-sdk\platform-tools\adb.exe
set S=127.0.0.1:5555
"%ADB%" -s %S% logcat -c
"%ADB%" -s %S% shell am force-stop com.rajanverma944.orchardcare
"%ADB%" -s %S% shell am start -n com.rajanverma944.orchardcare/.MainActivity
timeout /t 12 /nobreak >nul
"%ADB%" -s %S% logcat -d > C:\oc\tools\logcat2.txt 2>&1
echo DUMPED
