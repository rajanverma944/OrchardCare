# Skill: Mobile app development

**When:** changing screens, offline behaviour, or the API client.

## Screen contract (non-negotiable pattern)

```
focus → read SQLite (instant render) → try network refresh → update SQLite → rerender
writes → try API → on failure enqueue in SQLite queue → Settings shows pending count
```

If your screen spins first and renders later, you broke offline-first (GUARDRAILS #14).

## Where things live

- Screens: `src/screens/*.tsx` — keep them lean; shared widgets in `src/ui.tsx` (`Chip`,
  `HealthBar`, `card()`, `btn()`, `input()` helpers, `useUi()` fluid metrics).
- API calls: **only** via `src/api.ts` (`request`, `login`, `register`, `uploadPhoto`).
  It handles base URL + token refresh. Don't fetch directly.
- Offline data: `src/db.ts` helpers. New cached table → add to `initDb()` + cache/read helpers.
- Sync ops: `src/sync.ts` + payload types mirrored from backend `validation.ts`.

## Fluid UI

`useUi()` returns sizes scaled to screen width so phones and BlueStacks windows both look right.
Never hardcode font sizes >16 or paddings >24 — derive from `ui.font.*` / `ui.pad`.

## Error display

Render failures are caught by `ErrorBoundary` in `App.tsx`. For expected failures (offline
API call), show inline status text — never alert() spam, never silent swallow.

## Typecheck + build

```powershell
cd C:\oc\mobile
..\tools\node\npx tsc --noEmit
# native dep changes only:
..\tools\node\npx expo install <pkg>; ..\tools\node\npx expo prebuild --platform android --no-install
powershell -File C:\oc\scripts\build-apk.ps1
```

`newArchEnabled: false` in `app.json` is deliberate (BlueStacks compatibility). Don't flip it
without testing a full boot on BlueStacks.
