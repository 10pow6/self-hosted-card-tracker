"""Runtime-adjustable app settings, persisted in the `app_setting` table.

Currently holds the matching guardrail (`match_threshold`). Values are cached
in-process and invalidated on save — correct for the single-process server.
"""
from __future__ import annotations

import json
from contextlib import closing
from typing import Optional

from card_tracker.config import settings
from card_tracker.db.engine import connect, transaction

_MATCH_THRESHOLD_KEY = "match_threshold"

# Guardrail bounds: below 0.5 auto-accept would be reckless; 0.999 ≈ "never".
MATCH_THRESHOLD_MIN = 0.5
MATCH_THRESHOLD_MAX = 0.999

_cache: dict[str, float] = {}


def _read_raw(key: str) -> Optional[str]:
    with closing(connect()) as conn:
        row = conn.execute(
            "SELECT value FROM app_setting WHERE key = ?", (key,)
        ).fetchone()
        return row["value"] if row else None


def match_threshold() -> float:
    """The auto-accept similarity threshold. Stored value wins; falls back to
    the config.py default."""
    if _MATCH_THRESHOLD_KEY in _cache:
        return _cache[_MATCH_THRESHOLD_KEY]
    raw = _read_raw(_MATCH_THRESHOLD_KEY)
    value = settings.match_threshold
    if raw is not None:
        try:
            parsed = float(json.loads(raw))
            if MATCH_THRESHOLD_MIN <= parsed <= MATCH_THRESHOLD_MAX:
                value = parsed
        except (ValueError, json.JSONDecodeError):
            pass
    _cache[_MATCH_THRESHOLD_KEY] = value
    return value


def get_matching_settings() -> dict:
    return {
        "match_threshold": match_threshold(),
        "match_threshold_default": settings.match_threshold,
        "matcher_id": settings.matcher_id,
        "embedder_name": settings.embedder_name,
        "embedder_version": settings.embedder_version,
    }


def save_match_threshold(value: float) -> dict:
    if not (MATCH_THRESHOLD_MIN <= value <= MATCH_THRESHOLD_MAX):
        raise ValueError(
            f"match_threshold must be between {MATCH_THRESHOLD_MIN} and "
            f"{MATCH_THRESHOLD_MAX}, got {value}"
        )
    with transaction() as conn:
        conn.execute(
            "INSERT INTO app_setting (key, value) VALUES (?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value, "
            "updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')",
            (_MATCH_THRESHOLD_KEY, json.dumps(value)),
        )
    _cache[_MATCH_THRESHOLD_KEY] = value
    return get_matching_settings()
