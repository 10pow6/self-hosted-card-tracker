import { useState } from 'react';
import { Check, Clock, Database, Plus, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { CardPickerDialog } from '@/components/CardPickerDialog';
import type { ReviewQueueItem } from '@/api/types';
import { cn } from '@/lib/utils';

type Props = {
  item: ReviewQueueItem;
  selectedCandidateId: string | null;
  onSelectCandidate: (coreCardId: string) => void;
  onConfirm: () => void;
  onPromoteNew: () => void;
  onDefer: () => void; // toggles defer / un-defer based on item.deferred_at
  onPickFromDb: (coreCardId: string) => void; // assigns any CORE card from full DB
};

export function ReviewItem({
  item,
  selectedCandidateId,
  onSelectCandidate,
  onConfirm,
  onPromoteNew,
  onDefer,
  onPickFromDb,
}: Props) {
  const { placement, candidates, deferred_at } = item;
  const isDeferred = deferred_at !== null;
  const [pickerOpen, setPickerOpen] = useState(false);
  return (
    <Card className={cn('p-4 md:p-5', isDeferred && 'border-muted-foreground/30 bg-muted/15')}>
      <div className="grid md:grid-cols-[180px_1fr] gap-4 md:gap-6 items-start">
        <div className="space-y-2">
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
          <div className="text-xs text-muted-foreground leading-tight">
            <div className="truncate">{placement.binder_name}</div>
            <div>
              Page {placement.page_number} · slot {placement.slot_index + 1}
            </div>
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="text-sm text-muted-foreground">Top candidates in your database</div>
            {isDeferred ? (
              <Badge variant="outline" className="gap-1">
                <Clock className="size-3" />
                Deferred
              </Badge>
            ) : (
              <Badge variant="secondary">Pending</Badge>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {candidates.map((c, i) => {
              const selected = c.core_card.id === selectedCandidateId;
              return (
                <HoverCard key={c.core_card.id} openDelay={200} closeDelay={80}>
                  <HoverCardTrigger asChild>
                    <button
                      type="button"
                      onClick={() => onSelectCandidate(c.core_card.id)}
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
                      <div className="absolute top-1 left-1 rounded bg-background/85 backdrop-blur px-1.5 py-0.5 text-[10px] font-semibold">
                        {i + 1}
                      </div>
                      <div className="absolute top-1 right-1 rounded bg-background/85 backdrop-blur px-1.5 py-0.5 text-[10px] font-mono">
                        {(c.similarity * 100).toFixed(0)}%
                      </div>
                      <div className="p-2">
                        <div className="text-xs font-medium truncate">
                          {c.core_card.name ?? 'Unknown'}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {[c.core_card.set, c.core_card.number].filter(Boolean).join(' · ')}
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
                      <div className="text-muted-foreground font-mono mt-0.5">
                        {(c.similarity * 100).toFixed(1)}% similarity
                      </div>
                    </div>
                  </HoverCardContent>
                </HoverCard>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 justify-end">
            {isDeferred ? (
              <Button variant="ghost" onClick={onDefer}>
                <Undo2 className="size-4" />
                Move back to active
              </Button>
            ) : (
              <Button variant="ghost" onClick={onDefer}>
                <Clock className="size-4" />
                Defer
              </Button>
            )}
            <Button variant="outline" onClick={() => setPickerOpen(true)}>
              <Database className="size-4" />
              Pick from DB
            </Button>
            <Button variant="outline" onClick={onPromoteNew}>
              <Plus className="size-4" />
              Add as new card
            </Button>
            <Button onClick={onConfirm} disabled={!selectedCandidateId}>
              <Check className="size-4" />
              Confirm match
            </Button>
          </div>

          <CardPickerDialog
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            onPick={(c) => {
              setPickerOpen(false);
              onPickFromDb(c.id);
            }}
            title="Pick from card database"
            description="None of the top candidates match? Search the full database and assign any card to this placement."
          />
        </div>
      </div>
    </Card>
  );
}
