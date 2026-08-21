from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from card_tracker.services import review as review_svc

router = APIRouter(prefix="/review", tags=["review"])


class ResolveMatch(BaseModel):
    core_card_id: str


@router.get("/queue")
def get_queue(
    tab: str = Query(default="active", pattern="^(active|deferred)$"),
    limit: int = Query(default=5, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """One page of the queue plus totals for both tabs:
    {items, total_active, total_deferred, limit, offset}."""
    return review_svc.list_queue(tab=tab, limit=limit, offset=offset)


@router.post("/{placement_id}/match")
def confirm_match(placement_id: str, payload: ResolveMatch) -> dict:
    try:
        review_svc.confirm_match(placement_id, payload.core_card_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"placement_id": placement_id, "status": "user_confirmed"}


@router.post("/{placement_id}/new")
def confirm_new(placement_id: str) -> dict:
    try:
        core_id = review_svc.confirm_new(placement_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"placement_id": placement_id, "core_card_id": core_id, "status": "new_card"}


@router.post("/{placement_id}/defer")
def defer(placement_id: str) -> dict:
    try:
        review_svc.defer(placement_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"placement_id": placement_id, "deferred": True}


@router.post("/{placement_id}/undefer")
def undefer(placement_id: str) -> dict:
    try:
        review_svc.undefer(placement_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"placement_id": placement_id, "deferred": False}
