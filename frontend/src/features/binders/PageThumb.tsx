import { Link } from 'react-router';
import type { Binder, Page } from '@/api/types';
import { Card } from '@/components/ui/card';
import { parseLayout } from '@/lib/layout';

export function PageThumb({ binder, page }: { binder: Binder; page: Page }) {
  const dims = parseLayout(binder.layout);
  const pending = page.placements.filter((p) => p.review_status === 'pending').length;
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
          <div className="text-xs font-medium tabular-nums">Page {page.page_number}</div>
          {pending > 0 && (
            <span className="text-[10px] font-medium text-warning tabular-nums">
              {pending} need review
            </span>
          )}
        </div>
      </Card>
    </Link>
  );
}
