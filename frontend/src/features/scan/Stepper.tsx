import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ScanStep = 0 | 1 | 2 | 3;

const STEPS = ['Pick binder', 'Capture', 'Adjust boxes', 'Saved'] as const;

// Visible wizard position — the scan flow always shows where you are and
// what's left (the old UI had no step indicator at all).
export function Stepper({ current }: { current: ScanStep }) {
  return (
    <ol className="flex items-center gap-1.5 sm:gap-2 flex-wrap" aria-label="Scan progress">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex items-center gap-1.5 sm:gap-2">
            {i > 0 && <span className={cn('h-px w-4 sm:w-6', done || active ? 'bg-primary/60' : 'bg-border')} />}
            <span
              className={cn(
                'flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium whitespace-nowrap',
                active && 'bg-primary/15 text-primary',
                done && 'text-muted-foreground',
                !active && !done && 'text-muted-foreground/60',
              )}
              aria-current={active ? 'step' : undefined}
            >
              <span
                className={cn(
                  'grid size-4 place-items-center rounded-full text-[10px] tabular-nums',
                  active && 'bg-primary text-primary-foreground',
                  done && 'bg-primary/20 text-primary',
                  !active && !done && 'bg-muted text-muted-foreground',
                )}
              >
                {done ? <Check className="size-2.5" /> : i + 1}
              </span>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
