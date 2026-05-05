import { LAYOUT_PRESETS, parseLayout } from '@/lib/layout';
import { cn } from '@/lib/utils';

type Props = {
  value: string;
  onChange: (layout: string) => void;
  className?: string;
};

export function LayoutPicker({ value, onChange, className }: Props) {
  return (
    <div className={cn('grid grid-cols-3 sm:grid-cols-3 gap-2', className)}>
      {LAYOUT_PRESETS.map((p) => {
        const active = value === p.layout;
        const dims = parseLayout(p.layout);
        return (
          <button
            key={p.layout}
            type="button"
            onClick={() => onChange(p.layout)}
            aria-pressed={active}
            className={cn(
              'group rounded-lg border p-3 text-left transition-colors',
              active
                ? 'border-primary bg-primary/10'
                : 'border-border bg-card hover:bg-muted',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-medium text-sm">{p.label}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{p.subtitle}</div>
              </div>
              <MiniGrid rows={dims.rows} cols={dims.cols} active={active} />
            </div>
          </button>
        );
      })}
    </div>
  );
}

function MiniGrid({ rows, cols, active }: { rows: number; cols: number; active: boolean }) {
  // Cap visual cell density so 4×4 still reads as a grid.
  const total = rows * cols;
  return (
    <div
      className="size-10 grid gap-[1.5px] shrink-0"
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}
    >
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'rounded-[1.5px] border',
            active ? 'border-primary bg-primary/30' : 'border-muted-foreground/40 bg-muted',
          )}
        />
      ))}
    </div>
  );
}
