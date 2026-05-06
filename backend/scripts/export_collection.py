"""Export the card database to a multi-page PDF (Discord-shareable).

Usage:
    python scripts/export_collection.py
    python scripts/export_collection.py --out /tmp/my-collection.pdf

Default output: data/exports/collection-YYYYMMDD-HHMMSS.pdf
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime
from pathlib import Path

from card_tracker.config import settings
from card_tracker.services.export import render_collection_pdf


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--out",
        type=Path,
        default=None,
        help="Output PDF path. Defaults to data/exports/collection-<timestamp>.pdf",
    )
    args = parser.parse_args()
    if args.out is None:
        ts = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
        args.out = settings.data_dir / "exports" / f"collection-{ts}.pdf"
    out = render_collection_pdf(args.out)
    print(f"Wrote {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
