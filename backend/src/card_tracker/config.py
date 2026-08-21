from pathlib import Path
from pydantic import BaseModel


REPO_ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = REPO_ROOT / "data"


class Settings(BaseModel):
    data_dir: Path = DATA_DIR
    scans_dir: Path = DATA_DIR / "scans"
    crops_dir: Path = DATA_DIR / "crops"
    models_dir: Path = DATA_DIR / "models"
    db_path: Path = DATA_DIR / "card_tracker.db"

    embedder_name: str = "dinov2-small"
    embedder_version: str = "facebook/dinov2-small@v1"
    embedding_dim: int = 384

    binder_layout: str = "3x3"
    # Default auto-accept threshold; the live value is user-adjustable and
    # persisted via services.app_settings.
    match_threshold: float = 0.92

    matcher_id: str = "cosine-multivote-v1"


settings = Settings()
