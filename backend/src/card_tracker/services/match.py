"""Facade over `card_tracker.matchers` — keeps the call-site surface narrow.

All similarity-search + classification work is delegated to the active matcher
selected by `config.matcher_id`. Existing callers (`services.ingest`,
`services.placements`, `services.review`) import `find_candidates`, `classify`,
and `Candidate` from here and don't need to know which matcher is active.
"""
from __future__ import annotations

import sqlite3
from typing import Optional

import numpy as np

from card_tracker.matchers import Candidate, get_active

__all__ = ["Candidate", "find_candidates", "classify"]


def find_candidates(
    conn: sqlite3.Connection,
    embedding: np.ndarray,
    top_k: int = 3,
    *,
    embedder_name: Optional[str] = None,
    embedder_version: Optional[str] = None,
) -> list[Candidate]:
    return get_active().find_candidates(
        conn,
        embedding,
        top_k=top_k,
        embedder_name=embedder_name,
        embedder_version=embedder_version,
    )


def classify(top_similarity: float, candidates: Optional[list[Candidate]] = None) -> str:
    return get_active().classify(top_similarity, candidates)
