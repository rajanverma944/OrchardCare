-- OrchardCare schema v1
-- UUIDs via gen_random_uuid() (core in PG13+)

CREATE TABLE IF NOT EXISTS users (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name          text NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 80),
    email         text NOT NULL UNIQUE CHECK (email = lower(email)),
    password_hash text NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash text NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);

CREATE TABLE IF NOT EXISTS orchards (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name          text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 100),
    village       text,
    latitude      double precision CHECK (latitude BETWEEN -90 AND 90),
    longitude     double precision CHECK (longitude BETWEEN -180 AND 180),
    elevation_m   integer CHECK (elevation_m BETWEEN 0 AND 4500),
    area_hectares numeric(8,2) CHECK (area_hectares IS NULL OR area_hectares BETWEEN 0 AND 10000),
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orchards_owner ON orchards(owner_id);

CREATE TABLE IF NOT EXISTS trees (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    orchard_id           uuid NOT NULL REFERENCES orchards(id) ON DELETE CASCADE,
    client_tree_id       uuid UNIQUE,
    code                 text NOT NULL CHECK (length(btrim(code)) BETWEEN 1 AND 24),
    variety              text,
    rootstock            text,
    planted_year         integer CHECK (planted_year IS NULL OR planted_year BETWEEN 1850 AND 2200),
    block                text CHECK (block IS NULL OR length(block) <= 24),
    latitude             double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude            double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    gps_accuracy_m       double precision CHECK (gps_accuracy_m IS NULL OR gps_accuracy_m BETWEEN 0 AND 200),
    height_m             numeric(5,2) CHECK (height_m IS NULL OR (height_m >= 0 AND height_m <= 40)),
    trunk_girth_cm       numeric(6,1) CHECK (trunk_girth_cm IS NULL OR (trunk_girth_cm >= 0 AND trunk_girth_cm <= 500)),
    canopy_diameter_m    numeric(5,2) CHECK (canopy_diameter_m IS NULL OR (canopy_diameter_m >= 0 AND canopy_diameter_m <= 30)),
    health_grade         text CHECK (health_grade IN ('excellent','good','fair','poor','critical')),
    health_score         integer CHECK (health_score IS NULL OR health_score BETWEEN 0 AND 100),
    leaf_strength_score  integer CHECK (leaf_strength_score IS NULL OR leaf_strength_score BETWEEN 0 AND 100),
    disease_code         text,
    disease_severity     integer CHECK (disease_severity IS NULL OR disease_severity BETWEEN 0 AND 5),
    disease_notes        text,
    notes                text,
    is_active            boolean NOT NULL DEFAULT true,
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now(),
    last_assessed_at     timestamptz,
    UNIQUE (orchard_id, code)
);
CREATE INDEX IF NOT EXISTS idx_trees_orchard ON trees(orchard_id);
CREATE INDEX IF NOT EXISTS idx_trees_active ON trees(orchard_id, is_active);

CREATE TABLE IF NOT EXISTS observations (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tree_id              uuid NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
    client_obs_id        uuid UNIQUE,
    observed_at          timestamptz NOT NULL DEFAULT now(),
    source               text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','photo','survey')),
    height_m             numeric(5,2),
    health_score         integer,
    health_grade         text CHECK (health_grade IS NULL OR health_grade IN ('excellent','good','fair','poor','critical')),
    leaf_strength_score  integer,
    disease_code         text,
    disease_severity     integer,
    notes                text,
    created_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_observations_tree ON observations(tree_id, observed_at DESC);

CREATE TABLE IF NOT EXISTS tree_photos (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tree_id        uuid NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
    client_photo_id uuid UNIQUE,
    direction      text NOT NULL DEFAULT 'OTHER'
                   CHECK (direction IN ('N','NE','E','SE','S','SW','W','NW','CLOSEUP','CANOPY','TRUNK','OTHER')),
    heading_deg    double precision CHECK (heading_deg IS NULL OR heading_deg BETWEEN 0 AND 360),
    file_path      text NOT NULL,
    thumb_path     text,
    width          integer,
    height         integer,
    captured_at    timestamptz,
    analysis       jsonb,
    uploaded_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tree_photos_tree ON tree_photos(tree_id, uploaded_at DESC);

CREATE TABLE IF NOT EXISTS surveys (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    orchard_id   uuid NOT NULL REFERENCES orchards(id) ON DELETE CASCADE,
    type         text NOT NULL CHECK (type IN ('harvest','pruning')),
    season       text NOT NULL CHECK (season ~ '^[0-9]{4}$'),
    started_at   timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    notes        text
);
CREATE INDEX IF NOT EXISTS idx_surveys_orchard ON surveys(orchard_id, started_at DESC);

CREATE TABLE IF NOT EXISTS survey_entries (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id           uuid NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    tree_id             uuid NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
    client_entry_id     uuid UNIQUE,
    fruit_count_est     integer CHECK (fruit_count_est IS NULL OR fruit_count_est BETWEEN 0 AND 30000),
    avg_fruit_weight_g  integer CHECK (avg_fruit_weight_g IS NULL OR avg_fruit_weight_g BETWEEN 20 AND 800),
    canopy_density      integer CHECK (canopy_density IS NULL OR canopy_density BETWEEN 0 AND 100),
    bare_wood_ratio     integer CHECK (bare_wood_ratio IS NULL OR bare_wood_ratio BETWEEN 0 AND 100),
    water_sprouts       integer CHECK (water_sprouts IS NULL OR water_sprouts BETWEEN 0 AND 500),
    pruning_needed      text CHECK (pruning_needed IN ('none','light','moderate','heavy','renewal')),
    computed_pruning    text CHECK (computed_pruning IN ('none','light','moderate','heavy','renewal')),
    pruning_reason      text,
    estimated_yield_kg  numeric(8,2) CHECK (estimated_yield_kg IS NULL OR estimated_yield_kg BETWEEN 0 AND 999),
    notes               text,
    recorded_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_survey_entries_survey ON survey_entries(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_entries_tree ON survey_entries(tree_id);

CREATE TABLE IF NOT EXISTS spray_tasks (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    orchard_id    uuid NOT NULL REFERENCES orchards(id) ON DELETE CASCADE,
    season        integer NOT NULL CHECK (season BETWEEN 2000 AND 2100),
    stage_key     text NOT NULL,
    planned_start date NOT NULL,
    planned_end   date NOT NULL,
    status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','skipped')),
    product_used  text,
    completed_at  timestamptz,
    notes         text,
    created_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (orchard_id, season, stage_key)
);
CREATE INDEX IF NOT EXISTS idx_spray_tasks_orchard ON spray_tasks(orchard_id, season);
