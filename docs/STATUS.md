# Project status — 2026-10-03

## Done and verified

- **Toolchain provisioned** (portable, no admin rights): Node 22, JDK 21 (Temurin), Android SDK
  (platform-tools, API 36, build-tools 36), PostgreSQL 16 portable, portable Git.
- **Backend implemented** (`backend/`):
  - SQL schema (users, refresh tokens, orchards, trees, observations, tree photos with analysis,
    surveys, survey entries, spray tasks) + migration runner.
  - Auth: bcrypt + JWT access tokens, rotating refresh tokens with reuse detection, timing-equalised
    login, rate limiting on auth routes.
  - Orchards/trees/observations CRUD with per-user authorization on every route.
  - Photo upload: magic-byte + sharp decode checks, re-encode, thumbnail, heuristic colour-space
    analysis (leaf strength, canopy density, scab/mildew/chlorosis risk), 360° ring aggregation
    with confidence levels, tree recalculation endpoint.
  - Shimla spray-calendar engine: 12 stages with products/rates/bee-safety/PHI, elevation-based date
    shift, idempotent plan materialisation, status derivation (due-soon/in-window/overdue).
  - Harvest & pruning surveys: yield estimation, pruning verdicts, orchard summary + prioritised
    pruning list.
  - Advice handbook: 14 diseases, month-by-month articles, variety guide (offline bundle endpoint).
  - Offline batch sync endpoint with per-op savepoints and clientId idempotency.
  - Portable PostgreSQL running on **port 5433** (5432 was occupied by an existing service);
    databases `orchardcare` and `orchardcare_test` created.
- **READMEs** for the project and backend.

## In progress

- **Android APK build** running (Gradle `assembleRelease`). Start scripts + APK install
  instructions are in the root README.
- Mobile screens are implemented (auth, orchards, trees + 360° capture, spray calendar, harvest
  survey, advice, settings with offline sync + server address) and typecheck clean.
- **Android APK built and verified** (`app-release.apk`, debug-signed, all ABIs incl. x86 for
  BlueStacks; copied to `C:\oc\OrchardCare.apk`). Note: builds must run from the `C:\oc` junction —
  Windows MAX_PATH breaks CMake otherwise; `scripts\build-apk.ps1` handles this automatically.
- Remaining: install on BlueStacks/device and walk through the flows once, plus a final security
  review pass. Mobile `npm audit` reports transitive `braces`/`micromatch` advisories inside
  React Native's own jest tooling (dev-time only, not in the app runtime; fixing them would force
  react-native 0.87 which is incompatible with Expo SDK 53).

## Environment facts (this machine)

- LAN IP for the app: `192.168.1.7` (Wi-Fi) — configured in `backend/.env` as `PUBLIC_BASE_URL`.
- Port 5432 on this PC is already used by another PostgreSQL service; OrchardCare's is on **5433**.
- Local dev secrets live only in `backend/.env` (git-ignored).
