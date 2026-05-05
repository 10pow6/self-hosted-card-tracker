"""Brute-force cosine-similarity search over CORE card embeddings.

Embeddings are stored L2-normalized, so cosine similarity = dot product.
Acceptable up to ~tens of thousands of cards on CPU; switch to sqlite-vec
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
    """Top-K most similar CORE cards. Filters by embedder identity so we never
    compare embeddings produced by different models.
    """
    embedder_name = embedder_name or settings.embedder_name
    embedder_version = embedder_version or settings.embedder_version
    rows = conn.execute(
        "SELECT id, embedding FROM core_card "
        "WHERE embedder_name = ? AND embedder_version = ?",
        (embedder_name, embedder_version),
    ).fetchall()
    if not rows:
        return []
    matrix = np.stack([np.frombuffer(r["embedding"], dtype=np.float32) for r in rows])
    sims = matrix @ embedding.astype(np.float32)
    order = np.argsort(sims)[::-1][:top_k]
    return [Candidate(core_card_id=rows[int(i)]["id"], similarity=float(sims[int(i)])) for i in order]


def classify(top_similarity: float) -> str:
    """Map similarity → review_status for a freshly ingested placement."""
    if top_similarity >= settings.match_threshold:
        return "auto_matched"
    if top_similarity >= settings.review_threshold:
        return "pending"
    return "new_card"
