from fastapi import APIRouter, UploadFile, File, Form

router = APIRouter(prefix="/binders/{binder_id}/pages", tags=["pages"])


@router.post("")
async def upload_page(
    binder_id: str,
    page_number: int = Form(...),
    image: UploadFile = File(...),
) -> dict:
    """Accept a page photo, run ingest, return per-slot results."""
    raise NotImplementedError
