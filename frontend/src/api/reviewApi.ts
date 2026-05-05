import type { ReviewQueueItem } from './types';

async function postEmpty(url: string): Promise<void> {
  const res = await fetch(url, { method: 'POST' });
  if (!res.ok) throw new Error(`${url} → ${res.status}: ${await res.text()}`);
}

export async function getQueue(): Promise<ReviewQueueItem[]> {
  const res = await fetch('/api/review/queue');
  if (!res.ok) throw new Error(`getQueue → ${res.status}: ${await res.text()}`);
  return (await res.json()) as ReviewQueueItem[];
}

export async function confirmMatch(placementId: string, coreCardId: string): Promise<void> {
  const res = await fetch(`/api/review/${encodeURIComponent(placementId)}/match`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ core_card_id: coreCardId }),
  });
  if (!res.ok) throw new Error(`confirmMatch → ${res.status}: ${await res.text()}`);
}

export async function confirmNew(placementId: string): Promise<void> {
  await postEmpty(`/api/review/${encodeURIComponent(placementId)}/new`);
}

export async function defer(placementId: string): Promise<void> {
  await postEmpty(`/api/review/${encodeURIComponent(placementId)}/defer`);
}

export async function undefer(placementId: string): Promise<void> {
  await postEmpty(`/api/review/${encodeURIComponent(placementId)}/undefer`);
}
