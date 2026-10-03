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

- [ ] **Disease evidence map — 2.5D (shipped as beta, keep refining):** every photo upload is
      analysed for lesion-like / whitish-bloom areas; each detection is stored as a normalised
      bounding box (`analysis.regions` on `tree_photos`) and rendered in the tree screen located
      by **viewing direction (compass) + height band** with the photo as evidence. This is the
      pragmatic "points where rot/disease is, with image evidence" layer.
- [ ] **True 3D structure (photogrammetry)** — see the design note below.
- [ ] On-device ML classifier (TensorFlow Lite) for disease names, replacing colour heuristics —
      the `PhotoAnalysis` interface already matches this; backend recomputes for older photos
- [ ] Weather integration (IMD forecast): spray-window rain warnings, chill-hours tracker
- [ ] Smart spray reminders (push notifications via FCM) driven by stage windows + weather
- [ ] Scab infection periods (Mills table) from temp/humidity → risk alerts
- [ ] Yield accuracy loop: compare survey estimate vs actual harvest weight entry

### Design note: from 360° photos to a 3D disease map

**Where the data lives today.** Every capture is stored twice: the image on disk under
`backend/data/photos/<treeId>/` with an unguessable GUID name, and its metadata + analysis as a
JSONB row in Postgres (`tree_photos`: direction, compass heading, capture time, colour ratios,
scores, and now `regions[]` bounding boxes). Offline captures queue on-device (SQLite
`photo_queue`) and upload when signal returns — nothing is lost in the field.

**The pragmatic 3D path (recommended).** True mesh reconstruction needs Structure-from-Motion
(SfM) — matching thousands of features across overlapping photos to estimate camera poses and a
point cloud. That is a heavy offline compute job, not something a phone or this Node API should
do inline. The plan:

1. **Capture for reconstruction** (app change): offer an "Orbit capture" mode — 15-25 overlapping
   photos (or a slow video orbit sampled to frames), GPS + compass heading on each. Overlap ≥ 60%
   between neighbours is what SfM needs.
2. **Reconstruction job** (PC-side, queued): run OpenSfM/COLMAP on the photo set → camera poses +
   sparse/dense point cloud → store as PLY/LAS next to the photos, with poses in the DB.
3. **Anchoring disease evidence in 3D**: each `regions[]` bounding box is back-projected through
   its camera pose onto the point cloud → a 3D point (or small cluster) per detection, linked to
   the source image crop. Rot/disease now has coordinates on the tree.
4. **Viewing**: a web dashboard with three.js (point cloud + coloured disease markers + image
   pop-outs on click); the phone keeps the 2.5D direction/height view.

**Sequencing:** 2.5D map now (shipped), orbit capture + offline SfM next, viewer last. The data
model needs no breaking change — regions and photos already carry everything SfM anchoring needs.

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
