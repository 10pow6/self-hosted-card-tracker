import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Download, GitMerge, LayoutGrid, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/PageHeader';
import { CardThumb } from '@/components/CardThumb';
import { EmptyState } from '@/components/EmptyState';
import { Pagination } from '@/components/Pagination';
import { listCards } from '@/api/cardsApi';
import type { CardType, CoreCard } from '@/api/types';

type Filter = CardType | 'all';

const PAGE_SIZE = 24;

export function Cards() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [cards, setCards] = useState<CoreCard[] | null>(null);
  const [filter, setFilter] = useState<Filter>(
    (searchParams.get('type') as Filter) ?? 'all',
  );
  const [needsMetaOnly, setNeedsMetaOnly] = useState(searchParams.get('needs') === '1');
  const [q, setQ] = useState(searchParams.get('q') ?? '');
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);

  useEffect(() => {
    listCards({}).then(setCards);
  }, []);

  // Sync filters into URL (preserves shareable state).
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    filter === 'all' ? next.delete('type') : next.set('type', filter);
    needsMetaOnly ? next.set('needs', '1') : next.delete('needs');
    q ? next.set('q', q) : next.delete('q');
    // Reset to page 1 when filters change.
    next.delete('page');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, needsMetaOnly, q]);

  const filtered = useMemo(() => {
    if (!cards) return null;
    return cards.filter((c) => {
      if (filter !== 'all' && c.type !== filter) return false;
      if (needsMetaOnly && !c.needs_metadata) return false;
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
  }, [cards, filter, needsMetaOnly, q]);

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
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="pokemon">Pokémon</TabsTrigger>
              <TabsTrigger value="sports">Sports</TabsTrigger>
              <TabsTrigger value="other">Other</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button
            variant={needsMetaOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setNeedsMetaOnly((v) => !v)}
          >
            Needs metadata
          </Button>
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, set, number…"
              className="pl-9 pr-9"
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

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {children}
    </div>
  );
}
