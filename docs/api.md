# HTTP API reference

Mounted at `/api` by [`backend/src/card_tracker/main.py`](../backend/src/card_tracker/main.py). Static assets (page photos and crops) served at `/data/...`.

All bodies are JSON unless noted. All `*_at` timestamps are ISO 8601 UTC (`YYYY-MM-DDTHH:MM:SS.fffZ`).

## Health

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | Returns `{"status":"ok"}`. Useful for proxy diagnostics. |

## Binders

| Method | Path | Body / Query | Returns |
|---|---|---|---|
| GET | `/api/binders` | — | `Binder[]` |
| POST | `/api/binders` | `{name, layout?}` | `Binder` (201). Layout validated; invalid → 422. |
| GET | `/api/binders/{binder_id}` | — | `Binder` or 404. |

## Pages

| Method | Path | Body / Query | Returns |
|---|---|---|---|
| GET | `/api/binders/{binder_id}/pages` | — | `[{id, page_number, captured_at}]`. 404 if binder missing. |
| GET | `/api/binders/{binder_id}/pages/{page_number}` | — | `Page` with `placements` padded to `layout.total`. |

## Cards

| Method | Path | Body / Query | Returns |
|---|---|---|---|
| GET | `/api/cards` | `?type=&needs_metadata=&q=` | `CoreCard[]` (full filtered list — pagination is client-side). |
| GET | `/api/cards/{card_id}` | — | `CoreCard` or 404. |
| GET | `/api/cards/{card_id}/placements` | — | `Placement[]`. |

## Scans

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/api/scans/preview` | `multipart/form-data`: `image` (file), `layout?` (string) | `{scan_id, image_url, image_size, bbox, rows, cols, slots}`. 422 if decode/detect fails. |
| POST | `/api/scans/commit` | `{scan_id, binder_id, page_number, slots: [{slot_index, polygon, disabled}]}` | `{scan_id, page_id, binder_id, page_number, crops, empty_slots, summary}`. 422 on conflict (page already exists) or invalid input. |

## Review

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/review/queue` | — | `ReviewQueueItem[]` (mixed pending + deferred; client filters). |
| POST | `/api/review/{placement_id}/match` | `{core_card_id}` | `{placement_id, status: 'user_confirmed'}`. |
| POST | `/api/review/{placement_id}/new` | — | `{placement_id, core_card_id, status: 'new_card'}`. |
| POST | `/api/review/{placement_id}/defer` | — | `{placement_id, deferred: true}`. |
| POST | `/api/review/{placement_id}/undefer` | — | `{placement_id, deferred: false}`. |

## Dashboard

| Method | Path | Body / Query | Returns |
|---|---|---|---|
| GET | `/api/dashboard/stats` | — | `{binders, pages, core_cards, pending_review}`. |
| GET | `/api/dashboard/activity` | `?limit=10` (1–50) | `ActivityItem[]` — merged scans / confirmations / new cards / new binders, sorted desc. |

## Settings

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/settings/model-slots` | — | `ModelSlot[]` — detection / embeddings / metadata catalogs. Active option pinned by `config.py`. |
| POST | `/api/settings/model-slots/{slot_id}/active` | `{option_id}` | **501** — runtime swapping not supported in v1. Edit `config.py` and restart instead. |

## Static assets

| Path | Source |
|---|---|
| `/data/scans/<scan_id>.jpg` | Source page photos. |
| `/data/crops/<scan_id>/slot_<i>.jpg` | Warped per-card canonical crops. |
| `/data/models/...` | HF cache for DINOv2 weights (not browser-served as a feature, just consequence of the `/data` mount). |

## Type shapes

Every backend response field that the frontend consumes is mirrored in [`frontend/src/api/types.ts`](../frontend/src/api/types.ts). Look there for canonical shapes.
