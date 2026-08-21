import { useMemo } from 'react';
import { Link } from 'react-router';
import type { SavedPage } from './persistence';

type Props = {
  binderId: string;
  pages: SavedPage[];
};

// Pages saved this session — each links to its page view for a quick check.
export function SessionStrip({ binderId, pages }: Props) {
  const totalCards = useMemo(() => pages.reduce((acc, p) => acc + p.cropCount, 0), [pages]);
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="microlabel text-muted-foreground">This session</div>
        <div className="text-xs text-muted-foreground tabular-nums">
          {pages.length} page{pages.length === 1 ? '' : 's'} · {totalCards} card{totalCards === 1 ? '' : 's'}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {pages.map((p) => (
          <Link
            key={p.pageNumber}
            to={`/binders/${binderId}/pages/${p.pageNumber}`}
            className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5 hover:border-primary/50 transition-colors"
          >
            <div className="aspect-card w-6 rounded overflow-hidden bg-muted shrink-0">
              {p.firstCropUrl && <img src={p.firstCropUrl} alt="" className="size-full object-cover" />}
            </div>
            <div className="text-xs leading-tight">
              <div className="font-medium tabular-nums">Page {p.pageNumber}</div>
              <div className="text-muted-foreground tabular-nums">{p.cropCount} cards</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
