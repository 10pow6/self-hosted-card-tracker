from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from card_tracker.services.scans import ScanError, commit_scan, preview_scan

router = APIRouter(prefix="/scans", tags=["scans"])


@router.post("/preview")
async def post_preview(
    image: UploadFile = File(...),
    layout: Optional[str] = Form(default=None),
) -> dict:
    """Upload a page photo, run detection, return polygons for review.

    `layout` is an optional form field like "3x3"; defaults to the system
    default when not provided.
    """
    try:
        return preview_scan(await image.read(), image.filename or "", layout=layout)
    except ScanError as e:
        raise HTTPException(status_code=422, detail=str(e))


class CommitSlot(BaseModel):
    slot_index: int
    polygon: list[list[float]] = Field(default_factory=list)
    disabled: bool = False


class CommitRequest(BaseModel):
    scan_id: str
    binder_id: str
    page_number: int = Field(ge=1)
    slots: list[CommitSlot]


@router.post("/commit")
def post_commit(payload: CommitRequest) -> dict:
    """Persist a page-worth of placements into a binder via the ingest pipeline."""
    try:
        return commit_scan(
            scan_id=payload.scan_id,
            binder_id=payload.binder_id,
            page_number=payload.page_number,
            slots=[s.model_dump() for s in payload.slots],
        )
    except ScanError as e:
        raise HTTPException(status_code=422, detail=str(e))
