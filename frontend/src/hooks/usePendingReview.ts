import { useEffect, useSyncExternalStore } from 'react';
import { getStats } from '@/api/dashboardApi';

// Tiny module-level store for the pending-review count so the nav badge and
// screens stay in sync. Call refreshPendingReview() after any mutation that
// changes the queue (scan commit, confirm, defer, promote, …).

let count: number | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export async function refreshPendingReview(): Promise<void> {
  try {
    const stats = await getStats();
    count = stats.pending_review;
  } catch {
    // Keep the last known value; the badge is advisory.
  }
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePendingReview(): number | null {
  const value = useSyncExternalStore(subscribe, () => count);
  useEffect(() => {
    if (count === null) void refreshPendingReview();
  }, []);
  return value;
}
