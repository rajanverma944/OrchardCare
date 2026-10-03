# Getting Started — OrchardCare

Everything you need to go from a fresh Windows PC to a running app. No admin rights required at
any point.

## What this project is

A mobile app (Android) + backend for apple-orchard management in the Shimla (HP) belt:
tree-by-tree cataloging with photos/GPS, disease & health tracking, a localized spray calendar,
harvest/pruning surveys with yield estimation, and an offline-first field experience.

```
mobile/   Expo + React Native + TypeScript  →  Android APK (BlueStacks or phone)
backend/  Node.js + Express + TypeScript REST API (port 5092)
db        Portable PostgreSQL 16 (port 5433, bundled under tools/)
```

## Prerequisites

**You don't need to install anything** if the repo was provisioned on this machine — the entire
toolchain is portable and lives in `tools/`:

| Path | What |
|---|---|
| `tools/node/` | Node.js 22 |
| `tools/jdk21/` | Eclipse Temurin JDK 21 |
| `tools/android-sdk/` | Android platform-tools, SDK 35/36, build-tools |
| `tools/pgsql/` + `tools/pgdata/` | PostgreSQL 16 binaries + data cluster |
| `tools/git/` | Portable Git |

If you're cloning **from GitHub onto a new machine**, run `scripts\provision-tools.ps1`
(see [skills/skill-provisioning.md](skills/skill-provisioning.md)) or install the five tools
yourself and make sure they're on `PATH` for your shell.

> **Windows path-limit warning:** Android builds must run from a **short path**. We use a directory
> junction `C:\oc` → project folder. `scripts\build-apk.ps1` creates/uses it automatically. Building
> from `C:\Users\<you>\...\orchardcare\mobile\android` will fail in CMake with
> *"Filename longer than 260 characters"*.

## Daily use (3 commands)

```powershell
# 1. Start the database + API (backend)
powershell -ExecutionPolicy Bypass -File scripts\start-all.ps1

# 2. (One-time, or after code changes) Build the Android APK
powershell -ExecutionPolicy Bypass -File scripts\build-apk.ps1
#    Output: C:\oc\OrchardCare.apk

# 3. Install the APK
#    - BlueStacks: drag the APK onto the BlueStacks window (or Media Manager → install).
#      If upgrading: uninstall the old app first (long-press icon → Uninstall).
#    - Phone: copy APK over, open it, allow "unknown sources".
```

Then in the app: **Settings → Server address** must point at your PC — default
`http://192.168.1.7:5092` (this PC's Wi-Fi LAN IP; check yours if the network changes). The phone
and PC must be on the same Wi-Fi. Sign up, add an orchard, add trees, take photos.

## First-run smoke checklist (5 min)

1. `GET http://<pc-ip>:5092/health` in a browser → `{"ok":true,"db":"up",...}`
2. App → sign up (any email/password with 8+ chars, letter + number)
3. Add an orchard (name + elevation, e.g. 2100)
4. Add a tree → GPS is attached automatically
5. Open the tree → *Start 360° capture* → take a few photos → the analysis card appears
6. Spray tab → 12 stages with dates; mark one done
7. Survey tab → start survey, record a tree → summary updates

## Running the tests

```powershell
cd backend
..\tools\node\npm install          # once
..\tools\node\npm test             # 41 unit + integration tests (uses orchardcare_test DB)
..\tools\node\node scripts\smoke.mjs   # live checks against a running server
```

## Where things live

| Thing | Where |
|---|---|
| Database connection + secrets | `backend/.env` (git-ignored; copy from `backend/.env.example`) |
| Photo files | `backend/data/photos/` |
| SQL schema/migrations | `backend/sql/migrations/*.sql` |
| Spray-calendar domain logic | `backend/src/services/sprayCalendar.ts` |
| Photo analysis | `backend/src/services/imageAnalysis.ts` |
| Yield/pruning rules | `backend/src/services/yieldService.ts` |
| Shimla knowledge base | `backend/src/services/adviceData.ts` |
| App screens | `mobile/src/screens/*.tsx` |
| Offline cache + sync queue | `mobile/src/db.ts`, `mobile/src/sync.ts` |

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) — covers the known traps: port 5432 occupied,
BlueStacks ADB fights, MAX_PATH build failures, white screens, and how to read app error screens.
