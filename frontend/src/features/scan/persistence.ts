import type { CommitResponse, PreviewResponse, Slot } from '@/api/types';

export type SavedPage = { pageNumber: number; cropCount: number; firstCropUrl: string | null };

// iOS Safari sometimes evicts pages with `<input type="file">` from memory while
// the camera is open. When the user comes back, Safari reloads the tab and React
// state is gone — even though the upload may have already succeeded server-side.
// Persist the in-flight scan to sessionStorage so the user lands back on the
// adjust step on /scan?binder=<id> after the reload.
// Shape is unchanged from v1; bump the suffix if PersistedScanState changes.
const SCAN_STATE_KEY = 'card_tracker_scan_state_v1';

export type PersistedScanState = {
  binderId: string;
  pageNumber: number;
  savedPages: SavedPage[];
  preview: PreviewResponse | null;
  slots: Slot[];
  committed: CommitResponse | null;
};

export function loadScanState(binderId: string): PersistedScanState | null {
  try {
    const raw = sessionStorage.getItem(SCAN_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedScanState;
    if (parsed.binderId !== binderId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveScanState(state: PersistedScanState): void {
  try {
    sessionStorage.setItem(SCAN_STATE_KEY, JSON.stringify(state));
  } catch {
    // Quota exceeded or storage unavailable — silently no-op.
  }
}

export function clearScanState(): void {
  try {
    sessionStorage.removeItem(SCAN_STATE_KEY);
  } catch {
    /* ignore */
  }
}
