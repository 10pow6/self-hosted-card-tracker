from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from card_tracker.services import cards as cards_svc

router = APIRouter(prefix="/cards", tags=["cards"])


@router.get("")
def list_cards(
    type: Optional[str] = Query(default=None),
    needs_metadata: bool = Query(default=False),
    q: Optional[str] = Query(default=None),
) -> list[dict]:
    return cards_svc.list_cards(type_=type, needs_metadata=needs_metadata, q=q)


@router.get("/{card_id}")
def get_card(card_id: str) -> dict:
    card = cards_svc.get_card(card_id)
    if card is None:
        raise HTTPException(status_code=404, detail=f"Card not found: {card_id}")
    return card


@router.get("/{card_id}/placements")
def list_placements(card_id: str) -> list[dict]:
    if cards_svc.get_card(card_id) is None:
        raise HTTPException(status_code=404, detail=f"Card not found: {card_id}")
    return cards_svc.list_placements_for_card(card_id)


class MergePayload(BaseModel):
    target_id: str


@router.post("/{source_id}/merge")
def merge_card(source_id: str, payload: MergePayload) -> dict:
    """Merge `source_id` into `target_id`. Returns the updated target."""
    try:
        return cards_svc.merge_cards(source_id, payload.target_id)
    except cards_svc.CardMergeError as e:
        raise HTTPException(status_code=400, detail=str(e))


class RepresentativePayload(BaseModel):
    placement_id: str


@router.post("/{card_id}/representative")
def set_representative(card_id: str, payload: RepresentativePayload) -> dict:
    """Promote a placement's crop as this card's source/representative image."""
    try:
        return cards_svc.set_representative(card_id, payload.placement_id)
    except cards_svc.CardMergeError as e:
        raise HTTPException(status_code=400, detail=str(e))
