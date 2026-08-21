import type { CoreCard } from '@/api/types';

export type CatalogSort = 'recent' | 'placements' | 'name' | 'confidence';
export type SortDir = 'asc' | 'desc';

export const SORTS: CatalogSort[] = ['recent', 'placements', 'name', 'confidence'];

export const SORT_LABELS: Record<CatalogSort, string> = {
  recent: 'Recent',
  placements: 'Placements',
  name: 'Name',
  confidence: 'AI confidence',
};

// Direction shown when a sort is first picked. Toggle button inverts from here.
export const SORT_DEFAULT_DIR: Record<CatalogSort, SortDir> = {
  recent: 'desc',
  placements: 'desc',
  name: 'asc',
  confidence: 'asc',
};

export const DIR_HINT: Record<CatalogSort, { asc: string; desc: string }> = {
  recent: { asc: 'oldest first', desc: 'newest first' },
  placements: { asc: 'fewest first', desc: 'most first' },
  name: { asc: 'A → Z', desc: 'Z → A' },
  confidence: { asc: 'lowest first', desc: 'highest first' },
};

// Sort with direction. 'recent' sorts created_at explicitly.
// 'confidence' keeps cards without AI metadata grouped at the end in both
// directions — they have no confidence to compare (the toolbar says so).
export function sortCards(cards: CoreCard[], sort: CatalogSort, dir: SortDir): CoreCard[] {
  if (sort === 'confidence') {
    const isAi = (c: CoreCard) =>
      c.metadata_source === 'claude-skill' && c.metadata_confidence != null;
    const ai = cards
      .filter(isAi)
      .sort((a, b) => (a.metadata_confidence ?? 1) - (b.metadata_confidence ?? 1));
    if (dir === 'desc') ai.reverse();
    return [...ai, ...cards.filter((c) => !isAi(c))];
  }
  const out = [...cards];
  if (sort === 'recent') {
    out.sort((a, b) => a.created_at.localeCompare(b.created_at));
  } else if (sort === 'placements') {
    out.sort(
      (a, b) =>
        a.placement_count - b.placement_count ||
        (a.name ?? '').localeCompare(b.name ?? ''),
    );
  } else {
    out.sort((a, b) => (a.name ?? '~').localeCompare(b.name ?? '~'));
  }
  if (dir === 'desc') out.reverse();
  return out;
}
