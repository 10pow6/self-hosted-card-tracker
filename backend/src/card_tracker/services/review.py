from dataclasses import dataclass
from pathlib import Path


@dataclass
class ReviewCandidate:
    core_card_id: str
    similarity: float
    representative_crop_path: Path


@dataclass
class ReviewItem:
    placement_id: str
    binder_id: str
    binder_name: str
    page_number: int
    slot_index: int
    crop_path: Path
    candidates: list[ReviewCandidate]


def list_pending() -> list[ReviewItem]:
    """Placements awaiting user adjudication, with top-N CORE candidates."""
    raise NotImplementedError


def resolve_match(placement_id: str, core_card_id: str) -> None:
    """User confirmed: this placement is the given CORE card."""
    raise NotImplementedError


def resolve_new(placement_id: str) -> str:
    """User says this is a new card — promote placement embedding to a new CORE row."""
    raise NotImplementedError
