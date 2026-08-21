from fastapi import APIRouter, HTTPException

from card_tracker.services import binders as binders_svc
from card_tracker.services import pages as pages_svc

router = APIRouter(prefix="/binders/{binder_id}/pages", tags=["pages"])


@router.get("")
def list_pages(binder_id: str) -> list[dict]:
    """Every page with its full placement grid — one call for the binder view."""
    if binders_svc.get_binder(binder_id) is None:
        raise HTTPException(status_code=404, detail=f"Binder not found: {binder_id}")
    return pages_svc.list_pages_full(binder_id)


@router.get("/{page_number}")
def get_page(binder_id: str, page_number: int) -> dict:
    page = pages_svc.get_page(binder_id, page_number)
    if page is None:
        raise HTTPException(
            status_code=404,
            detail=f"Page {page_number} not found in binder {binder_id}",
        )
    return page
