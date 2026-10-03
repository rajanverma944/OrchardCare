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

### App crashes at launch / white or black screen on BlueStacks
Follow in this order — each step is one build or one settings change:

1. **Uninstall the old app first**, then install the new APK (stale native state survives
   otherwise).
2. Confirm `newArchEnabled=false` and `jsEngine: "jsc"` in `mobile/app.json` (v3+ APKs have both).
   - **Hermes vs BlueStacks:** Hermes requires SSE4.2 CPU instructions; BlueStacks' virtualisation
     sometimes doesn't expose them → SIGSEGV right when the JS engine starts (~2 s after launch),
     *before any of our code or error screens can render*. Symptom: first launch dies around the
     time the window animates, relaunch shows a blank (white/black) surface. JSC has no SSE4.2
     requirement — that's why v3 switched to `"jsEngine": "jsc"`.
3. **Enable ADB properly so logs can be pulled** (30 seconds, makes diagnosis deterministic):
   BlueStacks Settings (gear) → Advanced → tick **Android Debug Bridge**. Without this toggle the
   5555 port half-listens but every shell session drops with `error: closed` (this cost hours —
   see skills/skill-android-build.md for working capture patterns).
4. **Graphics renderer**: BlueStacks Settings → Graphics → switch renderer (OpenGL ↔ DirectX) and
   restart BlueStacks. Some RN builds render black surfaces on one renderer only.
5. If it still fails with ADB enabled, capture the crash in one terminal session:
   ```bat
   set ANDROID_ADB_SERVER_PORT=5900
   C:\oc\tools\android-sdk\platform-tools\adb.exe start-server
   C:\oc\tools\android-sdk\platform-tools\adb.exe connect 127.0.0.1:5555
   C:\oc\tools\android-sdk\platform-tools\adb.exe -s 127.0.0.1:5555 logcat -d -b crash,main > C:\oc\tools\crash.log
   ```
   `FATAL EXCEPTION` (Java) or `SIGSEGV` (native) + stack = the diagnosis. Send the file.

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
