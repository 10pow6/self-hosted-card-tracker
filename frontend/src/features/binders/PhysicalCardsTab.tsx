import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Crop, LayoutGrid, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Pagination } from '@/components/Pagination';
import { StatusBadge } from '@/components/decisions/StatusBadge';
import { ConfidenceChip } from '@/components/decisions/ConfidenceChip';
import { REVIEW_STATUS_META } from '@/lib/decisions';
import { listPlacements } from '@/api/placementApi';
import { getErrorMessage } from '@/api/client';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { PlacementListResponse, PlacementSummary, ReviewStatus } from '@/api/types';

const PAGE_SIZE = 25;
const STATUS_FILTERS: Exclude<ReviewStatus, 'empty'>[] = [
  'pending',
  'auto_matched',
  'user_confirmed',
  'new_card',
];

// Params are namespaced to this tab: pq (search), pstatus (filter), ppage (page).
// Search, filter, and paging all run server-side.
export function PhysicalCardsTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [resp, setResp] = useState<PlacementListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const q = searchParams.get('pq') ?? '';
  const status = searchParams.get('pstatus') ?? 'all';
  const page = Math.max(1, parseInt(searchParams.get('ppage') ?? '1', 10) || 1);
  const debouncedQ = useDebouncedValue(q.trim(), 300);

  const setParam = (key: 'pq' | 'pstatus' | 'ppage', value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'ppage') next.delete('ppage');
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    let cancelled = false;
    setError(null);
    listPlacements({
      q: debouncedQ || undefined,
      reviewStatus:
        status !== 'all' ? (status as Exclude<ReviewStatus, 'empty'>) : undefined,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    })
      .then((r) => {
        if (cancelled) return;
        // Filters shrank the list under our page — snap back to page 1.
        if (r.total > 0 && r.offset >= r.total) {
          setParam('ppage', null);
          return;
        }
        setResp(r);
      })
      .catch((e) => {
        if (!cancelled) setError(getErrorMessage(e));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, status, page, reloadKey]);

  const load = () => {
    setError(null);
    setResp(null);
    setReloadKey((k) => k + 1);
  };

  if (error) return <ErrorState message={error} onRetry={load} />;

  const totalCount = resp?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const slice = resp?.items ?? null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            value={q}
            onChange={(e) => setParam('pq', e.target.value || null)}
            placeholder="Search by card name, binder, set…"
            className="pl-8 pr-8"
          />
          {q && (
            <button
              onClick={() => setParam('pq', null)}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <Select value={status} onValueChange={(v) => setParam('pstatus', v === 'all' ? null : v)}>
          <SelectTrigger aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_FILTERS.map((s) => (
              <SelectItem key={s} value={s}>
                {REVIEW_STATUS_META[s].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {slice === null ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : slice.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title={q || status !== 'all' ? 'No cards match' : 'No cards yet'}
          description={
            q || status !== 'all'
              ? 'Try clearing the search or the status filter.'
              : 'Scan a binder page to populate your collection.'
          }
        />
      ) : (
        <>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Card</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Match</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {slice.map((p) => (
                  <PlacementRow key={p.id} placement={p} />
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination
            page={safePage}
            pageCount={pageCount}
            pageSize={PAGE_SIZE}
            totalCount={totalCount}
            onPageChange={(p) => setParam('ppage', p <= 1 ? null : String(p))}
          />
        </>
      )}
    </>
  );
}

function PlacementRow({ placement: p }: { placement: PlacementSummary }) {
  const meta = [p.core_card_set, p.core_card_number].filter(Boolean).join(' · ');
  return (
    <TableRow>
      <TableCell className="max-w-64">
        <div className="flex items-center gap-3 min-w-0">
          {p.crop_url ? (
            <HoverCard openDelay={200} closeDelay={80}>
              <HoverCardTrigger asChild>
                <div className="aspect-card w-9 shrink-0 rounded-md overflow-hidden bg-muted cursor-zoom-in">
                  <img src={p.crop_url} alt="" className="size-full object-cover" />
                </div>
              </HoverCardTrigger>
              <HoverCardContent side="right" className="w-64">
                <img src={p.crop_url} alt="" className="aspect-card w-full rounded-lg object-cover" />
              </HoverCardContent>
            </HoverCard>
          ) : (
            <div className="aspect-card w-9 shrink-0 rounded-md bg-muted" />
          )}
          <div className="min-w-0">
            {p.core_card_id ? (
              <Link to={`/cards/${p.core_card_id}`} className="block truncate text-sm font-medium hover:underline">
                {p.core_card_name ?? 'Unnamed card'}
              </Link>
            ) : (
              <span className="block truncate text-sm text-muted-foreground italic">Unmatched</span>
            )}
            {meta && <span className="block truncate text-xs text-muted-foreground">{meta}</span>}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Link
          to={`/binders/${p.binder_id}/pages/${p.page_number}`}
          className="text-xs text-muted-foreground hover:text-foreground hover:underline tabular-nums"
        >
          {p.binder_name} · p. {p.page_number} · slot {p.slot_index + 1}
        </Link>
      </TableCell>
      <TableCell>
        <StatusBadge status={p.review_status} size="sm" />
      </TableCell>
      <TableCell>
        {p.similarity_score != null ? (
          <ConfidenceChip similarity={p.similarity_score} size="sm" />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        <Button asChild variant="ghost" size="sm">
          <Link to={`/placements/${p.id}/refine`}>
            <Crop />
            Fix crop
          </Link>
        </Button>
      </TableCell>
    </TableRow>
  );
}
