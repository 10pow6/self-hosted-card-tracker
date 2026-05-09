# Metadata enrichment (Claude Code skill)

Every CORE row has six user-facing metadata fields — `name`, `set_name`, `card_number`, `year`, `card_type`, `notes` — plus two provenance columns: `metadata_confidence` (0–1 float) and `metadata_source` (`'manual'` or `'claude-skill'`, NULL = never enriched). Manual edits set source to `'manual'` and clear confidence.

Two ways to fill those fields in:

1. **Edit by hand** — the **Edit** button on Card detail opens a dialog. PATCH `/api/cards/{card_id}` writes whatever fields you submitted; empty/whitespace strings are stored as NULL. Marks `metadata_source = 'manual'`, clears `metadata_confidence`.
2. **Run the bundled Claude Code skill** — opt-in, local, allowlist-gated. The rest of this doc is about that path.

## Why a skill instead of a server-side enricher

The backend never reaches the public internet on its own. Card identification is a vision + web-search task that maps cleanly onto Claude Code's capabilities — and pushing it client-side means **the user runs it under their own quota, with their own domain allowlist, on their own hardware**. The backend stays offline; the user gets an upgrade path that doesn't require us to broker a paid third-party API.

## End-to-end flow

```
Settings UI                       Backend                       Claude Code (user)
───────────                       ───────                       ──────────────────
[ ] Enabled  ──── PUT /enrich/settings ──▶  data/enrichment_settings.json
[allowlist]
[Download skill] ── GET /enrich/skill.md ──▶  enrich-cards.md  ──▶  .claude/skills/enrich-cards.md
                                                                                │
                                                                       (user runs `claude`)
                                                                                │
                                                                                ▼
                                          ◀── GET /enrich/next?limit=N ─── /enrich-cards
                                                                                │
                                                                  (per card: identify visually,
                                                                   optionally web-search an
                                                                   allowlisted domain)
                                                                                │
                                          ◀── POST /cards/{id}/enrich ─────────┘
                                                                                │
core_card.{name, set_name, …, metadata_confidence,
            metadata_source = 'claude-skill'} ◀──── one transaction
```

The skill content (markdown) is rendered server-side from a template in [`services/enrich.py`](../backend/src/card_tracker/services/enrich.py) with the user's allowlist baked into the file at download time. Editing the allowlist invalidates the downloaded copy — re-download to pick up the change.

## Settings — `data/enrichment_settings.json`

Persisted runtime state, separate from `config.py` (which is for code-level pins).

```json
{
  "enabled": false,
  "allowlist": ["tcdb.com", "beckett.com", "wikipedia.org", "..."]
}
```

Reads/writes via `GET/PUT /api/enrich/settings`. The default allowlist (loaded when the file doesn't exist) is in `enrich.DEFAULT_ALLOWLIST`. Domains are stored normalized (`strip().lower()`).

## Endpoints

See [api.md](api.md#enrichment) for the full route table. The five relevant ones:

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/enrich/settings` | Current `{enabled, allowlist}`. |
| PUT | `/api/enrich/settings` | Partial update. Body: `{enabled?, allowlist?}`. |
| GET | `/api/enrich/next?limit=N` | Up to N cards still missing `name`, oldest-first. **403 when `enabled=false`** so a stray skill copy can't run. |
| GET | `/api/enrich/skill.md` | Renders the skill markdown with the current allowlist baked in. |
| POST | `/api/cards/{card_id}/enrich` | Apply a suggestion. **403 when disabled.** Body shape below. |

### `POST /api/cards/{card_id}/enrich` payload

```json
{
  "name": "Metapod",
  "set": "Base Set",
  "number": "54",            // optional — only set when readable + corroborated
  "year": 1999,
  "type": "pokemon",         // pokemon | sports | other
  "notes": "Stage 1 (Caterpie) · 70 HP · Stiffen / Stun Spore 20",
  "confidence": 0.92,        // required, 0–1
  "source_url": "https://bulbapedia.bulbagarden.net/..."
}
```

## Server-side guardrails

Implemented in `services/enrich.apply_enrichment`:

- **`confidence` is required** and must be a float in `[0, 1]`. 400 otherwise.
- **`type` must be one of** `pokemon`, `sports`, `other` (or absent). 400 otherwise.
- **`year` must be an integer** (or coerced from a numeric string). 400 if neither.
- **`card_number` is silently dropped when `confidence < 0.95`** even if the skill submitted it. Defense in depth — the skill is told the same rule, but the server enforces it anyway. The threshold is `enrich.NUMBER_CONFIDENCE_THRESHOLD`.
- **All string fields are trimmed**; empty strings become NULL.
- The full update runs in one transaction along with `metadata_confidence`, `metadata_source = 'claude-skill'`, `updated_at`. Unknown card → 400.

## How the skill is rendered

`render_skill_markdown()` in `services/enrich.py` returns a literal markdown file with frontmatter:

```
---
name: enrich-cards
description: Use this skill to enrich Card Tracker CORE rows that are missing metadata...
---
```

The body lays out the workflow (fetch a batch → identify each card → score confidence → POST), the `Hard rules` section that mirrors the server-side guardrails (so the skill agrees with the server before submitting), and the allowlist baked in as a literal bullet list.

The skill is project-scoped: the user saves it as `<project>/.claude/skills/enrich-cards.md` and invokes it with `/enrich-cards` from `claude` running in that directory.

## User flow (UI side)

1. **Settings → "Claude Code enrichment skill"** — flip the toggle on.
2. Edit the allowlist textarea if needed; click **Save allowlist**.
3. Click **Download enrich-cards.md**.
4. Drop the file at `.claude/skills/enrich-cards.md` inside any Claude Code project directory.
5. Run `claude` in that directory and type `/enrich-cards` (or "enrich my cards, limit 10").

The backend must be reachable at `http://localhost:8000` — that origin is hardcoded in the rendered skill. If you run uvicorn elsewhere, edit the file before saving it.

## Failure modes

| Symptom | Cause |
|---|---|
| `403 Enrichment is disabled` from `/enrich/next` or `/cards/{id}/enrich` | Toggle is off in Settings. |
| Skill never picks up new allowlist domain | Re-download the skill file — the allowlist is baked in at download time. |
| `card_number` keeps coming back NULL even though the skill submitted it | The server enforces `confidence ≥ 0.95` for the `number` field. Either the skill's overall confidence was lower, or the user manually downgraded it. |
| Manual edit replaced an AI-enriched card | Expected. PATCH from the Edit dialog sets `metadata_source = 'manual'` and clears `metadata_confidence`; the AI badge in the UI goes away. |

## Why per-batch instead of streaming

`/enrich/next?limit=N` returns the whole batch in one shot and the skill walks it locally. Simpler than streaming, and the natural unit of user control is "do up to N then stop".
