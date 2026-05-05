# Architecture

## Data model

- **`core_card`** — canonical unique cards. One row per distinct printed card identity. Carries the embedding, a representative crop path, and (manual for now) metadata: name, set, number, year, type, notes.
- **`binder`** — a physical binder. `name`, `layout` (currently `3x3`).
- **`page`** — one photographed page within a binder. References a binder, holds `page_number` and the source image path.
- **`placement`** — one card slot on a page. References a page, has `slot_index` (0–8), the crop image path, the crop's embedding, and a nullable FK to `core_card`. `review_status` ∈ `pending | auto_matched | user_confirmed | new_card`.

CORE is the source of truth for card identity. Placements are physical instances; many placements can map to one CORE row.

## Ingest flow

User-in-the-loop: auto-detection is a hint, not a critical path. Every page commit is reviewed by the user before placements are persisted.

```
1. CAPTURE / UPLOAD (frontend)
   - mobile-first; portrait phone aspect
   - file picker offers camera or gallery on mobile
   - (planned) live camera with 3×3 portrait grid overlay

2. PREVIEW (POST /api/scans/preview)
   - decode upload, save resized image to data/scans/<scan_id>.jpg
   - cv.grid.detect_slot_polygons:
       - _page_bbox: largest dark+grayscale connected region (binder silhouette)
       - split bbox into 9 cells (row-major, 0..8)
       - per cell: saturation/convex-hull refinement → 4-corner card quad if found,
         else axis-aligned cell rectangle as the starting box
   - return {scan_id, image_url, bbox, slots: [{slot_index, polygon, refined}]}

3. ADJUST (frontend)
   - render image with SVG polygon overlays
   - 4 draggable corner handles per slot (touch + mouse via Pointer Events)
   - user can drag corners, mark slots as deliberately empty
   - 'refined' is informational — every slot is editable regardless

4. COMMIT (POST /api/scans/commit) — NOT YET WIRED
   - user-confirmed polygons → cv.grid._warp_payload_to_crops → 9 BGR crops
   - save crops to data/crops/<scan_id>/slot_{0..8}.jpg
   - embeddings.dinov2 (DINOv2-small, dim=384, L2-normalized)
   - for each crop:
       sim ≥ match_threshold (0.92)  → auto_matched
       sim ≥ review_threshold (0.80) → pending review (top-N candidates)
       else                          → new CORE row (new_card)
   - persist page + placements
```

## Review queue

Surfaces every `placement` with `review_status = 'pending'`, paired with its top-N CORE candidates. User confirms a match or promotes to a new CORE row.

## Embedding stack

DINOv2-small (`facebook/dinov2-small`, 21M params, dim 384, CPU-tractable). Each `core_card` and `placement` row records `embedder_name` and `embedder_version` so future migrations are unambiguous. No plugin abstraction yet — single embedder for v1.

## Constraints

- Fully offline at runtime. The only acceptable network use is one-time HF model weight download at install time, cached under `data/models/`.
- No external card-data APIs.
- SQLite single-file storage. Embeddings stored as BLOBs and brute-force searched with NumPy — fine into the tens of thousands of cards.
