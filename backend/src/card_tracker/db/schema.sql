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
    created_at               TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at               TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS binder (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    layout     TEXT NOT NULL DEFAULT '3x3',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS page (
    id                TEXT PRIMARY KEY,
    binder_id         TEXT NOT NULL REFERENCES binder(id) ON DELETE CASCADE,
    page_number       INTEGER NOT NULL,
    source_image_path TEXT NOT NULL,
    captured_at       TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (binder_id, page_number)
);

CREATE TABLE IF NOT EXISTS placement (
    id                TEXT PRIMARY KEY,
    page_id           TEXT NOT NULL REFERENCES page(id) ON DELETE CASCADE,
    slot_index        INTEGER NOT NULL,
    crop_image_path   TEXT NOT NULL,
    embedding         BLOB NOT NULL,
    embedder_name     TEXT NOT NULL,
    embedder_version  TEXT NOT NULL,
    core_card_id      TEXT REFERENCES core_card(id),
    similarity_score  REAL,
    review_status     TEXT NOT NULL DEFAULT 'pending',
    created_at        TEXT NOT NULL DEFAULT (datetime('now')),
    resolved_at       TEXT,
    UNIQUE (page_id, slot_index)
);

CREATE INDEX IF NOT EXISTS idx_placement_review ON placement(review_status);
CREATE INDEX IF NOT EXISTS idx_placement_core ON placement(core_card_id);
