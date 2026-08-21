import type { CoreCard } from '@/api/types';
import { TONE_CLASSES, formatSimilarity, metadataProvenance } from '@/lib/decisions';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { SparklesIcon, UserIcon } from 'lucide-react';

type Props = {
  card: Pick<CoreCard, 'metadata_source' | 'needs_metadata' | 'metadata_confidence'>;
  size?: 'sm' | 'md';
  className?: string;
};

// Metadata-provenance chip: who wrote this card's metadata — you, the AI
// enrichment skill, or nobody yet. AI-enriched shows the model's own
// confidence alongside.
export function ProvenanceBadge({ card, size = 'md', className }: Props) {
  const meta = metadataProvenance(card.metadata_source, card.needs_metadata);
  const tone = TONE_CLASSES[meta.tone];
  const isAi = card.metadata_source === 'claude-skill';
  const isHuman = card.metadata_source === 'manual';
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap cursor-default',
            size === 'md' ? 'px-2 py-0.5 text-xs' : 'px-1.5 py-px text-[11px]',
            tone.chip,
            className,
          )}
        >
          {isAi && <SparklesIcon className="size-3" />}
          {isHuman && <UserIcon className="size-3" />}
          {meta.label}
          {isAi && card.metadata_confidence != null && (
            <span className="opacity-75 tabular-nums">{formatSimilarity(card.metadata_confidence)}</span>
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{meta.whoDecided}</TooltipContent>
    </Tooltip>
  );
}
