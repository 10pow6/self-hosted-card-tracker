# Placement management

Tools for fixing mistakes after the fact: bad auto-matches, wrong queue resolutions, mis-clicked merges, drifted polygons. Surfaced both as per-row actions on the **Card detail** placements list and as a dedicated **Refine** view.

Backend lives in [`services/placements.py`](../backend/src/card_tracker/services/placements.py); endpoints in [`api/placements.py`](../backend/src/card_tracker/api/placements.py); see [api.md](api.md#placements-management) for the route table.

## Actions

| Action | What it does | API |
|---|---|---|
| **Move to a different card** | Reassigns the placement to (potentially) any other CORE row. Sets `review_status = 'user_confirmed'`, recomputes `similarity_score` against the new target's photos. | `POST /api/placements/{id}/match` `{core_card_id}` |
| **Promote to new card** | Creates a fresh CORE row from this placement (using its current embedding + crop) and links the placement to it. Sets `review_status = 'new_card'`. | `POST /api/placements/{id}/promote-new` |
| **Send to review queue** | Clears `core_card_id`, sets `review_status = 'pending'`. Useful when you realize the linked card is wrong but don't yet know what's right. | `POST /api/placements/{id}/unmatch` |
| **Refine polygon** | Drag corners over the original source page photo, save → backend re-warps the crop, re-embeds it, updates `polygon` / `crop_image_path` / `embedding`. **Match assignment is preserved** (you re-classify separately if you want). | `PUT /api/placements/{id}/polygon` `{polygon: [[x,y]×4]}` |

## Where to find the actions

- **CardDetail** → each placement row has a `…` menu: Refine, Move, Promote, Send to review.
- **PageDetail** → clicking a populated slot navigates to its **Refine** view (sidebar exposes the same actions).
- **PlacementRefine** route — `/placements/:id/refine`. Polygon editor on the left over the source page; sidebar with current match, action buttons, and a re-rankable top-3 candidate list.

## What "refine" does to the data

1. Reads `page.source_image_path` from disk (the resized scan, max 1500 long edge).
2. Calls `cv.grid._warp_card(img, new_quad)` → 480×672 BGR canonical crop.
3. Saves to the placement's existing `crop_image_path` (overwrites). URL stays stable.
4. RGB-converts and re-embeds via the active embedder.
5. Recomputes `similarity_score` against the linked CORE card's photos (max similarity over all of that card's confirmed placements; see [embeddings.md](embeddings.md)).
6. Single-transaction UPDATE of `polygon`, `crop_image_path`, `embedding`, `embedder_name`, `embedder_version`, `similarity_score`.

What it does NOT do:
- Change `core_card_id` or `review_status` — your match decision is preserved across refines.
- Touch other placements or core_cards.
- Re-run the page detector.

## Recovering from a bad merge

Merges are a one-way DB operation — the source CORE row is gone. But the placements that moved are still intact (now pointing at the wrong target). Recovery procedure:

1. Open the (incorrectly merged) target card in CardDetail.
2. Find the placement(s) that don't belong.
3. Use **Move to a different card** (if the right home exists) or **Promote to new card** (to spin them out as their own CORE row).

If the original source's CORE row had distinguishing metadata (name, set, etc.), that's lost — the merge deleted that row. Promoting back gives you a blank CORE row that you'll need to re-enrich. This is why merges are intentionally "irreversible by design" rather than offering Undo: keeping merge history adds DB complexity without solving the metadata-loss problem.
