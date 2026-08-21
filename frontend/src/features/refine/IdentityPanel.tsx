import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowRight, ExternalLink, Inbox, Plus, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { StatusBadge } from '@/components/decisions/StatusBadge';
import { ConfidenceChip } from '@/components/decisions/ConfidenceChip';
import { MovePlacementDialog } from '@/features/catalog/MovePlacementDialog';
import { matchPlacement, promotePlacementToNew, unmatchPlacement } from '@/api/placementApi';
import { getErrorMessage } from '@/api/client';
import { refreshPendingReview } from '@/hooks/usePendingReview';
import type { Candidate, PlacementDetail } from '@/api/types';

type Props = {
  placement: PlacementDetail;
  onChanged: () => void | Promise<void>;
};

// The "Identity" half of the refine screen: who this card is.
// Kept strictly separate from crop editing — reassignments confirm first.
export function IdentityPanel({ placement, onChanged }: Props) {
  const navigate = useNavigate();
  const [moveOpen, setMoveOpen] = useState(false);
  const [pendingCandidate, setPendingCandidate] = useState<Candidate | null>(null);
  const [confirmPromote, setConfirmPromote] = useState(false);
  const [confirmUnmatch, setConfirmUnmatch] = useState(false);

  const current = placement.core_card;
  const currentName = current?.name ?? 'the current entry';

  const reassign = async (candidate: Candidate) => {
    try {
      await matchPlacement(placement.id, candidate.core_card.id);
      toast.success(
        `Reassigned to ${candidate.core_card.name ?? 'selected card'} — recorded as confirmed by you`,
      );
      void refreshPendingReview();
      await onChanged();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const promote = async () => {
    try {
      const res = await promotePlacementToNew(placement.id);
      toast.success('Created a new catalog entry from this placement');
      void refreshPendingReview();
      navigate(`/cards/${res.core_card_id}`);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const unmatch = async () => {
    try {
      await unmatchPlacement(placement.id);
      toast.success('Sent back to the review queue');
      void refreshPendingReview();
      await onChanged();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  return (
    <div className="space-y-4 min-w-0">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="microlabel text-muted-foreground">Identity</div>
            <StatusBadge status={placement.review_status} size="sm" />
          </div>
          {current ? (
            <div className="flex items-start gap-3">
              <ZoomThumb
                src={current.representative_crop_url}
                className="aspect-card w-14 rounded-md overflow-hidden bg-muted shrink-0"
              />
              <div className="min-w-0">
                <Link
                  to={`/cards/${current.id}`}
                  className="text-sm font-medium truncate block hover:underline underline-offset-2"
                >
                  {current.name ?? 'Unknown'}
                </Link>
                <div className="text-xs text-muted-foreground truncate">
                  {[current.set, current.number, current.year].filter(Boolean).join(' · ') ||
                    current.type}
                </div>
                {placement.similarity_score != null && (
                  <div className="mt-1.5">
                    <ConfidenceChip similarity={placement.similarity_score} size="sm" />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">
              No card linked yet — the review queue will surface this slot.
            </div>
          )}
          <AuditTrail placement={placement} />
          <div className="grid grid-cols-1 gap-1 pt-1">
            {current && (
              <Button asChild variant="outline" size="sm">
                <Link to={`/cards/${current.id}`}>
                  <ExternalLink className="size-3.5" />
                  View in catalog
                </Link>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setMoveOpen(true)}>
              <ArrowRight className="size-3.5" />
              Move to a different card
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirmPromote(true)}>
              <Plus className="size-3.5" />
              Promote to new card
            </Button>
            {placement.review_status !== 'pending' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmUnmatch(true)}
                className="text-destructive"
              >
                <Inbox className="size-3.5" />
                Send back to review
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="microlabel text-muted-foreground">Top candidates</div>
              <div className="text-xs text-muted-foreground mt-1">
                Ranked by the embedding model. Candidates re-rank after you save crop changes.
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => void onChanged()}
              aria-label="Refresh candidates"
            >
              <RefreshCcw className="size-3.5" />
            </Button>
          </div>
          {placement.candidates.length === 0 ? (
            <div className="text-xs text-muted-foreground">No candidates.</div>
          ) : (
            <ul className="space-y-2">
              {placement.candidates.map((c) => {
                const isCurrent = placement.core_card_id === c.core_card.id;
                return (
                  <li key={c.core_card.id}>
                    <button
                      type="button"
                      onClick={() => setPendingCandidate(c)}
                      disabled={isCurrent}
                      className="w-full text-left flex items-center gap-2 rounded-md border border-border bg-card px-2 py-2 hover:bg-muted disabled:opacity-60 disabled:cursor-default"
                    >
                      <ZoomThumb
                        src={c.core_card.representative_crop_url}
                        className="aspect-card w-8 rounded overflow-hidden bg-muted shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">
                          {c.core_card.name ?? 'Unknown'}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {[c.core_card.set, c.core_card.number].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      {isCurrent ? (
                        <span className="microlabel text-primary shrink-0">current</span>
                      ) : (
                        <ConfidenceChip similarity={c.similarity} size="sm" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={pendingCandidate !== null}
        onOpenChange={(o) => !o && setPendingCandidate(null)}
        title={`Reassign to ${pendingCandidate?.core_card.name ?? 'this card'}?`}
        description={
          current
            ? `This slot will be recorded as confirmed by you. If ${currentName} ends up with no placements, it is deleted from the catalog.`
            : 'This slot will be recorded as confirmed by you.'
        }
        confirmLabel="Reassign"
        onConfirm={async () => {
          if (pendingCandidate) await reassign(pendingCandidate);
          setPendingCandidate(null);
        }}
      />
      <ConfirmDialog
        open={confirmPromote}
        onOpenChange={setConfirmPromote}
        title="Promote to a new catalog entry?"
        description={`This placement becomes its own catalog entry${current ? `, and ${currentName} loses this placement` : ''}.`}
        confirmLabel="Promote"
        onConfirm={promote}
      />
      <ConfirmDialog
        open={confirmUnmatch}
        onOpenChange={setConfirmUnmatch}
        title="Send back to review?"
        description="Its current match is cleared and this slot reappears in the review queue for you to re-decide."
        confirmLabel="Send to review"
        destructive
        onConfirm={unmatch}
      />

      <MovePlacementDialog
        placement={placement}
        currentCardId={placement.core_card_id}
        open={moveOpen}
        onOpenChange={setMoveOpen}
        onMoved={() => void onChanged()}
      />
    </div>
  );
}

// The decision's paper trail: when the slot was scanned, when its identity
// was decided, and which embedder produced the evidence.
function AuditTrail({ placement }: { placement: PlacementDetail }) {
  const parts: string[] = [`Scanned ${formatDate(placement.created_at)}`];
  if (placement.resolved_at) parts.push(`decided ${formatDate(placement.resolved_at)}`);
  if (placement.embedder_version) parts.push(`evidence by ${placement.embedder_version}`);
  return (
    <div className="text-[11px] text-muted-foreground border-t border-border pt-2">
      {parts.join(' · ')}
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function ZoomThumb({ src, className }: { src: string; className?: string }) {
  return (
    <HoverCard openDelay={120} closeDelay={60}>
      <HoverCardTrigger asChild>
        <div className={className}>
          <img src={src} alt="" className="size-full object-cover" />
        </div>
      </HoverCardTrigger>
      <HoverCardContent side="left" className="p-1 w-auto">
        <img src={src} alt="" className="aspect-card w-56 rounded-md object-cover" />
      </HoverCardContent>
    </HoverCard>
  );
}
