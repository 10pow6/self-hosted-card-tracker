import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { Check, Clock, Crop, Library, Plus, TriangleAlert, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ConfidenceChip } from '@/components/decisions/ConfidenceChip';
import { CardPickerDialog } from '@/features/review/CardPickerDialog';
import { confidenceBand } from '@/lib/decisions';
import type { ReviewQueueItem } from '@/api/types';
import { cn } from '@/lib/utils';

type Props = {
  item: ReviewQueueItem;
  // Exactly one item on the page is focused; keyboard shortcuts act on it.
  focused: boolean;
  onFocus: () => void;
  selectedCandidateId: string | null;
  pickerOpen: boolean;
  onPickerOpenChange: (open: boolean) => void;
  onSelectCandidate: (coreCardId: string) => void;
  onConfirm: () => void;
  onPromoteNew: () => void;
  onDefer: () => void; // toggles defer / un-defer based on item.deferred_at
  onPickFromDb: (coreCardId: string) => void;
};

export function ReviewItem({
  item,
  focused,
  onFocus,
  selectedCandidateId,
  pickerOpen,
  onPickerOpenChange,
  onSelectCandidate,
  onConfirm,
  onPromoteNew,
  onDefer,
  onPickFromDb,
}: Props) {
  const { placement, candidates, deferred_at } = item;
  const isDeferred = deferred_at !== null;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ block: 'nearest' });
  }, [focused]);

  const pageTo = `/binders/${placement.binder_id}/pages/${placement.page_number}`;
  const allWeak =
    candidates.length > 0 && confidenceBand(candidates[0].similarity) === 'weak';

  return (
    <Card
      ref={ref}
      onClick={onFocus}
      className={cn(
        'p-4 md:p-5 transition-shadow scroll-mt-4',
        focused && 'ring-2 ring-primary/50 border-primary/40',
        isDeferred && 'border-muted-foreground/30 bg-muted/15',
      )}
    >
      <div className="grid md:grid-cols-[180px_1fr] gap-4 md:gap-6 items-start">
        <div className="space-y-2">
          <div className="microlabel text-muted-foreground">Scanned crop</div>
          {placement.crop_url ? (
            <HoverCard openDelay={200} closeDelay={80}>
              <HoverCardTrigger asChild>
                <div className="aspect-card overflow-hidden rounded-xl border border-border bg-muted cursor-zoom-in">
                  <img
                    src={placement.crop_url}
                    alt="Pending placement"
                    className="size-full object-cover"
                  />
                </div>
              </HoverCardTrigger>
              <HoverCardContent side="right" className="w-72">
                <img
                  src={placement.crop_url}
                  alt="Pending placement (large)"
                  className="aspect-card w-full rounded-lg object-cover"
                />
              </HoverCardContent>
            </HoverCard>
          ) : (
            <div className="aspect-card overflow-hidden rounded-xl border border-border bg-muted" />
          )}
          <div className="text-xs leading-tight space-y-1">
            <Link
              to={pageTo}
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Library className="size-3 shrink-0" />
              <span className="truncate">
                {placement.binder_name} · Page {placement.page_number} · Slot{' '}
                {placement.slot_index + 1}
              </span>
            </Link>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  to={`/placements/${placement.id}/refine`}
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Crop className="size-3 shrink-0" />
                  Fix crop
                </Link>
              </TooltipTrigger>
              <TooltipContent className="max-w-60">
                A badly cropped photo is the most common cause of weak matches. Adjust the
                corners, save, and the candidates refresh.
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="microlabel text-muted-foreground">Model proposals</div>
            {isDeferred && (
              <Badge variant="outline" className="gap-1">
                <Clock className="size-3" />
                Deferred
              </Badge>
            )}
          </div>

          {candidates.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
              The model found no candidates — this is probably a card your catalog hasn't
              seen before. Add it as a new card, or search the catalog yourself.
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {candidates.map((c, i) => {
                const selected = c.core_card.id === selectedCandidateId;
                return (
                  <HoverCard key={c.core_card.id} openDelay={200} closeDelay={80}>
                    <HoverCardTrigger asChild>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onFocus();
                          onSelectCandidate(c.core_card.id);
                        }}
                        className={cn(
                          'group relative text-left rounded-xl border bg-card overflow-hidden transition-all cursor-zoom-in',
                          selected
                            ? 'border-primary ring-2 ring-primary/40'
                            : 'border-border hover:border-primary/60',
                        )}
                      >
                        <div className="aspect-card overflow-hidden">
                          <img
                            src={c.core_card.representative_crop_url}
                            alt={c.core_card.name ?? 'Candidate card'}
                            className="size-full object-cover"
                          />
                        </div>
                        <div className="absolute top-1 left-1 rounded bg-background/85 backdrop-blur px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
                          {i + 1}
                        </div>
                        <div className="absolute top-1 right-1">
                          <ConfidenceChip similarity={c.similarity} size="sm" />
                        </div>
                        <div className="p-2">
                          <div className="text-xs font-medium truncate">
                            {c.core_card.name ?? 'Unknown'}
                          </div>
                          <div className="flex items-center justify-between gap-1">
                            <div className="text-[10px] text-muted-foreground truncate">
                              {[c.core_card.set, c.core_card.number].filter(Boolean).join(' · ') ||
                                '—'}
                            </div>
                            {selected && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-primary shrink-0">
                                <Check className="size-3" />
                                Selected
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    </HoverCardTrigger>
                    <HoverCardContent side="top" className="w-72">
                      <img
                        src={c.core_card.representative_crop_url}
                        alt={c.core_card.name ?? 'Candidate card (large)'}
                        className="aspect-card w-full rounded-lg object-cover"
                      />
                      <div className="px-1 pt-2 pb-1 text-xs">
                        <div className="font-medium truncate">{c.core_card.name ?? 'Unknown'}</div>
                        <div className="text-muted-foreground truncate">
                          {[c.core_card.set, c.core_card.number].filter(Boolean).join(' · ') || '—'}
                        </div>
                        <div className="mt-1.5">
                          <ConfidenceChip similarity={c.similarity} size="sm" />
                        </div>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                );
              })}
            </div>
          )}

          {allWeak && (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
              <TriangleAlert className="size-3.5 shrink-0 mt-px" />
              <span>
                All matches are weak — the crop itself may be off.{' '}
                <Link to={`/placements/${placement.id}/refine`} className="underline underline-offset-2">
                  Fix the crop
                </Link>{' '}
                first; matches usually improve.
              </span>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2 justify-end">
            <Button
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                onDefer();
              }}
            >
              {isDeferred ? <Undo2 className="size-4" /> : <Clock className="size-4" />}
              {isDeferred ? 'Move back to active' : 'Defer'}
            </Button>
            <Button
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                onFocus();
                onPickerOpenChange(true);
              }}
            >
              <Library className="size-4" />
              Pick from catalog…
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPromoteNew();
                  }}
                >
                  <Plus className="size-4" />
                  Add as new card
                </Button>
              </TooltipTrigger>
              <TooltipContent className="max-w-56">
                Creates a new catalog entry from this crop — merge later if it turns out to be
                a duplicate.
              </TooltipContent>
            </Tooltip>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onConfirm();
              }}
              disabled={!selectedCandidateId}
            >
              <Check className="size-4" />
              Confirm match
            </Button>
          </div>

          <CardPickerDialog
            open={pickerOpen}
            onOpenChange={onPickerOpenChange}
            onPick={(c) => {
              onPickerOpenChange(false);
              onPickFromDb(c.id);
            }}
            description="None of the proposals match? Search the full catalog and assign any card to this placement."
          />
        </div>
      </div>
    </Card>
  );
}
