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
| `name`, `set_name`, `card_number`, `year`, `card_type`, `notes` | All NULL-able — manual entry for now. |
| `created_at`, `updated_at` | ISO 8601 UTC. |

A row is **"unenriched"** when `name IS NULL` — surfaced in the UI as "needs metadata".

### `binder` — physical binder

| Column | Notes |
|---|---|
| `id` | `binder-{12-hex}` |
| `name` | Free text, 1–200 chars. |
| `layout` | Canonical `RxC` (e.g. `3x3`, `2x2`, `4x4`). See [layouts.md](layouts.md). |

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
| `crop_image_path` | NULL when `review_status = 'empty'`. |
| `embedding`, `embedder_name`, `embedder_version` | NULL when empty; otherwise the placement's own embedding (so we can re-rank later). |
| `core_card_id` | NULL while pending; set on auto/user/new resolutions. |
| `similarity_score` | Top-1 sim at ingest time; informational. |
| `review_status` | One of `pending`, `auto_matched`, `user_confirmed`, `new_card`, `empty`. CHECK-constrained. |
| `deferred_at` | NULL = active; set when the user defers a pending item. |
| `(page_id, slot_index)` | UNIQUE. |

## Identity rules

- **Each placement keeps its embedding.** When a card is moved between binders, its placement is deleted; the CORE row is untouched. The embedding-on-placement also lets the review queue recompute top-N candidates without re-embedding.
- **The CORE row's `representative_crop_path`** is the placement crop that was first promoted to that core_card. It can be replaced manually later (not yet implemented).
- **Different embedder versions never compare.** [`services/match.py`](../backend/src/card_tracker/services/match.py) filters core_cards by `embedder_name + embedder_version`; mixed-model collections will produce empty candidate lists for placements embedded under a different model.

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
