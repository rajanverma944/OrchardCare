@echo off
set ANDROID_ADB_SERVER_PORT=6952
set ADB=C:\oc\tools\android-sdk\platform-tools\adb.exe
for %%p in (5555 5556 5565 5575 5585 5595 5605) do "%ADB%" connect 127.0.0.1:%%p >nul 2>&1
"%ADB%" devices
