import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ChevronLeft, ChevronRight, Crop, Image, Library, SquareArrowOutUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Page } from '@/components/Page';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { StatusBadge } from '@/components/decisions/StatusBadge';
import { REVIEW_STATUS_META, TONE_CLASSES } from '@/lib/decisions';
import { getBinder, getPage } from '@/api/bindersApi';
import { getErrorMessage } from '@/api/client';
import type { Binder, Page as BinderPage, Placement, ReviewStatus } from '@/api/types';
import { parseLayout } from '@/lib/layout';
import { cn } from '@/lib/utils';

export function PageDetail() {
  const { id = '', n = '1' } = useParams<{ id: string; n: string }>();
  const pageNumber = Number(n);
  const navigate = useNavigate();
  const [binder, setBinder] = useState<Binder | null | undefined>(undefined);
  const [page, setPage] = useState<BinderPage | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [showPhoto, setShowPhoto] = useState(false);

  const load = () => {
    setError(null);
    setBinder(undefined);
    setPage(undefined);
    Promise.all([getBinder(id), getPage(id, pageNumber)])
      .then(([b, p]) => {
        setBinder(b);
        setPage(p);
      })
      .catch((e) => setError(getErrorMessage(e)));
  };
  useEffect(load, [id, pageNumber]);

  if (error) {
    return (
      <Page width="narrow">
        <PageHeader title="Page" back={{ to: `/binders/${id}`, label: 'Binder' }} />
        <ErrorState message={error} onRetry={load} />
      </Page>
    );
  }
  if (binder === undefined || page === undefined) {
    return (
      <Page width="narrow">
        <PageHeader title={<Skeleton className="h-8 w-72" />} back={{ to: `/binders/${id}`, label: 'Binder' }} />
        <Skeleton className="aspect-[63/88] max-w-2xl rounded-xl" />
      </Page>
    );
  }
  if (!binder || !page) {
    return (
      <Page width="narrow">
        <PageHeader title="Page not found" back={{ to: `/binders/${id}`, label: 'Binder' }} />
        <EmptyState icon={Library} title="That page doesn't exist in this binder" />
      </Page>
    );
  }

  const pendingCount = page.placements.filter((p) => p.review_status === 'pending').length;
  const dims = parseLayout(binder.layout);
  const canPrev = pageNumber > 1;
  const canNext = pageNumber < binder.page_count;

  return (
    <Page width="narrow">
      <PageHeader
        title={`Page ${page.page_number}`}
        description={
          pendingCount > 0 ? (
            <>
              {pendingCount} of {page.placements.length} slots{' '}
              <Link to="/review" className="text-warning hover:underline">
                need review →
              </Link>
            </>
          ) : (
            `${dims.rows}×${dims.cols} pockets`
          )
        }
        back={{ to: `/binders/${binder.id}`, label: binder.name }}
        actions={
          <div className="flex items-center gap-1">
            {page.source_image_url && (
              <Button
                variant={showPhoto ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setShowPhoto((v) => !v)}
              >
                <Image />
                {showPhoto ? 'Hide photo' : 'Original photo'}
              </Button>
            )}
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Previous page"
              disabled={!canPrev}
              onClick={() => navigate(`/binders/${binder.id}/pages/${pageNumber - 1}`)}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Next page"
              disabled={!canNext}
              onClick={() => navigate(`/binders/${binder.id}/pages/${pageNumber + 1}`)}
            >
              <ChevronRight />
            </Button>
          </div>
        }
      />

      {showPhoto && page.source_image_url && (
        <Card className="mb-4 overflow-hidden p-2">
          <img
            src={page.source_image_url}
            alt={`Original scan of page ${page.page_number}`}
            className="w-full rounded-lg"
          />
        </Card>
      )}

      <Card className="overflow-hidden p-3">
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${dims.cols}, minmax(0, 1fr))` }}
        >
          {page.placements.map((p) => (
            <PlacementSlot key={p.id} placement={p} />
          ))}
        </div>
      </Card>

      <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {(['user_confirmed', 'auto_matched', 'pending', 'new_card', 'empty'] as ReviewStatus[]).map(
          (status) => (
            <div key={status} className="flex items-center gap-2">
              <span className={cn('size-2.5 rounded-full', TONE_CLASSES[REVIEW_STATUS_META[status].tone].dot)} />
              <span className="text-muted-foreground">{REVIEW_STATUS_META[status].label}</span>
            </div>
          ),
        )}
      </div>
    </Page>
  );
}

function PlacementSlot({ placement }: { placement: Placement }) {
  if (placement.review_status === 'empty') {
    return (
      <div className="relative aspect-card rounded-md border-2 border-dashed border-border bg-muted/30 grid place-items-center text-muted-foreground text-xs">
        slot {placement.slot_index + 1}
      </div>
    );
  }
  // Identity is the common question — matched slots open the card;
  // unmatched slots fall back to the refine workbench.
  const target = placement.core_card_id
    ? `/cards/${placement.core_card_id}`
    : `/placements/${placement.id}/refine`;
  const borderClass = TONE_CLASSES[REVIEW_STATUS_META[placement.review_status].tone].border;
  return (
    <HoverCard openDelay={250} closeDelay={100}>
      <HoverCardTrigger asChild>
        <Link to={target} className="group block">
          <div
            className={cn(
              'relative aspect-card rounded-md overflow-hidden border-2 transition-all group-hover:brightness-110',
              borderClass,
            )}
          >
            {placement.crop_url ? (
              <img src={placement.crop_url} alt="" className="size-full object-cover" />
            ) : (
              <div className="size-full bg-muted" />
            )}
            <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-background/85 text-[10px] font-medium tabular-nums">
              {placement.slot_index + 1}
            </span>
          </div>
        </Link>
      </HoverCardTrigger>
      <HoverCardContent side="right" className="w-56 space-y-2">
        {placement.crop_url && (
          <img src={placement.crop_url} alt="" className="aspect-card w-full rounded-lg object-cover" />
        )}
        {placement.core_card_id && (
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">
              {placement.core_card_name ?? 'Unnamed card'}
            </div>
            {(placement.core_card_set || placement.core_card_number) && (
              <div className="text-xs text-muted-foreground truncate">
                {[placement.core_card_set, placement.core_card_number].filter(Boolean).join(' · ')}
              </div>
            )}
          </div>
        )}
        <StatusBadge status={placement.review_status} size="sm" />
        <div className="flex flex-col gap-1 pt-1">
          {placement.core_card_id && (
            <Link
              to={`/cards/${placement.core_card_id}`}
              className="inline-flex items-center gap-1.5 text-xs text-foreground hover:underline"
            >
              <SquareArrowOutUpRight className="size-3" />
              Open card
            </Link>
          )}
          <Link
            to={`/placements/${placement.id}/refine`}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            <Crop className="size-3" />
            Fix crop / reassign
          </Link>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
