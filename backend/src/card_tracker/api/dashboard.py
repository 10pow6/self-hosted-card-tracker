from fastapi import APIRouter, Query

from card_tracker.services import dashboard as dashboard_svc

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats")
def get_stats() -> dict:
    return dashboard_svc.get_stats()


@router.get("/activity")
def get_activity(limit: int = Query(default=10, ge=1, le=50)) -> list[dict]:
    return dashboard_svc.get_activity(limit=limit)
