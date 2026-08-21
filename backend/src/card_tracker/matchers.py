"""Matcher registry — pluggable similarity-search + classification strategies.

A matcher takes a query embedding and the set of confirmed `placement.embedding`
rows and returns ranked `core_card` candidates plus a classification decision
(`auto_matched` vs. `pending`). Different matchers can fuse multi-photo evidence
differently; switching between them is config-only.

Adding a new matcher (e.g. `rrf-v1`, `learned-rerank-v1`):
  1. Implement a class with `id`, `version`, `find_candidates(...)`, `classify(...)`.
  2. Register an instance in `REGISTRY`.
  3. Set `config.matcher_id` to the new id.

`services.match` is a thin facade that always delegates to `get_active()`, so
call sites don't depend on which matcher is active.
"""
from __future__ import annotations

import sqlite3
from dataclasses import dataclass, field
from typing import Optional, Protocol, runtime_checkable

import numpy as np

from card_tracker.config import settings


def _match_threshold() -> float:
    """Auto-accept threshold — user-adjustable at runtime (Settings → Automation).
    Lazy import keeps this module importable without a DB on disk."""
    from card_tracker.services import app_settings

    return app_settings.match_threshold()


@dataclass
class Candidate:
    """One CORE-card candidate for a query embedding.

    `similarity` is the **raw max cosine** between the query and any photo of
    this CORE card. It is the ground-truth measurement and is what gets stored
    on `placement.similarity_score` and compared against `match_threshold` for
    auto-match decisions. Keeping its meaning stable across matchers means
    callers don't need to know which matcher produced the candidate.

    `rank_score` is the matcher's headline confidence number — the sort key.
    For `cosine-max-v1` it equals `similarity`. For matchers that fuse
    multi-photo evidence (e.g. `cosine-multivote-v1`) it can exceed `similarity`
    to reflect supporting votes.

    `breakdown` carries the raw aggregation inputs so the UI can show the
    reasoning ("5 photos ≥ 0.80") without re-deriving anything.
    """

    core_card_id: str
    similarity: float
    rank_score: float = 0.0
    breakdown: dict = field(default_factory=dict)


@runtime_checkable
class Matcher(Protocol):
    id: str
    version: str

    def find_candidates(
        self,
        conn: sqlite3.Connection,
        embedding: np.ndarray,
        top_k: int = 3,
        *,
        embedder_name: Optional[str] = None,
        embedder_version: Optional[str] = None,
    ) -> list[Candidate]: ...

    def classify(
        self, top_similarity: float, candidates: Optional[list[Candidate]] = None
    ) -> str: ...


# ---------------------------------------------------------------------------
# Shared recall step

def _fetch_placement_matrix(
    conn: sqlite3.Connection,
    embedder_name: str,
    embedder_version: str,
) -> tuple[list[str], np.ndarray]:
    """Pull every confirmed placement embedding under the given embedder identity.

    Returns (core_ids, matrix) where matrix is shape (N, dim). Empty matrix
    when nothing matches.
    """
    rows = conn.execute(
        "SELECT core_card_id, embedding FROM placement "
        "WHERE core_card_id IS NOT NULL "
        "AND embedding IS NOT NULL "
        "AND embedder_name = ? AND embedder_version = ?",
        (embedder_name, embedder_version),
    ).fetchall()
    if not rows:
        return [], np.zeros((0, 0), dtype=np.float32)
    core_ids = [r["core_card_id"] for r in rows]
    matrix = np.stack([np.frombuffer(r["embedding"], dtype=np.float32) for r in rows])
    return core_ids, matrix


# ---------------------------------------------------------------------------
# Built-in matchers

class CosineMaxMatcher:
    """Original behavior, frozen. A card's score is its single best photo.

    Kept in the registry so users who don't want multi-vote ranking can opt
    back in via `config.matcher_id = "cosine-max-v1"`.
    """

    id = "cosine-max-v1"
    version = "1"

    def find_candidates(
        self,
        conn: sqlite3.Connection,
        embedding: np.ndarray,
        top_k: int = 3,
        *,
        embedder_name: Optional[str] = None,
        embedder_version: Optional[str] = None,
    ) -> list[Candidate]:
        en = embedder_name or settings.embedder_name
        ev = embedder_version or settings.embedder_version
        core_ids, matrix = _fetch_placement_matrix(conn, en, ev)
        if matrix.shape[0] == 0:
            return []
        sims = matrix @ embedding.astype(np.float32)
        best: dict[str, float] = {}
        for cid, s in zip(core_ids, sims):
            sf = float(s)
            if best.get(cid, -1.0) < sf:
                best[cid] = sf
        ranked = sorted(best.items(), key=lambda kv: kv[1], reverse=True)[:top_k]
        return [
            Candidate(
                core_card_id=cid,
                similarity=s,
                rank_score=s,
                breakdown={"max_sim": s, "n_placements": 0, "n_support": 0},
            )
            for cid, s in ranked
        ]

    def classify(
        self, top_similarity: float, candidates: Optional[list[Candidate]] = None
    ) -> str:
        if top_similarity >= _match_threshold():
            return "auto_matched"
        return "pending"


class CosineMultiVoteMatcher:
    """Cosine recall + multi-photo evidence boost on the ranking score.

    Recall and per-card raw similarity are identical to `cosine-max-v1`. The
    difference is the sort key: cards with multiple supporting photos get a
    small additive bonus so the review queue surfaces well-evidenced cards
    above lucky one-shot near-misses.

    Auto-match safety: `classify(top_similarity)` reads the **raw max cosine**,
    not the boosted rank score. The bonus reorders the queue but cannot push a
    card across the auto-match threshold on its own.

    Tuning constants (class-level so tests / forks can override):
      α          per-supporting-photo bonus (default 0.01)
      τ_low      sim threshold for a photo to count as "supporting" (default 0.80)
      M          cap on supporting photos counted (default 5 → max bonus +0.05)
    """

    id = "cosine-multivote-v1"
    version = "1"

    alpha: float = 0.01
    tau_low: float = 0.80
    cap: int = 5

    def find_candidates(
        self,
        conn: sqlite3.Connection,
        embedding: np.ndarray,
        top_k: int = 3,
        *,
        embedder_name: Optional[str] = None,
        embedder_version: Optional[str] = None,
    ) -> list[Candidate]:
        en = embedder_name or settings.embedder_name
        ev = embedder_version or settings.embedder_version
        core_ids, matrix = _fetch_placement_matrix(conn, en, ev)
        if matrix.shape[0] == 0:
            return []
        sims = matrix @ embedding.astype(np.float32)

        # Per-core: max sim, total photo count, count of photos at or above the
        # support threshold. Single pass.
        max_by_core: dict[str, float] = {}
        n_by_core: dict[str, int] = {}
        n_support_by_core: dict[str, int] = {}
        for cid, s in zip(core_ids, sims):
            sf = float(s)
            if max_by_core.get(cid, -1.0) < sf:
                max_by_core[cid] = sf
            n_by_core[cid] = n_by_core.get(cid, 0) + 1
            if sf >= self.tau_low:
                n_support_by_core[cid] = n_support_by_core.get(cid, 0) + 1

        scored: list[Candidate] = []
        for cid, max_sim in max_by_core.items():
            n_support = n_support_by_core.get(cid, 0)
            # Subtract 1 so a singleton (its own top photo) gets no bonus.
            extra = max(0, n_support - 1)
            bonus = self.alpha * min(extra, self.cap)
            scored.append(
                Candidate(
                    core_card_id=cid,
                    similarity=max_sim,
                    rank_score=max_sim + bonus,
                    breakdown={
                        "max_sim": max_sim,
                        "n_placements": n_by_core[cid],
                        "n_support": n_support,
                        "bonus": bonus,
                        "tau_low": self.tau_low,
                    },
                )
            )
        scored.sort(key=lambda c: c.rank_score, reverse=True)
        return scored[:top_k]

    def classify(
        self, top_similarity: float, candidates: Optional[list[Candidate]] = None
    ) -> str:
        # Auto-match decision uses raw max cosine — boost only affects ranking.
        if top_similarity >= _match_threshold():
            return "auto_matched"
        return "pending"


# ---------------------------------------------------------------------------
# Registry

REGISTRY: dict[str, Matcher] = {
    CosineMaxMatcher.id: CosineMaxMatcher(),
    CosineMultiVoteMatcher.id: CosineMultiVoteMatcher(),
}

DEFAULT_MATCHER = CosineMultiVoteMatcher.id


def get_active() -> Matcher:
    """Return the matcher named by `settings.matcher_id`, or the default."""
    return REGISTRY.get(settings.matcher_id, REGISTRY[DEFAULT_MATCHER])
