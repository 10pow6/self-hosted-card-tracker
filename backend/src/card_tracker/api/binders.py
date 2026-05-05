from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from card_tracker import layouts
from card_tracker.services import binders as binders_svc

router = APIRouter(prefix="/binders", tags=["binders"])


class BinderCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    layout: str = "3x3"


@router.get("")
def list_binders() -> list[dict]:
    return binders_svc.list_binders()


@router.post("", status_code=201)
def create_binder(payload: BinderCreate) -> dict:
    try:
        return binders_svc.create_binder(payload.name, payload.layout)
    except layouts.InvalidLayout as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.get("/{binder_id}")
def get_binder(binder_id: str) -> dict:
    binder = binders_svc.get_binder(binder_id)
    if binder is None:
        raise HTTPException(status_code=404, detail=f"Binder not found: {binder_id}")
    return binder
