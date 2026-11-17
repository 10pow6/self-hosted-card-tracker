// Binder layout helpers. Layouts look like "RxC" (e.g. "3x3", "2x2", "4x3").

export type LayoutDims = { rows: number; cols: number; total: number; canonical: string };

export const LAYOUT_PRESETS: { layout: string; label: string; subtitle: string }[] = [
  { layout: '1x1', label: '1 × 1', subtitle: 'toploader' },
  { layout: '2x2', label: '2 × 2', subtitle: '4 pockets' },
  { layout: '3x3', label: '3 × 3', subtitle: 'standard · 9 pockets' },
  { layout: '3x4', label: '3 × 4', subtitle: '12 pockets · portrait' },
  { layout: '4x3', label: '4 × 3', subtitle: '12 pockets · landscape' },
  { layout: '4x4', label: '4 × 4', subtitle: '16 pockets' },
];

const RE = /^(\d+)x(\d+)$/;

export function parseLayout(layout: string | null | undefined): LayoutDims {
  if (typeof layout === 'string') {
    const m = RE.exec(layout.trim().toLowerCase());
    if (m) {
      const rows = Number(m[1]);
      const cols = Number(m[2]);
      if (rows > 0 && cols > 0) {
        return { rows, cols, total: rows * cols, canonical: `${rows}x${cols}` };
      }
    }
  }
  return { rows: 3, cols: 3, total: 9, canonical: '3x3' };
}
