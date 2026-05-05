from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from card_tracker.api import binders, cards, dashboard, pages, review, scans, settings as settings_api
from card_tracker.config import settings

app = FastAPI(title="Card Tracker", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

settings.scans_dir.mkdir(parents=True, exist_ok=True)
settings.crops_dir.mkdir(parents=True, exist_ok=True)
app.mount("/data", StaticFiles(directory=settings.data_dir), name="data")

app.include_router(binders.router, prefix="/api")
app.include_router(cards.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(pages.router, prefix="/api")
app.include_router(review.router, prefix="/api")
app.include_router(scans.router, prefix="/api")
app.include_router(settings_api.router, prefix="/api")


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
