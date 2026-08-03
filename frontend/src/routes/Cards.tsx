import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
  ArrowDownNarrowWide,
  ArrowUpNarrowWide,
  ChevronDown,
  Download,
  GitMerge,
  LayoutGrid,
  Search,
  X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageHeader } from '@/components/PageHeader';
import { CardThumb } from '@/components/CardThumb';
import { EmptyState } from '@/components/EmptyState';
import { Pagination } from '@/components/Pagination';
import { listCards } from '@/api/cardsApi';
import type { CardType, CoreCard } from '@/api/types';

type Filter = CardType | 'all';
type Sort = 'recent' | 'placements' | 'name' | 'confidence';
type Dir = 'asc' | 'desc';

const PAGE_SIZE = 24;
const LOW_CONFIDENCE = 0.7;

const SORTS: Sort[] = ['recent', 'placements', 'name', 'confidence'];
const SORT_LABELS: Record<Sort, string> = {
  recent: 'Recent',
  placements: 'Placements',
  name: 'Name',
  confidence: 'AI confidence',
};
// Direction shown when a sort is first picked. Toggle button inverts from here.
const SORT_DEFAULT_DIR: Record<Sort, Dir> = {
  recent: 'desc',
  placements: 'desc',
  name: 'asc',
  confidence: 'asc',
};
const DIR_HINT: Record<Sort, { asc: string; desc: string }> = {
  recent: { asc: 'oldest first', desc: 'newest first' },
  placements: { asc: 'fewest first', desc: 'most first' },
  name: { asc: 'A → Z', desc: 'Z → A' },
  confidence: { asc: 'lowest first', desc: 'highest first' },
};

const TYPE_LABELS: Record<CardType, string> = {
  pokemon: 'Pokémon',
  sports: 'Sports',
  other: 'Other',
};

export function Cards() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [cards, setCards] = useState<CoreCard[] | null>(null);

  const [filter, setFilter] = useState<Filter>(
    (searchParams.get('type') as Filter) ?? 'all',
  );
  const [needsMetaOnly, setNeedsMetaOnly] = useState(searchParams.get('needs') === '1');
  const [hasPlacements, setHasPlacements] = useState(searchParams.get('placed') === '1');
  const [aiOnly, setAiOnly] = useState(searchParams.get('ai') === '1');
  const [lowConfidence, setLowConfidence] = useState(searchParams.get('low') === '1');
  const [q, setQ] = useState(searchParams.get('q') ?? '');
  const [sort, setSort] = useState<Sort>(
    (SORTS as string[]).includes(searchParams.get('sort') ?? '')
      ? (searchParams.get('sort') as Sort)
      : 'recent',
  );
  const [dir, setDir] = useState<Dir>(
    searchParams.get('dir') === 'asc' || searchParams.get('dir') === 'desc'
      ? (searchParams.get('dir') as Dir)
      : SORT_DEFAULT_DIR[
          (SORTS as string[]).includes(searchParams.get('sort') ?? '')
            ? (searchParams.get('sort') as Sort)
            : 'recent'
        ],
  );
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);

  useEffect(() => {
    listCards({}).then(setCards);
  }, []);

  // Sync filters into URL (preserves shareable state).
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    filter === 'all' ? next.delete('type') : next.set('type', filter);
    needsMetaOnly ? next.set('needs', '1') : next.delete('needs');
    hasPlacements ? next.set('placed', '1') : next.delete('placed');
    aiOnly ? next.set('ai', '1') : next.delete('ai');
    lowConfidence ? next.set('low', '1') : next.delete('low');
    q ? next.set('q', q) : next.delete('q');
    sort === 'recent' ? next.delete('sort') : next.set('sort', sort);
    dir === SORT_DEFAULT_DIR[sort] ? next.delete('dir') : next.set('dir', dir);
    next.delete('page');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, needsMetaOnly, hasPlacements, aiOnly, lowConfidence, q, sort, dir]);

  const filtered = useMemo(() => {
    if (!cards) return null;
    const matches = cards.filter((c) => {
      if (filter !== 'all' && c.type !== filter) return false;
      if (needsMetaOnly && !c.needs_metadata) return false;
      if (hasPlacements && c.placement_count <= 0) return false;
      if (aiOnly && c.metadata_source !== 'claude-skill') return false;
      if (lowConfidence) {
        if (c.metadata_source !== 'claude-skill') return false;
        if (c.metadata_confidence == null) return false;
        if (c.metadata_confidence >= LOW_CONFIDENCE) return false;
      }
      if (q) {
        const needle = q.toLowerCase();
        const hay = [c.name, c.set, c.number, c.year?.toString()]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    return sortCards(matches, sort, dir);
  }, [cards, filter, needsMetaOnly, hasPlacements, aiOnly, lowConfidence, q, sort, dir]);

  const totalCount = filtered?.length ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const slice = filtered
    ? filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
    : null;

  const setPage = (p: number) => {
    const next = new URLSearchParams(searchParams);
    p <= 1 ? next.delete('page') : next.set('page', String(p));
    setSearchParams(next, { replace: true });
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const pickSort = (s: Sort) => {
    setSort(s);
    setDir(SORT_DEFAULT_DIR[s]);
  };

  const toggleDir = () => setDir((d) => (d === 'asc' ? 'desc' : 'asc'));

  const activeChips: Array<{ key: string; label: string; onRemove: () => void }> = [];
  if (filter !== 'all')
    activeChips.push({
      key: 'type',
      label: TYPE_LABELS[filter],
      onRemove: () => setFilter('all'),
    });
  if (needsMetaOnly)
    activeChips.push({
      key: 'needs',
      label: 'Needs metadata',
      onRemove: () => setNeedsMetaOnly(false),
    });
  if (hasPlacements)
    activeChips.push({
      key: 'placed',
      label: 'Has placements',
      onRemove: () => setHasPlacements(false),
    });
  if (aiOnly)
    activeChips.push({
      key: 'ai',
      label: 'AI-enriched',
      onRemove: () => setAiOnly(false),
    });
  if (lowConfidence)
    activeChips.push({
      key: 'low',
      label: 'Low confidence',
      onRemove: () => setLowConfidence(false),
    });
  if (q)
    activeChips.push({
      key: 'q',
      label: `“${q}”`,
      onRemove: () => setQ(''),
    });

  const clearAll = () => {
    setFilter('all');
    setNeedsMetaOnly(false);
    setHasPlacements(false);
    setAiOnly(false);
    setLowConfidence(false);
    setQ('');
  };

  return (
    <>
      <PageHeader
        title="Card database"
        description="Every distinct card you've cataloged — type-agnostic. Pokémon and sports coexist."
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <a href="/api/cards/export.pdf" download>
                <Download className="size-3.5" />
                Export PDF
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/cards/merge">
                <GitMerge className="size-3.5" />
                Merge duplicates
              </Link>
            </Button>
          </div>
        }
      />
      <section className="px-4 md:px-8 pb-12">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="pokemon">Pokémon</TabsTrigger>
              <TabsTrigger value="sports">Sports</TabsTrigger>
              <TabsTrigger value="other">Other</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <span className="text-muted-foreground">Sort:</span>
                  <span className="font-medium">{SORT_LABELS[sort]}</span>
                  <ChevronDown className="size-3.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44">
                {SORTS.map((s) => (
                  <DropdownMenuItem
                    key={s}
                    onClick={() => pickSort(s)}
                    className={s === sort ? 'font-medium' : ''}
                  >
                    {SORT_LABELS[s]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleDir}
              aria-label={`Sort direction: ${DIR_HINT[sort][dir]}`}
              title={DIR_HINT[sort][dir]}
              className="px-2"
            >
              {dir === 'asc' ? (
                <ArrowUpNarrowWide className="size-3.5" />
              ) : (
                <ArrowDownNarrowWide className="size-3.5" />
              )}
            </Button>
          </div>

          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {cards === null ? '—' : `${totalCount} card${totalCount === 1 ? '' : 's'}`}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <ToggleChip active={needsMetaOnly} onClick={() => setNeedsMetaOnly((v) => !v)}>
            Needs metadata
          </ToggleChip>
          <ToggleChip active={hasPlacements} onClick={() => setHasPlacements((v) => !v)}>
            Has placements
          </ToggleChip>
          <ToggleChip active={aiOnly} onClick={() => setAiOnly((v) => !v)}>
            AI-enriched
          </ToggleChip>
          <ToggleChip active={lowConfidence} onClick={() => setLowConfidence((v) => !v)}>
            Low confidence
          </ToggleChip>
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, set, number…"
              className="pl-9 pr-9 h-8"
            />
            {q && (
              <button
                onClick={() => setQ('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        {activeChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mb-5 text-xs">
            <span className="text-muted-foreground">Active:</span>
            {activeChips.map((c) => (
              <button
                key={c.key}
                onClick={c.onRemove}
                className="inline-flex items-center gap-1 rounded-full border bg-muted/40 hover:bg-muted px-2 py-0.5"
              >
                <span>{c.label}</span>
                <X className="size-3 opacity-60" />
              </button>
            ))}
            <button
              onClick={clearAll}
              className="ml-1 text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            >
              Clear all
            </button>
          </div>
        )}

        {slice === null ? (
          <Grid>
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="aspect-card rounded-xl" />
            ))}
          </Grid>
        ) : slice.length === 0 ? (
          <EmptyState
            icon={LayoutGrid}
            title="No cards match"
            description="Try clearing filters or scanning more pages."
          />
        ) : (
          <>
            <Grid>
              {slice.map((c) => (
                <CardThumb key={c.id} card={c} to={`/cards/${c.id}`} />
              ))}
            </Grid>
            <Pagination
              page={safePage}
              pageCount={pageCount}
              pageSize={PAGE_SIZE}
              totalCount={totalCount}
              onPageChange={setPage}
            />
          </>
        )}
      </section>
    </>
  );
}

function ToggleChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant={active ? 'default' : 'outline'}
      size="sm"
      onClick={onClick}
      className="h-8 rounded-full"
    >
      {children}
    </Button>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {children}
    </div>
  );
}

// Sort with direction. 'recent' uses backend order as desc baseline.
// 'confidence' keeps non-AI cards parked at the bottom in both directions —
// they have nothing to review.
function sortCards(cards: CoreCard[], sort: Sort, dir: Dir): CoreCard[] {
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
  if (sort === 'placements') {
    out.sort(
      (a, b) =>
        b.placement_count - a.placement_count ||
        (a.name ?? '').localeCompare(b.name ?? ''),
    );
  } else if (sort === 'name') {
    out.sort((a, b) => (a.name ?? '~').localeCompare(b.name ?? '~'));
  }
  if (dir !== SORT_DEFAULT_DIR[sort]) out.reverse();
  return out;
}
