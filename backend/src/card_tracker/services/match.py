"""Visual-similarity search across confirmed placements, aggregated to CORE.

We compare a query embedding against EVERY confirmed `placement.embedding` (any
placement linked to a `core_card`), then take the max similarity per
`core_card_id`. This means each card is judged by the best photo we have of it,
not by whichever single embedding happened to seed its CORE row.

Embeddings are stored L2-normalized so cosine similarity = dot product.
Acceptable up to ~tens of thousands of placements on CPU; switch to sqlite-vec
or FAISS when that ceiling becomes uncomfortable.
"""
from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from typing import Optional

import numpy as np

from card_tracker.config import settings


@dataclass
class Candidate:
    core_card_id: str
    similarity: float


def find_candidates(
    conn: sqlite3.Connection,
    embedding: np.ndarray,
    top_k: int = 3,
    *,
    embedder_name: Optional[str] = None,
    embedder_version: Optional[str] = None,
) -> list[Candidate]:
    """Top-K most similar CORE cards, scored by the best photo we have of each.

    Filters placements by embedder identity so we never compare embeddings
    produced by different models.
    """
    embedder_name = embedder_name or settings.embedder_name
    embedder_version = embedder_version or settings.embedder_version
    rows = conn.execute(
        "SELECT core_card_id, embedding FROM placement "
        "WHERE core_card_id IS NOT NULL "
        "AND embedding IS NOT NULL "
        "AND embedder_name = ? AND embedder_version = ?",
        (embedder_name, embedder_version),
    ).fetchall()
    if not rows:
        return []
    query = embedding.astype(np.float32)
    matrix = np.stack([np.frombuffer(r["embedding"], dtype=np.float32) for r in rows])
    sims = matrix @ query  # cosine similarities, since embeddings are unit norm
    # Aggregate by core_card_id taking the max — a card's score is the
    # best-matching photo we have of it.
    best_by_core: dict[str, float] = {}
    for row, sim in zip(rows, sims):
        core_id = row["core_card_id"]
        prev = best_by_core.get(core_id)
        s = float(sim)
        if prev is None or s > prev:
            best_by_core[core_id] = s
    sorted_pairs = sorted(best_by_core.items(), key=lambda kv: kv[1], reverse=True)[:top_k]
    return [Candidate(core_card_id=cid, similarity=sim) for cid, sim in sorted_pairs]


def classify(top_similarity: float) -> str:
    """Map similarity → review_status for a freshly ingested placement.

    Only two outcomes: 'auto_matched' (high confidence) or 'pending' (anything
    else). New CORE rows are NEVER created automatically from similarity alone —
    that path was the source of silent dupes. The only ways a new CORE row gets
    created are:
      1. Bootstrap: CORE table is empty, so nothing to match against (handled in ingest).
      2. Explicit user action via the review queue ("Add as new card").
    """
    if top_similarity >= settings.match_threshold:
        return "auto_matched"
    return "pending"
