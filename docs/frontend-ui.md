# Frontend UI architecture

The 2026-08 ground-up redesign. Visual rules live in [`DESIGN.md`](DESIGN.md) (dark-first "Archive Dark" system); this doc covers structure and conventions.

## Information architecture

| Nav item | Route | Meaning |
|---|---|---|
| Home | `/` | Dashboard: stats (all clickable), quick actions, activity, automation guardrails. First-run onboarding when empty. |
| Scan | `/scan` | 4-step wizard: pick binder → capture → adjust boxes → committed. |
| **Binders** | `/binders` | The *physical* collection. Tabs: Binders, Physical cards (placements table). |
| **Catalog** | `/cards` | The *canonical* card database (formerly "Cards"; renamed to kill the Collection/Cards ambiguity). |
| Review | `/review` | Human-in-the-loop queue; nav badge shows pending count. |

Routes are unchanged from before the redesign — only labels and content moved.

## Code layout

- `src/routes/*` — thin route components (orchestration only).
- `src/features/<area>/*` — feature-specific components (`scan/`, `review/`, `binders/`, `catalog/`, `refine/`, `home/`, `settings/`).
- `src/components/*` — shared app components: `Page` (owns gutters/width — screens never set their own), `PageHeader`, `CardThumb`, `CardSearchList` (the single card-search list used by picker/move/merge), `CreateBinderDialog`, `ConfirmDialog`, `ErrorState`, `EmptyState`, `ExportButton`, `Pagination`.
- `src/components/ui/*` — shadcn-style primitives (Radix via the `radix-ui` package). Includes select, switch, checkbox, textarea, alert-dialog, progress, table, kbd — never use OS-native controls or hand-rolled toggles.
- `src/components/decisions/*` + `src/lib/decisions.ts` — the decision-provenance system (below).
- `src/api/*` — one module per endpoint group; `client.ts` has `apiGet`/`apiSend`/`getErrorMessage`; exports go through `exportsApi.ts`.
- `src/hooks/usePendingReview.ts` — shared pending-review count store; call `refreshPendingReview()` after any mutation that changes the queue.

## Decision provenance (AI-centric UX)

Every AI-derived value carries its provenance. Single source: `src/lib/decisions.ts`.

- **Colors**: violet `--ai` = model decided · green `--success` = human decided · amber `--warning` = awaiting human · blue `--info` = system event. Violet is *reserved* for model output.
- `StatusBadge` — review-status chip; tooltip states who decided.
- `ConfidenceChip` — `92% · strong`; bands strong ≥ 90% / plausible 75–89% / weak < 75%; tooltip explains similarity is advisory.
- `ProvenanceBadge` — metadata source (Edited by you / AI-enriched + confidence / Needs info).
- Slot borders, legends, and table statuses all derive from `REVIEW_STATUS_META` / `TONE_CLASSES` — never hardcode status colors.

## Conventions

- Every fetch has a `.catch` → `ErrorState` with retry (no permanent skeletons); every mutation toasts via `sonner` + `getErrorMessage`.
- Destructive/irreversible actions go through `ConfirmDialog` (AlertDialog) with the consequence stated in one sentence — never `window.confirm`/`alert`.
- Dark-only theme; tokens single-sourced in `index.css` `:root`. Numbers use `tabular-nums`; micro-labels use the `microlabel` utility.
- URL params are namespaced per tab (e.g. `/binders`: `bq` vs `pq`/`pstatus`/`ppage`; legacy `?tab=cards` still resolves).
- Keep files under ~300 lines; split into the feature folder.
