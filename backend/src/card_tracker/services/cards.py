"""CORE card list/get + per-card placements query."""
from __future__ import annotations

import sqlite3
from contextlib import closing
from typing import Optional

from card_tracker.db.engine import connect, transaction
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


class CardMergeError(ValueError):
    """Recoverable error during card merge (unknown id, self-merge, etc.)."""


def merge_cards(source_id: str, target_id: str) -> dict:
    """Merge `source_id` into `target_id`.

    All placements that pointed at `source_id` get repointed to `target_id`,
    then the source CORE row is deleted. Crops on disk are NOT touched —
    placements still own their own crop files and continue to reference them.

    Raises `CardMergeError` for invalid input (unknown id, self-merge).
    Returns the updated target card dict + count of repointed placements.
    """
    if source_id == target_id:
        raise CardMergeError("Cannot merge a card into itself.")
    with transaction() as conn:
        rows = {
            r["id"]
            for r in conn.execute(
                "SELECT id FROM core_card WHERE id IN (?, ?)",
                (source_id, target_id),
            ).fetchall()
        }
        if source_id not in rows:
            raise CardMergeError(f"Source card not found: {source_id}")
        if target_id not in rows:
            raise CardMergeError(f"Target card not found: {target_id}")
        moved = conn.execute(
            "UPDATE placement SET core_card_id = ? WHERE core_card_id = ?",
            (target_id, source_id),
        ).rowcount
        conn.execute("DELETE FROM core_card WHERE id = ?", (source_id,))
    target = get_card(target_id)
    if target is None:
        # Shouldn't happen — we just verified target existed inside the txn.
        raise CardMergeError(f"Target card vanished after merge: {target_id}")
    return {"target": target, "moved_placements": int(moved)}


def set_representative(card_id: str, placement_id: str) -> dict:
    """Promote one of a card's placement crops to be the card's representative
    (source) image. Validates the placement actually belongs to this card and
    has a crop on disk.

    Returns the updated card dict.
    """
    with transaction() as conn:
        row = conn.execute(
            "SELECT pl.crop_image_path, pl.core_card_id "
            "FROM placement pl WHERE pl.id = ?",
            (placement_id,),
        ).fetchone()
        if row is None:
            raise CardMergeError(f"Unknown placement: {placement_id}")
        if row["core_card_id"] != card_id:
            raise CardMergeError(
                f"Placement {placement_id} is not linked to card {card_id}."
            )
        if not row["crop_image_path"]:
            raise CardMergeError(
                f"Placement {placement_id} has no crop image (empty slot)."
            )
        cur = conn.execute(
            "UPDATE core_card SET representative_crop_path = ?, "
            "updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
            (row["crop_image_path"], card_id),
        )
        if cur.rowcount == 0:
            raise CardMergeError(f"Unknown card: {card_id}")
    card = get_card(card_id)
    if card is None:
        raise CardMergeError(f"Card vanished after representative update: {card_id}")
    return card


def delete_card(card_id: str) -> None:
    """Delete a CORE row that has zero placements. Refuses if any placement
    still points at it — use `/cards/merge` for that case so the placements
    move somewhere instead of becoming dangling references.

    Raises:
        CardMergeError: card unknown, or has remaining placements.
    """
    with transaction() as conn:
        row = conn.execute(
            "SELECT 1 FROM core_card WHERE id = ?", (card_id,)
        ).fetchone()
        if row is None:
            raise CardMergeError(f"Unknown card: {card_id}")
        n = conn.execute(
            "SELECT COUNT(*) AS n FROM placement WHERE core_card_id = ?",
            (card_id,),
        ).fetchone()["n"]
        if n > 0:
            raise CardMergeError(
                f"Cannot delete card {card_id}: still has {n} placement(s). "
                "Use merge to consolidate, or move the placements first."
            )
        conn.execute("DELETE FROM core_card WHERE id = ?", (card_id,))


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
