# Skill: Android build & emulator deployment

**When:** producing/installing the APK; diagnosing build or emulator issues.

## The build (one command)

```powershell
powershell -ExecutionPolicy Bypass -File C:\oc\scripts\build-apk.ps1
# → C:\oc\OrchardCare.apk
```

Under the hood: ensures `C:\oc` junction → JAVA_HOME/ANDROID_HOME → gradle `assembleRelease`.
Cold build ≈ 45 min (Gradle downloads), warm ≈ 3-16 min.

## Prerequisite matrix

| Task | Needs |
|---|---|
| JS-only screen edits | nothing (Gradle re-bundles automatically) |
| New native module / package.json change | `npx expo install <pkg>` + `npx expo prebuild --platform android --no-install` |
| app.json change (name/icon/permissions/plugins) | prebuild again |
| New Android SDK version | `sdkmanager 'platforms;android-3X' 'build-tools;3X.0.0'` from `tools\android-sdk\cmdline-tools\latest\bin` with JAVA_HOME set |

## Known traps (each cost us real time once)

1. **MAX_PATH**: CMake fails with "Filename longer than 260 characters" if you build from the
   real project path. Always `C:\oc`.
2. **expo-asset**: `expo-sqlite` needs it at bundle time — "Unable to resolve module expo-asset"
   means a fresh clone skipped `npm install` or prebuild plugins.
3. **Gradle memory**: `--no-daemon` avoids zombie daemons on this machine; slower but reliable.
4. **newArchEnabled must stay false** for BlueStacks (Fabric/white-screen issues on VirtualBox
   GPU). Real phones would be fine either way; BlueStacks is the test target.
5. **Signing**: release APK is debug-signed (Expo default) — installable anywhere, don't ship to
   production. versionCode bumps live in `mobile/app.json` under `android`.

## Installing on BlueStacks

- Drag APK onto the BlueStacks window; or Media Manager → Install.
- **Reinstall after a crashed/white-screen build:** uninstall the app first (long-press icon →
  Uninstall) — stale native state otherwise survives upgrades.

## Installing via ADB (optional, flaky on BlueStacks)

```bat
set ANDROID_ADB_SERVER_PORT=5900
C:\oc\tools\android-sdk\platform-tools\adb.exe start-server
C:\oc\tools\android-sdk\platform-tools\adb.exe connect 127.0.0.1:5555
C:\oc\tools\android-sdk\platform-tools\adb.exe -s 127.0.0.1:5555 install -r C:\oc\OrchardCare.apk
```

Rules learned the hard way:
- Our adb (v41) and BlueStacks' `HD-Adb.exe` (v36) kill each other's server over port 5037 —
  use exactly one client per session.
- The adb server dies when its parent console closes → run `start-server` **and all commands in
  one shell session** (private port helps avoid the 5037 war).
- If `shell` returns `error: closed`, ADB debugging isn't really enabled in BlueStacks
  (Settings → Advanced) — fall back to manual APK drag-and-drop.
- Do everything in one command chain; see `scripts\adb-launch-capture.bat` for the pattern.
