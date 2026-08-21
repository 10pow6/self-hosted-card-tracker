"""Page queries — placements joined to page/binder context and linked-card names."""
from __future__ import annotations

import sqlite3
from contextlib import closing
from typing import Optional

from card_tracker import layouts
from card_tracker.db.engine import connect
from card_tracker.services.paths import to_url

_PLACEMENT_SQL = """
SELECT pl.id, pl.page_id, pl.slot_index, pl.crop_image_path, pl.core_card_id,
       pl.review_status,
       cc.name        AS core_card_name,
       cc.set_name    AS core_card_set,
       cc.card_number AS core_card_number
FROM placement pl
LEFT JOIN core_card cc ON pl.core_card_id = cc.id
"""


def _placement_rows_to_grid(
    page: sqlite3.Row, placement_rows: list[sqlite3.Row], total_slots: int
) -> list[dict]:
    """Pad missing slots with synthetic empty entries so the UI always renders
    the binder's full grid (some scans skip slots if the user marked them empty
    before commit)."""
    by_index = {r["slot_index"]: r for r in placement_rows}
    placements: list[dict] = []
    for slot in range(total_slots):
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
                "core_card_name": None,
                "core_card_set": None,
                "core_card_number": None,
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
            "core_card_name": r["core_card_name"],
            "core_card_set": r["core_card_set"],
            "core_card_number": r["core_card_number"],
            "review_status": r["review_status"],
        })
    return placements


def _page_dict(page: sqlite3.Row, placements: list[dict]) -> dict:
    return {
        "id": page["id"],
        "binder_id": page["binder_id"],
        "page_number": page["page_number"],
        "source_image_url": to_url(page["source_image_path"]),
        "placements": placements,
    }


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
            _PLACEMENT_SQL + "WHERE pl.page_id = ? ORDER BY pl.slot_index",
            (page["id"],),
        ).fetchall()
        return _page_dict(
            page, _placement_rows_to_grid(page, placement_rows, layout.total)
        )


def list_pages_full(binder_id: str) -> list[dict]:
    """Every page of a binder with its full placement grid — two queries total,
    so the binder view doesn't need one request per page."""
    with closing(connect()) as conn:
        pages = conn.execute(
            "SELECT p.*, b.name AS binder_name, b.layout AS binder_layout FROM page p "
            "JOIN binder b ON p.binder_id = b.id "
            "WHERE p.binder_id = ? ORDER BY p.page_number ASC",
            (binder_id,),
        ).fetchall()
        if not pages:
            return []
        layout = layouts.parse(pages[0]["binder_layout"])
        placement_rows = conn.execute(
            _PLACEMENT_SQL
            + "JOIN page p ON pl.page_id = p.id "
            + "WHERE p.binder_id = ? ORDER BY pl.slot_index",
            (binder_id,),
        ).fetchall()
        by_page: dict[str, list[sqlite3.Row]] = {}
        for r in placement_rows:
            by_page.setdefault(r["page_id"], []).append(r)
        return [
            _page_dict(
                page,
                _placement_rows_to_grid(page, by_page.get(page["id"], []), layout.total),
            )
            for page in pages
        ]
