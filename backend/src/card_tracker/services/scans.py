"""Scan upload + commit. Preview detects polygons (using a per-binder detector +
config); commit warps + embeds + persists.
"""
from __future__ import annotations

import uuid
from typing import Optional

import cv2
import numpy as np

from card_tracker import detectors, layouts
from card_tracker.config import settings
from card_tracker.cv.grid import DetectionConfig, GridNotFound, detect_slot_polygons
from card_tracker.services import binders as binders_svc
from card_tracker.services.ingest import IngestError, ingest_page


class ScanError(Exception):
    """Recoverable error during scan ingest (bad upload, detection failed, etc.)."""


def _run_detector(
    img: np.ndarray,
    *,
    detector_id: str,
    config: dict[str, float],
    rows: int,
    cols: int,
) -> tuple[np.ndarray, dict]:
    """Single-dispatch on detector id. Add new branches as detectors are added."""
    if detector_id == detectors.OPENCV_GRID_V1:
        return detect_slot_polygons(
            img,
            rows=rows,
            cols=cols,
            config=DetectionConfig(
                min_cell_fill=config["min_cell_fill"],
                min_hull_fill=config["min_hull_fill"],
                aspect_tolerance=config["aspect_tolerance"],
            ),
        )
    raise ScanError(f"Detector not implemented: {detector_id}")


def preview_scan(
    upload_bytes: bytes,
    filename: str,
    layout: Optional[str] = None,
    binder_id: Optional[str] = None,
) -> dict:
    """Decode an uploaded image, save the resized version, return polygon preview.

    If `binder_id` is provided, the binder's layout AND detector + detector_config
    are used. If not, falls back to `layout` (parsed) and the system default
    detector with its default config.
    """
    arr = np.frombuffer(upload_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ScanError(f"Could not decode image (file: {filename or 'unknown'})")

    if binder_id:
        binder = binders_svc.get_binder(binder_id)
        if binder is None:
            raise ScanError(f"Unknown binder: {binder_id}")
        layout = binder["layout"]
        detector_id, detector_config = binders_svc.resolve_detector(binder_id)
    else:
        detector_id = detectors.DEFAULT_DETECTOR
        detector_config = detectors.merged_config(detector_id, None)

    try:
        parsed = layouts.parse(layout or settings.binder_layout)
    except layouts.InvalidLayout as e:
        raise ScanError(str(e)) from e

    try:
        resized, detection = _run_detector(
            img,
            detector_id=detector_id,
            config=detector_config,
            rows=parsed.rows,
            cols=parsed.cols,
        )
    except GridNotFound as e:
        raise ScanError(str(e)) from e

    scan_id = uuid.uuid4().hex
    settings.scans_dir.mkdir(parents=True, exist_ok=True)
    scan_path = settings.scans_dir / f"{scan_id}.jpg"
    cv2.imwrite(str(scan_path), resized)

    return {
        "scan_id": scan_id,
        "image_url": f"/data/scans/{scan_path.name}",
        "detector": detector_id,
        **detection,
    }


def commit_scan(
    *,
    scan_id: str,
    binder_id: str,
    page_number: int,
    slots: list[dict],
) -> dict:
    """Persist a scanned page into the given binder via the ingest pipeline."""
    try:
        return ingest_page(
            scan_id=scan_id,
            binder_id=binder_id,
            page_number=page_number,
            slots=slots,
        )
    except IngestError as e:
        raise ScanError(str(e)) from e
