import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Camera, Library, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { getBinder, getPage } from '@/api/bindersApi';
import type { Binder, Page } from '@/api/types';
import { parseLayout } from '@/lib/layout';

export function BinderDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const [binder, setBinder] = useState<Binder | null | undefined>(undefined);
  const [pages, setPages] = useState<Page[] | null>(null);

  useEffect(() => {
    getBinder(id).then(setBinder);
  }, [id]);

  useEffect(() => {
    if (!binder) return;
    Promise.all(
      Array.from({ length: binder.page_count }, (_, i) => getPage(binder.id, i + 1)),
    ).then((ps) => setPages(ps.filter((p): p is Page => p !== null)));
  }, [binder]);

  if (binder === undefined) {
    return (
      <>
        <PageHeader title={<Skeleton className="h-8 w-64" />} back={{ to: '/binders', label: 'Binders' }} />
        <div className="px-4 md:px-8 grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-card rounded-xl" />
          ))}
        </div>
      </>
    );
  }
  if (binder === null) {
    return (
      <>
        <PageHeader title="Binder not found" back={{ to: '/binders', label: 'Binders' }} />
        <div className="px-4 md:px-8">
          <EmptyState icon={Library} title="That binder doesn't exist" />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={binder.name}
        description={`${binder.page_count} pages · ${binder.card_count} cards · ${parseLayout(binder.layout).rows}×${parseLayout(binder.layout).cols} pockets`}
        back={{ to: '/binders', label: 'Binders' }}
        actions={
          <Button asChild>
            <Link to={`/scan?binder=${binder.id}`}>
              <Camera className="size-4" />
              Scan a page
            </Link>
          </Button>
        }
      />
      <section className="px-4 md:px-8 pb-12">
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {(pages ?? Array.from({ length: binder.page_count }).map(() => null)).map((p, i) => {
            if (!p)
              return <Skeleton key={i} className="aspect-card rounded-xl" />;
            return <PageThumb key={p.id} binder={binder} page={p} />;
          })}
          <Link
            to={`/scan?binder=${binder.id}`}
            className="group aspect-card rounded-xl border-2 border-dashed border-border bg-card/40 grid place-items-center text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
          >
            <div className="flex flex-col items-center gap-2">
              <Plus className="size-6" />
              <span className="text-xs font-medium">Scan a page</span>
            </div>
          </Link>
        </div>
      </section>
    </>
  );
}

function PageThumb({ binder, page }: { binder: Binder; page: Page }) {
  const dims = parseLayout(binder.layout);
  return (
    <Link to={`/binders/${binder.id}/pages/${page.page_number}`} className="group">
      <Card className="overflow-hidden p-2 transition-all group-hover:border-primary/60 group-hover:-translate-y-0.5">
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${dims.cols}, minmax(0, 1fr))` }}
        >
          {page.placements.map((pl) => (
            <div
              key={pl.id}
              className="aspect-card rounded bg-muted overflow-hidden ring-1 ring-border/40"
            >
              {pl.crop_url ? (
                <img src={pl.crop_url} alt="" className="size-full object-cover" />
              ) : (
                <div className="size-full grid place-items-center text-[10px] text-muted-foreground">
                  empty
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="px-1 pt-2 pb-1 flex items-center justify-between">
          <div className="text-xs font-medium">Page {page.page_number}</div>
          <div className="text-[10px] text-muted-foreground">
            {page.placements.filter((p) => p.review_status === 'pending').length > 0 && (
              <span className="text-[var(--card-needs-review)]">needs review</span>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}
