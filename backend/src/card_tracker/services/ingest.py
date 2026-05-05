"""End-to-end page ingest: warp → embed → match → persist.

The detector ran during /scans/preview. This stage takes the user-confirmed
polygons, warps them to canonical card crops, embeds each, looks them up
against CORE, and writes the rows.
"""
from __future__ import annotations

import uuid
from contextlib import closing
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import cv2
import numpy as np

from card_tracker.config import settings
from card_tracker.cv.grid import _warp_card
from card_tracker.db.engine import connect, transaction
from card_tracker.embeddings.dinov2 import get_embedder
from card_tracker.services import match
from card_tracker.services.paths import to_relative, to_url


class IngestError(Exception):
    """Recoverable error during ingest (bad inputs, missing scan, conflict)."""


@dataclass
class _ProcessedSlot:
    slot_index: int
    is_empty: bool
    crop_path: Optional[Path]              # filesystem path
    crop_relative: Optional[str]           # DB-stored relative path
    embedding: Optional[np.ndarray]
    candidates: list[match.Candidate]
    status: str                            # 'empty' | 'auto_matched' | 'pending' | 'new_card'


def ingest_page(
    *,
    scan_id: str,
    binder_id: str,
    page_number: int,
    slots: list[dict],
) -> dict:
    """Persist a scanned page into the given binder and return a summary."""
    if page_number < 1:
        raise IngestError(f"page_number must be ≥ 1, got {page_number}")

    scan_path = settings.scans_dir / f"{scan_id}.jpg"
    if not scan_path.exists():
        raise IngestError(f"Unknown scan_id: {scan_id}")
    img = cv2.imread(str(scan_path))
    if img is None:
        raise IngestError(f"Could not read scan image: {scan_path}")

    crops_dir = settings.crops_dir / scan_id
    crops_dir.mkdir(parents=True, exist_ok=True)
    embedder = get_embedder()
    processed: list[_ProcessedSlot] = []

    # Phase A — guard checks + warp + embed + match. Read-only DB use.
    with closing(connect()) as conn:
        if conn.execute("SELECT 1 FROM binder WHERE id = ?", (binder_id,)).fetchone() is None:
            raise IngestError(f"Unknown binder: {binder_id}")
        if conn.execute(
            "SELECT 1 FROM page WHERE binder_id = ? AND page_number = ?",
            (binder_id, page_number),
        ).fetchone() is not None:
            raise IngestError(
                f"Page {page_number} already exists in binder {binder_id}. "
                "Pick a different page number or delete the existing page."
            )
        for raw in slots:
            idx = int(raw["slot_index"])
            if raw.get("disabled"):
                processed.append(
                    _ProcessedSlot(
                        slot_index=idx,
                        is_empty=True,
                        crop_path=None,
                        crop_relative=None,
                        embedding=None,
                        candidates=[],
                        status="empty",
                    )
                )
                continue
            polygon = raw.get("polygon")
            if not polygon or len(polygon) != 4:
                raise IngestError(f"Slot {idx}: polygon must have exactly 4 points")
            quad = np.array(polygon, dtype=np.float32)
            crop_bgr = _warp_card(img, quad)
            crop_path = crops_dir / f"slot_{idx}.jpg"
            cv2.imwrite(str(crop_path), crop_bgr)
            crop_rgb = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2RGB)
            embedding = embedder.embed(crop_rgb)
            candidates = match.find_candidates(conn, embedding, top_k=3)
            # Bootstrap: empty CORE → seed with a new row. Otherwise classify(...)
            # only returns 'auto_matched' or 'pending'; new CORE rows after the
            # initial seed must come from explicit user action in the review queue.
            if not candidates:
                top_sim = 0.0
                status = "new_card"
            else:
                top_sim = candidates[0].similarity
                status = match.classify(top_sim)
            processed.append(
                _ProcessedSlot(
                    slot_index=idx,
                    is_empty=False,
                    crop_path=crop_path,
                    crop_relative=to_relative(crop_path),
                    embedding=embedding,
                    candidates=candidates,
                    status=status,
                )
            )

    # Phase B — transactional persistence.
    page_id = f"page-{uuid.uuid4().hex[:12]}"
    page_relative = to_relative(scan_path)
    summary = {"auto_matched": 0, "pending": 0, "new_cards": 0, "empty": 0}
    crops_response: list[dict] = []
    empty_response: list[int] = []
    with transaction() as conn:
        conn.execute(
            "INSERT INTO page (id, binder_id, page_number, source_image_path) VALUES (?, ?, ?, ?)",
            (page_id, binder_id, page_number, page_relative),
        )
        for slot in processed:
            placement_id = f"pl-{uuid.uuid4().hex[:12]}"
            if slot.is_empty:
                summary["empty"] += 1
                empty_response.append(slot.slot_index)
                conn.execute(
                    "INSERT INTO placement (id, page_id, slot_index, review_status) "
                    "VALUES (?, ?, ?, 'empty')",
                    (placement_id, page_id, slot.slot_index),
                )
                continue

            assert slot.embedding is not None and slot.crop_relative is not None
            embedding_blob = slot.embedding.astype(np.float32).tobytes()
            top_sim = slot.candidates[0].similarity if slot.candidates else 0.0
            top_id = slot.candidates[0].core_card_id if slot.candidates else None

            if slot.status == "auto_matched":
                summary["auto_matched"] += 1
                conn.execute(
                    """
                    INSERT INTO placement
                      (id, page_id, slot_index, crop_image_path, embedding,
                       embedder_name, embedder_version, core_card_id,
                       similarity_score, review_status, resolved_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'auto_matched', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
                    """,
                    (
                        placement_id, page_id, slot.slot_index, slot.crop_relative,
                        embedding_blob, embedder.name, embedder.version, top_id, top_sim,
                    ),
                )
            elif slot.status == "pending":
                summary["pending"] += 1
                conn.execute(
                    """
                    INSERT INTO placement
                      (id, page_id, slot_index, crop_image_path, embedding,
                       embedder_name, embedder_version, similarity_score, review_status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
                    """,
                    (
                        placement_id, page_id, slot.slot_index, slot.crop_relative,
                        embedding_blob, embedder.name, embedder.version, top_sim,
                    ),
                )
            else:  # new_card
                summary["new_cards"] += 1
                core_id = f"core-{uuid.uuid4().hex[:12]}"
                conn.execute(
                    """
                    INSERT INTO core_card
                      (id, embedder_name, embedder_version, embedding,
                       representative_crop_path)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (
                        core_id, embedder.name, embedder.version, embedding_blob,
                        slot.crop_relative,
                    ),
                )
                conn.execute(
                    """
                    INSERT INTO placement
                      (id, page_id, slot_index, crop_image_path, embedding,
                       embedder_name, embedder_version, core_card_id,
                       similarity_score, review_status, resolved_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new_card', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
                    """,
                    (
                        placement_id, page_id, slot.slot_index, slot.crop_relative,
                        embedding_blob, embedder.name, embedder.version, core_id, top_sim,
                    ),
                )

            crops_response.append(
                {
                    "slot_index": slot.slot_index,
                    "crop_url": to_url(slot.crop_relative),
                    "status": slot.status,
                    "similarity": top_sim,
                    "core_card_id": top_id if slot.status == "auto_matched" else
                                    (core_id if slot.status == "new_card" else None),
                }
            )

    crops_response.sort(key=lambda c: c["slot_index"])
    return {
        "scan_id": scan_id,
        "page_id": page_id,
        "binder_id": binder_id,
        "page_number": page_number,
        "crops": crops_response,
        "empty_slots": sorted(empty_response),
        "summary": summary,
    }
