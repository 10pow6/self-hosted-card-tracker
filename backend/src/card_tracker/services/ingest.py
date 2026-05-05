from pathlib import Path
from dataclasses import dataclass


@dataclass
class IngestedPlacement:
    placement_id: str
    slot_index: int
    crop_path: Path
    matched_core_id: str | None
    similarity: float | None
    review_status: str


def ingest_page(binder_id: str, page_number: int, source_image_path: Path) -> list[IngestedPlacement]:
    """Process a binder page photo end-to-end.

    1. Persist source image to data/scans
    2. Detect page rectangle, rectify, split into 9 slot crops
    3. Save each crop to data/crops
    4. Embed each crop with DINOv2-small
    5. For each placement: nearest-neighbor search vs CORE; auto-match,
       enqueue for review, or create new CORE row based on thresholds
    6. Persist page + placements to DB

    Stub — wired up to grid/embeddings/db layers later.
    """
    raise NotImplementedError
