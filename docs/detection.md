# Detection (CV pipeline)

[`backend/src/card_tracker/cv/grid.py`](../backend/src/card_tracker/cv/grid.py) finds the binder page in a photo and emits one polygon per pocket. CV is a **hint, not a critical path** — the user reviews every box before commit, so "good enough" is good enough.

## Stages

### 1. Page bbox

`_page_bbox(img_bgr) → (x, y, w, h) | None`

Plastic binder sleeves are dark and (mostly) grayscale. The detector finds them by:

1. Convert to HSV.
2. Threshold pixels with `V ≤ PLASTIC_V_MAX` **and** `S ≤ PLASTIC_S_MAX` → boolean mask of "plastic-ish" pixels.
3. Morphologically close with a `40×40` kernel — fills the card-shaped holes inside the binder so the silhouette becomes one connected region.
4. Pick the largest connected component → its bbox is the page.

Raises `GridNotFound` if no plastic-region candidate exists. The frontend surfaces this as a 422 with the friendly message.

### 2. Per-cell card refinement

`_refine_card_in_cell(cell_bgr) → quad | None`

For each cell of the `rows × cols` grid:

1. Mask out plastic again (inverse of stage 1's test) → "card content" mask.
2. Open with a `5×5` kernel to remove sleeve-glare specks.
3. Largest external contour → convex hull → `minAreaRect` → 4 corner points.
4. Reject if:
   - rect area / cell area `< MIN_CELL_FILL` (0.30) — the card is too small for the cell, probably noise.
   - max/min side aspect outside `CARD_ASPECT ± ASPECT_TOLERANCE` (0.716 ± 20%) — not card-shaped.
   - hull area / rect area `< MIN_HULL_FILL` (0.70) — too concave to be a card.
5. If accepted: return the rect's 4 cell-local corners (re-mapped to image-global coordinates by the caller).

If rejected: caller falls back to `_default_card_polygon` — a card-aspect rectangle centered in the cell, sized to ~80% of cell side. Gives the user a sensible starting box to drag.

### 3. Layout parameterization

`detect_slot_polygons(img, rows=3, cols=3)` accepts the binder's grid dimensions. Cells are `pw // cols × ph // rows`. Slot index = `row * cols + col`, row-major. See [layouts.md](layouts.md).

## Tuning constants

Process-wide constants in [`cv/grid.py`](../backend/src/card_tracker/cv/grid.py):

| Constant | Value | What |
|---|---|---|
| `MAX_LONG_SIDE` | 1500 | Resize threshold; large phone photos get downscaled before processing. |
| `PLASTIC_V_MAX` | 60 | Max V (HSV) for "plastic" pixels. |
| `PLASTIC_S_MAX` | 40 | Max S (HSV); excludes dark-but-colored regions. |
| `PAGE_FILL_KERNEL` | (40, 40) | Card-shaped hole fill. Increase if cards are very large in the frame. |
| `CELL_OPEN_KERNEL` | (5, 5) | Inside-cell speck removal. |
| `CARD_ASPECT` | 88/63 | Trading-card aspect (~1.397). |
| `CANONICAL_CARD_SIZE` | (480, 672) | Output crop size after warp. Embedder gets this exact size. |

### Per-binder tunable thresholds (`DetectionConfig`)

Three thresholds are exposed per binder via `binder.detector_config` (see [data-model.md](data-model.md) and [the detector registry](../backend/src/card_tracker/detectors.py)):

| Field | Default | Range | What |
|---|---|---|---|
| `min_cell_fill` | 0.30 | 0.05 – 0.60 | Min rect / cell area ratio. **Lower this for dense layouts (4×4) where each cell is small.** |
| `min_hull_fill` | 0.70 | 0.30 – 0.95 | Min convex-hull tightness. Drop for crumpled or sleeve-occluded cards. |
| `aspect_tolerance` | 0.20 | 0.05 – 0.50 | ±% deviation from `CARD_ASPECT`. Higher = more permissive on tilt/perspective. |

The frontend's binder-create dialog renders an "Advanced detection tuning" disclosure with these fields. Per-binder values flow through `services/binders.resolve_detector(binder_id)` into the call to `detect_slot_polygons` during scan preview.

## Adding new detectors

The `detector` column on `binder` and the registry in [`backend/src/card_tracker/detectors.py`](../backend/src/card_tracker/detectors.py) are designed so adding a new detector (e.g. a YOLOv8n-trained card detector) is purely additive:

1. Implement the detector function (taking a numpy image + per-call config dict, returning the same `(resized_img, payload)` shape as `detect_slot_polygons`).
2. Add a `DetectorSpec` entry to `REGISTRY` with its config field schemas.
3. Add a dispatch branch in `services/scans._run_detector`.
4. Mirror the spec in [`frontend/src/lib/detectors.ts`](../frontend/src/lib/detectors.ts) (or just rely on the `/api/binders/detectors` endpoint).

Existing binders keep their stored `detector` (e.g. `opencv-grid-v1`) unchanged — no migration. New binders default to whatever `detectors.DEFAULT_DETECTOR` is at creation time.

## Debug helper

`write_debug_artifacts(image_path, out_dir)` writes:
- `01_resized.jpg` — what the detector sees.
- `02_bbox_cells_quads.jpg` — overlay of bbox (yellow), cell grid (cyan), refined card quads (red).

Call from a Python REPL or scratch script when tuning.

## Known weak spots

- **Dense layouts (4×4 and up).** The default `min_cell_fill` was tuned for 3×3 — small cells often fail it. Lower it per binder via `detector_config` (Advanced detection tuning in the create-binder dialog), or drag manually.
- **Toploaders against a busy background.** Stage 1 needs a single clearly-darkest region; transparent toploaders on a dark surface confuse it.
- **Glossy sleeves under harsh light.** Specular highlights chunk the card mask. The 5×5 open kernel helps but isn't perfect — diffuse lighting always beats algorithm tuning.
