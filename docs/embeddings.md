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

### Preprocessing (no torchvision)

We do **not** use `transformers.AutoImageProcessor` for DINOv2. It depends on `torchvision`, which we don't otherwise need. Preprocessing is matched manually in `_preprocess()` using cv2 + numpy:

1. Resize shortest edge to **256** (bicubic, `cv2.INTER_CUBIC`).
2. Center-crop to **224×224**.
3. Float32 / 255, normalize with ImageNet `mean = [0.485, 0.456, 0.406]`, `std = [0.229, 0.224, 0.225]`.
4. Layout `HWC → CHW`, add batch dim, hand to `model(pixel_values=tensor)`.

The CLS token (`outputs.last_hidden_state[0, 0]`) is the embedding. L2-normalize before returning so cosine similarity = dot product later.

If you ever swap embedders, mirror the new model's preprocessing here or accept that you'll need `torchvision` (and add it to `pyproject.toml`).

### Network use

The first call downloads the weights (~90 MB) from HuggingFace into `data/models/`. Subsequent runs are fully offline. Override the cache with `HF_HOME=/some/path` in the environment if you don't want it under the repo.

## Matching — match against placements, aggregate to CORE

[`backend/src/card_tracker/services/match.py`](../backend/src/card_tracker/services/match.py)

For each query embedding we compare against **every confirmed `placement.embedding`** (any placement linked to a `core_card`), then aggregate by `core_card_id` taking the max similarity. The score for a card is the best photo we've ever taken of it.

```python
rows = conn.execute(
    "SELECT core_card_id, embedding FROM placement "
    "WHERE core_card_id IS NOT NULL AND embedding IS NOT NULL "
    "AND embedder_name = ? AND embedder_version = ?",
    (...),
).fetchall()
matrix = np.stack([np.frombuffer(r["embedding"], dtype=np.float32) for r in rows])
sims = matrix @ query                # shape (N,) — cosine similarities
# Aggregate: a card's score = max sim over its placements.
best_by_core: dict[str, float] = {}
for row, sim in zip(rows, sims):
    cid = row["core_card_id"]
    s = float(sim)
    if best_by_core.get(cid, -1) < s:
        best_by_core[cid] = s
```

### Why match against placements, not the canonical embedding?

The naive approach is to compare against `core_card.embedding` directly. We did this initially, but it has a real failure mode: a card's `core_card.embedding` is just whichever placement happened to seed its CORE row first. Trading-card photos vary a lot (lighting, sleeves, holo glare, angle), so that single snapshot can mismatch a new scan even when the new scan would clearly match a *different* photo of the same card we already have.

Matching against all placements gives the same physical card multiple "votes" — same-card photos under different conditions all contribute. Same-card similarity stays robust as the collection grows.

A side effect: `core_card.embedding` is now redundant for matching. Kept on the schema for now (might be useful if we later add a fast pre-filter), but `find_candidates` doesn't read it.

### Embedder-identity filter

The placement query filters by `(embedder_name, embedder_version)`. **We never compare embeddings produced by different models** — that would silently return garbage similarities.

A consequence: when (in the future) you swap to a different embedder, existing placements produced under the old model become invisible to new placements until they're re-embedded.

### Performance

Acceptable into the tens of thousands of placements on CPU (one matrix multiply per query, ≈ 50–100 ms at 50k placements). Migrate to `sqlite-vec` or FAISS when that ceiling becomes uncomfortable.

## Thresholds (`backend/src/card_tracker/config.py`)

| Threshold | Default | Outcome |
|---|---|---|
| `match_threshold` | 0.92 | `>=` → `auto_matched`; placement links to top candidate immediately. |
| (else) | < 0.92 | `pending`; lands in the work queue. The user resolves it. |

**No automatic new-card creation from similarity alone.** The only ways a new `core_card` row gets created are:

1. **Bootstrap** — CORE table is empty so there's nothing to match against. Ingest creates a new row from the placement.
2. **Explicit user action** — the user picks **Add as new card** in the review queue, or commits a placement whose top match was below the threshold and then promotes it.

This is deliberate: at typical photo-to-photo similarities for trading cards (often 0.70–0.90 even for the same physical card under different lighting), letting any below-threshold sim auto-spawn a CORE row produced silent dupes. The fix is to always involve the human when confidence is uncertain.

`classify(top_similarity) → 'auto_matched' | 'pending'` lives in `match.py`. The `review_threshold` field still exists in `config.py` but is unused — kept for forward compatibility.

### Calibration notes

DINOv2-small similarity for trading-card crops, observed in practice:

- **0.95+** — same printing of the same card, very likely the same physical copy under similar lighting.
- **0.88–0.94** — same card name + same set, often a different copy or angle. Holo and foil variants frequently land here.
- **0.70–0.88** — could be the same card under bad lighting/angle, OR a closely related card (same Pokémon different art, same player different year). **This range is exactly why we never auto-create new CORE rows from similarity alone** — these need human judgment.
- **< 0.70** — likely a different card, but still routes to review so the human can confirm.

If too many false-positive auto-matches sneak through, raise `match_threshold` (e.g. 0.95). If you want everything human-reviewed, set `match_threshold = 1.01` so nothing ever auto-matches.

## Future swaps

The Settings page surfaces a "model slot" catalog so the embedder is meant to be swappable. v1 only honors what's in `config.py` — runtime swap returns 501. To actually swap:

1. Add a new embedder class implementing `name`, `version`, `dim`, `embed(rgb_uint8) → float32[dim]`.
2. Update `config.embedder_name` / `embedder_version` and restart.
3. Optional: write a re-embedding script that updates every CORE row's embedding under the new identity (or wipe + re-ingest).
