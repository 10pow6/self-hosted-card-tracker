"""Path ↔ URL conversion for assets under `data/`."""
from __future__ import annotations

from pathlib import Path
from typing import Optional

from card_tracker.config import settings


def to_relative(path: Path) -> str:
    """Filesystem absolute path → path-relative-to-data, forward-slashed.

    Stored in DB so the same value works regardless of where data/ lives.
    """
    return path.resolve().relative_to(settings.data_dir.resolve()).as_posix()


def to_url(relative: Optional[str]) -> Optional[str]:
    """Stored relative path → public URL served by the FastAPI StaticFiles mount.

    Appends `?v=<mtime>` so the browser refetches when the underlying file is
    overwritten in place (e.g. polygon refine re-warps a crop to the same path).
    `crop_image_path` is intentionally stable across refines so URLs are cache-
    able; the version param keeps caching honest by changing whenever the bytes
    do. Falls back to the un-versioned URL if the file is missing.
    """
    if not relative:
        return None
    base = f"/data/{relative}"
    try:
        mtime = int((settings.data_dir / relative).stat().st_mtime)
    except OSError:
        return base
    return f"{base}?v={mtime}"


def from_relative(relative: str) -> Path:
    """Stored relative path → absolute filesystem path."""
    return settings.data_dir / relative
