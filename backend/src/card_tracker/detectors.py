"""Detector registry — maps a `detector` id to the schema of its config.

A binder stores its `detector` id and `detector_config`; this registry tells the
rest of the system how to validate / normalize that config and which detector
function to call.

Adding a new detector (e.g. `yolo-cards-v1`) means:
  1. Implement the detector function (taking a numpy image + per-call config).
  2. Add an entry here with its config keys + defaults + value bounds.
  3. Wire it into `services.scans.preview_scan` (single dispatch on detector id).

No schema migration, no UI change to existing binders.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

OPENCV_GRID_V1 = "opencv-grid-v1"

DEFAULT_DETECTOR = OPENCV_GRID_V1


@dataclass(frozen=True)
class ConfigField:
    key: str
    default: float
    min: float
    max: float


@dataclass(frozen=True)
class DetectorSpec:
    id: str
    label: str
    description: str
    fields: tuple[ConfigField, ...]

    def field_keys(self) -> set[str]:
        return {f.key for f in self.fields}

    def defaults(self) -> dict[str, float]:
        return {f.key: f.default for f in self.fields}


# ---------------------------------------------------------------------------
# Registry — add new detectors here. Frontend mirrors these in
# `frontend/src/lib/detectors.ts`.

REGISTRY: dict[str, DetectorSpec] = {
    OPENCV_GRID_V1: DetectorSpec(
        id=OPENCV_GRID_V1,
        label="OpenCV grid detector",
        description=(
            "Bbox + per-cell saturation refinement. Local, no model weights required. "
            "Tuned for 3×3 — denser layouts may want a lower min_cell_fill."
        ),
        fields=(
            ConfigField("min_cell_fill", default=0.30, min=0.05, max=0.60),
            ConfigField("min_hull_fill", default=0.70, min=0.30, max=0.95),
            ConfigField("aspect_tolerance", default=0.20, min=0.05, max=0.50),
        ),
    ),
    # Future:
    # 'yolo-cards-v1': DetectorSpec(
    #     id='yolo-cards-v1',
    #     label='YOLOv8n (trained on cards)',
    #     fields=(ConfigField('confidence', 0.25, 0.05, 0.95), ...),
    # ),
}


def get_spec(detector_id: Optional[str]) -> DetectorSpec:
    """Return the spec for a detector id, or the default detector's spec when
    `detector_id` is None or unknown.
    """
    return REGISTRY.get(detector_id or DEFAULT_DETECTOR, REGISTRY[DEFAULT_DETECTOR])


def validate_config(detector_id: Optional[str], raw: Any) -> Optional[dict]:
    """Strip unknown keys, type-check, range-check. Returns the cleaned dict or
    None if no overrides are present. Raises ValueError on bad input.
    """
    if raw is None:
        return None
    if not isinstance(raw, dict):
        raise ValueError("detector_config must be an object.")
    spec = get_spec(detector_id)
    out: dict[str, float] = {}
    for f in spec.fields:
        if f.key not in raw:
            continue
        v = raw[f.key]
        if not isinstance(v, (int, float)):
            raise ValueError(f"detector_config.{f.key} must be a number.")
        fv = float(v)
        if not (f.min <= fv <= f.max):
            raise ValueError(
                f"detector_config.{f.key} must be in [{f.min}, {f.max}], got {fv}."
            )
        out[f.key] = fv
    return out or None


def merged_config(detector_id: Optional[str], overrides: Optional[dict]) -> dict[str, float]:
    """Defaults + overrides. Always returns a dict with every field set."""
    spec = get_spec(detector_id)
    cfg = spec.defaults()
    if overrides:
        cfg.update({k: v for k, v in overrides.items() if k in spec.field_keys()})
    return cfg
