# Architecture & Understanding Guide

Read this once and the whole codebase will make sense. Time: ~10 minutes.

## The big picture

```
┌────────────────────────────────┐           ┌────────────────────────────────────┐
│  MOBILE (Expo RN, TypeScript)  │           │  BACKEND (Express, TypeScript)     │
│                                │   HTTPS   │                                    │
│  screens/    UI + forms        │ ────────▶ │  routes/     REST endpoints        │
│  api.ts      fetch + refresh   │ ◀──────── │  middleware/ auth, errors          │
│  db.ts       SQLite cache      │           │  services/   domain logic          │
│  sync.ts     offline queue     │           │  repo.ts     ownership guards      │
└────────────────────────────────┘           │  db.ts       pg pool + tx helper   │
        BlueStacks / Android phone           └──────────────┬─────────────────────┘
                                                          │
                                                 ┌────────▼─────────┐
                                                 │  PostgreSQL 16   │
                                                 │  5433 (local)    │
                                                 └──────────────────┘
```

**One language** (TypeScript) end to end. **Offline-first**: the phone works with zero signal;
writes queue in SQLite and flush via `POST /api/sync` when connected.

## Backend layers (request lifecycle)

1. `index.ts` — boot: load config → run migrations → start HTTP.
2. `app.ts` — middleware chain: helmet → cors → json → rate-limit → routes → 404 → error handler.
3. `middleware/auth.ts` (`requireAuth`) — verifies JWT, attaches `req.user`.
4. `repo.ts` — **ownership guards**: `getOwnedOrchard` / `getOwnedTree` return 404 unless the row
   belongs to `req.user.id`. Every data route calls one of these first. This is the single most
   important security pattern in the codebase — never query data without it.
5. `routes/*.ts` — controllers: validate input with a zod schema (`validation.ts`), call services,
   shape the JSON response.
6. `services/` — pure domain logic (testable without HTTP):
   - `sprayCalendar.ts` — 12 Shimla-belt stages, elevation-shifted dates, idempotent plan
     materialisation into `spray_tasks`.
   - `yieldService.ts` — yield estimate + pruning verdict rules.
   - `imageAnalysis.ts` — sharp → raw pixels → colour classes → 0-100 scores; aggregates a tree's
     photo ring into a `TreePhotoInsight`.
   - `adviceData.ts` — static Shimla agronomy knowledge base.
   - `authService.ts` — bcrypt, refresh-token rotation with reuse detection.

## Database schema (essentials)

```
users ── orchards ── trees ──┬── tree_photos (analysis jsonb)
                             ├── observations  (time series)
survey_entries (surveys ─ orchards, per tree)
spray_tasks    (per orchard+season, one per stage)
refresh_tokens (hashed, rotated)
```

- Every mutation table carries a `client_*_id uuid UNIQUE` column: the phone generates the UUID,
  so a retried sync can never duplicate a row (the backend returns the existing row instead).
- Money-ish numerics are `numeric` (never float). UUIDs via `gen_random_uuid()`.
- Migrations: plain SQL files in `sql/migrations/`, tracked in `schema_migrations`, applied at
  server boot (or `npm run migrate`).

## Mobile app structure

- `App.tsx` — auth gate (SecureStore tokens) + stack/tab navigation + **ErrorBoundary** +
  boot-error screen. Any crash renders readable text, never a silent white screen.
- `src/api.ts` — fetch wrapper: injects `Authorization`, transparently refreshes expired access
  tokens once, throws typed `ApiError`. `uploadPhoto` uses multipart FormData.
- `src/db.ts` — expo-sqlite: cached orchards/trees (instant offline lists), `sync_queue` (generic
  ops), `photo_queue` (offline shots), `kv` (small settings like selected orchard).
- `src/sync.ts` — flush photo queue first (multipart), then batched `/api/sync`; removes only
  server-confirmed items.
- `src/ui.tsx` — design tokens + `useUi()` fluid sizing (everything scales with screen width →
  same UI feels right on phones and BlueStacks' large window).
- Screens read from SQLite first, then refresh from the network — never a spinner-first UX.

## Design decisions worth knowing

| Decision | Why |
|---|---|
| Node backend, not Java/.NET | one runtime for app tooling + API on this machine; same language as the app |
| Portable PostgreSQL, not Docker | Docker Desktop isn't running on this PC; portability needs no admin |
| heuristic photo analysis (not ML) | zero-dependency first version; the interface (`PhotoAnalysis`) is designed so an ML model can drop in later |
| client-generated UUIDs everywhere | offline writes can't conflict or duplicate on sync |
| refresh-token rotation + reuse detection | a stolen refresh token gets the whole family revoked on first reuse |
| debug-signed APK for now | fastest loop for BlueStacks testing; proper signing is a 10-min upgrade when distributing |

## Performance notes

- Backend: parameterised queries, indexed FKs, `max: 10` pool; photo analysis capped at 512 px
  before pixel work; photos re-encoded (mozjpeg q82) + 480 px thumbnails.
- Mobile: SQLite reads for all list screens (0 network on launch), WAL mode, fluid layout avoids
  re-layout thrash, images served with immutable cache headers.
