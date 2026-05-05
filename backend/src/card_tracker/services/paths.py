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
    """Stored relative path → public URL served by the FastAPI StaticFiles mount."""
    if not relative:
        return None
    return f"/data/{relative}"


def from_relative(relative: str) -> Path:
    """Stored relative path → absolute filesystem path."""
    return settings.data_dir / relative
