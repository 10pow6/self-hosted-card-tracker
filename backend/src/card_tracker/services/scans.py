"""Scan upload + commit. Preview detects polygons (using a per-binder layout);
commit warps + embeds + persists.
"""
from __future__ import annotations

import uuid
from typing import Optional

import cv2
import numpy as np

from card_tracker import layouts
from card_tracker.config import settings
from card_tracker.cv.grid import GridNotFound, detect_slot_polygons
from card_tracker.services.ingest import IngestError, ingest_page


class ScanError(Exception):
    """Recoverable error during scan ingest (bad upload, detection failed, etc.)."""


def preview_scan(upload_bytes: bytes, filename: str, layout: Optional[str] = None) -> dict:
    """Decode an uploaded image, save the resized version, return polygon preview.

    Layout defaults to the system default (`config.binder_layout`) when omitted.
    """
    arr = np.frombuffer(upload_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ScanError(f"Could not decode image (file: {filename or 'unknown'})")

    try:
        parsed = layouts.parse(layout or settings.binder_layout)
    except layouts.InvalidLayout as e:
        raise ScanError(str(e)) from e

    try:
        resized, detection = detect_slot_polygons(img, rows=parsed.rows, cols=parsed.cols)
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
