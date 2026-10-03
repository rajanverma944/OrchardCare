# AGENTS.md — instructions for AI coding agents

You (an AI agent) are working on OrchardCare: an apple-orchard management app
(Expo/React Native mobile + Express/TypeScript backend + portable PostgreSQL) for Shimla (HP),
India. This file tells you how to work effectively in this repo.

## Read order (do this before any code change)

1. `docs/GUARDRAILS.md` — hard rules. Violating #1-#8 (security) is a failed change.
2. `docs/ARCHITECTURE.md` — how everything fits together (10 min).
3. `docs/PLAYBOOK.md` — how to run/build/test on this specific machine.
4. `docs/TROUBLESHOOTING.md` — known environment traps (ports, MAX_PATH, ADB).

## Machine reality (this is a Windows box with a portable toolchain)

- Repo root: `C:\Users\ACER\.zcode\workspace\default\orchardcare`, junctioned at `C:\oc`.
  **Use `C:\oc` for builds.**
- `node`, `git`, `java` are NOT on the system PATH. Use:
  - Node/npm: `C:\oc\tools\node\node.exe`, `C:\oc\tools\node\npm.cmd`
  - Git: `C:\oc\tools\git\bin\git.exe`
  - JDK: `C:\oc\tools\jdk21` (set `JAVA_HOME`)
  - Android SDK: `C:\oc\tools\android-sdk` (set `ANDROID_HOME`)
- PostgreSQL runs on **5433** (5432 is another service — do not touch it).
  Superuser password is in `scripts\setup-postgres.ps1`; app role creds in `backend\.env`.
- Backend: port **5092**; health `GET /health`; test DB `orchardcare_test`.
- ADB/BlueStacks: flaky. Prefer private `ANDROID_ADB_SERVER_PORT` and single-session commands.

## Standard workflows

### Backend change
```
edit src → cd C:\oc\backend → ..\tools\node\npm run typecheck
→ ..\tools\node\npm test        (must stay 41+ green)
→ npm run build → restart server → node scripts\smoke.mjs
```

### Mobile change
```
edit src → cd C:\oc\mobile → ..\tools\node\npx tsc --noEmit
→ (native dep changes only) npx expo prebuild --platform android --no-install
→ powershell -File C:\oc\scripts\build-apk.ps1  (~3-16 min; runs from junction)
```

### Committing
```
cd C:\oc; ..\tools\git\bin\git.exe add -A; commit with a why-style message; push origin main
```
Never commit: `.env`, `tools/`, `*.apk`, photo/data dirs (git-ignored — verify with
`git status` before pushing).

## Conventions

- Backend: routes validate with zod → guard with repo helpers → services hold domain logic.
  Add tests for new domain logic (vitest, `tests/`).
- Mobile: screens read SQLite-first; use `useUi()` for sizing; all network via `src/api.ts`.
- No new dependencies without checking Expo SDK compatibility (`npx expo install <pkg>`).
- Docs live in `docs/`; agent-facing runbooks in `skills/`. Update them when you change
  workflows, ports, or architecture — stale docs are bugs.

## When something fails

- Backend won't boot: read the error — usually DB down (run setup-postgres.ps1) or `.env`
  missing (copy from `.env.example`).
- Tests fail: run `npm test` twice before investigating (test DB truncation races are rare but
  real); if a failure is real, fix root cause — never delete a test to go green.
- APK build fails with CMake path errors: you built from the long path — use `C:\oc`.
- White screen in app: check `App.tsx` BootError text (screenshot from user); old-arch flag
  (`newArchEnabled=false`) must stay for BlueStacks compatibility.
- If an API returns 404 but the row exists: it's the ownership guard working — the requester
  isn't the owner; don't "fix" it by weakening the guard.

## Out of scope for agents without explicit instruction

- Release signing/keystore creation, Play Store setup
- Changing the public API shape without updating the mobile client + tests + docs
- Deleting or rewriting applied migrations
