import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Props = {
  icon: LucideIcon;
  label: string;
  value: number | string;
  hint?: string;
  tone?: 'default' | 'accent' | 'warn';
  className?: string;
};

const toneClasses: Record<NonNullable<Props['tone']>, string> = {
  default: 'bg-muted text-foreground',
  accent: 'bg-primary/10 text-primary',
  warn: 'bg-[var(--card-needs-review)]/15 text-[var(--card-needs-review)]',
};

export function StatCard({ icon: Icon, label, value, hint, tone = 'default', className }: Props) {
  return (
    <Card className={cn('relative overflow-hidden', className)}>
      <CardContent className="p-4 md:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
            <div className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{value}</div>
            {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
          </div>
          <div className={cn('size-10 rounded-lg grid place-items-center shrink-0', toneClasses[tone])}>
            <Icon className="size-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
