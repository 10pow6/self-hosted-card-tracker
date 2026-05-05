from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from card_tracker.services.scans import ScanError, commit_scan, preview_scan

router = APIRouter(prefix="/scans", tags=["scans"])


@router.post("/preview")
async def post_preview(image: UploadFile = File(...)) -> dict:
    """Upload a page photo, run detection, return polygons for review."""
    try:
        return preview_scan(await image.read(), image.filename or "")
    except ScanError as e:
        raise HTTPException(status_code=422, detail=str(e))


class CommitSlot(BaseModel):
    slot_index: int
    polygon: list[list[float]]
    disabled: bool = False


class CommitRequest(BaseModel):
    scan_id: str
    slots: list[CommitSlot]


@router.post("/commit")
def post_commit(payload: CommitRequest) -> dict:
    """Warp user-confirmed polygons into canonical card crops and save them."""
    try:
        return commit_scan(
            payload.scan_id,
            [s.model_dump() for s in payload.slots],
        )
    except ScanError as e:
        raise HTTPException(status_code=422, detail=str(e))
