from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from card_tracker.services import app_settings, settings_svc

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/matching")
def get_matching_settings() -> dict:
    """The live matching guardrail: auto-accept threshold + model identity."""
    return app_settings.get_matching_settings()


class MatchingUpdate(BaseModel):
    match_threshold: float = Field(
        ge=app_settings.MATCH_THRESHOLD_MIN, le=app_settings.MATCH_THRESHOLD_MAX
    )


@router.put("/matching")
def put_matching_settings(payload: MatchingUpdate) -> dict:
    """Adjust the auto-accept threshold. Applies to future scans immediately;
    already-decided placements are not re-classified."""
    try:
        return app_settings.save_match_threshold(payload.match_threshold)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.get("/model-slots")
def get_model_slots() -> list[dict]:
    return settings_svc.list_slots()


class SetActive(BaseModel):
    option_id: str


@router.post("/model-slots/{slot_id}/active")
def set_active_option(slot_id: str, payload: SetActive) -> dict:
    """Runtime model swapping isn't supported in v1 — the active option is
    pinned by `config.py`. Return 501 with a helpful message.
    """
    raise HTTPException(
        status_code=501,
        detail=(
            "Runtime model swapping isn't supported yet. "
            "Edit card_tracker/config.py to change the active embedder/detector."
        ),
    )
