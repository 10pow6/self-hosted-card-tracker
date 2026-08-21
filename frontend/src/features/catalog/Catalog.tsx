import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { GitMerge, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Page } from '@/components/Page';
import { PageHeader } from '@/components/PageHeader';
import { CardThumb } from '@/components/CardThumb';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { ExportButton } from '@/components/ExportButton';
import { Pagination } from '@/components/Pagination';
import { listCards } from '@/api/cardsApi';
import { getErrorMessage } from '@/api/client';
import { exportUrls } from '@/api/exportsApi';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { CoreCard } from '@/api/types';
import { CatalogToolbar, type TypeFilter } from './CatalogToolbar';
import {
  SORT_DEFAULT_DIR,
  SORTS,
  sortCards,
  type CatalogSort,
  type SortDir,
} from './catalogSort';

const PAGE_SIZE = 24;

export function Catalog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [cards, setCards] = useState<CoreCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [type, setType] = useState<TypeFilter>((searchParams.get('type') as TypeFilter) ?? 'all');
  const [needsInfo, setNeedsInfo] = useState(searchParams.get('needs') === '1');
  const [unnamed, setUnnamed] = useState(searchParams.get('unnamed') === '1');
  const [q, setQ] = useState(searchParams.get('q') ?? '');
  const [sort, setSort] = useState<CatalogSort>(
    (SORTS as string[]).includes(searchParams.get('sort') ?? '')
      ? (searchParams.get('sort') as CatalogSort)
      : 'recent',
  );
  const [dir, setDir] = useState<SortDir>(
    searchParams.get('dir') === 'asc' || searchParams.get('dir') === 'desc'
      ? (searchParams.get('dir') as SortDir)
      : SORT_DEFAULT_DIR[
          (SORTS as string[]).includes(searchParams.get('sort') ?? '')
            ? (searchParams.get('sort') as CatalogSort)
            : 'recent'
        ],
  );
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);

  const debouncedQ = useDebouncedValue(q.trim());

  // Server-side filtering — type, needs_metadata, and q all go to the API.
  useEffect(() => {
    let cancelled = false;
    setError(null);
    listCards({
      type,
      needsMetadata: needsInfo || undefined,
      q: debouncedQ || undefined,
    })
      .then((rows) => {
        if (!cancelled) setCards(rows);
      })
      .catch((e) => {
        if (!cancelled) {
          setCards(null);
          setError(getErrorMessage(e));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [type, needsInfo, debouncedQ, reloadKey]);

  // Sync filters into URL (shareable state).
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (type === 'all') next.delete('type');
    else next.set('type', type);
    if (needsInfo) next.set('needs', '1');
    else next.delete('needs');
    if (unnamed) next.set('unnamed', '1');
    else next.delete('unnamed');
    if (q) next.set('q', q);
    else next.delete('q');
    if (sort === 'recent') next.delete('sort');
    else next.set('sort', sort);
    if (dir === SORT_DEFAULT_DIR[sort]) next.delete('dir');
    else next.set('dir', dir);
    next.delete('page');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, needsInfo, unnamed, q, sort, dir]);

  const visible = useMemo(() => {
    if (!cards) return null;
    const rows = unnamed ? cards.filter((c) => !c.name) : cards;
    return sortCards(rows, sort, dir);
  }, [cards, unnamed, sort, dir]);

  const totalCount = visible?.length ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const slice = visible ? visible.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE) : null;

  const setPage = (p: number) => {
    const next = new URLSearchParams(searchParams);
    if (p <= 1) next.delete('page');
    else next.set('page', String(p));
    setSearchParams(next, { replace: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Page>
      <PageHeader
        title="Catalog"
        description="Every distinct card you've cataloged — type-agnostic. Pokémon and sports coexist."
        actions={
          <div className="flex items-center gap-2">
            <ExportButton url={exportUrls.allCards} filename="catalog.pdf">
              Export PDF
            </ExportButton>
            <Button asChild variant="outline" size="sm">
              <Link to="/cards/merge">
                <GitMerge className="size-3.5" />
                Merge duplicates
              </Link>
            </Button>
          </div>
        }
      />

      <CatalogToolbar
        type={type}
        onTypeChange={setType}
        needsInfo={needsInfo}
        onNeedsInfoChange={setNeedsInfo}
        unnamed={unnamed}
        onUnnamedChange={setUnnamed}
        q={q}
        onQChange={setQ}
        sort={sort}
        dir={dir}
        onSortChange={(s, d) => {
          setSort(s);
          setDir(d);
        }}
        count={visible === null ? null : totalCount}
      />

      {sort === 'confidence' && (
        <p className="mb-4 -mt-2 text-xs text-muted-foreground">
          Sorted by the enrichment model's own confidence. Cards without AI metadata are listed
          last — they have nothing to compare.
        </p>
      )}

      {error ? (
        <ErrorState message={error} onRetry={() => setReloadKey((k) => k + 1)} />
      ) : slice === null ? (
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
    </Page>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {children}
    </div>
  );
}
