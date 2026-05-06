from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from card_tracker import detectors, layouts
from card_tracker.services import binders as binders_svc

router = APIRouter(prefix="/binders", tags=["binders"])


class BinderCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    layout: str = "3x3"
    detector: Optional[str] = None
    # Schema depends on `detector` — validated by detectors.validate_config in the service.
    detector_config: Optional[dict[str, Any]] = None


@router.get("")
def list_binders() -> list[dict]:
    return binders_svc.list_binders()


@router.get("/detectors")
def list_detectors() -> list[dict]:
    """Catalog of detectors available for binder creation. Mirrors
    `frontend/src/lib/detectors.ts` so the FE can render the right config UI.
    """
    return [
        {
            "id": spec.id,
            "label": spec.label,
            "description": spec.description,
            "fields": [
                {"key": f.key, "default": f.default, "min": f.min, "max": f.max}
                for f in spec.fields
            ],
        }
        for spec in detectors.REGISTRY.values()
    ]


@router.post("", status_code=201)
def create_binder(payload: BinderCreate) -> dict:
    try:
        return binders_svc.create_binder(
            payload.name,
            payload.layout,
            detector=payload.detector,
            detector_config=payload.detector_config,
        )
    except layouts.InvalidLayout as e:
        raise HTTPException(status_code=422, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.get("/{binder_id}")
def get_binder(binder_id: str) -> dict:
    binder = binders_svc.get_binder(binder_id)
    if binder is None:
        raise HTTPException(status_code=404, detail=f"Binder not found: {binder_id}")
    return binder
