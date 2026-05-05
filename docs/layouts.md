# Binder layouts

Each binder has a fixed pocket grid expressed as `RxC` — `R` rows by `C` columns. Default `3x3`.

## Format

`"<rows>x<cols>"`, lowercase, no whitespace. `R` and `C` are integers in `[1, 6]`. Total pockets per page = `R × C` (max 36).

## Supported presets

Surfaced in the create-binder dialog ([`frontend/src/lib/layout.ts::LAYOUT_PRESETS`](../frontend/src/lib/layout.ts)):

| Layout | Pockets | Note |
|---|---|---|
| `1x1` | 1 | Toploader |
| `2x2` | 4 | 4-pocket binder |
| `3x3` | 9 | Standard — system default |
| `3x4` | 12 | Portrait 12-pocket |
| `4x3` | 12 | Landscape 12-pocket |
| `4x4` | 16 | 16-pocket |

Custom dimensions outside the preset list are accepted as long as they satisfy the bounds (e.g. `5x5`, `6x4`). The frontend doesn't expose them by default — pass via the API directly if needed.

## Where it lives

| Concern | Module |
|---|---|
| Backend parser, validation | [`backend/src/card_tracker/layouts.py`](../backend/src/card_tracker/layouts.py) — `parse(s) → Layout`, raises `InvalidLayout` |
| Schema storage | `binder.layout TEXT` (no DB-level constraint; trusted to be parser-canonical) |
| CV detection | [`cv/grid.py::detect_slot_polygons(rows, cols)`](../backend/src/card_tracker/cv/grid.py) — splits bbox into `pw // cols × ph // rows` cells |
| Page padding | [`services/pages.py::get_page`](../backend/src/card_tracker/services/pages.py) — pads missing slots up to `layout.total` so the UI always has the binder's full grid |
| Frontend parser | [`frontend/src/lib/layout.ts::parseLayout(s)`](../frontend/src/lib/layout.ts) — same shape, safe `3x3` fallback |
| Frontend picker | [`components/LayoutPicker.tsx`](../frontend/src/components/LayoutPicker.tsx) |
| Frontend grids | `BinderCard`, `PolygonEditor`, `SlotThumbnails`, `PageDetail`, `BinderDetail`, `Scan` (CommittedStep) all read `dims` from `parseLayout(binder.layout)` |

## Validation

Both layers apply the same `[1, 6]` bound. Backend rejects anything outside with HTTP 422 + reason. Frontend's `parseLayout` returns `3x3` for malformed input rather than throwing — UI is never broken by bad data, even if it ever sneaks past the backend.

## Slot indexing

Row-major: `slot_index = row * cols + col`. Cells number `0` to `R*C - 1` left-to-right, top-to-bottom. The schema enforces `UNIQUE (page_id, slot_index)`.

## Constraints by layout (advisory)

- **1×1.** CV bbox detection still expects a binder-page silhouette. For raw single cards on a flat surface, the page detector may struggle; expect to drag the polygon manually.
- **4×4 and denser.** `MIN_CELL_FILL` (0.30) was tuned for 3×3 cell sizes. Smaller cells often fail it. See [detection.md](detection.md) for tuning notes.
