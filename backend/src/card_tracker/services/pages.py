"""Page query — given binder + page_number, return placements joined to context."""
from __future__ import annotations

from contextlib import closing
from typing import Optional

from card_tracker import layouts
from card_tracker.db.engine import connect
from card_tracker.services.paths import to_url


def get_page(binder_id: str, page_number: int) -> Optional[dict]:
    with closing(connect()) as conn:
        page = conn.execute(
            "SELECT p.*, b.name AS binder_name, b.layout AS binder_layout FROM page p "
            "JOIN binder b ON p.binder_id = b.id "
            "WHERE p.binder_id = ? AND p.page_number = ?",
            (binder_id, page_number),
        ).fetchone()
        if page is None:
            return None
        layout = layouts.parse(page["binder_layout"])
        placement_rows = conn.execute(
            "SELECT * FROM placement WHERE page_id = ? ORDER BY slot_index",
            (page["id"],),
        ).fetchall()
        # Pad missing slots with synthetic empty entries so the UI always renders the
        # binder's full grid (some scans skip slots if the user marked them empty
        # before commit).
        by_index = {r["slot_index"]: r for r in placement_rows}
        placements: list[dict] = []
        for slot in range(layout.total):
            r = by_index.get(slot)
            if r is None:
                placements.append({
                    "id": f"{page['id']}-empty-{slot}",
                    "page_id": page["id"],
                    "binder_id": page["binder_id"],
                    "binder_name": page["binder_name"],
                    "page_number": page["page_number"],
                    "slot_index": slot,
                    "crop_url": None,
                    "core_card_id": None,
                    "review_status": "empty",
                })
                continue
            placements.append({
                "id": r["id"],
                "page_id": r["page_id"],
                "binder_id": page["binder_id"],
                "binder_name": page["binder_name"],
                "page_number": page["page_number"],
                "slot_index": r["slot_index"],
                "crop_url": to_url(r["crop_image_path"]),
                "core_card_id": r["core_card_id"],
                "review_status": r["review_status"],
            })
        return {
            "id": page["id"],
            "binder_id": page["binder_id"],
            "page_number": page["page_number"],
            "source_image_url": to_url(page["source_image_path"]),
            "placements": placements,
        }


def list_pages_for_binder(binder_id: str) -> list[dict]:
    """Lightweight list (id, page_number, captured_at) for a binder's page index."""
    with closing(connect()) as conn:
        rows = conn.execute(
            "SELECT id, page_number, captured_at FROM page "
            "WHERE binder_id = ? ORDER BY page_number ASC",
            (binder_id,),
        ).fetchall()
        return [dict(r) for r in rows]
