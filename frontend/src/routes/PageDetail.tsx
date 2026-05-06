import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Library } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { getBinder, getPage } from '@/api/bindersApi';
import type { Binder, Page, Placement, ReviewStatus } from '@/api/types';
import { parseLayout } from '@/lib/layout';
import { cn } from '@/lib/utils';

export function PageDetail() {
  const { id = '', n = '1' } = useParams<{ id: string; n: string }>();
  const pageNumber = Number(n);
  const [binder, setBinder] = useState<Binder | null | undefined>(undefined);
  const [page, setPage] = useState<Page | null | undefined>(undefined);

  useEffect(() => {
    getBinder(id).then(setBinder);
    getPage(id, pageNumber).then(setPage);
  }, [id, pageNumber]);

  if (binder === undefined || page === undefined) {
    return (
      <>
        <PageHeader title={<Skeleton className="h-8 w-72" />} back={{ to: `/binders/${id}`, label: 'Binder' }} />
        <div className="px-4 md:px-8">
          <Skeleton className="aspect-[63/88] max-w-2xl rounded-xl" />
        </div>
      </>
    );
  }
  if (!binder || !page) {
    return (
      <>
        <PageHeader title="Page not found" back={{ to: `/binders/${id}`, label: 'Binder' }} />
        <div className="px-4 md:px-8">
          <EmptyState icon={Library} title="That page doesn't exist in this binder" />
        </div>
      </>
    );
  }

  const pendingCount = page.placements.filter((p) => p.review_status === 'pending').length;
  const dims = parseLayout(binder.layout);

  return (
    <>
      <PageHeader
        title={`${binder.name} · Page ${page.page_number}`}
        description={`Slot grid: ${dims.rows}×${dims.cols}. ${pendingCount} pending review.`}
        back={{ to: `/binders/${binder.id}`, label: binder.name }}
      />
      <section className="px-4 md:px-8 pb-12 max-w-3xl">
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

        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <StatusLegend status="user_confirmed" label="Confirmed" />
          <StatusLegend status="auto_matched" label="Auto-matched" />
          <StatusLegend status="pending" label="Pending review" />
          <StatusLegend status="empty" label="Empty pocket" />
        </div>
      </section>
    </>
  );
}

function PlacementSlot({ placement }: { placement: Placement }) {
  if (placement.review_status === 'empty') {
    return (
      <div className="relative aspect-card rounded-md border-2 border-dashed border-border bg-muted/30 grid place-items-center text-muted-foreground text-xs">
        slot {placement.slot_index + 1}
        <span className="absolute bottom-1 right-2 text-[10px] opacity-70">empty</span>
      </div>
    );
  }
  // Clicking a populated slot goes to the refine view — the most powerful action
  // here (re-crop / move / promote / unmatch). The refine sidebar links to the
  // currently-matched CORE card if you just want to inspect that.
  const linkTarget = `/placements/${placement.id}/refine`;
  return (
    <Link to={linkTarget} className="group">
      <div
        className={cn(
          'relative aspect-card rounded-md overflow-hidden border-2 transition-all',
          placement.review_status === 'pending'
            ? 'border-[var(--card-needs-review)]'
            : 'border-[var(--card-refined)]/70 group-hover:border-[var(--card-refined)]',
        )}
      >
        {placement.crop_url ? (
          <img src={placement.crop_url} alt="" className="size-full object-cover" />
        ) : (
          <div className="size-full bg-muted" />
        )}
        <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-background/85 text-[10px] font-medium">
          {placement.slot_index + 1}
        </span>
        {placement.review_status === 'pending' && (
          <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-[var(--card-needs-review)]/90 text-[10px] font-semibold text-black">
            review
          </span>
        )}
      </div>
    </Link>
  );
}

function StatusLegend({ status, label }: { status: ReviewStatus; label: string }) {
  const colorClass = {
    pending: 'bg-[var(--card-needs-review)]',
    auto_matched: 'bg-[var(--card-refined)]/70',
    user_confirmed: 'bg-[var(--card-refined)]',
    new_card: 'bg-primary',
    empty: 'bg-muted-foreground/40',
  }[status];
  return (
    <div className="flex items-center gap-2">
      <span className={cn('size-2.5 rounded-full', colorClass)} />
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

