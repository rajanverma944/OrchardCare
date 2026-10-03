# OrchardCare backend

Node.js + Express + TypeScript REST API for the OrchardCare mobile app.

## Quick start

```powershell
# 1. Start the bundled portable PostgreSQL (creates DBs, port 5433)
powershell -ExecutionPolicy Bypass -File ..\scripts\setup-postgres.ps1

# 2. Install dependencies
npm install

# 3. Create .env from the example (already done for this machine)
copy .env.example .env

# 4. Run (migrations are applied automatically at boot)
npm run dev
```

API then listens on `http://<your-LAN-IP>:5092` — health check: `GET /health`.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Watch-mode dev server |
| `npm run build` / `npm start` | Compile and run (`dist/`) |
| `npm run migrate` | Apply pending SQL migrations manually |
| `npm test` | Vitest unit + API integration tests (uses `orchardcare_test` DB) |
| `npm run typecheck` | Strict TypeScript check |

## Environment (`.env`)

| Key | Meaning |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (dev) |
| `DATABASE_URL_TEST` | Database used by the test suite |
| `JWT_SECRET` | 32+ chars — access-token signing key |
| `PORT` | API port (default 5092) |
| `PHOTOS_DIR` | Where photo files are stored |
| `PUBLIC_BASE_URL` | Base URL the phone/BlueStacks uses to reach this PC |

## API surface

```
POST /api/auth/register|login|refresh|logout
GET  /health
GET/POST/PUT/DELETE /api/orchards[/:id]
GET  /api/trees/orchards/:id/trees        POST /api/trees/orchards/:id/trees
GET/PUT/DELETE /api/trees/:treeId
POST /api/trees/:treeId/observations
POST /api/trees/:treeId/recalculate       (re-derive health from photo set, >=3 photos)
POST /api/photos/:treeId/photos           (multipart JPEG/PNG, analysed on upload)
GET  /api/photos/:treeId/photos           DELETE /api/photos/:photoId
POST/GET /api/surveys/orchards/:id/surveys
POST /api/surveys/:surveyId/entries       GET /api/surveys/:surveyId   POST .../complete
GET  /api/spray/orchards/:id/plan?season=YYYY   PUT /api/spray/tasks/:taskId
POST /api/sync                            (offline batch flush, idempotent per clientId)
GET  /api/advice/handbook|diseases|varieties?month=
```

All orchard/tree/photo/survey/spray routes require `Authorization: Bearer <accessToken>` and are
scoped to the owning user.

## Testing

`npm test` runs pure unit tests (yield/pruning engines, spray calendar, photo analyser) plus an
API integration suite against `orchardcare_test` (registration → orchard → trees → photos →
surveys → spray plan → sync → authorization matrix).
