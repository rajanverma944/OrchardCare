# OrchardCare 🍎

Apple-orchard management app built for the **Shimla (Himachal Pradesh) apple belt** — tree-by-tree
cataloging with photos and GPS, disease & health tracking, a localized spray calendar, harvest /
pruning surveys with yield estimation, and an offline-first mobile experience for field use.

> **Status: under active development.** The backend API is implemented and boots against a local
> PostgreSQL. The mobile app and end-to-end verification are in progress — see
> [docs/STATUS.md](docs/STATUS.md).

## What it does

| Feature | Detail |
|---|---|
| Tree catalog | Every tree gets a code, variety, GPS position, height, trunk girth, canopy diameter, health grade & score, leaf-strength score, disease code and severity |
| Photo survey (360°) | Guided 8-direction capture ring + close-ups; the backend analyses each photo's canopy colours to estimate leaf strength, canopy density and scab/mildew/chlorosis risk, then aggregates a full-tree insight |
| Observations | Manual assessments (disease, health, height) recorded with a timestamped history per tree |
| Spray calendar | Shimla-belt stage plan (dormant oil → pink bud → petal fall → covers → calcium → harvest → post-harvest sanitation → winter pruning), shifted by orchard elevation, with products/rates, bee-safety notes, pre-harvest intervals and status tracking (due-soon / in-window / overdue) |
| Harvest survey | Count fruit per tree → per-tree kg estimate → orchard projection; identify top producers |
| Pruning survey | Canopy density, bare-wood ratio and water-sprout counts → automatic pruning verdict (none/light/moderate/heavy/renewal) with reasons, plus a prioritised winter work list |
| Advice | Month-by-month care calendar, disease handbook (14 entries with organic + chemical controls), variety notes — all downloadable for offline use |
| Offline sync | Field data is queued on-device (SQLite) and flushed transactionally with client-generated IDs — retries never duplicate records |

## Architecture

```
┌──────────────────────┐        REST + JWT          ┌─────────────────────────┐
│  React Native (Expo) │  ───────────────────────▶  │  Node.js + Express API  │
│  TypeScript, SQLite  │   photos (multipart)       │  TypeScript             │
│  offline-first       │  ◀───────────────────────  │  sharp image analysis   │
└──────────────────────┘                            └───────────┬─────────────┘
        Android APK (BlueStacks / device)                       │
                                                     ┌──────────▼─────────────┐
                                                     │      PostgreSQL 16     │
                                                     └────────────────────────┘
```

- [`backend/`](backend) — REST API (Express + TypeScript), PostgreSQL, JWT auth with refresh-token
  rotation, heuristic photo analysis (sharp), spray-calendar engine, yield/pruning estimator,
  offline-batch sync endpoint. Vitest test suite.
- `mobile/` — Expo / React Native app *(in progress)*.
- [`scripts/`](scripts) — portable PostgreSQL setup for Windows.

## Security notes

- Passwords: bcrypt (12 rounds). Tokens: short-lived JWT access + rotating opaque refresh tokens
  (hashed at rest; reuse of a rotated token revokes the whole family).
- Uploads: magic-byte checked, size-limited, re-encoded via sharp (no original bytes served),
  stored under unguessable GUID names, authorization checked on every read/write.
- All input validated with zod; parameterised SQL throughout (no string-built queries).
- `.env` files and toolchain binaries are **not** committed — see `.gitignore`.

## Setup (Windows)

See [backend/README.md](backend/README.md) and [docs/STATUS.md](docs/STATUS.md).

---

*Guidance content follows Himachal Pradesh Horticulture Department extension practice in general
terms. Always confirm products and rates with your Circle Horticulture Development Officer and the
product label.*
