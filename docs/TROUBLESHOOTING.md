# Troubleshooting

Symptoms → causes → fixes, collected from real incidents on this project.

## Backend

### `Invalid environment configuration: DATABASE_URL: Required`
`.env` missing. Copy `backend\.env.example` → `backend\.env`, fill values (secrets are machine
local; on the dev PC it already exists).

### `ECONNREFUSED 127.0.0.1:5433`
PostgreSQL isn't running: run `scripts\setup-postgres.ps1` (idempotent) or the pg_ctl start line
in [skills/skill-db-ops.md](../skills/skill-db-ops.md).

### Server starts but every request 500s / `/health` says `db: down`
Postgres died after boot — check `tools\pg.log`. Usual cause: another process grabbed 5433, or
the machine slept and the port didn't rebind (restart the service).

### Tests fail in a weird cascade (401s everywhere)
The auth rate-limiter tripped. Tests run with `NODE_ENV=test` which lifts the limit — if you ran
vitest without it (`npx vitest`), the 20-request limiter fires. Use `npm test`.

### `could not determine data type of parameter $N`
Postgres can't infer a parameter's type (usually one used only in `IS NULL`/CASE). Cast it
explicitly (`$N::timestamptz`) or compute the value in TypeScript like `insertTree` does.

## Mobile / build

### CMake: `Filename longer than 260 characters`
Building from the real project path. Build via `C:\oc` (junction) — `scripts\build-apk.ps1`
does this; run the build only through it.

### `Unable to resolve module expo-asset`
Stale node_modules vs new prebuild. `cd mobile && npm install && npx expo prebuild -p android --no-install`, rebuild.

### App crashes at launch / white or black screen on BlueStacks — **SOLVED CASE**

**Actual root cause (proven from crash log, 2026-10-03):**
`@expo/vector-icons@14.1.0` resolved `expo-font@57.0.4` (the SDK-54 generation) while the app
builds against `expo-modules-core@2.5.0` (SDK 53). At JS-context creation,
`FontLoaderModule.definition()` calls a method that doesn't exist in the older
expo-modules-core → `NoSuchMethodError` → instant crash ~2 s after launch, before any UI or
error screen. Symptom: first launch dies during the window animation; relaunch shows a dead
black/white surface. Crashes the same on both JS engines and both architectures.

**Fix:** pin everything to the SDK's expected versions —
```powershell
cd mobile
npx expo install expo-font @expo/vector-icons   # lets Expo pick SDK-matched versions
npm dedupe                                       # collapse duplicate transitive copies
npm ls expo-font                                 # must show ONE version, matching expo's
npx expo prebuild --platform android --clean --no-install
```
**Lesson: when anything Expo-native crashes at launch with a weird native `NoSuchMethodError`,
run `npm ls <suspect>` and look for nested duplicate versions from different SDK generations.**
`npx expo install --fix` does NOT check transitive deps of non-expo packages — `expo-font` was
invisible to it because only `@expo/vector-icons` (a plain npm dep) referenced it.

Other launch-crash causes we ruled out along the way (kept here so you don't chase them again):
- ~~Fabric/new-arch instability~~ (switched off in `app.json` — harmless to keep off)
- ~~Hermes SSE4.2 missing on BlueStacks~~ (v3 ran JSC — crashed identically)
- ~~missing JS bundle~~ (verified embedded in APK via zip listing)
- ~~window rotation race~~ (`screenOrientation="portrait"` already locked in the manifest)

**Cause 2 (JS, surfaced only after cause 1 was fixed):** React Native 0.79's lazy
`react-native` entry **no longer runs `InitializeCore` automatically**, so the app had
**no `fetch`, `XMLHttpRequest`, `FormData`, `Blob` globals at all**. The first module touching
them crashed with `Property 'FormData' doesn't exist` (JSC wording: `Can't find variable:
FormData`) on the `mqt_js` thread. Fix: the entry imports it explicitly — `mobile/index.js`:
```js
import 'react-native/Libraries/Core/InitializeCore';
```
Note: `FormData` moved from `Libraries/Blob/` to `Libraries/Network/` in RN 0.79 — old polyfill
snippets pointing at `Blob/FormData` will not resolve.

**Verified fixed on BlueStacks (Android 9 "P64", 2026-10-03, APK v6):** crash buffer empty
after launch + `ReactNativeJS: Running "main"`. Final config: `newArchEnabled=false`, Hermes
engine (default), `InitializeCore` imported in `index.js`.

**Enabling ADB on BlueStacks (needed for any of this diagnosis):** Settings → Advanced →
tick *Android Debug Bridge*. Then the reliable capture pattern (servers die with their console;
large streams drop — small on-device writes + `pull` work):
```bat
set ANDROID_ADB_SERVER_PORT=5900
C:\oc\tools\android-sdk\platform-tools\adb.exe start-server
C:\oc\tools\android-sdk\platform-tools\adb.exe connect 127.0.0.1:5555
C:\oc\tools\android-sdk\platform-tools\adb.exe -s 127.0.0.1:5555 shell logcat -d -b crash -f /sdcard/crash.txt
C:\oc\tools\android-sdk\platform-tools\adb.exe -s 127.0.0.1:5555 pull /sdcard/crash.txt C:\oc\tools\crash.txt
```
Each adb session is flaky — retry the pair; it lands within a few attempts.

### App can't reach the server ("network error" at login)
- Backend running? `curl http://127.0.0.1:5092/health` on the PC.
- Same Wi-Fi? BlueStacks uses the PC's network (usually fine); real phones need the same network.
- Windows Firewall may block inbound 5092 — allow Node/Private networks once, or check with the
  firewall prompt at first run.
- Server address in app Settings must be `http://<PC-LAN-IP>:5092` (default `192.168.1.7`).
  `ipconfig` to check the current IP.

## ADB (BlueStacks)

### `adb devices` empty / `error: closed` / daemon wars
- BlueStacks bundles `HD-Adb.exe` (protocol v36) that fights our platform-tools adb (v41) over
  port 5037 — pick ONE client per session, kill the other (`taskkill /f /im adb.exe`).
- The server dies with its parent console → start-server + all commands in ONE session.
- Private port avoids the 5037 war entirely: `set ANDROID_ADB_SERVER_PORT=5900`.
- Persistent `error: closed` on `shell` → ADB debugging isn't truly enabled in BlueStacks
  settings; manual APK install is the reliable path anyway.

## Git

### `push` fails intermittently
If two git commands run concurrently they race the index lock (`Unable to create ... index.lock`).
Run them sequentially. Check `git status` + `git fetch && git log origin/main..main` to confirm
what actually landed.

## Anything else

1. Reproduce.
2. Read the actual error (red screen / server console / pg.log).
3. Fix root cause; add the trap to this file.
