"""Binder CRUD service. Pure SQLite, no DTO classes — returns plain dicts shaped
for direct JSON encoding by the API layer.
"""
from __future__ import annotations

import json
import sqlite3
import uuid
from typing import Optional

from card_tracker import detectors, layouts
from card_tracker.config import settings
from card_tracker.db.engine import connect, transaction
from card_tracker.services.paths import to_url


def _detector_config_from_row(row: sqlite3.Row) -> Optional[dict]:
    raw = row["detector_config"]
    if not raw:
        return None
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return None
    if not isinstance(parsed, dict):
        return None
    spec = detectors.get_spec(row["detector"])
    keys = spec.field_keys()
    return {k: v for k, v in parsed.items() if k in keys}


def _binder_dict(conn: sqlite3.Connection, row: sqlite3.Row) -> dict:
    layout = layouts.parse(row["layout"])
    counts = conn.execute(
        "SELECT COUNT(*) AS n FROM page WHERE binder_id = ?",
        (row["id"],),
    ).fetchone()
    card_count = conn.execute(
        "SELECT COUNT(*) AS n FROM placement pl "
        "JOIN page p ON pl.page_id = p.id "
        "WHERE p.binder_id = ? AND pl.review_status != 'empty'",
        (row["id"],),
    ).fetchone()
    cover = conn.execute(
        "SELECT pl.crop_image_path FROM placement pl "
        "JOIN page p ON pl.page_id = p.id "
        "WHERE p.binder_id = ? AND pl.crop_image_path IS NOT NULL "
        "ORDER BY p.page_number ASC, pl.slot_index ASC LIMIT ?",
        (row["id"], layout.total),
    ).fetchall()
    return {
        "id": row["id"],
        "name": row["name"],
        "layout": layout.canonical(),
        "detector": row["detector"] or detectors.DEFAULT_DETECTOR,
        "detector_config": _detector_config_from_row(row),
        "page_count": int(counts["n"]),
        "card_count": int(card_count["n"]),
        "cover_thumbs": [to_url(r["crop_image_path"]) for r in cover],
        "created_at": row["created_at"],
    }


def list_binders() -> list[dict]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT * FROM binder ORDER BY created_at DESC"
        ).fetchall()
        return [_binder_dict(conn, r) for r in rows]


def get_binder(binder_id: str) -> Optional[dict]:
    with connect() as conn:
        row = conn.execute("SELECT * FROM binder WHERE id = ?", (binder_id,)).fetchone()
        return _binder_dict(conn, row) if row else None


def resolve_detector(binder_id: str) -> tuple[str, dict[str, float]]:
    """Return `(detector_id, merged_config_dict)` for a binder, falling back to
    the detector's defaults for any unset key. Used by `services.scans`.
    """
    binder = get_binder(binder_id)
    if binder is None:
        return detectors.DEFAULT_DETECTOR, detectors.merged_config(detectors.DEFAULT_DETECTOR, None)
    detector_id = binder["detector"]
    return detector_id, detectors.merged_config(detector_id, binder.get("detector_config"))


def create_binder(
    name: str,
    layout: Optional[str] = None,
    detector: Optional[str] = None,
    detector_config: Optional[dict] = None,
) -> dict:
    raw_layout = layout or settings.binder_layout
    parsed = layouts.parse(raw_layout)  # raises InvalidLayout → 422 in the API layer
    detector_id = detector or detectors.DEFAULT_DETECTOR
    if detector_id not in detectors.REGISTRY:
        raise ValueError(f"Unknown detector: {detector_id}")
    cleaned_config = detectors.validate_config(detector_id, detector_config)
    binder_id = f"binder-{uuid.uuid4().hex[:12]}"
    with transaction() as conn:
        conn.execute(
            "INSERT INTO binder (id, name, layout, detector, detector_config) "
            "VALUES (?, ?, ?, ?, ?)",
            (
                binder_id,
                name,
                parsed.canonical(),
                detector_id,
                json.dumps(cleaned_config) if cleaned_config else None,
            ),
        )
        row = conn.execute("SELECT * FROM binder WHERE id = ?", (binder_id,)).fetchone()
        return _binder_dict(conn, row)
