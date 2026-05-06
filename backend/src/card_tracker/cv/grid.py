from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import cv2
import numpy as np


@dataclass
class SlotCrop:
    slot_index: int
    image: np.ndarray  # uint8 BGR, fixed canonical size
    refined: bool      # True if a card was detected in the cell; False = fallback resize


class GridNotFound(Exception):
    """Could not locate the binder page in the photo."""


CANONICAL_CARD_SIZE = (480, 672)   # (width, height); ~1.4 portrait
CARD_ASPECT = 88 / 63              # standard trading card aspect (~1.397)

PLASTIC_V_MAX = 60                 # binder plastic is V ≤ this (black, glossy)
PLASTIC_S_MAX = 40                 # AND nearly grayscale — excludes dark-but-colored regions
PAGE_FILL_KERNEL = (40, 40)        # fill card-shaped holes when finding the binder silhouette

CELL_OPEN_KERNEL = (5, 5)          # remove sleeve-glare specks inside a cell

MAX_LONG_SIDE = 1500               # downscale large input photos


# Tunable per-binder thresholds. Defaults work for 3×3; denser layouts (4×4+)
# typically want lower MIN_CELL_FILL because each cell is smaller, so the
# card-to-cell ratio is harder to hit.
@dataclass(frozen=True)
class DetectionConfig:
    min_cell_fill: float = 0.30      # detected card must cover ≥ this % of its cell
    min_hull_fill: float = 0.70      # convex-hull fills ≥ this % of its bounding rect
    aspect_tolerance: float = 0.20   # ±% deviation from CARD_ASPECT


DEFAULT_DETECTION = DetectionConfig()


# ---------------------------------------------------------------------------
# Shared helpers


def _resize_max_side(img: np.ndarray, max_side: int) -> np.ndarray:
    h, w = img.shape[:2]
    long_side = max(h, w)
    if long_side <= max_side:
        return img
    scale = max_side / long_side
    new_size = (int(round(w * scale)), int(round(h * scale)))
    return cv2.resize(img, new_size, interpolation=cv2.INTER_AREA)


def _order_corners(pts: np.ndarray) -> np.ndarray:
    """Order 4 corners as TL, TR, BR, BL (works for any tilt < 45°)."""
    s = pts.sum(axis=1)
    d = np.diff(pts, axis=1).flatten()
    return np.stack(
        [pts[np.argmin(s)], pts[np.argmin(d)], pts[np.argmax(s)], pts[np.argmax(d)]],
        axis=0,
    ).astype(np.float32)


def _warp_card(img_bgr: np.ndarray, quad: np.ndarray) -> np.ndarray:
    ordered = _order_corners(quad)
    w, h = CANONICAL_CARD_SIZE
    dst = np.array([[0, 0], [w - 1, 0], [w - 1, h - 1], [0, h - 1]], dtype=np.float32)
    M = cv2.getPerspectiveTransform(ordered, dst)
    return cv2.warpPerspective(img_bgr, M, (w, h))


# ---------------------------------------------------------------------------
# Stage 1: binder bbox


def _page_bbox(img_bgr: np.ndarray) -> tuple[int, int, int, int] | None:
    """Largest dark+grayscale connected region (with card-holes filled) = the binder."""
    hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
    plastic = (
        (hsv[:, :, 2] <= PLASTIC_V_MAX) & (hsv[:, :, 1] <= PLASTIC_S_MAX)
    ).astype(np.uint8) * 255
    fill_k = cv2.getStructuringElement(cv2.MORPH_RECT, PAGE_FILL_KERNEL)
    page = cv2.morphologyEx(plastic, cv2.MORPH_CLOSE, fill_k)
    n, _, stats, _ = cv2.connectedComponentsWithStats(page)
    if n < 2:
        return None
    largest = max(range(1, n), key=lambda i: stats[i, cv2.CC_STAT_AREA])
    return (
        int(stats[largest, cv2.CC_STAT_LEFT]),
        int(stats[largest, cv2.CC_STAT_TOP]),
        int(stats[largest, cv2.CC_STAT_WIDTH]),
        int(stats[largest, cv2.CC_STAT_HEIGHT]),
    )


# ---------------------------------------------------------------------------
# Stage 2: per-cell card refinement


def _cell_card_mask(cell_bgr: np.ndarray) -> np.ndarray:
    """Inside a cell, anything not-plastic is card. White card content included."""
    hsv = cv2.cvtColor(cell_bgr, cv2.COLOR_BGR2HSV)
    is_plastic = (hsv[:, :, 2] <= PLASTIC_V_MAX) & (hsv[:, :, 1] <= PLASTIC_S_MAX)
    mask = (~is_plastic).astype(np.uint8) * 255
    open_k = cv2.getStructuringElement(cv2.MORPH_RECT, CELL_OPEN_KERNEL)
    return cv2.morphologyEx(mask, cv2.MORPH_OPEN, open_k)


def _refine_card_in_cell(
    cell_bgr: np.ndarray,
    config: DetectionConfig = DEFAULT_DETECTION,
) -> np.ndarray | None:
    """Return a 4-corner quad for the card in the cell (cell-local coords), or None."""
    h, w = cell_bgr.shape[:2]
    cell_area = float(h * w)
    mask = _cell_card_mask(cell_bgr)
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
    largest = max(contours, key=cv2.contourArea)
    hull = cv2.convexHull(largest)
    rect = cv2.minAreaRect(hull)
    (_, _), (rw, rh), _ = rect
    if rw == 0 or rh == 0:
        return None
    rect_area = float(rw * rh)
    if rect_area / cell_area < config.min_cell_fill:
        return None
    aspect = max(rw, rh) / min(rw, rh)
    if abs(aspect - CARD_ASPECT) > config.aspect_tolerance * CARD_ASPECT:
        return None
    hull_area = float(cv2.contourArea(hull))
    if hull_area / rect_area < config.min_hull_fill:
        return None
    return cv2.boxPoints(rect).astype(np.float32)


def _cell_crop_resized(cell_bgr: np.ndarray) -> np.ndarray:
    """Fallback: stretch the whole cell to canonical card size."""
    return cv2.resize(cell_bgr, CANONICAL_CARD_SIZE, interpolation=cv2.INTER_AREA)


# ---------------------------------------------------------------------------
# Public API


def detect_slot_polygons(
    img: np.ndarray,
    rows: int = 3,
    cols: int = 3,
    config: Optional[DetectionConfig] = None,
) -> tuple[np.ndarray, dict]:
    """Detect bbox + RxC slot polygons in image-pixel coordinates (no warping).

    Returns ``(resized_image, payload)``. Callers serve the resized image so
    polygon coordinates align 1:1 with what the user sees in the browser.
    Slots are emitted in row-major order with `slot_index = row * cols + col`.
    Each polygon is 4 (x, y) points in TL→TR→BR→BL order:
      - refined cells: per-card minAreaRect quad detected by saturation+hull
      - unrefined cells: the axis-aligned cell rectangle (so the user has a
        sensible starting box to drag)
    Raises ``GridNotFound`` if the binder bbox itself cannot be located.
    """
    cfg = config or DEFAULT_DETECTION
    img = _resize_max_side(img, MAX_LONG_SIDE)
    bbox = _page_bbox(img)
    if bbox is None:
        raise GridNotFound("Could not locate the binder page in the photo.")
    h, w = img.shape[:2]
    payload = {
        "image_size": [int(w), int(h)],
        "bbox": [int(v) for v in bbox],
        "rows": int(rows),
        "cols": int(cols),
        "slots": _detect_cell_polygons(img, bbox, rows=rows, cols=cols, config=cfg),
    }
    return img, payload


def extract_slots(image_path: Path) -> list[SlotCrop]:
    """CLI/test path: read an image and return 9 warped SlotCrops in row-major order."""
    img = cv2.imread(str(image_path))
    if img is None:
        raise FileNotFoundError(f"Cannot read image: {image_path}")
    img, payload = detect_slot_polygons(img)
    return _warp_payload_to_crops(img, payload)


def _default_card_polygon(cx: int, cy: int, cell_w: int, cell_h: int) -> np.ndarray:
    """Card-aspect rectangle filling ~80% of the cell, centered.

    The default for unrefined cells — gives the user a sensibly-sized starting box
    rather than the full cell rect (which is much bigger than a card).
    """
    margin = 0.80
    max_h = cell_h * margin
    max_w = cell_w * margin
    if max_h / CARD_ASPECT <= max_w:
        ph = max_h
        pw = ph / CARD_ASPECT
    else:
        pw = max_w
        ph = pw * CARD_ASPECT
    px = cx + (cell_w - pw) / 2
    py = cy + (cell_h - ph) / 2
    return np.array(
        [[px, py], [px + pw, py], [px + pw, py + ph], [px, py + ph]],
        dtype=np.float32,
    )


def _detect_cell_polygons(
    img: np.ndarray,
    bbox: tuple[int, int, int, int],
    rows: int = 3,
    cols: int = 3,
    config: DetectionConfig = DEFAULT_DETECTION,
) -> list[dict]:
    x, y, pw, ph = bbox
    cell_w = pw // cols
    cell_h = ph // rows
    out: list[dict] = []
    for row in range(rows):
        for col in range(cols):
            cx = x + col * cell_w
            cy = y + row * cell_h
            cell = img[cy : cy + cell_h, cx : cx + cell_w]
            quad = _refine_card_in_cell(cell, config=config)
            if quad is not None:
                polygon = (quad + np.array([cx, cy], dtype=np.float32))
                refined = True
            else:
                polygon = _default_card_polygon(cx, cy, cell_w, cell_h)
                refined = False
            out.append(
                {
                    "slot_index": row * cols + col,
                    "polygon": polygon.tolist(),
                    "refined": refined,
                }
            )
    return out


def _warp_payload_to_crops(img: np.ndarray, payload: dict) -> list[SlotCrop]:
    slots: list[SlotCrop] = []
    for s in payload["slots"]:
        quad = np.array(s["polygon"], dtype=np.float32)
        if s["refined"]:
            crop = _warp_card(img, quad)
        else:
            x_min = int(round(min(p[0] for p in s["polygon"])))
            y_min = int(round(min(p[1] for p in s["polygon"])))
            x_max = int(round(max(p[0] for p in s["polygon"])))
            y_max = int(round(max(p[1] for p in s["polygon"])))
            crop = _cell_crop_resized(img[y_min:y_max, x_min:x_max])
        slots.append(SlotCrop(slot_index=s["slot_index"], image=crop, refined=s["refined"]))
    return slots


# ---------------------------------------------------------------------------
# Debug


def write_debug_artifacts(image_path: Path, out_dir: Path) -> dict:
    """Write diagnostic images to inspect each pipeline stage. Returns a stats dict."""
    out_dir.mkdir(parents=True, exist_ok=True)
    img = cv2.imread(str(image_path))
    if img is None:
        raise FileNotFoundError(f"Cannot read image: {image_path}")
    img = _resize_max_side(img, MAX_LONG_SIDE)
    cv2.imwrite(str(out_dir / "01_resized.jpg"), img)

    bbox = _page_bbox(img)
    overlay = img.copy()
    refined_count = 0
    if bbox is not None:
        x, y, pw, ph = bbox
        cv2.rectangle(overlay, (x, y), (x + pw, y + ph), (255, 255, 0), 4)
        cell_w = pw // 3
        cell_h = ph // 3
        for row in range(3):
            for col in range(3):
                cx = x + col * cell_w
                cy = y + row * cell_h
                cv2.rectangle(overlay, (cx, cy), (cx + cell_w, cy + cell_h), (0, 255, 255), 2)
                cell = img[cy : cy + cell_h, cx : cx + cell_w]
                quad = _refine_card_in_cell(cell)
                if quad is not None:
                    refined_count += 1
                    quad_global = quad + np.array([cx, cy], dtype=np.float32)
                    cv2.polylines(overlay, [quad_global.astype(np.int32)], True, (0, 0, 255), 3)
    cv2.imwrite(str(out_dir / "02_bbox_cells_quads.jpg"), overlay)

    return {
        "frame_size": (img.shape[1], img.shape[0]),
        "bbox": bbox,
        "refined_cells": refined_count,
    }
