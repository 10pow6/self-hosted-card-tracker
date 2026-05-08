"""Placement management — get / reassign / promote-to-new / unassign / refine.

Refining a placement re-warps the source page photo through a new polygon, saves
the new crop, re-embeds it, and recomputes similarity vs. the (currently linked
or top) candidate. The placement's `core_card_id` and `review_status` are NOT
changed by refine — that's a separate user decision.
"""
from __future__ import annotations

import json
import sqlite3
import uuid
from contextlib import closing
from typing import Optional

import cv2
import numpy as np
from PIL import Image

from card_tracker import layouts
from card_tracker.config import settings
from card_tracker.cv.grid import _warp_card
from card_tracker.db.engine import connect, transaction
from card_tracker.embeddings.dinov2 import get_embedder
from card_tracker.services import cards as cards_svc
from card_tracker.services import match
from card_tracker.services.paths import from_relative, to_relative, to_url


class PlacementError(Exception):
    """Recoverable error during placement management."""


# ---------------------------------------------------------------------------
# Reads


def list_placements() -> list[dict]:
    """Flat list of every non-empty placement across every binder.

    Used by the Collection > All cards tab. Each row carries enough context for
    the UI to render a thumb + binder/page/slot label + linked-card metadata
    (or "Unmatched" when the placement is still pending) and link straight to
    `/placements/{id}/refine`. Ordered newest-first.

    Returns a list — pagination + filtering are client-side, matching the
    existing `/api/cards` shape. Acceptable into the tens of thousands.
    """
    sql = """
    SELECT pl.id, pl.page_id, pl.slot_index, pl.crop_image_path,
           pl.core_card_id, pl.review_status, pl.similarity_score, pl.created_at,
           p.page_number, p.binder_id,
           b.name AS binder_name,
           cc.name AS core_card_name,
           cc.set_name AS core_card_set,
           cc.card_number AS core_card_number
    FROM placement pl
    JOIN page p   ON pl.page_id = p.id
    JOIN binder b ON p.binder_id = b.id
    LEFT JOIN core_card cc ON pl.core_card_id = cc.id
    WHERE pl.review_status != 'empty'
    ORDER BY pl.created_at DESC
    """
    with closing(connect()) as conn:
        rows = conn.execute(sql).fetchall()
        return [
            {
                "id": r["id"],
                "page_id": r["page_id"],
                "binder_id": r["binder_id"],
                "binder_name": r["binder_name"],
                "page_number": r["page_number"],
                "slot_index": r["slot_index"],
                "crop_url": to_url(r["crop_image_path"]),
                "core_card_id": r["core_card_id"],
                "core_card_name": r["core_card_name"],
                "core_card_set": r["core_card_set"],
                "core_card_number": r["core_card_number"],
                "review_status": r["review_status"],
                "similarity_score": r["similarity_score"],
                "created_at": r["created_at"],
            }
            for r in rows
        ]


def _live_similarity_vs_other_photos(
    conn: sqlite3.Connection,
    embedding: np.ndarray,
    *,
    core_card_id: str,
    placement_id: str,
    embedder_name: str,
    embedder_version: str,
) -> Optional[float]:
    """Max cosine between `embedding` and every OTHER confirmed photo of
    `core_card_id` (excludes the placement itself).

    Returns None when the linked card has no other photos — that's an honest
    "this placement IS the only evidence" signal, not a 100% pseudo-match.
    """
    rows = conn.execute(
        "SELECT embedding FROM placement "
        "WHERE core_card_id = ? AND id != ? AND embedding IS NOT NULL "
        "AND embedder_name = ? AND embedder_version = ?",
        (core_card_id, placement_id, embedder_name, embedder_version),
    ).fetchall()
    if not rows:
        return None
    matrix = np.stack([np.frombuffer(r["embedding"], dtype=np.float32) for r in rows])
    sims = matrix @ embedding.astype(np.float32)
    return float(sims.max())


def _placement_dict(row: sqlite3.Row) -> dict:
    """Shape consistent with the page/cards endpoints' Placement DTO."""
    polygon = None
    if row["polygon"]:
        try:
            polygon = json.loads(row["polygon"])
        except json.JSONDecodeError:
            polygon = None
    return {
        "id": row["id"],
        "page_id": row["page_id"],
        "binder_id": row["bndr_id"],
        "binder_name": row["bndr_name"],
        "page_number": row["pg_num"],
        "slot_index": row["slot_index"],
        "polygon": polygon,
        "crop_url": to_url(row["crop_image_path"]),
        "core_card_id": row["core_card_id"],
        "review_status": row["review_status"],
        "similarity_score": row["similarity_score"],
    }


def get_placement(placement_id: str) -> Optional[dict]:
    """Fetch a placement with full context (page image, dimensions, current
    match if any, top-N candidates against current embedding).
    """
    sql = """
    SELECT pl.*,
           p.id              AS pg_id,
           p.page_number     AS pg_num,
           p.binder_id       AS bndr_id,
           p.source_image_path AS pg_src,
           b.name            AS bndr_name,
           b.layout          AS bndr_layout
    FROM placement pl
    JOIN page p   ON pl.page_id = p.id
    JOIN binder b ON p.binder_id = b.id
    WHERE pl.id = ?
    """
    with closing(connect()) as conn:
        row = conn.execute(sql, (placement_id,)).fetchone()
        if row is None:
            return None
        out = _placement_dict(row)
        layout = layouts.parse(row["bndr_layout"])
        # Image dimensions: read from the source image on disk so the FE can
        # set up SVG coordinates correctly. Cheap (~ms).
        page_src = row["pg_src"]
        image_size: list[int] = [0, 0]
        if page_src:
            try:
                with Image.open(from_relative(page_src)) as im:
                    image_size = [int(im.width), int(im.height)]
            except (FileNotFoundError, OSError):
                pass
        out["page"] = {
            "id": row["pg_id"],
            "binder_id": row["bndr_id"],
            "binder_name": row["bndr_name"],
            "page_number": row["pg_num"],
            "source_image_url": to_url(page_src),
            "image_size": image_size,
            "layout": layout.canonical(),
            "rows": layout.rows,
            "cols": layout.cols,
        }
        # Currently linked card (if any) for the FE to display in the sidebar.
        out["core_card"] = (
            cards_svc.get_card(row["core_card_id"]) if row["core_card_id"] else None
        )
        # Top-N candidates against the current embedding — useful both for the
        # refine sidebar and for re-classifying after a refine save.
        if row["embedding"] is not None and row["embedder_name"] and row["embedder_version"]:
            embedding = np.frombuffer(row["embedding"], dtype=np.float32)
            cands = match.find_candidates(
                conn, embedding, top_k=3,
                embedder_name=row["embedder_name"],
                embedder_version=row["embedder_version"],
            )
            payload = []
            for c in cands:
                core = cards_svc.get_card(c.core_card_id)
                if core is None:
                    continue
                payload.append({"core_card": core, "similarity": c.similarity})
            out["candidates"] = payload
            # Live "evidence" similarity for the displayed match: max cosine vs.
            # OTHER photos of the linked card. None when this placement is the
            # only photo (the stored value would be either stale or self-vs-self).
            if row["core_card_id"]:
                out["similarity_score"] = _live_similarity_vs_other_photos(
                    conn, embedding,
                    core_card_id=row["core_card_id"],
                    placement_id=row["id"],
                    embedder_name=row["embedder_name"],
                    embedder_version=row["embedder_version"],
                )
        else:
            out["candidates"] = []
        return out


# ---------------------------------------------------------------------------
# Reassignment


_PRUNABLE_METADATA_FIELDS = ("name", "set_name", "card_number", "year", "card_type", "notes")


def _maybe_prune_orphan_core(conn: sqlite3.Connection, old_core_id: str, new_core_id: str) -> None:
    """If `old_core_id` has zero remaining placements, migrate any metadata
    fields the target is missing, then delete the orphan.

    Migration rule: copy field old → target only when target's is NULL and old's
    is non-NULL. Never overwrite a value the user already entered on target —
    that would silently stomp correct data with stale data from an
    accidentally-reassigned placement.

    Crop files on disk are not touched. The orphan's `representative_crop_path`
    likely pointed at the placement that just moved away, but the placement
    still owns its `crop_image_path` and the file remains valid.
    """
    if old_core_id == new_core_id:
        return
    remaining = conn.execute(
        "SELECT COUNT(*) AS n FROM placement WHERE core_card_id = ?",
        (old_core_id,),
    ).fetchone()["n"]
    if remaining > 0:
        return
    old = conn.execute("SELECT * FROM core_card WHERE id = ?", (old_core_id,)).fetchone()
    target = conn.execute("SELECT * FROM core_card WHERE id = ?", (new_core_id,)).fetchone()
    if old is None or target is None:
        return
    updates: list[str] = []
    params: list[object] = []
    for f in _PRUNABLE_METADATA_FIELDS:
        if target[f] is None and old[f] is not None:
            updates.append(f"{f} = ?")
            params.append(old[f])
    if updates:
        updates.append("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')")
        params.append(new_core_id)
        conn.execute(
            f"UPDATE core_card SET {', '.join(updates)} WHERE id = ?",
            params,
        )
    conn.execute("DELETE FROM core_card WHERE id = ?", (old_core_id,))


def assign_to_core(placement_id: str, core_card_id: str) -> None:
    """Link a placement to a (possibly different) CORE card. Sets status to
    'user_confirmed' regardless of previous state. Useful for fixing a bad
    auto-match or moving a placement after a merge mistake.

    Auto-prune: if the placement was the last one on its previous CORE row,
    that row is deleted after migrating any metadata fields the target is
    missing. See `_maybe_prune_orphan_core`.
    """
    with transaction() as conn:
        if conn.execute(
            "SELECT 1 FROM core_card WHERE id = ?", (core_card_id,)
        ).fetchone() is None:
            raise PlacementError(f"Unknown core_card: {core_card_id}")
        # Recompute similarity_score against the new target's photos so the
        # stored value reflects current evidence. Also fetch the OLD core_card_id
        # so we know whether to consider an orphan-prune after the reassignment.
        row = conn.execute(
            "SELECT embedding, embedder_name, embedder_version, core_card_id "
            "FROM placement WHERE id = ?",
            (placement_id,),
        ).fetchone()
        if row is None:
            raise PlacementError(f"Unknown placement: {placement_id}")
        old_core_id: Optional[str] = row["core_card_id"]
        new_sim: Optional[float] = None
        if row["embedding"] is not None:
            embedding = np.frombuffer(row["embedding"], dtype=np.float32)
            new_sim = _live_similarity_vs_other_photos(
                conn, embedding,
                core_card_id=core_card_id,
                placement_id=placement_id,
                embedder_name=row["embedder_name"],
                embedder_version=row["embedder_version"],
            )
        conn.execute(
            "UPDATE placement SET core_card_id = ?, review_status = 'user_confirmed', "
            "similarity_score = COALESCE(?, similarity_score), "
            "resolved_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), "
            "deferred_at = NULL WHERE id = ?",
            (core_card_id, new_sim, placement_id),
        )
        if old_core_id is not None:
            _maybe_prune_orphan_core(conn, old_core_id, core_card_id)


def promote_to_new_card(placement_id: str) -> str:
    """Create a new CORE row from this placement (using its current embedding
    and crop) and link the placement to it. Returns the new core_card id.
    """
    with transaction() as conn:
        row = conn.execute(
            "SELECT * FROM placement WHERE id = ?", (placement_id,)
        ).fetchone()
        if row is None:
            raise PlacementError(f"Unknown placement: {placement_id}")
        if row["embedding"] is None or row["crop_image_path"] is None:
            raise PlacementError(
                f"Cannot promote empty placement: {placement_id}. Refine the polygon first."
            )
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
            "similarity_score = 1.0, "
            "resolved_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), "
            "deferred_at = NULL WHERE id = ?",
            (core_id, placement_id),
        )
        return core_id


def unassign(placement_id: str) -> None:
    """Send a placement back to the review queue. Clears core_card_id and
    sets review_status to 'pending'.
    """
    with transaction() as conn:
        cur = conn.execute(
            "UPDATE placement SET core_card_id = NULL, review_status = 'pending', "
            "resolved_at = NULL, deferred_at = NULL, similarity_score = NULL "
            "WHERE id = ? AND review_status != 'empty'",
            (placement_id,),
        )
        if cur.rowcount == 0:
            raise PlacementError(
                f"Cannot unassign placement {placement_id} (unknown or empty slot)."
            )


# ---------------------------------------------------------------------------
# Refine polygon (re-warp + re-embed)


def refine_polygon(placement_id: str, polygon: list[list[float]]) -> dict:
    """Replace the polygon for a placement, re-warp the crop, re-embed.

    `core_card_id` and `review_status` are intentionally NOT changed — the user
    can re-classify separately based on the freshly-computed top-N. We only
    update `similarity_score` against the currently-linked card if any (so the
    stored sim doesn't go stale).

    Returns the updated placement dict (same shape as `get_placement`).
    """
    if not polygon or len(polygon) != 4:
        raise PlacementError("Polygon must have exactly 4 points.")
    quad = np.array(polygon, dtype=np.float32)

    # Locate the source image so we can re-warp.
    with closing(connect()) as conn:
        row = conn.execute(
            "SELECT pl.id, pl.page_id, pl.crop_image_path, pl.embedder_name, "
            "       pl.embedder_version, pl.core_card_id, "
            "       p.source_image_path "
            "FROM placement pl JOIN page p ON pl.page_id = p.id "
            "WHERE pl.id = ?",
            (placement_id,),
        ).fetchone()
    if row is None:
        raise PlacementError(f"Unknown placement: {placement_id}")
    src_relative = row["source_image_path"]
    if not src_relative:
        raise PlacementError("Placement's page has no source image.")
    src_path = from_relative(src_relative)
    img = cv2.imread(str(src_path))
    if img is None:
        raise PlacementError(f"Could not read source image: {src_path}")

    # Warp + write crop. Reuse the existing crop path so URLs don't change.
    crop_relative = row["crop_image_path"]
    if crop_relative:
        crop_path = from_relative(crop_relative)
    else:
        # Empty slot being given a crop for the first time — synthesize a path.
        page_id_short = row["page_id"].replace("page-", "") or "page"
        new_dir = settings.crops_dir / page_id_short
        new_dir.mkdir(parents=True, exist_ok=True)
        crop_path = new_dir / f"{placement_id}.jpg"
        crop_relative = to_relative(crop_path)
    crop_bgr = _warp_card(img, quad)
    crop_path.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(crop_path), crop_bgr)

    # Re-embed.
    crop_rgb = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2RGB)
    embedder = get_embedder()
    embedding = embedder.embed(crop_rgb)
    embedding_blob = embedding.astype(np.float32).tobytes()
    polygon_json = json.dumps([[float(p[0]), float(p[1])] for p in polygon])

    # If the placement is linked to a core_card, stamp a live "evidence
    # similarity" — max cosine vs. OTHER photos of that card. None when the
    # placement is the only photo (stored as NULL → UI hides the number).
    new_sim: Optional[float] = None
    if row["core_card_id"]:
        with closing(connect()) as conn:
            new_sim = _live_similarity_vs_other_photos(
                conn, embedding,
                core_card_id=row["core_card_id"],
                placement_id=placement_id,
                embedder_name=row["embedder_name"] or embedder.name,
                embedder_version=row["embedder_version"] or embedder.version,
            )

    with transaction() as conn:
        conn.execute(
            "UPDATE placement SET "
            "  polygon = ?, "
            "  crop_image_path = ?, "
            "  embedding = ?, "
            "  embedder_name = ?, "
            "  embedder_version = ?, "
            "  similarity_score = COALESCE(?, similarity_score) "
            "WHERE id = ?",
            (
                polygon_json,
                crop_relative,
                embedding_blob,
                embedder.name,
                embedder.version,
                new_sim,
                placement_id,
            ),
        )

    refreshed = get_placement(placement_id)
    if refreshed is None:
        raise PlacementError(f"Placement vanished after refine: {placement_id}")
    return refreshed
