import type { CommitResponse, PreviewResponse, RawPreviewResponse, Slot } from './types';

export async function previewScan(file: File): Promise<PreviewResponse> {
  const fd = new FormData();
  fd.append('image', file);
  const res = await fetch('/api/scans/preview', { method: 'POST', body: fd });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Preview failed (${res.status}): ${detail}`);
  }
  const raw = (await res.json()) as RawPreviewResponse;
  const slots: Slot[] = raw.slots.map((s) => ({
    slot_index: s.slot_index,
    refined: s.refined,
    disabled: false,
    polygon: s.polygon.map(([x, y]) => ({ x, y })) as Slot['polygon'],
  }));
  return { ...raw, slots };
}

export async function commitScan(scanId: string, slots: Slot[]): Promise<CommitResponse> {
  const body = {
    scan_id: scanId,
    slots: slots.map((s) => ({
      slot_index: s.slot_index,
      disabled: s.disabled,
      polygon: s.polygon.map((p) => [p.x, p.y]),
    })),
  };
  const res = await fetch('/api/scans/commit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Commit failed (${res.status}): ${detail}`);
  }
  return (await res.json()) as CommitResponse;
}
