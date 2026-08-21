# Data model

Schema is defined in [`backend/src/card_tracker/db/schema.sql`](../backend/src/card_tracker/db/schema.sql). Re-create the DB by deleting `data/card_tracker.db` and running `python scripts/init_db.py`.

## Entities

### `core_card` — canonical card identity

The "CORE" table. One row per distinct printed card across the entire collection. Type-agnostic — Pokémon, sports, MTG, etc. live together.

| Column | Notes |
|---|---|
| `id` | `core-{12-hex}` |
| `embedder_name`, `embedder_version` | Pinned per row so we never compare embeddings produced by different models. |
| `embedding` | `BLOB` — float32 bytes, L2-normalized, length = `dim` of the embedder. |
| `representative_crop_path` | DB-relative path (e.g. `crops/<scan>/slot_3.jpg`). |
| `name`, `set_name`, `card_number`, `year`, `card_type`, `notes` | All NULL-able. Filled in via the Edit dialog or the Claude-skill enricher — see [enrichment.md](enrichment.md). |
| `metadata_confidence` | `REAL` in `[0, 1]`, or NULL. Set when metadata came from the Claude skill; cleared when the user manually edits. |
| `metadata_source` | `'manual'` or `'claude-skill'`. NULL = never enriched. |
| `created_at`, `updated_at` | ISO 8601 UTC. |

A row is **"unenriched"** when `name IS NULL` — surfaced in the UI as "needs metadata" and used as the queue source by `GET /api/enrich/next`.

### `binder` — physical binder

| Column | Notes |
|---|---|
| `id` | `binder-{12-hex}` |
| `name` | Free text, 1–200 chars. |
| `layout` | Canonical `RxC` (e.g. `3x3`, `2x2`, `4x4`). See [layouts.md](layouts.md). |
| `detector` | Detector id this binder uses for `/scans/preview`, e.g. `'opencv-grid-v1'`. See [detection.md](detection.md). |
| `detector_config` | JSON; schema depends on `detector`. Subset of the detector's fields; missing keys fall back to that detector's defaults. |

`name`, `detector`, and `detector_config` are editable after creation via `PATCH /api/binders/{id}` (detector changes apply to future scans). `layout` is immutable — pages were committed against it. `DELETE /api/binders/{id}` cascades to pages and placements; catalog entries survive.

### `app_setting` — runtime-adjustable settings

| Column | Notes |
|---|---|
| `key` | Setting name, e.g. `match_threshold`. |
| `value` | JSON-encoded value. |
| `updated_at` | ISO timestamp. |

Read through `services.app_settings`, which layers defaults from `config.py` and caches in-process. Currently holds the auto-accept `match_threshold` (Settings → Automation).

### `page` — one photographed page within a binder

| Column | Notes |
|---|---|
| `id` | `page-{12-hex}` |
| `binder_id` | FK → `binder.id` (CASCADE). |
| `page_number` | 1-indexed within the binder. |
| `source_image_path` | DB-relative; the JPEG that was scanned. |
| `(binder_id, page_number)` | UNIQUE. Re-scanning a page rejects with 422. |

### `placement` — one card slot on a page

The most-touched table. One row per slot in the binder's grid (including deliberately empty slots).

| Column | Notes |
|---|---|
| `id` | `pl-{12-hex}` |
| `page_id` | FK → `page.id` (CASCADE). |
| `slot_index` | `0 .. layout.total - 1`, row-major. |
| `polygon` | JSON-encoded `[[x,y], [x,y], [x,y], [x,y]]` in source-image px (resized scan, max 1500 long edge). NULL only for `empty` placements. |
| `crop_image_path` | NULL when `review_status = 'empty'`. |
| `embedding`, `embedder_name`, `embedder_version` | NULL when empty; otherwise the placement's own embedding (so we can re-rank later). |
| `core_card_id` | NULL while pending; set on auto/user/new resolutions. |
| `similarity_score` | Top-1 sim against the linked card; updated by reassign and refine actions. |
| `review_status` | One of `pending`, `auto_matched`, `user_confirmed`, `new_card`, `empty`. CHECK-constrained. |
| `deferred_at` | NULL = active; set when the user defers a pending item. |
| `resolved_at` | Set when a review action resolves the placement (confirm / new card); NULL otherwise. |
| `(page_id, slot_index)` | UNIQUE. |

The polygon is what the refine UI starts from; saving a refinement re-warps the source image through the new polygon, re-embeds the resulting crop, and updates `polygon`, `crop_image_path`, `embedding`. The placement's `core_card_id` and `review_status` are NOT touched by refine — that's a separate user decision via reassign / promote-new / unmatch.

## Identity rules

- **Each placement keeps its embedding.** When a card is moved between binders, its placement is deleted; the CORE row is untouched. The embedding-on-placement also lets the review queue recompute top-N candidates without re-embedding.
- **The CORE row's `representative_crop_path`** starts as the placement crop that seeded the card (the first photo). The user can promote any other linked placement's crop to be the source via **Set as source image** in the CardDetail placement-row menu (or `POST /api/cards/{id}/representative`). Useful when the seed photo is poor and a later scan yielded a better one.
- **Different embedder versions never compare.** [`services/match.py`](../backend/src/card_tracker/services/match.py) filters core_cards by `embedder_name + embedder_version`; mixed-model collections will produce empty candidate lists for placements embedded under a different model.
- **CORE rows are only created two ways:** (a) bootstrap when the table is empty during ingest, or (b) explicit user action via **Add as new card** in the review queue. Similarity-alone auto-creation was removed because it produced silent dupes.

## Merging duplicates

If two `core_card` rows turn out to represent the same physical card identity, merge them with `POST /api/cards/{source_id}/merge` (body: `{target_id}`). The endpoint runs in one transaction:

1. `UPDATE placement SET core_card_id = <target> WHERE core_card_id = <source>` — every placement that pointed at the source now points at the target.
2. `DELETE FROM core_card WHERE id = <source>` — the source row is removed.

Crop files on disk are **not** touched: each placement still owns its own `crop_image_path`, and the target CORE keeps whatever `representative_crop_path` it had. Only the source's CORE row goes away.

### UI flow — `/cards/merge`

Merging is a **catalog-level** operation, not a per-card-detail action. The dedicated route `/cards/merge` is the only UI surface for it. Reach it from the **Merge duplicates** button in the Catalog (`/cards`) page header, or directly via URL with optional `?target=<id>` pre-selection.

The page opens with a **Likely duplicates** section: model-proposed pairs from `GET /api/cards/duplicates` (embedding cosine ≥ 0.9), each with a confidence chip, a suggested keeper (more placements → named → older), a one-click **Stage merge**, and a dismiss. Suggestions are advisory — nothing merges without staging + the confirm dialog.

Below it, the manual two-pane pickers (side-by-side on desktop, stacked on mobile) — both search the **whole catalog**; they are pickers, not duplicate reports:

- **Keeper pane (left)** — single selection. Search + list. Big preview + placement count when set, with a clear button.
- **Duplicates pane (right)** — multi-select, revealed only after a keeper is chosen (progressive disclosure — prevents the two identical pre-selection lists that read as "duplicates found"). Selected cards shown as a tile grid above the search list (click a tile to remove). The current keeper is excluded from the source list.
- **Footer** — selection summary plus a confirm button labeled `Merge N into <target>`. Confirms run sequentially with a progress indicator; navigates to the target's CardDetail on success.

After a merge, future similarity searches benefit because the target now has more confirmed photos contributing to its match score (see [embeddings.md](embeddings.md)).

## Diagram

```
                     ┌──────────┐
                     │  binder  │
                     └────┬─────┘
                          │ 1
                          │ N
                     ┌────▼─────┐
                     │   page   │
                     └────┬─────┘
                          │ 1
                          │ N
       ┌────────────┐ ┌───▼────────┐
       │ core_card  │◄┤ placement  │
       └────────────┘0│   N        │
                  N  └────────────┘
```

A placement has 0 or 1 `core_card`. A core_card has 0…N placements (the same canonical card can appear in many physical pockets across many binders).
