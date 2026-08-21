import { Link } from 'react-router';
import type { Binder } from '@/api/types';
import { Card } from '@/components/ui/card';
import { parseLayout } from '@/lib/layout';

type Props = {
  binder: Binder;
};

export function BinderCard({ binder }: Props) {
  const dims = parseLayout(binder.layout);
  // Pad out to one full page in this binder's layout.
  const slots = Array.from({ length: dims.total }, (_, i) => binder.cover_thumbs[i] ?? null);
  const created = new Date(binder.created_at);
  return (
    <Link
      to={`/binders/${binder.id}`}
      className="group block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Card className="overflow-hidden transition-all group-hover:border-primary/60 group-hover:shadow-lg group-hover:shadow-primary/10 group-hover:-translate-y-0.5">
        <div
          className="grid gap-1 p-2 bg-gradient-to-br from-muted/40 to-muted/10"
          style={{ gridTemplateColumns: `repeat(${dims.cols}, minmax(0, 1fr))` }}
        >
          {slots.map((url, i) => (
            <div key={i} className="aspect-card rounded-md overflow-hidden bg-muted/60 ring-1 ring-border/50">
              {url ? (
                <img src={url} alt="" className="size-full object-cover" draggable={false} />
              ) : null}
            </div>
          ))}
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="font-semibold truncate">{binder.name}</div>
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground tabular-nums">
              {dims.rows}×{dims.cols}
            </span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground flex items-center gap-2 tabular-nums">
            <span>{binder.page_count} pages</span>
            <span className="size-0.5 rounded-full bg-muted-foreground/50" />
            <span>{binder.card_count} cards</span>
            <span className="size-0.5 rounded-full bg-muted-foreground/50" />
            <span>
              {created.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
