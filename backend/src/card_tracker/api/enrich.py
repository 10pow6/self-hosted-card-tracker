from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field

from card_tracker.services import enrich as enrich_svc

router = APIRouter(prefix="/enrich", tags=["enrich"])


@router.get("/settings")
def get_settings() -> dict:
    return enrich_svc.get_settings()


class UpdateSettings(BaseModel):
    enabled: Optional[bool] = None
    allowlist: Optional[list[str]] = None
    model_config = {"extra": "forbid"}


@router.put("/settings")
def update_settings(payload: UpdateSettings) -> dict:
    return enrich_svc.update_settings(
        enabled=payload.enabled, allowlist=payload.allowlist
    )


@router.get("/next")
def next_batch(limit: int = Query(default=10, ge=1, le=50)) -> list[dict]:
    """Return up to `limit` cards needing metadata. 403 when disabled —
    so a downloaded skill can't run unless the user has flipped the toggle.
    """
    cfg = enrich_svc.get_settings()
    if not cfg["enabled"]:
        raise HTTPException(
            status_code=403,
            detail="Enrichment is disabled. Enable it in Settings → Metadata enrichment.",
        )
    return enrich_svc.list_cards_needing_metadata(limit)


@router.get("/skill.md", response_class=PlainTextResponse)
def download_skill() -> str:
    """Render the project-scope Claude Code skill with the current allowlist
    baked in. The user drops the file at `<project>/.claude/skills/enrich-cards.md`.
    """
    return enrich_svc.render_skill_markdown()
