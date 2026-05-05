import uuid

import cv2
import numpy as np

from card_tracker.config import settings
from card_tracker.cv.grid import GridNotFound, _warp_card, detect_slot_polygons


class ScanError(Exception):
    """Recoverable error during scan ingest (bad upload, detection failed, etc.)."""


def preview_scan(upload_bytes: bytes, filename: str) -> dict:
    """Decode an uploaded image, save the resized version, return polygon preview."""
    arr = np.frombuffer(upload_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ScanError(f"Could not decode image (file: {filename or 'unknown'})")

    try:
        resized, detection = detect_slot_polygons(img)
    except GridNotFound as e:
        raise ScanError(str(e)) from e

    scan_id = uuid.uuid4().hex
    settings.scans_dir.mkdir(parents=True, exist_ok=True)
    scan_path = settings.scans_dir / f"{scan_id}.jpg"
    cv2.imwrite(str(scan_path), resized)

    return {
        "scan_id": scan_id,
        "image_url": f"/data/scans/{scan_path.name}",
        **detection,
    }


def commit_scan(scan_id: str, slots: list[dict]) -> dict:
    """Warp each non-disabled slot's polygon to a canonical card crop, save to disk.

    Does not persist to the DB yet — that comes once binder/page selection UX exists.
    Returns crop URLs so the frontend can show what was saved.
    """
    scan_path = settings.scans_dir / f"{scan_id}.jpg"
    if not scan_path.exists():
        raise ScanError(f"Unknown scan_id: {scan_id}")

    img = cv2.imread(str(scan_path))
    if img is None:
        raise ScanError(f"Could not read scan image: {scan_path}")

    crops_dir = settings.crops_dir / scan_id
    crops_dir.mkdir(parents=True, exist_ok=True)

    crops: list[dict] = []
    empty: list[int] = []
    for s in slots:
        idx = int(s["slot_index"])
        if s.get("disabled"):
            empty.append(idx)
            continue
        polygon = s.get("polygon")
        if not polygon or len(polygon) != 4:
            raise ScanError(f"Slot {idx}: polygon must have exactly 4 points")
        quad = np.array(polygon, dtype=np.float32)
        crop = _warp_card(img, quad)
        crop_path = crops_dir / f"slot_{idx}.jpg"
        cv2.imwrite(str(crop_path), crop)
        crops.append({
            "slot_index": idx,
            "crop_url": f"/data/crops/{scan_id}/{crop_path.name}",
        })

    crops.sort(key=lambda c: c["slot_index"])
    return {"scan_id": scan_id, "crops": crops, "empty_slots": sorted(empty)}
