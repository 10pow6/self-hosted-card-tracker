from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/review", tags=["review"])


class ResolveMatch(BaseModel):
    core_card_id: str


@router.get("/queue")
def get_queue() -> list[dict]:
    """Pending placements with top-N candidate CORE cards."""
    raise NotImplementedError


@router.post("/{placement_id}/match")
def confirm_match(placement_id: str, payload: ResolveMatch) -> dict:
    raise NotImplementedError


@router.post("/{placement_id}/new")
def confirm_new(placement_id: str) -> dict:
    raise NotImplementedError
