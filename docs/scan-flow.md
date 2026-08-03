# Scan flow

The end-to-end pipeline from "I have a binder page photographed on my phone" to "every card persisted with placements + matches".

## Wizard states (frontend)

`routes/Scan.tsx` is a state machine on top of local state:

```
┌──────────────┐  pick or create   ┌───────────────┐
│ pick_binder  │───────────────────▶│  capturing    │
└──────────────┘                    └───────┬───────┘
                                            │ file selected
                                            ▼
                                    ┌───────────────┐
                                    │  previewing   │
                                    └──┬─────────┬──┘
                                  retake│         │confirm
                                        │         ▼
                                        │  ┌────────────┐  next page
                                        │  │ committed  │────────────┐
                                        │  └─────┬──────┘            │
                                        │        │ done              │
                                        ▼        ▼                   ▼
                                   (capturing)  /binders/:id    (capturing, page+1)
```

URL is `/scan?binder=<id>` once a binder is picked. Refresh keeps you in the same binder; the binder's `page_count + 1` is fetched fresh so multi-tab editing doesn't collide.

## Step-by-step

### 1. Capture (frontend)

`<input type="file" accept="image/*" capture="environment">` — hints to mobile browsers to open the rear camera directly. Android Chrome jumps to the camera; iOS Safari shows a "Take Photo / Photo Library" sheet (iOS UI policy). No HTTPS needed.

### 2. Preview (`POST /api/scans/preview`)

Form fields: `image` (the photo), plus either `binder_id` (preferred — uses that binder's layout, detector, and `detector_config`) or `layout` (e.g. `"3x3"`) as a fallback when no binder is picked yet.

`services/scans.py::preview_scan`:
1. Decodes the upload.
2. Resizes the long edge to `MAX_LONG_SIDE` (1500 px) — keeps polygon coords aligned with what the user sees in the browser.
3. Runs the binder's detector via `_run_detector` (default `opencv-grid-v1` → [`detect_slot_polygons`](detection.md)) with the resolved `(rows, cols)` and per-binder config.
4. Saves the resized image to `data/scans/<scan_id>.jpg`.

Returns `{scan_id, image_url, image_size, bbox, rows, cols, detector, slots: [{slot_index, polygon, refined}]}`.

### 3. Adjust (frontend)

`PolygonEditor` renders the photo with one SVG quad per slot:
- Drag any of the 4 corners.
- Drag the body to translate the whole quad.
- × button → mark slot as empty.
- + button on an empty slot → restore with a default card-aspect quad.
- Pinch / scroll to zoom; drag background to pan.

`SlotThumbnails` shows live SVG-clipped previews of each polygon as the user drags — no backend round-trip.

### 4. Commit (`POST /api/scans/commit`)

Body: `{scan_id, binder_id, page_number, slots: [{slot_index, disabled, polygon: [[x,y]…]}]}`.

`services/ingest.py::ingest_page` runs in two phases:

**Phase A — outside the DB transaction** (heavy, slow):
1. Verify binder exists and `(binder_id, page_number)` isn't already taken.
2. For each non-empty slot: warp polygon → canonical 480×672 BGR crop → save to `data/crops/<scan_id>/slot_<i>.jpg` → embed (BGR → RGB → DINOv2 → unit float32[384]) → top-3 cosine similarity vs CORE.
3. Classify each slot: top similarity `>= 0.92` (`match_threshold`) → `auto_matched`, otherwise `pending`. The only exception is **bootstrap**: when the CORE table is empty there's nothing to match against, so the slot becomes `new_card`. Similarity alone never creates new CORE rows — see [embeddings.md](embeddings.md).

**Phase B — single DB transaction**:
4. Insert `page` row.
5. Insert `placement` rows. For bootstrap `new_card` slots, also insert a fresh `core_card` row using the placement's embedding + crop as the canonical reference.

Response includes `summary: {auto_matched, pending, new_cards, empty}` so the UI can render the colored success chips.

## Why two phases

The embedder is the slowest step (~50 ms per crop on CPU). Holding a write transaction open while embedding 9–16 cards would block other readers. Phase A reads what it needs (CORE embeddings for matching) without locks; Phase B does only fast inserts.

Failure between phases leaves orphan crops on disk under `data/crops/<scan_id>/`. Acceptable for v1 — they're cheap and discoverable; a janitor sweep is a future enhancement.
