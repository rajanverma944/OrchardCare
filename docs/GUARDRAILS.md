# Guardrails — read before changing this project

Rules that protect correctness, security, and the next person (human or AI agent) who touches the
code. If a change would violate one of these, stop and discuss in a PR description first.

## Security guardrails (never break these)

1. **Ownership checks before any data access.** Every orchard/tree/photo/survey/spray query goes
   through `repo.getOwnedOrchard` / `getOwnedTree` (or an explicit `owner_id` join in the WHERE).
   No route may trust a bare row id.
2. **Validate every input with zod** (`validation.ts`). No `req.body` field reaches SQL or logic
   unvalidated. New fields: extend the schema first.
3. **Parameterised SQL only.** `query(sql, params)` — never build SQL by string concatenation.
4. **Auth secrets never in code or git.** `.env` is git-ignored. JWT secret ≥ 32 chars. If a
   secret ever lands in a commit, rotate it immediately (it's public forever after).
5. **Passwords**: bcrypt cost ≥ 12. Login errors are generic (no user enumeration); login timing
   is equalised via the dummy-hash compare.
6. **Refresh tokens**: stored hashed (SHA-256), rotated on use, reuse revokes the family. Don't
   "simplify" this.
7. **Uploads**: magic-byte check + sharp decode + re-encode. Size limits enforced. Never serve
   client-supplied bytes as-is, never trust client filenames.
8. **Rate limits stay on** `/api/auth`. Test mode may raise limits via `NODE_ENV`, not by
   deleting the limiter.

## Data-integrity guardrails

9. **Offline sync is idempotent by construction**: every queued mutation carries a client UUID.
   Any new sync op type MUST use the `client_*_id` dedupe pattern or it will duplicate rows.
10. **Sync op isolation**: one bad op fails alone (savepoint), never the batch. Preserve this.
11. **Migrations are append-only SQL files**, each applied once inside a transaction. Never edit
    an applied migration — add a new file.
12. **Numeric columns for measurements** (numeric/double as per schema) — no floats stored in
    text, no unit guessing: heights are metres, girth centimetres, weight grams/kg as noted.
13. **Soft-delete trees** (`is_active = false`). Hard deletes only for photos (which also delete
    their files) and full orchard cascade.

## Mobile guardrails

14. **Offline-first**: list screens render from SQLite first, network is a refresh — never
    spinner-first. New screens must do the same.
15. **Network writes go through the queue pattern** (or direct API with an enqueue fallback).
    Silent data loss is the one unacceptable mobile bug.
16. **No white screens**: render errors go through `ErrorBoundary`/`BootError`. If you add a
    top-level component, wrap it.
17. **Android builds run from `C:\oc`** (short path). `scripts\build-apk.ps1` enforces this.
    Don't "fix" the path handling without testing a full clean CMake build.
18. **Expo SDK alignment**: after dependency changes run `npx expo install --fix`. Never bump
    react-native past what the Expo SDK supports.

## Process guardrails

19. **Typecheck before commit**: `npm run typecheck` in `backend/` and `mobile/`. Tests green:
    `npm test` in `backend/`. The suite takes ~70s — run it.
20. **Port discipline**: backend 5092, our PostgreSQL 5433 (5432 belongs to another service on
    this machine — never touch it), ADB server port: prefer a private port (e.g. 5900) because
    BlueStacks fights over 5037.
21. **Secrets in `.env` only**; new env vars go in `config.ts`'s zod schema + `.env.example`.
22. **Commits**: small, one concern, message describes the *why*; push to `main` is allowed for
    now (solo project) — revisit when collaborators appear.
23. **Agronomy content** (spray stages, advice, disease info) must carry the disclaimer and stay
    consistent with HP Horticulture extension practice; chemical names/rates are general
    guidance, never bespoke prescriptions.
