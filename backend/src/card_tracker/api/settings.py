from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from card_tracker.services import settings_svc

router = APIRouter(prefix="/settings", tags=["settings"])


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
