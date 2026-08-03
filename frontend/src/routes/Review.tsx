import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Inbox, Keyboard } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/PageHeader';
import { ReviewItem } from '@/components/ReviewItem';
import { EmptyState } from '@/components/EmptyState';
import { Pagination } from '@/components/Pagination';
import { confirmMatch, confirmNew, defer, getQueue, undefer } from '@/api/reviewApi';
import type { ReviewQueueItem } from '@/api/types';

const PAGE_SIZE = 5;
type Tab = 'active' | 'deferred';

export function Review() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [queue, setQueue] = useState<ReviewQueueItem[] | null>(null);
  const [selectedByPlacement, setSelectedByPlacement] = useState<Record<string, string>>({});
  const tab: Tab = searchParams.get('tab') === 'deferred' ? 'deferred' : 'active';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);

  const refresh = useCallback(async () => {
    const q = await getQueue();
    setQueue(q);
    // Always snap to the current top candidate. Adding a new CORE elsewhere
    // can re-rank a remaining placement's candidates; preserving the prior
    // selection (even if still present) leaves the ring on a non-top tile,
    // which is exactly the bug we're avoiding. Manual #2 picks are ephemeral
    // within the current render — re-click after a refresh if needed.
    setSelectedByPlacement(() => {
      const next: Record<string, string> = {};
      for (const item of q) {
        if (item.candidates.length) {
          next[item.placement.id] = item.candidates[0].core_card.id;
        }
      }
      return next;
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const select = (placementId: string, coreCardId: string) => {
    setSelectedByPlacement((prev) => ({ ...prev, [placementId]: coreCardId }));
  };

  const handleConfirm = useCallback(
    async (placementId: string) => {
      const coreCardId = selectedByPlacement[placementId];
      if (!coreCardId) return;
      await confirmMatch(placementId, coreCardId);
      refresh();
    },
    [selectedByPlacement, refresh],
  );

  const handlePickFromDb = useCallback(
    async (placementId: string, coreCardId: string) => {
      await confirmMatch(placementId, coreCardId);
      refresh();
    },
    [refresh],
  );

  const handleNew = useCallback(
    async (placementId: string) => {
      await confirmNew(placementId);
      refresh();
    },
    [refresh],
  );

  // Toggles defer / un-defer based on the item's current state.
  const handleDeferToggle = useCallback(
    async (item: ReviewQueueItem) => {
      if (item.deferred_at) await undefer(item.placement.id);
      else await defer(item.placement.id);
      refresh();
    },
    [refresh],
  );

  const counts = useMemo(() => {
    if (!queue) return { active: 0, deferred: 0 };
    let active = 0;
    let deferred = 0;
    for (const item of queue) {
      if (item.deferred_at) deferred += 1;
      else active += 1;
    }
    return { active, deferred };
  }, [queue]);

  const tabItems = useMemo(() => {
    if (!queue) return null;
    return queue.filter((item) =>
      tab === 'deferred' ? item.deferred_at !== null : item.deferred_at === null,
    );
  }, [queue, tab]);

  const totalCount = tabItems?.length ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const slice = tabItems ? tabItems.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE) : null;

  const setTab = (next: Tab) => {
    const params = new URLSearchParams(searchParams);
    next === 'active' ? params.delete('tab') : params.set('tab', next);
    params.delete('page');
    setSearchParams(params, { replace: true });
  };

  const setPage = (p: number) => {
    const params = new URLSearchParams(searchParams);
    p <= 1 ? params.delete('page') : params.set('page', String(p));
    setSearchParams(params, { replace: true });
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Keyboard shortcuts target the FIRST item on the current page of the current tab.
  useEffect(() => {
    if (!slice || slice.length === 0) return;
    const first = slice[0];
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'y') handleConfirm(first.placement.id);
      else if (e.key === 'd') handleDeferToggle(first);
      else if (e.key === '+' || e.key === '=') handleNew(first.placement.id);
      else if (['1', '2', '3'].includes(e.key)) {
        const idx = Number(e.key) - 1;
        const c = first.candidates[idx];
        if (c) select(first.placement.id, c.core_card.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [slice, handleConfirm, handleNew, handleDeferToggle]);

  const deferShortcutLabel = tab === 'deferred' ? 'restore' : 'defer';

  return (
    <>
      <PageHeader
        title="Work queue"
        description="Each pending placement, side-by-side with its top candidates from your card database. Confirm, promote to a new card, or defer for later."
        actions={
          <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground border border-border rounded-md px-2.5 py-1.5">
            <Keyboard className="size-3.5" />
            <kbd className="font-mono">1/2/3</kbd> pick · <kbd className="font-mono">y</kbd> confirm ·{' '}
            <kbd className="font-mono">+</kbd> new · <kbd className="font-mono">d</kbd>{' '}
            {deferShortcutLabel}
          </div>
        }
      />
      <section className="px-4 md:px-8 pb-12 max-w-5xl">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mb-5">
          <TabsList>
            <TabsTrigger value="active" className="gap-2">
              Active
              <Badge variant={tab === 'active' ? 'secondary' : 'outline'} className="tabular-nums">
                {counts.active}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="deferred" className="gap-2">
              Deferred
              <Badge variant={tab === 'deferred' ? 'secondary' : 'outline'} className="tabular-nums">
                {counts.deferred}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {slice === null ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-60 rounded-xl" />
            ))}
          </div>
        ) : slice.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={tab === 'deferred' ? 'No deferred items' : 'Queue is clear'}
            description={
              tab === 'deferred'
                ? 'When you defer an active item it shows up here. Use the d shortcut to defer the top item.'
                : 'No pending matches right now. Scan more pages to refill the queue.'
            }
          />
        ) : (
          <>
            <div className="space-y-3">
              {slice.map((item) => (
                <ReviewItem
                  key={item.placement.id}
                  item={item}
                  selectedCandidateId={selectedByPlacement[item.placement.id] ?? null}
                  onSelectCandidate={(id) => select(item.placement.id, id)}
                  onConfirm={() => handleConfirm(item.placement.id)}
                  onPromoteNew={() => handleNew(item.placement.id)}
                  onDefer={() => handleDeferToggle(item)}
                  onPickFromDb={(coreCardId) => handlePickFromDb(item.placement.id, coreCardId)}
                />
              ))}
            </div>
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
