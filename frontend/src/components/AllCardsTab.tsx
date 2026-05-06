import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Crop, LayoutGrid, MapPin, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { EmptyState } from '@/components/EmptyState';
import { Pagination } from '@/components/Pagination';
import { listPlacements } from '@/api/placementApi';
import type { PlacementSummary, ReviewStatus } from '@/api/types';

const PAGE_SIZE = 24;

export function AllCardsTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<PlacementSummary[] | null>(null);
  const [q, setQ] = useState(searchParams.get('q') ?? '');
  const page = Math.max(1, parseInt(searchParams.get('cpage') ?? '1', 10) || 1);

  useEffect(() => {
    listPlacements().then(setItems);
  }, []);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    q ? next.set('q', q) : next.delete('q');
    next.delete('cpage');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const filtered = useMemo(() => {
    if (!items) return null;
    if (!q) return items;
    const needle = q.toLowerCase();
    return items.filter((p) => {
      const hay = [
        p.binder_name,
        p.core_card_name,
        p.core_card_set,
        p.core_card_number,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [items, q]);

  const totalCount = filtered?.length ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const slice = filtered
    ? filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
    : null;

  const setPage = (p: number) => {
    const next = new URLSearchParams(searchParams);
    p <= 1 ? next.delete('cpage') : next.set('cpage', String(p));
    setSearchParams(next, { replace: true });
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by card name, binder, set…"
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
        <div className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
          {items === null ? '—' : `${totalCount} ${totalCount === 1 ? 'card' : 'cards'}`}
        </div>
      </div>

      {slice === null ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : slice.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title={q ? 'No cards match' : 'No cards yet'}
          description={
            q
              ? 'Try a different search term.'
              : 'Scan a binder page to populate your collection.'
          }
        />
      ) : (
        <>
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {slice.map((p) => (
              <PlacementRow key={p.id} placement={p} />
            ))}
          </ul>
          <Pagination
            page={safePage}
            pageCount={pageCount}
            pageSize={PAGE_SIZE}
            totalCount={totalCount}
            onPageChange={setPage}
          />
        </>
      )}
    </>
  );
}

function PlacementRow({ placement: p }: { placement: PlacementSummary }) {
  const titleParts = [p.core_card_set, p.core_card_number].filter(Boolean);
  return (
    <li className="p-3 flex items-center gap-3">
      {p.crop_url ? (
        <HoverCard openDelay={200} closeDelay={80}>
          <HoverCardTrigger asChild>
            <div className="aspect-card w-12 shrink-0 rounded-md overflow-hidden bg-muted cursor-zoom-in">
              <img src={p.crop_url} alt="" className="size-full object-cover" />
            </div>
          </HoverCardTrigger>
          <HoverCardContent side="right" className="w-64">
            <img
              src={p.crop_url}
              alt=""
              className="aspect-card w-full rounded-lg object-cover"
            />
          </HoverCardContent>
        </HoverCard>
      ) : (
        <div className="aspect-card w-12 shrink-0 rounded-md overflow-hidden bg-muted" />
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">
          {p.core_card_name ?? <span className="text-muted-foreground italic">Unnamed</span>}
          {titleParts.length > 0 && (
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
              {titleParts.join(' · ')}
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {p.binder_name} · page {p.page_number} · slot {p.slot_index + 1}
        </div>
      </div>
      <StatusBadge status={p.review_status} />
      {p.core_card_id && (
        <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
          <Link to={`/cards/${p.core_card_id}`}>
            <LayoutGrid className="size-3.5" />
            Card
          </Link>
        </Button>
      )}
      <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
        <Link to={`/binders/${p.binder_id}/pages/${p.page_number}`}>
          <MapPin className="size-3.5" />
          Page
        </Link>
      </Button>
      <Button asChild variant="outline" size="sm">
        <Link to={`/placements/${p.id}/refine`}>
          <Crop className="size-3.5" />
          Refine
        </Link>
      </Button>
    </li>
  );
}

function StatusBadge({ status }: { status: ReviewStatus }) {
  if (status === 'auto_matched') return <Badge variant="secondary">Auto</Badge>;
  if (status === 'user_confirmed') return <Badge variant="secondary">Confirmed</Badge>;
  if (status === 'new_card') return <Badge variant="secondary">New</Badge>;
  if (status === 'pending') return <Badge variant="outline">Pending</Badge>;
  return null;
}
