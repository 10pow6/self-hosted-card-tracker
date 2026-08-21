"""Dashboard aggregates: counts + a unified recent-activity stream."""
from __future__ import annotations

from contextlib import closing


def get_stats() -> dict:
    with closing(_conn()) as conn:
        binders = conn.execute("SELECT COUNT(*) AS n FROM binder").fetchone()["n"]
        pages = conn.execute("SELECT COUNT(*) AS n FROM page").fetchone()["n"]
        cards = conn.execute("SELECT COUNT(*) AS n FROM core_card").fetchone()["n"]
        total_cards = conn.execute(
            "SELECT COUNT(*) AS n FROM placement WHERE review_status != 'empty'"
        ).fetchone()["n"]
        pending = conn.execute(
            "SELECT COUNT(*) AS n FROM placement WHERE review_status = 'pending'"
        ).fetchone()["n"]
        needs_metadata = conn.execute(
            "SELECT COUNT(*) AS n FROM core_card WHERE name IS NULL OR TRIM(name) = ''"
        ).fetchone()["n"]
        return {
            "binders": int(binders),
            "pages": int(pages),
            "core_cards": int(cards),
            "total_cards": int(total_cards),
            "pending_review": int(pending),
            "needs_metadata": int(needs_metadata),
        }


def get_activity(limit: int = 10) -> list[dict]:
    """Merge recent scans, confirmations, new-card creations, and binder creates
    into one chronological feed.
    """
    items: list[dict] = []
    with closing(_conn()) as conn:
        # Recent scans (= recent pages).
        for r in conn.execute(
            "SELECT p.id, p.binder_id, p.captured_at, p.page_number, b.name AS binder_name, "
            "  (SELECT COUNT(*) FROM placement WHERE page_id = p.id "
            "    AND review_status != 'empty') AS card_count "
            "FROM page p JOIN binder b ON p.binder_id = b.id "
            "ORDER BY datetime(p.captured_at) DESC LIMIT ?",
            (limit,),
        ).fetchall():
            items.append({
                "id": f"scan-{r['id']}",
                "kind": "scan",
                "title": f"Scanned page {r['page_number']}",
                "detail": f"{r['binder_name']} · {r['card_count']} cards",
                "when": r["captured_at"],
                "binder_id": r["binder_id"],
                "page_number": r["page_number"],
            })
        # Recent confirmations.
        for r in conn.execute(
            "SELECT pl.id, pl.resolved_at, pl.core_card_id, c.name AS card_name "
            "FROM placement pl LEFT JOIN core_card c ON pl.core_card_id = c.id "
            "WHERE pl.review_status = 'user_confirmed' AND pl.resolved_at IS NOT NULL "
            "ORDER BY datetime(pl.resolved_at) DESC LIMIT ?",
            (limit,),
        ).fetchall():
            items.append({
                "id": f"confirm-{r['id']}",
                "kind": "review",
                "title": "Confirmed match",
                "detail": r["card_name"] or "(unnamed card)",
                "when": r["resolved_at"],
                "core_card_id": r["core_card_id"],
            })
        # New CORE cards.
        for r in conn.execute(
            "SELECT id, name, set_name, created_at FROM core_card "
            "ORDER BY datetime(created_at) DESC LIMIT ?",
            (limit,),
        ).fetchall():
            label = r["name"] or "Unnamed card"
            if r["set_name"]:
                label += f" · {r['set_name']}"
            items.append({
                "id": f"core-{r['id']}",
                "kind": "enrich",
                "title": "Added to catalog",
                "detail": label,
                "when": r["created_at"],
                "core_card_id": r["id"],
            })
        # New binders.
        for r in conn.execute(
            "SELECT id, name, created_at FROM binder "
            "ORDER BY datetime(created_at) DESC LIMIT ?",
            (limit,),
        ).fetchall():
            items.append({
                "id": f"binder-{r['id']}",
                "kind": "binder",
                "title": "Created binder",
                "detail": r["name"],
                "when": r["created_at"],
                "binder_id": r["id"],
            })

    items.sort(key=lambda x: x["when"], reverse=True)
    return items[:limit]


def _conn():
    # Late import to avoid circular import via services packages.
    from card_tracker.db.engine import connect
    return connect()
