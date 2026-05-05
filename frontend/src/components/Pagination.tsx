import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Props = {
  page: number; // 1-indexed
  pageCount: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  className?: string;
};

export function Pagination({
  page,
  pageCount,
  pageSize,
  totalCount,
  onPageChange,
  className,
}: Props) {
  if (pageCount <= 1) {
    // Still surface the count so the user knows what they're seeing.
    return (
      <div className={cn('mt-6 text-xs text-muted-foreground tabular-nums', className)}>
        {totalCount} item{totalCount === 1 ? '' : 's'}
      </div>
    );
  }
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(start + pageSize - 1, totalCount);
  const pages = paginationPages(page, pageCount);
  return (
    <div className={cn('mt-6 flex flex-wrap items-center justify-between gap-3', className)}>
      <div className="text-xs text-muted-foreground tabular-nums order-2 sm:order-1">
        Showing{' '}
        <span className="text-foreground font-medium">
          {start}–{end}
        </span>{' '}
        of {totalCount}
      </div>
      <nav className="flex items-center gap-1 order-1 sm:order-2" aria-label="Pagination">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <div className="hidden sm:flex items-center gap-1">
          {pages.map((p, i) =>
            p === '…' ? (
              <span
                key={`ellipsis-${i}`}
                className="size-8 grid place-items-center text-muted-foreground"
                aria-hidden
              >
                <MoreHorizontal className="size-4" />
              </span>
            ) : (
              <Button
                key={p}
                variant={p === page ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onPageChange(p)}
                className="min-w-8 px-2 tabular-nums"
                aria-current={p === page ? 'page' : undefined}
              >
                {p}
              </Button>
            ),
          )}
        </div>
        <span className="sm:hidden text-sm tabular-nums px-3 text-muted-foreground">
          Page <span className="text-foreground font-medium">{page}</span> of {pageCount}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page === pageCount}
          aria-label="Next page"
        >
          <ChevronRight className="size-4" />
        </Button>
      </nav>
    </div>
  );
}

// Compact page list with ellipses, e.g. [1, '…', 4, 5, 6, '…', 12].
function paginationPages(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | '…')[] = [1];
  if (current > 3) out.push('…');
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let p = start; p <= end; p++) out.push(p);
  if (current < total - 2) out.push('…');
  out.push(total);
  return out;
}
