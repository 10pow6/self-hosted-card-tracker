"""Work-queue service. Lists pending+deferred placements and resolves them."""
from __future__ import annotations

from contextlib import closing

import numpy as np

from card_tracker.db.engine import connect, transaction
from card_tracker.services import cards as cards_svc
from card_tracker.services import match
from card_tracker.services.paths import to_url


def list_queue() -> list[dict]:
    """Return both active (review_status='pending', deferred_at NULL) and deferred items.

    Top-3 candidates are recomputed on the fly per placement so the queue stays
    consistent if the CORE table grows or shrinks between visits.
    """
    sql = """
    SELECT pl.*, p.page_number AS pg_num, p.binder_id AS bndr_id, b.name AS bndr_name
    FROM placement pl
    JOIN page p   ON pl.page_id = p.id
    JOIN binder b ON p.binder_id = b.id
    WHERE pl.review_status = 'pending'
    ORDER BY (pl.deferred_at IS NOT NULL), pl.created_at ASC
    """
    with closing(connect()) as conn:
        rows = conn.execute(sql).fetchall()
        out: list[dict] = []
        for r in rows:
            embedding_blob = r["embedding"]
            if embedding_blob is None:
                continue
            embedding = np.frombuffer(embedding_blob, dtype=np.float32)
            candidates = match.find_candidates(
                conn, embedding, top_k=3,
                embedder_name=r["embedder_name"],
                embedder_version=r["embedder_version"],
            )
            candidate_payload = []
            for c in candidates:
                core = cards_svc.get_card(c.core_card_id)
                if core is None:
                    continue
                candidate_payload.append({"core_card": core, "similarity": c.similarity})
            placement = {
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
            out.append({
                "placement": placement,
                "candidates": candidate_payload,
                "deferred_at": r["deferred_at"],
            })
        return out


def confirm_match(placement_id: str, core_card_id: str) -> None:
    """User says: this placement IS that CORE card. Marks it user_confirmed."""
    with transaction() as conn:
        if conn.execute("SELECT 1 FROM core_card WHERE id = ?", (core_card_id,)).fetchone() is None:
            raise ValueError(f"Unknown core_card: {core_card_id}")
        cur = conn.execute(
            "UPDATE placement SET core_card_id = ?, review_status = 'user_confirmed', "
            "resolved_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), deferred_at = NULL WHERE id = ?",
            (core_card_id, placement_id),
        )
        if cur.rowcount == 0:
            raise ValueError(f"Unknown placement: {placement_id}")


def confirm_new(placement_id: str) -> str:
    """User says: none of the candidates match. Promote this placement's embedding
    to a brand-new CORE row and link the placement to it.
    """
    import uuid

    with transaction() as conn:
        row = conn.execute(
            "SELECT * FROM placement WHERE id = ?", (placement_id,)
        ).fetchone()
        if row is None:
            raise ValueError(f"Unknown placement: {placement_id}")
        if row["embedding"] is None or row["crop_image_path"] is None:
            raise ValueError(f"Cannot promote empty placement: {placement_id}")
        core_id = f"core-{uuid.uuid4().hex[:12]}"
        conn.execute(
            "INSERT INTO core_card "
            "  (id, embedder_name, embedder_version, embedding, representative_crop_path) "
            "VALUES (?, ?, ?, ?, ?)",
            (
                core_id,
                row["embedder_name"],
                row["embedder_version"],
                row["embedding"],
                row["crop_image_path"],
            ),
        )
        conn.execute(
            "UPDATE placement SET core_card_id = ?, review_status = 'new_card', "
            "resolved_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), deferred_at = NULL WHERE id = ?",
            (core_id, placement_id),
        )
        return core_id


def defer(placement_id: str) -> None:
    with transaction() as conn:
        cur = conn.execute(
            "UPDATE placement SET deferred_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') "
            "WHERE id = ? AND review_status = 'pending'",
            (placement_id,),
        )
        if cur.rowcount == 0:
            raise ValueError(f"Cannot defer placement {placement_id} (unknown or not pending)")


def undefer(placement_id: str) -> None:
    with transaction() as conn:
        cur = conn.execute(
            "UPDATE placement SET deferred_at = NULL WHERE id = ?",
            (placement_id,),
        )
        if cur.rowcount == 0:
            raise ValueError(f"Unknown placement: {placement_id}")
