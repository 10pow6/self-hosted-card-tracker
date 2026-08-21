PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS core_card (
    id                       TEXT PRIMARY KEY,
    embedder_name            TEXT NOT NULL,
    embedder_version         TEXT NOT NULL,
    embedding                BLOB NOT NULL,
    representative_crop_path TEXT NOT NULL,
    name                     TEXT,
    set_name                 TEXT,
    card_number              TEXT,
    year                     INTEGER,
    card_type                TEXT,
    notes                    TEXT,
    metadata_confidence      REAL,
    metadata_source          TEXT,  -- 'manual' | 'claude-skill' (NULL = never enriched)
    created_at               TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at               TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS binder (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    layout          TEXT NOT NULL DEFAULT '3x3',
    -- Which detector this binder uses for /scans/preview. Each detector has its own
    -- config schema (see card_tracker.detectors). Adding a new detector (e.g.
    -- 'yolo-cards-v1') is purely additive — no schema change.
    detector        TEXT NOT NULL DEFAULT 'opencv-grid-v1',
    -- JSON, schema depends on `detector`. Any subset of keys; missing keys fall
    -- back to the detector's defaults.
    detector_config TEXT,
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS page (
    id                TEXT PRIMARY KEY,
    binder_id         TEXT NOT NULL REFERENCES binder(id) ON DELETE CASCADE,
    page_number       INTEGER NOT NULL,
    source_image_path TEXT NOT NULL,
    captured_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (binder_id, page_number)
);

-- Empty pockets are persisted with NULL crop/embedding and review_status='empty'
-- so the binder model accurately reflects "this slot was deliberately empty".
CREATE TABLE IF NOT EXISTS placement (
    id                TEXT PRIMARY KEY,
    page_id           TEXT NOT NULL REFERENCES page(id) ON DELETE CASCADE,
    slot_index        INTEGER NOT NULL,
    polygon           TEXT,                              -- JSON: [[x,y], [x,y], [x,y], [x,y]] in source-image px
    crop_image_path   TEXT,
    embedding         BLOB,
    embedder_name     TEXT,
    embedder_version  TEXT,
    core_card_id      TEXT REFERENCES core_card(id),
    similarity_score  REAL,
    review_status     TEXT NOT NULL DEFAULT 'pending',
    deferred_at       TEXT,
    created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    resolved_at       TEXT,
    UNIQUE (page_id, slot_index),
    CHECK (review_status IN ('pending', 'auto_matched', 'user_confirmed', 'new_card', 'empty'))
);

CREATE INDEX IF NOT EXISTS idx_placement_review ON placement(review_status);
CREATE INDEX IF NOT EXISTS idx_placement_core ON placement(core_card_id);
CREATE INDEX IF NOT EXISTS idx_placement_deferred ON placement(deferred_at);
CREATE INDEX IF NOT EXISTS idx_page_binder ON page(binder_id);

-- Small key/value store for runtime-adjustable app settings (JSON values).
-- Read through services.app_settings, which layers defaults from config.py.
CREATE TABLE IF NOT EXISTS app_setting (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
