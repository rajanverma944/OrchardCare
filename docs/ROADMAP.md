# OrchardCare Roadmap

Where we are, and where this goes. Phases are sequenced by value to a working Shimla orchard
operation; each phase leaves the app fully usable.

## Phase 0 — Core platform ✅ (done, 2026-10-03)

- [x] Auth (JWT + rotating refresh, reuse detection), rate limiting
- [x] Orchards / trees / observations CRUD, per-user authorization
- [x] Photo upload: validation, re-encode, thumbnails, heuristic 360° analysis
- [x] Shimla spray calendar (12 stages, elevation shifts, status tracking)
- [x] Harvest + pruning surveys: yield estimates, verdicts, prioritised work list
- [x] Advice handbook (14 diseases, month-by-month calendar, varieties) — offline capable
- [x] Offline-first mobile app (SQLite cache, sync queue, error boundary)
- [x] Release APK for BlueStacks/phones; 41 backend tests; live smoke checks
- [x] Portable toolchain + one-command start/build scripts

## Phase 1 — Field hardening (next 2-4 weeks)

- [ ] Install on a real phone + 2-3 days of orchard use; fix whatever real fingers find
- [ ] Tree detail: manual attribute editor (height, girth, variety) in the app
- [ ] Photo-based tree health trends (sparkline over observations)
- [ ] Export: CSV + PDF block report (per-tree yields, spray log) for the market/bank
- [ ] PWA-lite fallback? (only if growers need it on basic phones — probably not)
- [ ] Release signing (proper keystore, versioned builds)

## Phase 2 — Intelligence upgrade (1-2 months)

- [ ] Replace heuristic analyser with on-device ML (TensorFlow Lite, leaf-disease model) —
      the `PhotoAnalysis` interface already matches this; backend recomputes for older photos
- [ ] Weather integration (IMD forecast): spray-window rain warnings, chill-hours tracker
- [ ] Smart spray reminders (push notifications via FCM) driven by stage windows + weather
- [ ] Scab infection periods (Mills table) from temp/humidity → risk alerts
- [ ] Yield accuracy loop: compare survey estimate vs actual harvest weight entry

## Phase 3 — Scale & collaboration (3+ months)

- [ ] Multi-user orchards (owner + workers with roles; worker sees assigned blocks)
- [ ] Blocks/zones within orchards; spray-task assignment per block
- [ ] Marketplace layer (optional): input dealers, mandi rates (Theog/Dhalli)
- [ ] Hindi / Himachali localization of the advice content
- [ ] Horticulture-officer dashboard (aggregate, anonymised block health)

## Engineering roadmap (continuing)

- [ ] CI on GitHub Actions: typecheck + tests + APK build on every push
- [ ] Greenkeeper-style dependency discipline; RN 0.8x upgrade when Expo SDK supports it
- [ ] Move photo storage to S3-compatible storage if multi-device/multi-user grows
- [ ] Backup story: nightly `pg_dump` + photo dir sync (script exists as TODO)

## Explicit non-goals

- iOS builds (nothing in the codebase blocks it, but Shimla growers are Android-first)
- Social features, gamification — the orchard is the product
- Real-time collaboration (sync is batch/eventual by design; field connectivity is poor)
