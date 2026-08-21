import type { ReviewStatus } from '@/api/types';
import { REVIEW_STATUS_META, TONE_CLASSES } from '@/lib/decisions';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type Props = {
  status: ReviewStatus;
  size?: 'sm' | 'md';
  className?: string;
};

// Review-status chip. Always explains *who decided* via tooltip —
// AI decisions must never masquerade as facts (DESIGN.md · Do's and Don'ts).
export function StatusBadge({ status, size = 'md', className }: Props) {
  const meta = REVIEW_STATUS_META[status];
  const tone = TONE_CLASSES[meta.tone];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap cursor-default',
            size === 'md' ? 'px-2 py-0.5 text-xs' : 'px-1.5 py-px text-[11px]',
            tone.chip,
            className,
          )}
        >
          <span className={cn('rounded-full', size === 'md' ? 'size-1.5' : 'size-1', tone.dot)} />
          {meta.label}
        </span>
      </TooltipTrigger>
      <TooltipContent>{meta.whoDecided}</TooltipContent>
    </Tooltip>
  );
}
