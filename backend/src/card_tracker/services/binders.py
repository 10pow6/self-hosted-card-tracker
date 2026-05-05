"""Binder CRUD service. Pure SQLite, no DTO classes — returns plain dicts shaped
for direct JSON encoding by the API layer.
"""
from __future__ import annotations

import sqlite3
import uuid
from typing import Optional

from card_tracker import layouts
from card_tracker.config import settings
from card_tracker.db.engine import connect, transaction
from card_tracker.services.paths import to_url


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
    # Cover thumbnails: enough to fill one page in this binder's layout.
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


def create_binder(name: str, layout: Optional[str] = None) -> dict:
    raw_layout = layout or settings.binder_layout
    parsed = layouts.parse(raw_layout)  # raises InvalidLayout → 422 in the API layer
    binder_id = f"binder-{uuid.uuid4().hex[:12]}"
    with transaction() as conn:
        conn.execute(
            "INSERT INTO binder (id, name, layout) VALUES (?, ?, ?)",
            (binder_id, name, parsed.canonical()),
        )
        row = conn.execute("SELECT * FROM binder WHERE id = ?", (binder_id,)).fetchone()
        return _binder_dict(conn, row)
