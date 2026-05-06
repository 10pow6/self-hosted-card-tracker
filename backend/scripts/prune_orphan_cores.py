"""One-shot cleanup: delete CORE rows with zero placements.

Orphan CORE rows accumulate when placements get reassigned away (via "Move to
a different card") in versions before the auto-prune logic shipped. This
script lists them and, with --apply, deletes them.

Usage:
    python scripts/prune_orphan_cores.py            # dry-run: list orphans, no changes
    python scripts/prune_orphan_cores.py --apply    # delete orphans

Crop files on disk are not touched. The orphan's representative_crop_path
typically pointed at a placement that has since moved to another CORE; that
placement still owns the file via its crop_image_path.
"""
from __future__ import annotations

import argparse
import sys
from contextlib import closing

from card_tracker.db.engine import connect, transaction


def find_orphans(conn) -> list[dict]:
    rows = conn.execute(
        """
        SELECT cc.id, cc.name, cc.set_name, cc.card_number, cc.year,
               cc.card_type, cc.notes, cc.representative_crop_path, cc.created_at
        FROM core_card cc
        LEFT JOIN placement pl ON pl.core_card_id = cc.id
        WHERE pl.id IS NULL
        ORDER BY cc.created_at ASC
        """
    ).fetchall()
    return [dict(r) for r in rows]


def _format_orphan(o: dict) -> str:
    label_parts = [o["name"], o["set_name"], o["card_number"]]
    label = " · ".join(p for p in label_parts if p) or "(no metadata)"
    has_meta = any(o[f] for f in ("name", "set_name", "card_number", "year", "notes"))
    flag = " [HAS METADATA]" if has_meta else ""
    return f"  {o['id']}  {label}{flag}"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Actually delete the orphans. Without this flag, only lists them.",
    )
    args = parser.parse_args()

    with closing(connect()) as conn:
        orphans = find_orphans(conn)

    if not orphans:
        print("No orphan CORE rows. DB is clean.")
        return 0

    with_meta = [o for o in orphans if any(
        o[f] for f in ("name", "set_name", "card_number", "year", "notes")
    )]
    without_meta = [o for o in orphans if o not in with_meta]

    print(f"Found {len(orphans)} orphan CORE row(s) (zero placements):")
    print(f"  - {len(with_meta)} with user-entered metadata (irreversible if deleted)")
    print(f"  - {len(without_meta)} bare (only embedding + crop reference)")
    print()
    for o in orphans:
        print(_format_orphan(o))

    if not args.apply:
        print()
        print("Dry-run only. Re-run with --apply to delete these rows.")
        if with_meta:
            print(
                "WARNING: rows tagged [HAS METADATA] will lose typed-in fields. "
                "Consider /cards/merge instead if any of them duplicate a card you keep."
            )
        return 0

    ids = [o["id"] for o in orphans]
    placeholders = ",".join("?" * len(ids))
    with transaction() as conn:
        cur = conn.execute(
            f"DELETE FROM core_card WHERE id IN ({placeholders})", ids
        )
    print()
    print(f"Deleted {cur.rowcount} orphan CORE row(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
