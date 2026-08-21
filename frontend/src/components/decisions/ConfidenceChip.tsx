import { BAND_TONE, TONE_CLASSES, confidenceBand, formatSimilarity } from '@/lib/decisions';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type Props = {
  similarity: number; // 0..1
  size?: 'sm' | 'md';
  className?: string;
};

// Model-confidence chip: "92% · strong". Number is always paired with its
// band word; tooltip sets expectations about what similarity does and
// doesn't mean (DESIGN.md · Components).
export function ConfidenceChip({ similarity, size = 'md', className }: Props) {
  const band = confidenceBand(similarity);
  const tone = TONE_CLASSES[BAND_TONE[band]];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full font-medium tabular-nums whitespace-nowrap cursor-default',
            size === 'md' ? 'px-2 py-0.5 text-xs' : 'px-1.5 py-px text-[11px]',
            tone.chip,
            className,
          )}
        >
          {formatSimilarity(similarity)}
          <span className="opacity-75">· {band}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">
        Visual similarity between this crop and the catalog card, judged by the embedding
        model. It's advisory — strong ≥ 90%, plausible 75–89%, weak below 75%. You make the
        final call.
      </TooltipContent>
    </Tooltip>
  );
}
