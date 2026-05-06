import type { CommitResponse, PreviewResponse, RawPreviewResponse, Slot } from './types';

export async function previewScan(
  file: File,
  opts: { binderId?: string; layout?: string } = {},
): Promise<PreviewResponse> {
  const fd = new FormData();
  fd.append('image', file);
  // Prefer binderId — backend uses that binder's layout AND detection_config.
  // Fall back to a bare layout for binder-less testing.
  if (opts.binderId) fd.append('binder_id', opts.binderId);
  else if (opts.layout) fd.append('layout', opts.layout);
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

export async function commitScan(args: {
  scanId: string;
  binderId: string;
  pageNumber: number;
  slots: Slot[];
}): Promise<CommitResponse> {
  const body = {
    scan_id: args.scanId,
    binder_id: args.binderId,
    page_number: args.pageNumber,
    slots: args.slots.map((s) => ({
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
