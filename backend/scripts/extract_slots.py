"""CLI smoke test: extract 9 card crops from a binder page photo.

Usage (from backend/, with venv active):
    python scripts/extract_slots.py <image_path> [--out DIR]

Writes slot_0.jpg .. slot_8.jpg to the output directory and prints each path.
Default output: data/crops/preview/<image_basename>/
"""

import argparse
import sys
from pathlib import Path

import cv2

from card_tracker.config import settings
from card_tracker.cv.grid import GridNotFound, extract_slots, write_debug_artifacts


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Extract 9 card crops from a binder page photo.")
    p.add_argument("image_path", type=Path, help="Input page photo")
    p.add_argument("--out", type=Path, default=None, help="Output directory (default: data/crops/preview/<name>/)")
    p.add_argument("--debug", action="store_true", help="Also write CV pipeline diagnostic images")
    return p.parse_args()


def resolve_out_dir(image_path: Path, override: Path | None) -> Path:
    if override is not None:
        return override
    return settings.crops_dir / "preview" / image_path.stem


def main() -> int:
    args = parse_args()
    if not args.image_path.exists():
        print(f"Image not found: {args.image_path}", file=sys.stderr)
        return 2
    out_dir = resolve_out_dir(args.image_path, args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    if args.debug:
        stats = write_debug_artifacts(args.image_path, out_dir / "debug")
        print(f"[debug] frame={stats['frame_size']} bbox={stats['bbox']} refined_cells={stats['refined_cells']}/9")
        print(f"[debug] artifacts in {out_dir / 'debug'}")

    try:
        slots = extract_slots(args.image_path)
    except GridNotFound as e:
        print(f"GridNotFound: {e}", file=sys.stderr)
        return 1

    for slot in slots:
        out_path = out_dir / f"slot_{slot.slot_index}.jpg"
        cv2.imwrite(str(out_path), slot.image)
        print(out_path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
