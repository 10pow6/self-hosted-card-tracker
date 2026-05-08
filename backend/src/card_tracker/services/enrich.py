"""Enrichment settings + Claude Code skill rendering.

Two responsibilities:
  - Persist runtime-mutable enrichment settings (enabled flag + allowlist) in
    a small JSON file under data_dir. Config.py is for code-level pins; this is
    for things the user toggles in the UI.
  - Render the project-scope Claude Code skill markdown with the user's
    allowlist baked in. The skill is downloaded by the user and dropped into
    `<project>/.claude/skills/enrich-cards.md` to enable the flow.
"""
from __future__ import annotations

import json
from contextlib import closing
from typing import Optional

from card_tracker.config import settings
from card_tracker.db.engine import connect, transaction
from card_tracker.services.paths import to_url

SETTINGS_FILE = settings.data_dir / "enrichment_settings.json"

DEFAULT_ALLOWLIST = [
    "tcdb.com",
    "beckett.com",
    "comc.com",
    "psacard.com",
    "bulbapedia.bulbagarden.net",
    "pokellector.com",
    "pkmncards.com",
    "wikipedia.org",
]

NUMBER_CONFIDENCE_THRESHOLD = 0.95


def _load() -> dict:
    if not SETTINGS_FILE.exists():
        return {"enabled": False, "allowlist": list(DEFAULT_ALLOWLIST)}
    try:
        data = json.loads(SETTINGS_FILE.read_text())
    except (OSError, json.JSONDecodeError):
        return {"enabled": False, "allowlist": list(DEFAULT_ALLOWLIST)}
    enabled = bool(data.get("enabled", False))
    allowlist = data.get("allowlist") or list(DEFAULT_ALLOWLIST)
    if not isinstance(allowlist, list):
        allowlist = list(DEFAULT_ALLOWLIST)
    cleaned = [str(d).strip().lower() for d in allowlist if str(d).strip()]
    return {"enabled": enabled, "allowlist": cleaned}


def get_settings() -> dict:
    return _load()


def update_settings(*, enabled: Optional[bool] = None, allowlist: Optional[list[str]] = None) -> dict:
    current = _load()
    if enabled is not None:
        current["enabled"] = bool(enabled)
    if allowlist is not None:
        current["allowlist"] = [d.strip().lower() for d in allowlist if d and d.strip()]
    SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
    SETTINGS_FILE.write_text(json.dumps(current, indent=2))
    return current


def list_cards_needing_metadata(limit: int) -> list[dict]:
    """Cards still missing a name (the cheapest 'needs metadata' signal),
    ordered oldest-first so the skill works through them deterministically.
    Includes the representative crop URL so Claude can view the image.
    """
    sql = """
    SELECT id, name, set_name, card_number, year, card_type, notes,
           representative_crop_path, metadata_confidence, metadata_source
    FROM core_card
    WHERE name IS NULL OR TRIM(name) = ''
    ORDER BY datetime(created_at) ASC
    LIMIT ?
    """
    with closing(connect()) as conn:
        rows = conn.execute(sql, (limit,)).fetchall()
    return [
        {
            "id": r["id"],
            "name": r["name"],
            "set": r["set_name"],
            "number": r["card_number"],
            "year": r["year"],
            "type": r["card_type"],
            "notes": r["notes"],
            "representative_crop_url": to_url(r["representative_crop_path"]) or "",
            "metadata_confidence": r["metadata_confidence"],
            "metadata_source": r["metadata_source"],
        }
        for r in rows
    ]


_VALID_TYPES = {"pokemon", "sports", "other"}


class EnrichmentError(ValueError):
    pass


def apply_enrichment(card_id: str, payload: dict) -> dict:
    """Apply a Claude-Skill-produced suggestion. Server-side guardrails:
      - confidence required, 0–1.
      - card_number is dropped if confidence < NUMBER_CONFIDENCE_THRESHOLD
        (defense-in-depth — even if the skill ignored its own rule).
      - type must be in {pokemon, sports, other} if present.
    Returns the refreshed card dict.
    """
    confidence = payload.get("confidence")
    if not isinstance(confidence, (int, float)) or not (0.0 <= float(confidence) <= 1.0):
        raise EnrichmentError("confidence is required and must be a float in [0, 1].")
    confidence = float(confidence)

    name = _clean_str(payload.get("name"))
    set_name = _clean_str(payload.get("set"))
    number = _clean_str(payload.get("number"))
    year = payload.get("year")
    card_type = _clean_str(payload.get("type"))
    notes = _clean_str(payload.get("notes"))

    if year is not None and not isinstance(year, int):
        try:
            year = int(year)
        except (TypeError, ValueError):
            raise EnrichmentError(f"year must be an integer; got {year!r}")
    if card_type is not None and card_type not in _VALID_TYPES:
        raise EnrichmentError(f"type must be one of {sorted(_VALID_TYPES)}; got {card_type!r}")
    if number is not None and confidence < NUMBER_CONFIDENCE_THRESHOLD:
        # Server guard. The skill is told the same rule, but enforce here too.
        number = None

    fields: dict[str, object] = {
        "name": name,
        "set_name": set_name,
        "card_number": number,
        "year": year,
        "card_type": card_type,
        "notes": notes,
        "metadata_confidence": confidence,
        "metadata_source": "claude-skill",
    }

    set_clauses = [f"{k} = ?" for k in fields]
    set_clauses.append("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')")
    params = list(fields.values()) + [card_id]

    with transaction() as conn:
        cur = conn.execute(
            f"UPDATE core_card SET {', '.join(set_clauses)} WHERE id = ?",
            params,
        )
        if cur.rowcount == 0:
            raise EnrichmentError(f"Unknown card: {card_id}")

    # Avoid a circular import; cards_svc imports nothing from enrich.
    from card_tracker.services import cards as cards_svc

    refreshed = cards_svc.get_card(card_id)
    if refreshed is None:
        raise EnrichmentError(f"Card vanished after enrichment: {card_id}")
    return refreshed


def _clean_str(v: object) -> Optional[str]:
    if v is None:
        return None
    if not isinstance(v, str):
        return None
    s = v.strip()
    return s or None


def render_skill_markdown() -> str:
    """Render the Claude Code skill with the current allowlist baked in."""
    cfg = _load()
    allowlist_lines = "\n".join(f"  - {d}" for d in cfg["allowlist"]) or "  (none configured)"
    threshold_pct = int(NUMBER_CONFIDENCE_THRESHOLD * 100)
    return f"""---
name: enrich-cards
description: Use this skill to enrich Card Tracker CORE rows that are missing metadata. Pulls a batch of cards from the local FastAPI backend, identifies each from its representative crop image, optionally web-searches an allowlisted source to confirm details, and posts the suggestion back. The user controls the enable toggle and allowlist in Settings.
---

# enrich-cards

Enrich Card Tracker CORE rows whose metadata is missing or thin. The backend
is at http://localhost:8000 (or wherever the user is running uvicorn). The
skill works through cards one at a time and stops when the queue is empty or
the user interrupts.

## Workflow

1. **Fetch a batch.**
   `GET /api/enrich/next?limit=N` (default N=10). If the response is `403`,
   tell the user enrichment is disabled in Settings and stop.

2. **For each card:**
   - The response's `representative_crop_url` is a relative path (e.g.
     `/data/crops/...?v=123`). Prefix it with the same backend origin you used
     for the API call (default `http://localhost:8000`) before fetching the image.
   - Identify the card visually: name, set, year, card type, any visible
     card number, and notable details (team, sport for sports cards;
     evolution / HP / energy type for Pokémon).
   - If you need confirmation, use WebSearch — but **only on these domains**:
{allowlist_lines}
     Never fetch URLs outside this allowlist. If the user's collection has
     cards from sources not on the list, mention it and skip the web step
     for that card.

3. **Score your confidence** in the *whole extraction* on a 0–1 scale:
     - `0.95–1.0`: card is unambiguously identified, all returned fields
       are confirmed against image + (optionally) an allowlisted source.
     - `0.75–0.94`: card identity is clear; one or two fields are inferred.
     - `0.50–0.74`: best guess; user should verify.
     - `< 0.50`: do not submit. Skip the card.

4. **POST the suggestion**:
   `POST /api/cards/{{card_id}}/enrich`
   ```json
   {{
     "name": "...",
     "set": "...",
     "number": "...",   // see rules below
     "year": 1989,
     "type": "pokemon" | "sports" | "other",
     "notes": "...",
     "confidence": 0.92,
     "source_url": "https://allowlisted-site.example/page"
   }}
   ```

## Hard rules

- **Always set when known**: `name`, `set`, `year`, `type`, `notes`.
- **Only set `number`** when:
    a. The card number is *visibly readable on the image*, AND
    b. It is corroborated by an allowlisted source, AND
    c. Your overall confidence is ≥ {threshold_pct}%.
  The server enforces (c) — it will silently drop `number` if confidence is
  below threshold. So omit it rather than guess.
- **Never invent.** If a field is not derivable from the image or an allowed
  source, omit it (use null or leave it out of the JSON).
- **Stop on first failure** — if the backend returns a 4xx that isn't a 404
  for a deleted card, surface the error and stop.

## Notes formatting

`notes` is freeform; keep it dense but useful. Examples:
  - Sports: `Houston Astros · Baseball · Raw`
  - Pokémon: `Holo Rare · Base Set Shadowless · 120 HP · Fire`

## Type mapping

- `pokemon` — Pokémon TCG
- `sports` — any sports trading card (baseball, basketball, football, hockey, soccer, MMA, etc.)
- `other` — everything else (Magic, Yu-Gi-Oh, non-sports, novelty)

## Stopping condition

Stop when `/api/enrich/next` returns `[]`, or when the user says stop, or
after N successful enrichments where N is the user's argument (default: 10).
"""
