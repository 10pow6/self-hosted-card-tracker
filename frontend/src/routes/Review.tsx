import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Camera, Inbox, Keyboard } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Kbd } from '@/components/ui/kbd';
import { Page } from '@/components/Page';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Pagination } from '@/components/Pagination';
import { ReviewItem } from '@/features/review/ReviewItem';
import { confirmMatch, confirmNew, defer, getQueue, undefer } from '@/api/reviewApi';
import { getErrorMessage } from '@/api/client';
import { refreshPendingReview } from '@/hooks/usePendingReview';
import type { ReviewQueueItem, ReviewQueueResponse } from '@/api/types';

const PAGE_SIZE = 5;
type Tab = 'active' | 'deferred';

export function Review() {
  const [searchParams, setSearchParams] = useSearchParams();
  // One server page of the queue plus totals for both tabs.
  const [data, setData] = useState<ReviewQueueResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedByPlacement, setSelectedByPlacement] = useState<Record<string, string>>({});
  // Keyboard shortcuts act on exactly one visibly focused item.
  const [focusIndex, setFocusIndex] = useState(0);
  // Which item's pick-from-catalog dialog is open (lifted so `p` can open it).
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const tab: Tab = searchParams.get('tab') === 'deferred' ? 'deferred' : 'active';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      const q = await getQueue({ tab, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
      setData(q);
      // Snap selection to the current top candidate: candidates re-rank as the
      // catalog changes, so a stale manual pick must not survive a refresh.
      setSelectedByPlacement(() => {
        const next: Record<string, string> = {};
        for (const item of q.items) {
          if (item.candidates.length) {
            next[item.placement.id] = item.candidates[0].core_card.id;
          }
        }
        return next;
      });
    } catch (e) {
      setLoadError(getErrorMessage(e));
    }
  }, [tab, page]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Reset focus when the visible list changes shape.
  useEffect(() => {
    setFocusIndex(0);
  }, [tab, page]);

  const totalForTab = data ? (tab === 'deferred' ? data.total_deferred : data.total_active) : 0;
  const pageCount = Math.max(1, Math.ceil(totalForTab / PAGE_SIZE));
  const items = data?.items ?? null;
  const safeFocus = items && items.length > 0 ? Math.min(focusIndex, items.length - 1) : 0;

  const setPage = useCallback(
    (p: number) => {
      const params = new URLSearchParams(searchParams);
      if (p <= 1) params.delete('page');
      else params.set('page', String(p));
      setSearchParams(params, { replace: true });
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [searchParams, setSearchParams],
  );

  // If the fetched page came back empty but the tab still has items (last item
  // on the page was resolved, or ?page= overshot after totals shrank), step
  // back to the nearest valid page — the param change triggers a refetch.
  useEffect(() => {
    if (data && data.items.length === 0 && page > 1 && totalForTab > 0) {
      setPage(Math.min(page - 1, pageCount));
    }
  }, [data, page, totalForTab, pageCount, setPage]);

  const select = (placementId: string, coreCardId: string) => {
    setSelectedByPlacement((prev) => ({ ...prev, [placementId]: coreCardId }));
  };

  const afterMutation = useCallback(async () => {
    await refresh();
    void refreshPendingReview();
  }, [refresh]);

  const handleConfirm = useCallback(
    async (placementId: string) => {
      const coreCardId = selectedByPlacement[placementId];
      if (!coreCardId) return;
      try {
        await confirmMatch(placementId, coreCardId);
        toast.success('Match confirmed');
      } catch (e) {
        toast.error(getErrorMessage(e));
      }
      afterMutation();
    },
    [selectedByPlacement, afterMutation],
  );

  const handlePickFromDb = useCallback(
    async (placementId: string, coreCardId: string) => {
      try {
        await confirmMatch(placementId, coreCardId);
        toast.success('Match confirmed from catalog');
      } catch (e) {
        toast.error(getErrorMessage(e));
      }
      afterMutation();
    },
    [afterMutation],
  );

  const handleNew = useCallback(
    async (placementId: string) => {
      try {
        await confirmNew(placementId);
        toast.success('Added to the catalog as a new card');
      } catch (e) {
        toast.error(getErrorMessage(e));
      }
      afterMutation();
    },
    [afterMutation],
  );

  const handleDeferToggle = useCallback(
    async (item: ReviewQueueItem) => {
      try {
        if (item.deferred_at) {
          await undefer(item.placement.id);
          toast.success('Moved back to active');
        } else {
          await defer(item.placement.id);
          toast.success('Deferred for later');
        }
      } catch (e) {
        toast.error(getErrorMessage(e));
      }
      afterMutation();
    },
    [afterMutation],
  );

  const setTab = (next: Tab) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'active') params.delete('tab');
    else params.set('tab', next);
    params.delete('page');
    setSearchParams(params, { replace: true });
  };

  // Keyboard model: j/k or arrows move focus; everything else acts on the
  // focused item only. Disabled while any dialog is open or a field has focus.
  useEffect(() => {
    if (!items || items.length === 0) return;
    const focusedItem = items[safeFocus];
    const onKey = (e: KeyboardEvent) => {
      if (pickerFor !== null) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (
        t instanceof HTMLInputElement ||
        t instanceof HTMLTextAreaElement ||
        (t && t.isContentEditable)
      )
        return;
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusIndex((i) => Math.min(i + 1, items.length - 1));
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'y') {
        handleConfirm(focusedItem.placement.id);
      } else if (e.key === 'd') {
        handleDeferToggle(focusedItem);
      } else if (e.key === 'n') {
        handleNew(focusedItem.placement.id);
      } else if (e.key === 'p') {
        setPickerFor(focusedItem.placement.id);
      } else if (['1', '2', '3'].includes(e.key)) {
        const c = focusedItem.candidates[Number(e.key) - 1];
        if (c) select(focusedItem.placement.id, c.core_card.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [items, safeFocus, pickerFor, handleConfirm, handleNew, handleDeferToggle]);

  const renderBody = () => {
    if (loadError) {
      return <ErrorState message={loadError} onRetry={refresh} />;
    }
    if (items === null) {
      return (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-60 rounded-xl" />
          ))}
        </div>
      );
    }
    if (items.length === 0) {
      return tab === 'deferred' ? (
        <EmptyState
          icon={Inbox}
          title="No deferred items"
          description="Deferring sets an item aside without deciding anything — it waits here until you move it back."
        />
      ) : (
        <EmptyState
          icon={Inbox}
          title="Queue is clear"
          description="Every placement has been decided. Scan more pages to refill the queue."
          action={
            <Button asChild>
              <Link to="/scan">
                <Camera className="size-4" />
                Scan a page
              </Link>
            </Button>
          }
        />
      );
    }
    return (
      <>
        <div className="mb-2 text-xs text-muted-foreground tabular-nums">
          {totalForTab} in queue
        </div>
        <div className="space-y-3">
          {items.map((item, i) => (
            <ReviewItem
              key={item.placement.id}
              item={item}
              focused={i === safeFocus}
              onFocus={() => setFocusIndex(i)}
              selectedCandidateId={selectedByPlacement[item.placement.id] ?? null}
              pickerOpen={pickerFor === item.placement.id}
              onPickerOpenChange={(open) => setPickerFor(open ? item.placement.id : null)}
              onSelectCandidate={(id) => select(item.placement.id, id)}
              onConfirm={() => handleConfirm(item.placement.id)}
              onPromoteNew={() => handleNew(item.placement.id)}
              onDefer={() => handleDeferToggle(item)}
              onPickFromDb={(coreCardId) => handlePickFromDb(item.placement.id, coreCardId)}
            />
          ))}
        </div>
        <Pagination
          page={Math.min(page, pageCount)}
          pageCount={pageCount}
          pageSize={PAGE_SIZE}
          totalCount={totalForTab}
          onPageChange={setPage}
        />
      </>
    );
  };

  return (
    <Page>
      <PageHeader
        title="Review queue"
        description="The model ranked catalog candidates for each scanned crop by visual similarity. Nothing is written to your collection until you decide here."
        actions={
          <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground border border-border rounded-lg px-2.5 py-1.5">
            <Keyboard className="size-3.5" />
            <Kbd>j</Kbd>
            <Kbd>k</Kbd> move · <Kbd>1</Kbd>–<Kbd>3</Kbd> pick · <Kbd>y</Kbd> confirm ·{' '}
            <Kbd>n</Kbd> new · <Kbd>d</Kbd> {tab === 'deferred' ? 'restore' : 'defer'} ·{' '}
            <Kbd>p</Kbd> catalog
          </div>
        }
      />
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="mb-5">
          <TabsTrigger value="active" className="gap-2">
            Active
            <Badge variant={tab === 'active' ? 'secondary' : 'outline'} className="tabular-nums">
              {data?.total_active ?? 0}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="deferred" className="gap-2">
            Deferred
            <Badge variant={tab === 'deferred' ? 'secondary' : 'outline'} className="tabular-nums">
              {data?.total_deferred ?? 0}
            </Badge>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="active">{tab === 'active' && renderBody()}</TabsContent>
        <TabsContent value="deferred">{tab === 'deferred' && renderBody()}</TabsContent>
      </Tabs>
    </Page>
  );
}
