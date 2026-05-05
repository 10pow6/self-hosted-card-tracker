# Review queue

Where placements with ambiguous matches go for a human yes/no.

## Placement states

`placement.review_status` (CHECK-constrained):

| State | Meaning | `core_card_id` | `crop`/`embedding` |
|---|---|---|---|
| `pending` | Top similarity below `match_threshold`. Awaits review. | NULL | set |
| `auto_matched` | Top similarity ≥ `match_threshold` at ingest time. Linked automatically. | set | set |
| `user_confirmed` | User picked a candidate from the queue. | set | set |
| `new_card` | Either: (a) bootstrap — CORE was empty when this placement landed, OR (b) user promoted from queue via **Add as new card**. A new `core_card` row was created from this placement. | set | set |
| `empty` | User marked the slot deliberately empty before commit. | NULL | NULL |

**Note on `new_card`**: similarity alone never creates new CORE rows after the first scan. Anything below the auto-match threshold goes to the queue. If the user finds out later that a queue resolution created a duplicate (via clicking "Add as new card" on what was actually a known card), see [data-model.md → Merging duplicates](data-model.md#merging-duplicates).

`deferred_at` is orthogonal: NULL = active, ISO timestamp = deferred. Only `pending` placements can be deferred.

## Frontend tabs

[`frontend/src/routes/Review.tsx`](../frontend/src/routes/Review.tsx) splits the queue:

- **Active** — `review_status = 'pending' AND deferred_at IS NULL`.
- **Deferred** — `review_status = 'pending' AND deferred_at IS NOT NULL`.

URL `?tab=active|deferred&page=N` keeps both tabs page-scoped. Switching tabs resets `page` to 1.

## Top-N candidates

Computed **on the fly per visit** by `services/review.py::list_queue`:

```python
embedding = np.frombuffer(placement.embedding, dtype=np.float32)
candidates = match.find_candidates(
    conn, embedding, top_k=3,
    embedder_name=placement.embedder_name,
    embedder_version=placement.embedder_version,
)
```

Why on the fly: as users add new CORE rows over time, the candidate list for an existing pending placement should improve. Persisted candidates would go stale.

## Resolutions

Each pending placement has three terminal actions plus defer:

| Action | API | Effect |
|---|---|---|
| Confirm match | `POST /api/review/{id}/match` `{core_card_id}` | Sets `core_card_id`, `review_status = 'user_confirmed'`, `resolved_at = now()`, clears `deferred_at`. |
| Add as new card | `POST /api/review/{id}/new` | Inserts a new `core_card` row from the placement's crop+embedding, links the placement, `review_status = 'new_card'`. |
| Defer | `POST /api/review/{id}/defer` | Sets `deferred_at = now()`. Item moves from Active → Deferred tab. Still `pending`. |
| Un-defer | `POST /api/review/{id}/undefer` | Clears `deferred_at`. |

## Keyboard shortcuts

Active on the **first item of the current page** of the current tab:

| Key | Action |
|---|---|
| `1` `2` `3` | Pick candidate by rank (1 = top). |
| `y` | Confirm match (uses currently-selected candidate; defaults to top-1). |
| `+` or `=` | Add as new card. |
| `d` | Defer (on Active tab) / un-defer (on Deferred tab). |

Shortcuts ignore keystrokes inside `<input>` / `<textarea>`.

## Pagination behavior

5 items per page. Confirming or new-promoting an item shrinks the queue; if it leaves the current page empty, pagination clamps to the last valid page automatically.
