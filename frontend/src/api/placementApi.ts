import type { Placement, PlacementDetail, PlacementSummary, Point } from './types';

export async function listPlacements(): Promise<PlacementSummary[]> {
  const res = await fetch('/api/placements');
  if (!res.ok) throw new Error(`listPlacements → ${res.status}: ${await res.text()}`);
  return (await res.json()) as PlacementSummary[];
}

type RawPlacementDetail = Omit<PlacementDetail, 'polygon'> & {
  polygon: [number, number][] | null;
};

function hydrate(raw: RawPlacementDetail): PlacementDetail {
  const polygon = raw.polygon
    ? (raw.polygon.map(([x, y]) => ({ x, y })) as PlacementDetail['polygon'])
    : null;
  return { ...raw, polygon } as PlacementDetail;
}

export async function getPlacement(placementId: string): Promise<PlacementDetail | null> {
  const res = await fetch(`/api/placements/${encodeURIComponent(placementId)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`getPlacement → ${res.status}: ${await res.text()}`);
  return hydrate((await res.json()) as RawPlacementDetail);
}

export async function matchPlacement(placementId: string, coreCardId: string): Promise<void> {
  const res = await fetch(`/api/placements/${encodeURIComponent(placementId)}/match`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ core_card_id: coreCardId }),
  });
  if (!res.ok) throw new Error(`matchPlacement → ${res.status}: ${await res.text()}`);
}

export async function promotePlacementToNew(placementId: string): Promise<{ core_card_id: string }> {
  const res = await fetch(`/api/placements/${encodeURIComponent(placementId)}/promote-new`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`promotePlacementToNew → ${res.status}: ${await res.text()}`);
  return await res.json();
}

export async function unmatchPlacement(placementId: string): Promise<void> {
  const res = await fetch(`/api/placements/${encodeURIComponent(placementId)}/unmatch`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`unmatchPlacement → ${res.status}: ${await res.text()}`);
}

export async function refinePolygon(
  placementId: string,
  polygon: Point[],
): Promise<PlacementDetail> {
  const body = { polygon: polygon.map((p) => [p.x, p.y]) };
  const res = await fetch(`/api/placements/${encodeURIComponent(placementId)}/polygon`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`refinePolygon → ${res.status}: ${await res.text()}`);
  return hydrate((await res.json()) as RawPlacementDetail);
}

// Re-export Placement so callers can stay in one import.
export type { Placement };
