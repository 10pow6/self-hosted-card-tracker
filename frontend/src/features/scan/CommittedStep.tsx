import { Link } from 'react-router';
import { Camera, Check, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/decisions/StatusBadge';
import { ConfidenceChip } from '@/components/decisions/ConfidenceChip';
import { REVIEW_STATUS_META, TONE_CLASSES } from '@/lib/decisions';
import type { CommitResponse } from '@/api/types';

type Props = {
  committed: CommitResponse;
  pageNumber: number;
  cols: number;
  onNext: () => void;
  onDone: () => void;
};

// Step 4 — what the pipeline decided about each slot, with provenance and a
// direct path into the review queue. Auto-matches are the model's decisions,
// pending slots are the user's to make; neither is a dead end here.
export function CommittedStep({ committed, pageNumber, cols, onNext, onDone }: Props) {
  const { summary } = committed;
  const hasPending = summary.pending > 0;

  return (
    <Card className="overflow-hidden border-primary/40 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
      <CardContent className="p-5 md:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-primary/15 text-primary grid place-items-center">
            <Check className="size-5" />
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Page {pageNumber} saved</div>
            <div className="text-xl font-semibold tabular-nums">
              {committed.crops.length} card{committed.crops.length === 1 ? '' : 's'}
              {committed.empty_slots.length > 0 && ` · ${committed.empty_slots.length} empty`}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground tabular-nums">
          {summary.auto_matched > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-ai" />
              {summary.auto_matched} auto-matched by the model
            </span>
          )}
          {summary.pending > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-warning" />
              {summary.pending} awaiting your review
            </span>
          )}
          {summary.new_cards > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-info" />
              {summary.new_cards} new in catalog
            </span>
          )}
        </div>

        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {committed.crops.map((c) => {
            const tone = TONE_CLASSES[REVIEW_STATUS_META[c.status].tone];
            return (
              <div
                key={c.slot_index}
                className={`aspect-card rounded-md overflow-hidden border-2 ${tone.border} relative`}
              >
                <img src={c.crop_url} alt={`slot ${c.slot_index + 1}`} className="size-full object-cover" />
                <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-background/85 text-xs tabular-nums">
                  {c.slot_index + 1}
                </span>
                <span className="absolute bottom-1 left-1 right-1 flex flex-wrap items-center justify-between gap-1">
                  <StatusBadge status={c.status} size="sm" className="bg-background/85" />
                  {c.status !== 'new_card' && (
                    <ConfidenceChip similarity={c.similarity} size="sm" className="bg-background/85" />
                  )}
                </span>
              </div>
            );
          })}
          {committed.empty_slots.map((idx) => (
            <div
              key={`e-${idx}`}
              className="aspect-card rounded-md border-2 border-dashed border-border bg-muted/30 grid place-items-center text-muted-foreground text-sm tabular-nums"
            >
              {idx + 1} · empty
            </div>
          ))}
        </div>

        {hasPending && (
          <p className="text-xs text-muted-foreground">
            Pending slots stay unmatched until you decide them — they don't enter your catalog on
            the model's word alone.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 justify-end">
          <Button variant="ghost" onClick={onDone}>
            Done
          </Button>
          <Button variant={hasPending ? 'outline' : 'default'} onClick={onNext}>
            <Camera className="size-4" />
            Scan page {pageNumber + 1}
          </Button>
          {hasPending && (
            <Button asChild>
              <Link to="/review">
                <Inbox className="size-4" />
                Review {summary.pending} pending now
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
