# Skill: Database operations

**When:** starting/stopping PostgreSQL, inspecting data, resetting, backups.

## Facts

- Portable PostgreSQL 16 at `C:\oc\tools\pgsql`, data at `C:\oc\tools\pgdata`.
- **Port 5433** (5432 belongs to a pre-existing Windows PostgreSQL service with unknown
  credentials — leave it alone).
- Role `orchard` / password `orchard_local_dev` (app uses it via `backend\.env` DATABASE_URL).
- Superuser `postgres` / `orchard-super-local` (set by `scripts\setup-postgres.ps1`).
- DBs: `orchardcare` (dev), `orchardcare_test` (tests truncate + re-run freely).

## Start / stop / status

```powershell
C:\oc\tools\pgsql\bin\pg_ctl.exe -D C:\oc\tools\pgdata -o "-p 5433 -c listen_addresses=127.0.0.1" -l C:\oc\tools\pg.log start
C:\oc\tools\pgsql\bin\pg_ctl.exe -D C:\oc\tools\pgdata stop -m fast
C:\oc\tools\pgsql\bin\pg_ctl.exe -D C:\oc\tools\pgdata status
```

(`scripts\start-all.ps1` starts it for you.)

## psql shell

```powershell
$env:PGPASSWORD='orchard-super-local'
C:\oc\tools\pgsql\bin\psql.exe -U postgres -h 127.0.0.1 -p 5433 -d orchardcare
```

Handy SQL:
```sql
\dt                                            -- tables
SELECT count(*) FROM trees;                    -- quick counts
SELECT code, health_score FROM trees WHERE is_active ORDER BY code;
SELECT stage_key, status, planned_start FROM spray_tasks ORDER BY planned_start;
```

## Migrations

Applied automatically at server boot. Manual: `cd C:\oc\backend; ..\tools\node\npm run migrate`.
Rules: append-only files, never edit an applied migration (GUARDRAILS #11).

## Reset dev database (destroys data)

```sql
-- psql as postgres:
DROP DATABASE IF EXISTS orchardcare;
CREATE DATABASE orchardcare OWNER orchard;
```
Then restart the backend (migrations re-apply).

## Backup / restore

```powershell
$env:PGPASSWORD='orchard-super-local'
C:\oc\tools\pgsql\bin\pg_dump.exe -U postgres -h 127.0.0.1 -p 5433 orchardcare > C:\oc\tools\backup-2026-10-03.sql
# restore: psql -U postgres -h 127.0.0.1 -p 5433 orchardcare < backup.sql
```

TODO (roadmap): nightly scheduled dump + `backend\data\photos` copy.

## Photo files

`backend\data\photos\<tree-prefix>\<treeId>\*.jpg` — DB rows in `tree_photos` hold absolute
paths + `analysis jsonb`. Deleting a photo row deletes its file (see `routes/photos.ts`).
Deleting an orchard deletes all descendant rows and photo files (cascade + best-effort rm).
