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
| GET | `/api/binders` | — | `Binder[]` (each with `detector` + `detector_config`). |
| GET | `/api/binders/detectors` | — | Catalog of detectors available for binder creation: `[{id, label, description, fields:[{key, default, min, max}]}]`. Mirrors `frontend/src/lib/detectors.ts`. |
| POST | `/api/binders` | `{name, layout?, detector?, detector_config?}` | `Binder` (201). `detector` defaults to `'opencv-grid-v1'`; `detector_config` keys are validated against the chosen detector's schema. Invalid → 422. |
| GET | `/api/binders/{binder_id}` | — | `Binder` or 404. |
| GET | `/api/binders/{binder_id}/export-cards.pdf` | — | Row-style PDF of every card linked to this binder. 404 if binder missing. See [export.md](export.md). |
| GET | `/api/binders/{binder_id}/export-pages.pdf` | — | Full-grid PDF: one PDF page per binder page, RxC slots drawn with each card's crop. 404 if binder missing. |

## Pages

| Method | Path | Body / Query | Returns |
|---|---|---|---|
| GET | `/api/binders/{binder_id}/pages` | — | `[{id, page_number, captured_at}]`. 404 if binder missing. |
| GET | `/api/binders/{binder_id}/pages/{page_number}` | — | `Page` with `placements` padded to `layout.total`. |

## Cards

| Method | Path | Body / Query | Returns |
|---|---|---|---|
| GET | `/api/cards` | `?type=&needs_metadata=&q=` | `CoreCard[]` (full filtered list — pagination is client-side). |
| GET | `/api/cards/export.pdf` | — | Multi-page PDF of every CORE row, row-style. See [export.md](export.md). |
| GET | `/api/cards/{card_id}` | — | `CoreCard` or 404. |
| GET | `/api/cards/{card_id}/placements` | — | `Placement[]`. |
| PATCH | `/api/cards/{card_id}` | `{name?, set?, number?, year?, type?, notes?}` (extras forbidden) | Updated `CoreCard`. Manual partial edit — only fields present are touched. Empty/whitespace strings stored as NULL. Sets `metadata_source = 'manual'`, clears `metadata_confidence`. |
| DELETE | `/api/cards/{card_id}` | — | `{deleted: card_id}`. 400 if the card still has placements. |
| POST | `/api/cards/{source_id}/merge` | `{target_id}` | `{target: CoreCard, moved_placements}`. Repoints all placements of `source_id` to `target_id`, then deletes the source. 400 on self-merge or unknown id. |
| POST | `/api/cards/{card_id}/representative` | `{placement_id}` | Updated `CoreCard`. Sets `representative_crop_path` to that placement's crop. Validates the placement is linked to this card and has a crop. 400 on bad input. |
| POST | `/api/cards/{card_id}/enrich` | `{name?, set?, number?, year?, type?, notes?, confidence, source_url?}` | Apply a Claude-skill suggestion. **403 when enrichment is disabled** in Settings. Server-side guardrails (confidence range, type whitelist, drop `number` when confidence < 0.95). See [enrichment.md](enrichment.md). |

## Scans

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/api/scans/preview` | `multipart/form-data`: `image` (file), `binder_id?` (preferred — uses that binder's layout + detector + config), `layout?` (fallback when no `binder_id`) | `{scan_id, image_url, image_size, bbox, rows, cols, detector, slots}`. 422 if decode/detect fails. |
| POST | `/api/scans/commit` | `{scan_id, binder_id, page_number, slots: [{slot_index, polygon, disabled}]}` | `{scan_id, page_id, binder_id, page_number, crops, empty_slots, summary}`. 422 on conflict (page already exists) or invalid input. |

## Placements (management)

Per-placement actions for fixing mistakes (bad merge, wrong auto-match) or improving the crop.

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/placements/{placement_id}` | — | Full context: `polygon` (or null), `page` (source image url + dimensions + layout), `core_card` (currently linked), `candidates[]` (top-3 against current embedding). |
| POST | `/api/placements/{placement_id}/match` | `{core_card_id}` | Reassigns to a (possibly different) CORE card. Sets `review_status = 'user_confirmed'`. |
| POST | `/api/placements/{placement_id}/promote-new` | — | Creates a new CORE row from this placement. Sets `review_status = 'new_card'`. |
| POST | `/api/placements/{placement_id}/unmatch` | — | Clears link, sets `review_status = 'pending'`. Empty slots are rejected. |
| PUT | `/api/placements/{placement_id}/polygon` | `{polygon: [[x,y]×4]}` | Re-warps source through new polygon, re-embeds. Returns refreshed placement. Does NOT change `core_card_id` / `review_status`. |

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

## Enrichment

User-toggleable Claude Code metadata-enrichment skill. Full feature doc: [enrichment.md](enrichment.md).

| Method | Path | Body / Query | Returns |
|---|---|---|---|
| GET | `/api/enrich/settings` | — | `{enabled: bool, allowlist: string[]}`. |
| PUT | `/api/enrich/settings` | `{enabled?, allowlist?}` (extras forbidden) | Updated settings (partial merge). Persisted to `data/enrichment_settings.json`. |
| GET | `/api/enrich/next` | `?limit=N` (1–50, default 10) | `[{id, name, set, number, year, type, notes, representative_crop_url, metadata_confidence, metadata_source}]` — cards still missing `name`, oldest-first. **403 when `enabled=false`**. |
| GET | `/api/enrich/skill.md` | — | `text/plain` rendering of the project-scope Claude Code skill with the current allowlist baked in. The user drops it at `<project>/.claude/skills/enrich-cards.md`. |

## Static assets

| Path | Source |
|---|---|
| `/data/scans/<scan_id>.jpg` | Source page photos. |
| `/data/crops/<scan_id>/slot_<i>.jpg` | Warped per-card canonical crops. |
| `/data/models/...` | HF cache for DINOv2 weights (not browser-served as a feature, just consequence of the `/data` mount). |

## Type shapes

Every backend response field that the frontend consumes is mirrored in [`frontend/src/api/types.ts`](../frontend/src/api/types.ts). Look there for canonical shapes.
