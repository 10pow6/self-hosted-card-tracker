from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from card_tracker.services import placements as placements_svc

router = APIRouter(prefix="/placements", tags=["placements"])


@router.get("")
def list_placements() -> list[dict]:
    """Flat list of every non-empty placement (Collection > All cards tab)."""
    return placements_svc.list_placements()


@router.get("/{placement_id}")
def get_placement(placement_id: str) -> dict:
    """Full placement context — page image, polygon, current match, top-N candidates."""
    p = placements_svc.get_placement(placement_id)
    if p is None:
        raise HTTPException(status_code=404, detail=f"Placement not found: {placement_id}")
    return p


class AssignBody(BaseModel):
    core_card_id: str


@router.post("/{placement_id}/match")
def match_placement(placement_id: str, payload: AssignBody) -> dict:
    """Reassign placement to (possibly different) core card. Sets user_confirmed."""
    try:
        placements_svc.assign_to_core(placement_id, payload.core_card_id)
    except placements_svc.PlacementError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"placement_id": placement_id, "core_card_id": payload.core_card_id, "status": "user_confirmed"}


@router.post("/{placement_id}/promote-new")
def promote_new(placement_id: str) -> dict:
    """Create a new CORE row from this placement and link them."""
    try:
        core_id = placements_svc.promote_to_new_card(placement_id)
    except placements_svc.PlacementError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"placement_id": placement_id, "core_card_id": core_id, "status": "new_card"}


@router.post("/{placement_id}/unmatch")
def unmatch(placement_id: str) -> dict:
    """Send placement back to the review queue."""
    try:
        placements_svc.unassign(placement_id)
    except placements_svc.PlacementError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"placement_id": placement_id, "status": "pending"}


class RefineBody(BaseModel):
    polygon: list[list[float]] = Field(min_length=4, max_length=4)


@router.put("/{placement_id}/polygon")
def refine_polygon(placement_id: str, payload: RefineBody) -> dict:
    """Replace the polygon, re-warp the crop, re-embed. Returns refreshed placement
    (with new top-N candidates against the new embedding)."""
    try:
        return placements_svc.refine_polygon(placement_id, payload.polygon)
    except placements_svc.PlacementError as e:
        raise HTTPException(status_code=400, detail=str(e))
