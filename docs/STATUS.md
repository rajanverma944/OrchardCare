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

- Backend test suite (`tests/`): unit tests written, integration suite being added; then
  `npm install` + `npm test` until green.
- Mobile app: Expo/React Native scaffolding, screens (auth, orchards, tree catalog, 360 capture,
  spray plan, surveys, advice, settings), SQLite offline cache + sync queue.
- Android build: Expo prebuild + Gradle APK, installable on BlueStacks/device.
- End-to-end verification of the running API, start-scripts, and a security review pass.

## Environment facts (this machine)

- LAN IP for the app: `192.168.1.7` (Wi-Fi) — configured in `backend/.env` as `PUBLIC_BASE_URL`.
- Port 5432 on this PC is already used by another PostgreSQL service; OrchardCare's is on **5433**.
- Local dev secrets live only in `backend/.env` (git-ignored).
