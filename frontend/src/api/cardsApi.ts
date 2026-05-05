import type { CardType, CoreCard, Placement } from './types';

export type CardFilter = {
  type?: CardType | 'all';
  needsMetadata?: boolean;
  q?: string;
};

export async function listCards(filter: CardFilter = {}): Promise<CoreCard[]> {
  const params = new URLSearchParams();
  if (filter.type && filter.type !== 'all') params.set('type', filter.type);
  if (filter.needsMetadata) params.set('needs_metadata', 'true');
  if (filter.q) params.set('q', filter.q);
  const url = `/api/cards${params.toString() ? `?${params}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`listCards → ${res.status}: ${await res.text()}`);
  return (await res.json()) as CoreCard[];
}

export async function getCard(id: string): Promise<CoreCard | null> {
  const res = await fetch(`/api/cards/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`getCard → ${res.status}: ${await res.text()}`);
  return (await res.json()) as CoreCard;
}

export async function listPlacementsForCard(coreCardId: string): Promise<Placement[]> {
  const res = await fetch(`/api/cards/${encodeURIComponent(coreCardId)}/placements`);
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`listPlacementsForCard → ${res.status}: ${await res.text()}`);
  return (await res.json()) as Placement[];
}

export type MergeResult = {
  target: CoreCard;
  moved_placements: number;
};

export async function mergeCards(sourceId: string, targetId: string): Promise<MergeResult> {
  const res = await fetch(`/api/cards/${encodeURIComponent(sourceId)}/merge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_id: targetId }),
  });
  if (!res.ok) throw new Error(`mergeCards → ${res.status}: ${await res.text()}`);
  return (await res.json()) as MergeResult;
}
