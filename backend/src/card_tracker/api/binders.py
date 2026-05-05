from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/binders", tags=["binders"])


class BinderCreate(BaseModel):
    name: str
    layout: str = "3x3"


class Binder(BaseModel):
    id: str
    name: str
    layout: str


@router.post("", response_model=Binder)
def create_binder(payload: BinderCreate) -> Binder:
    raise NotImplementedError


@router.get("", response_model=list[Binder])
def list_binders() -> list[Binder]:
    raise NotImplementedError


@router.get("/{binder_id}", response_model=Binder)
def get_binder(binder_id: str) -> Binder:
    raise NotImplementedError
