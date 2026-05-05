# Embeddings & matching

How a card crop becomes a vector and how that vector finds its twin in the CORE table.

## Active model — DINOv2-small

[`backend/src/card_tracker/embeddings/dinov2.py`](../backend/src/card_tracker/embeddings/dinov2.py)

| Property | Value |
|---|---|
| Model id (HF Hub) | `facebook/dinov2-small` |
| Parameters | ~21M |
| Output dim | 384 |
| Output | CLS-token embedding, L2-normalized, float32 |
| Device | CUDA if available, otherwise CPU |
| Cache location | `data/models/` (via `HF_HOME` pinned in `__init__`) |

### Lazy singleton

`get_embedder()` returns a process-wide instance, lazy-initialized on first call. Heavy imports (`torch`, `transformers`) are deferred inside `__init__` so the FastAPI process boots in milliseconds — the model load only happens on the first actual scan.

### Network use

The first call downloads the weights (~90 MB) from HuggingFace into `data/models/`. Subsequent runs are fully offline. Override the cache with `HF_HOME=/some/path` in the environment if you don't want it under the repo.

## Matching

[`backend/src/card_tracker/services/match.py`](../backend/src/card_tracker/services/match.py)

Brute-force NumPy cosine similarity. Embeddings are unit-normalized so cosine sim = dot product:

```python
matrix = np.stack([np.frombuffer(r["embedding"], dtype=np.float32) for r in rows])
sims = matrix @ query           # shape (N,) — cosine similarities
order = np.argsort(sims)[::-1]  # descending
```

Acceptable into the tens of thousands of cards. Migrate to `sqlite-vec` or FAISS when that ceiling becomes uncomfortable.

### Embedder-identity filter

`find_candidates(conn, embedding, embedder_name, embedder_version)` filters CORE by `(embedder_name, embedder_version)`. **We never compare embeddings produced by different models** — that would silently return garbage similarities.

A consequence: when (in the future) you swap to a different embedder, existing CORE rows produced under the old model become invisible to new placements until they're re-embedded.

## Thresholds (`backend/src/card_tracker/config.py`)

| Threshold | Default | Outcome |
|---|---|---|
| `match_threshold` | 0.92 | `>=` → `auto_matched`; placement links to top candidate immediately. |
| `review_threshold` | 0.80 | `>=` and `< 0.92` → `pending`; lands in the work queue. |
| (else) | < 0.80 | `new_card`; ingest creates a fresh `core_card` from this placement. |

`classify(top_similarity) → str` lives in `match.py`. Edit `config.py` to tune.

### Calibration notes

These thresholds were chosen for DINOv2-small on trading-card crops. Rough behaviors:

- **0.95+** — same printing of the same card, probably from another scan of the same physical copy.
- **0.88–0.94** — same card name + same set, potentially different copy or angle.
- **0.80–0.88** — same card across different printings/sets, OR distinct but visually similar (e.g. same Pokémon different art).
- **< 0.80** — almost certainly different cards.

If too many cards land in the review queue, raise `review_threshold` (e.g. 0.85). If too many false-positive auto-matches sneak through, raise `match_threshold` (e.g. 0.95).

## Future swaps

The Settings page surfaces a "model slot" catalog so the embedder is meant to be swappable. v1 only honors what's in `config.py` — runtime swap returns 501. To actually swap:

1. Add a new embedder class implementing `name`, `version`, `dim`, `embed(rgb_uint8) → float32[dim]`.
2. Update `config.embedder_name` / `embedder_version` and restart.
3. Optional: write a re-embedding script that updates every CORE row's embedding under the new identity (or wipe + re-ingest).
