from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel

from card_tracker.config import settings
from card_tracker.services import cards as cards_svc
from card_tracker.services import enrich as enrich_svc
from card_tracker.services.export import render_collection_pdf

router = APIRouter(prefix="/cards", tags=["cards"])


@router.get("")
def list_cards(
    type: Optional[str] = Query(default=None),
    needs_metadata: bool = Query(default=False),
    q: Optional[str] = Query(default=None),
) -> list[dict]:
    return cards_svc.list_cards(type_=type, needs_metadata=needs_metadata, q=q)


@router.get("/export.pdf")
def export_pdf() -> FileResponse:
    """Render the entire CORE table to a multi-page PDF and return it.

    Registered before `/{card_id}` so FastAPI matches the literal path first.
    """
    ts = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
    out = settings.data_dir / "exports" / f"collection-{ts}.pdf"
    render_collection_pdf(out)
    return FileResponse(out, media_type="application/pdf", filename=out.name)


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


class UpdateCardPayload(BaseModel):
    name: Optional[str] = None
    set: Optional[str] = None
    number: Optional[str] = None
    year: Optional[int] = None
    type: Optional[str] = None
    notes: Optional[str] = None
    model_config = {"extra": "forbid"}


@router.patch("/{card_id}")
def update_card(card_id: str, payload: UpdateCardPayload) -> dict:
    """Partial update of user-editable metadata. Only fields present in the
    request body are touched; omitted fields are left as-is. Empty / whitespace
    strings are stored as NULL.
    """
    fields = payload.model_dump(exclude_unset=True)
    try:
        return cards_svc.update_metadata(card_id, fields)
    except cards_svc.CardMergeError as e:
        raise HTTPException(status_code=400, detail=str(e))


class EnrichPayload(BaseModel):
    name: Optional[str] = None
    set: Optional[str] = None
    number: Optional[str] = None
    year: Optional[int] = None
    type: Optional[str] = None
    notes: Optional[str] = None
    confidence: float
    source_url: Optional[str] = None
    model_config = {"extra": "forbid"}


@router.post("/{card_id}/enrich")
def enrich_card(card_id: str, payload: EnrichPayload) -> dict:
    """Apply a Claude-Code-skill metadata suggestion. Server enforces the
    high-confidence rule for `number` (see services.enrich).
    """
    cfg = enrich_svc.get_settings()
    if not cfg["enabled"]:
        raise HTTPException(
            status_code=403,
            detail="Enrichment is disabled. Enable it in Settings → Metadata enrichment.",
        )
    try:
        return enrich_svc.apply_enrichment(card_id, payload.model_dump(exclude_unset=True))
    except enrich_svc.EnrichmentError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{card_id}")
def delete_card(card_id: str) -> dict:
    """Delete a CORE row with zero placements. 400 if it still has placements."""
    try:
        cards_svc.delete_card(card_id)
    except cards_svc.CardMergeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"deleted": card_id}
