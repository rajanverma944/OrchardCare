# Design: Image Storage, Fast Analysis Access & Derived Advice

Answers to "where do blobs/thumbnails/analysis live" and "how do we get from image findings to
tree-specific and group-level advice" — including the role of AI reasoning vs deterministic
rules. This is the blueprint Phase 2 implements.

## 1. Storage tiers (built for thousands of trees, no lag)

| Tier | What | Where | Why |
|---|---|---|---|
| **Blobs (originals)** | Re-encoded capture JPEGs (~300-500 KB each, q82) | Server disk `data/photos/<treeId>/GUID.jpg` → **object storage (MinIO/S3) at scale** | Bytes never live in Postgres (bloat + slow backups). GUID names, immutable, 30-day cache headers. 10k trees × 20 photos/yr ≈ 60 GB/yr — trivial for object storage. |
| **Quick images (thumbnails)** | 480 px q70 JPEG, generated at upload | Same directory as original (`*-t.jpg`) | Every list/evidence view loads *only* thumbs; full-size is fetched on tap. Phone caches thumbs (HTTP immutable cache). |
| **Quick analysis (JSONB)** | Colour ratios, scores, `regions[]` evidence boxes | `tree_photos.analysis` JSONB **on the same row** | One-row read gives photo + analysis together; no joins at render time. |
| **Rollups** | health score, leaf strength, disease code, photo count | Columns on `trees` (and orchard aggregates in the list query) | List screens read narrow columns — they never open the JSONB or blobs. This is the lag-killer. |
| **Device cache** | Thumbs + metadata for offline field use | SQLite (`trees`, `orchards`) + OS image cache | Orchard lists render instantly with zero network; sync queues fill gaps. |

Scale path (only when needed): partition `tree_photos` by orchard/month, materialized view for
per-orchard disease stats, CDN in front of thumbs.

## 2. Two kinds of advice: general vs derived

**General advice** (shipped): the Shimla spray calendar + month-by-month handbook. Same for every
orchard of the same elevation. Cheap, offline, always correct.

**Derived advice** (the heart of Phase 2) is produced by a pipeline, not by a person:

```
photos ──▶ analyser ──▶ FINDINGS ──▶ CLUSTERING ──▶ RULE ENGINE ──▶ advice cards (instant, offline-capable)
                                  │                                   ▲
                                  └──▶ LLM SYNTHESIS (narrative,     │
                                       forecasts, unusual patterns) ─┘──▶ safety filter (rates/PHI
                                                                            from knowledge base only)
```

### 2a. Findings table (new, the keystone)

```sql
CREATE TABLE findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id uuid REFERENCES trees(id) ON DELETE CASCADE,
  kind text NOT NULL,            -- 'disease' | 'pest' | 'stress' | 'structure'
  code text NOT NULL,            -- knowledge-base code e.g. 'apple-scab'
  confidence real NOT NULL,      -- 0..1
  source text NOT NULL,          -- 'photo-region' | 'manual' | 'survey'
  photo_id uuid REFERENCES tree_photos(id),   -- evidence link
  region jsonb,                  -- the bounding box inside that photo
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,       -- closed when a later photo shows recovery / treatment done
  notes text
);
```

Every analyser output, manual observation and survey answer becomes a **finding**. Advice never
reads raw photos — it reads findings. This decouples "detection" from "reasoning" and lets the
detector improve (colour → ML model) without touching the advice layer.

### 2b. Clustering → group scenarios (your "couple of trees in the same boat")

Trees already carry GPS. A scheduled pass (or on-sync trigger) groups findings:

- **Spatial**: trees within one block / within R metres of each other (R ≈ 2× average planting
  spacing, default 10 m).
- **Temporal**: same `code` detected within a 30-day window.
- **Weather-fit**: monsoon window active for fungal codes, pink-bud for thrips, etc.

Cluster result becomes an **outbreak** row: `{ code, tree_ids, first_seen, centroid, spread }`.
Your example then falls out naturally: ≥3 neighbouring trees with scab-like findings in the
monsoon window → "group destruction" scenario → block-level advice (spray the whole block, not
just the trees; sanitation for fallen leaves; increase monitoring frequency).

### 2c. Rule engine (deterministic, runs everywhere)

Advice for known scenarios is pure rules over (findings, clusters, season, stage, elevation):

```
WHEN outbreak(code=apple-scab, count>=3, window=monsoon)
EMIT advice: block-level mancozeb cycle 12-15 days (from knowledge base),
             remove+bury fallen leaves, re-photograph affected trees in 10 days,
             forecast: untreated scab in monsoon → 30-60% yield loss + storage rots (3-12 mo outlook)
```

Rules are auditable, free, instant, and work offline. Every rule cites the knowledge base entry —
**no invented doses, no invented PHI**. Scenarios to cover (supplied by domain content, one row
each): single-tree disease, co-infections (scab+mildew together), group outbreak, tree decline
(falling health across consecutive photo sets), biennial-bearing pattern from surveys, hail
aftermath, nutrient chlorosis pattern, post-treatment follow-up (finding unresolved after
treatment window), block-level canopy decline, pre-harvest PHI conflicts (don't spray, harvest
soon).

### 2d. Outcome forecasts (3 / 6 / 12 months)

Two layers, same split:

- **Deterministic progression tables** (first version): literature-based outcome curves per
  disease × season × severity → "untreated: −40% marketable yield by harvest, spores threaten
  neighbours within 3 weeks". Static, explainable, offline.
- **LLM-assisted synthesis** (later): turns the deterministic facts + findings history into a
  readable narrative ("this block will likely need 2 extra sprays and lose top-leaf quality by
  September unless treated before the next wet window"). The LLM *never* invents numbers —
  progression figures and product rates are injected from the knowledge base and the safety
  filter rejects any output containing doses/PHI not present in the input.

### 2e. So — do we need AI?

**Yes, but in a specific role.** The reasoning stack is hybrid by design:

| Job | Approach | Why |
|---|---|---|
| Detect abnormalities in photos | colour heuristics now → **ML model (TFLite / server)** | pattern recognition is ML's strength |
| Group/cluster scenarios | deterministic spatial-temporal rules | must be exact and explainable |
| Known-scenario advice | **rule engine** | safety-critical, offline, auditable |
| Narrative forecasts, unusual combinations, "what is linked to what" | **LLM (server-side, queued)** with strict grounding | genuinely needs language reasoning |
| Anything with a product rate or PHI | knowledge base only, hard-filtered | an LLM hallucinating a dose is unacceptable |

The LLM runs on the server as a *batch job over structured findings* (no images needed for most
synthesis; crops optional), so it stays cheap, works when connectivity returns, and its output is
advice *drafts* that pass the same safety filter as rules.

## 3. Implementation order (Phase 2)

1. `findings` table + analyser writes findings (not just JSONB) — small, immediate.
2. Rule engine v1: single-tree scenarios + PHI guardrails, advice cards in the tree screen.
3. Clustering pass → outbreak rows → block advice cards on the orchard screen.
4. Progression tables → 3/6/12-month outlook lines on advice cards.
5. LLM synthesis endpoint (server-side, cached, safety-filtered) for narratives.
