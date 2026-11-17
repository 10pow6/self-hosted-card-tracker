// Frontend mirror of the backend `card_tracker.detectors` registry.
// The backend exposes `/api/binders/detectors` as the source of truth, but we
// keep a static fallback here so create dialogs can render their UI without
// waiting on a network round-trip. Backend-driven entries take precedence
// (handy when adding a detector backend-only without redeploying the FE).

export const OPENCV_GRID_V1 = 'opencv-grid-v1';
export const DEFAULT_DETECTOR = OPENCV_GRID_V1;

export type DetectorFieldSpec = {
  key: string;
  label: string;
  help: string;
  default: number;
  min: number;
  max: number;
};

export type DetectorSpec = {
  id: string;
  label: string;
  description: string;
  fields: DetectorFieldSpec[];
};

// Static fallback. Keys/defaults must match backend `detectors.py`.
export const STATIC_DETECTORS: Record<string, DetectorSpec> = {
  [OPENCV_GRID_V1]: {
    id: OPENCV_GRID_V1,
    label: 'OpenCV grid detector',
    description:
      'Bbox + per-cell saturation refinement. Local, no model weights required. Tuned for 3×3 — denser layouts may want a lower min cell fill.',
    fields: [
      {
        key: 'min_cell_fill',
        label: 'Min cell fill',
        help: 'Minimum % of a cell that the detected card must cover. Lower this for dense layouts (4×4) where each cell is smaller.',
        default: 0.3,
        min: 0.05,
        max: 0.6,
      },
      {
        key: 'min_hull_fill',
        label: 'Min hull fill',
        help: 'How tightly the detected shape must fill its bounding rectangle. Lower this if cards are crumpled or partially covered by sleeve glare.',
        default: 0.7,
        min: 0.3,
        max: 0.95,
      },
      {
        key: 'aspect_tolerance',
        label: 'Aspect tolerance',
        help: 'How far from the standard 63×88 trading-card aspect the detected box can be. Higher = more permissive on tilt/perspective.',
        default: 0.2,
        min: 0.05,
        max: 0.5,
      },
    ],
  },
};

export function getDetectorSpec(id: string | null | undefined): DetectorSpec {
  return STATIC_DETECTORS[id ?? DEFAULT_DETECTOR] ?? STATIC_DETECTORS[DEFAULT_DETECTOR];
}
