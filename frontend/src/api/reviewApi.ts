import type { ReviewQueueResponse } from './types';

async function postEmpty(url: string): Promise<void> {
  const res = await fetch(url, { method: 'POST' });
  if (!res.ok) throw new Error(`${url} → ${res.status}: ${await res.text()}`);
}

export type QueueParams = {
  tab?: 'active' | 'deferred';
  limit?: number;
  offset?: number;
};

export async function getQueue(params: QueueParams = {}): Promise<ReviewQueueResponse> {
  const search = new URLSearchParams();
  if (params.tab) search.set('tab', params.tab);
  if (params.limit !== undefined) search.set('limit', String(params.limit));
  if (params.offset !== undefined) search.set('offset', String(params.offset));
  const res = await fetch(`/api/review/queue${search.size ? `?${search}` : ''}`);
  if (!res.ok) throw new Error(`getQueue → ${res.status}: ${await res.text()}`);
  return (await res.json()) as ReviewQueueResponse;
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
