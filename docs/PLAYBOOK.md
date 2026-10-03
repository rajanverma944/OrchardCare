# Master Playbook — OrchardCare

The step-by-step runbook for every common task. Each task assumes you start at the repo root
(`C:\oc` works everywhere — it's the junction to the project folder).

> **Golden rule:** use the portable tools under `tools\` and the `C:\oc` path. Never assume
> `node`/`git` are on the system PATH; never build Android from the long path.

---

## 1. Run everything (daily)

```powershell
powershell -ExecutionPolicy Bypass -File C:\oc\scripts\start-all.ps1
```

What it does: starts portable PostgreSQL (5433) → starts compiled backend (5092).
Check: browser to `http://127.0.0.1:5092/health`.

## 2. Rebuild the backend after code changes

```powershell
cd C:\oc\backend
..\tools\node\npm run build        # tsc → dist\
node dist\src\index.js             # or rerun start-all.ps1
```

Dev mode (auto-reload, no dist needed): `..\tools\node\npm run dev`

## 3. Run the test suite

```powershell
cd C:\oc\backend
..\tools\node\npm test             # 41 tests against orchardcare_test
..\tools\node\npm run typecheck    # fast sanity
node scripts\smoke.mjs             # live server checks (server must be running)
```

## 4. Rebuild the Android APK

```powershell
powershell -ExecutionPolicy Bypass -File C:\oc\scripts\build-apk.ps1
# → C:\oc\OrchardCare.apk
```

Inside this script: creates `C:\oc` junction if missing → sets JAVA_HOME/ANDROID_HOME →
`gradlew assembleRelease --no-daemon` → copies APK to `C:\oc\OrchardCare.apk`.
Build time: ~3 min warm, ~45 min cold (first Gradle run downloads the world).

If native deps changed (`npm install` added something with native code):
`cd C:\oc\mobile && ..\tools\node\npx expo prebuild --platform android --no-install` first,
then rebuild.

## 5. Install into BlueStacks

1. Drag `C:\oc\OrchardCare.apk` onto the BlueStacks window, **or** Media Manager → import → open.
2. **Upgrading over a broken/crashed install:** long-press the app icon → Uninstall first.
3. Launch → if anything goes wrong you'll see a red error screen with the message —
   screenshot it and bring it to the next task (that's what it's for).

## 6. Change the server address the app uses

- In-app: Settings → Server address → save.
- Default is baked as `http://192.168.1.7:5092` (PC LAN IP). If your IP changed:
  update `backend\.env` `PUBLIC_BASE_URL`, restart backend, update it in app Settings too.

## 7. Database operations

```powershell
# start/stop
C:\oc\tools\pgsql\bin\pg_ctl.exe -D C:\oc\tools\pgdata -o "-p 5433" -l C:\oc\tools\pg.log start
C:\oc\tools\pgsql\bin\pg_ctl.exe -D C:\oc\tools\pgdata stop -m fast

# psql shell
$env:PGPASSWORD='orchard-super-local'
C:\oc\tools\pgsql\bin\psql.exe -U postgres -h 127.0.0.1 -p 5433 -d orchardcare

# manual migration
cd C:\oc\backend; ..\tools\node\npm run migrate

# reset dev DB (DESTROYS data)
# in psql: DROP DATABASE orchardcare; CREATE DATABASE orchardcare OWNER orchard;
# then restart backend (migrations re-apply)
```

## 8. Git

```powershell
cd C:\oc
..\tools\git\bin\git.exe status
..\tools\git\bin\git.exe add -A
..\tools\git\bin\git.exe commit -m "..."
..\tools\git\bin\git.exe push origin main
```

Never commit: `.env`, `tools\`, `tools\pgdata`, photo data, `*.apk` (all git-ignored — keep it that way).

## 9. Diagnose an app problem on BlueStacks

1. In-app red screen? Read it — it contains the JS error + stack.
2. Server-side: backend console window / `tools\pg.log`.
3. ADB (if enabled in BlueStacks settings → Advanced):
   - Our platform-tools adb fights BlueStacks' own `HD-Adb.exe` over port 5037 — pick ONE.
   - If servers keep dying when your terminal closes, run start-server + all commands in a
     single shell session on a private port: `set ANDROID_ADB_SERVER_PORT=5900`.
4. Always test auth first: `curl http://127.0.0.1:5092/health`.

## 10. Onboard a new developer / agent

Point them at `docs/GETTING-STARTED.md`, then `docs/ARCHITECTURE.md`, then the
`skills/` folder for task-specific runbooks. AI agents: read `AGENTS.md` first, then
`docs/GUARDRAILS.md` before touching anything.
