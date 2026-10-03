@echo off
set ADB=C:\oc\tools\android-sdk\platform-tools\adb.exe
"%ADB%" kill-server >nul 2>&1
"%ADB%" start-server >nul 2>&1
for %%p in (5555 5556 5565 5575 5585 5595 5605 5625 5645) do "%ADB%" connect 127.0.0.1:%%p >nul 2>&1
"%ADB%" devices
