"""CORE card list/get + per-card placements query."""
from __future__ import annotations

import sqlite3
from contextlib import closing
from typing import Optional

from card_tracker.db.engine import connect
from card_tracker.services.paths import to_url


def _card_dict(conn: sqlite3.Connection, row: sqlite3.Row) -> dict:
    placement_count = conn.execute(
        "SELECT COUNT(*) AS n FROM placement WHERE core_card_id = ?",
        (row["id"],),
    ).fetchone()["n"]
    name = row["name"]
    return {
        "id": row["id"],
        "name": name,
        "set": row["set_name"],
        "number": row["card_number"],
        "year": row["year"],
        "type": row["card_type"] or "other",
        "notes": row["notes"],
        "representative_crop_url": to_url(row["representative_crop_path"]) or "",
        "embedder_name": row["embedder_name"],
        "embedder_version": row["embedder_version"],
        "placement_count": int(placement_count),
        "needs_metadata": not (name and name.strip()),
        "created_at": row["created_at"],
    }


def list_cards(
    *,
    type_: Optional[str] = None,
    needs_metadata: bool = False,
    q: Optional[str] = None,
) -> list[dict]:
    """List CORE cards with optional filters. Returns the full filtered list —
    pagination is client-side at the frontend (works fine into the tens of thousands).
    """
    where: list[str] = []
    params: list = []
    if type_ and type_ != "all":
        where.append("(card_type = ? OR (card_type IS NULL AND ? = 'other'))")
        params.extend([type_, type_])
    if needs_metadata:
        where.append("(name IS NULL OR TRIM(name) = '')")
    if q:
        where.append(
            "(LOWER(COALESCE(name,'')) LIKE ? "
            "OR LOWER(COALESCE(set_name,'')) LIKE ? "
            "OR LOWER(COALESCE(card_number,'')) LIKE ?)"
        )
        like = f"%{q.lower()}%"
        params.extend([like, like, like])
    sql = "SELECT * FROM core_card"
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY datetime(created_at) DESC"
    with closing(connect()) as conn:
        rows = conn.execute(sql, params).fetchall()
        return [_card_dict(conn, r) for r in rows]


def get_card(card_id: str) -> Optional[dict]:
    with closing(connect()) as conn:
        row = conn.execute("SELECT * FROM core_card WHERE id = ?", (card_id,)).fetchone()
        return _card_dict(conn, row) if row else None


def list_placements_for_card(card_id: str) -> list[dict]:
    sql = """
    SELECT pl.*, p.page_number AS pg_num, p.binder_id AS bndr_id, b.name AS bndr_name
    FROM placement pl
    JOIN page p   ON pl.page_id = p.id
    JOIN binder b ON p.binder_id = b.id
    WHERE pl.core_card_id = ?
    ORDER BY b.name, p.page_number, pl.slot_index
    """
    with closing(connect()) as conn:
        rows = conn.execute(sql, (card_id,)).fetchall()
        return [
            {
                "id": r["id"],
                "page_id": r["page_id"],
                "binder_id": r["bndr_id"],
                "binder_name": r["bndr_name"],
                "page_number": r["pg_num"],
                "slot_index": r["slot_index"],
                "crop_url": to_url(r["crop_image_path"]),
                "core_card_id": r["core_card_id"],
                "review_status": r["review_status"],
            }
            for r in rows
        ]
