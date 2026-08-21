import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, Inbox, MoreHorizontal, Plus, Star } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { MovePlacementDialog } from './MovePlacementDialog';
import { promotePlacementToNew, unmatchPlacement } from '@/api/placementApi';
import { setRepresentative } from '@/api/cardsApi';
import { getErrorMessage } from '@/api/client';
import { refreshPendingReview } from '@/hooks/usePendingReview';
import type { Placement } from '@/api/types';

type Props = {
  placement: Placement;
  /** When set, enables "Set as source image" if the placement is linked to that card. */
  hostCardId?: string | null;
  /** True if this placement's crop is the host card's current representative image. */
  isCurrentSource?: boolean;
  /** Name of the currently linked card, for consequence copy. */
  hostCardName?: string | null;
  onChanged: () => void;
};

type PendingConfirm = 'promote' | 'unmatch' | null;

// The one overflow menu for placement management. "Fix crop" stays a visible
// button at the call site; everything else lives here.
export function PlacementActions({
  placement,
  hostCardId,
  isCurrentSource,
  hostCardName,
  onChanged,
}: Props) {
  const navigate = useNavigate();
  const [moveOpen, setMoveOpen] = useState(false);
  const [confirming, setConfirming] = useState<PendingConfirm>(null);
  const [busy, setBusy] = useState(false);

  if (placement.review_status === 'empty') return null;

  const canSetAsSource =
    !!hostCardId &&
    placement.core_card_id === hostCardId &&
    !!placement.crop_url &&
    !isCurrentSource;

  const onPromote = async () => {
    const res = await promotePlacementToNew(placement.id);
    toast.success('Created a new catalog entry from this placement');
    void refreshPendingReview();
    onChanged();
    navigate(`/cards/${res.core_card_id}`);
  };

  const onUnmatch = async () => {
    await unmatchPlacement(placement.id);
    toast.success('Sent back to the review queue');
    void refreshPendingReview();
    onChanged();
  };

  const onSetSource = async () => {
    if (busy || !hostCardId) return;
    setBusy(true);
    try {
      await setRepresentative(hostCardId, placement.id);
      toast.success('Representative image updated');
      onChanged();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const currentName = hostCardName ?? 'the current entry';

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Placement actions" disabled={busy}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {canSetAsSource && (
            <DropdownMenuItem onClick={onSetSource}>
              <Star className="size-3.5" />
              Set as source image
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => setMoveOpen(true)}>
            <ArrowRight className="size-3.5" />
            Move to a different card
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setConfirming('promote')}>
            <Plus className="size-3.5" />
            Promote to new card
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setConfirming('unmatch')}
            className="text-destructive focus:text-destructive"
          >
            <Inbox className="size-3.5" />
            Send back to review
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirming === 'promote'}
        onOpenChange={(o) => !o && setConfirming(null)}
        title="Promote to a new catalog entry?"
        description={`This placement becomes its own catalog entry, and ${currentName} loses this placement.`}
        confirmLabel="Promote"
        onConfirm={async () => {
          try {
            await onPromote();
          } catch (e) {
            toast.error(getErrorMessage(e));
          }
        }}
      />
      <ConfirmDialog
        open={confirming === 'unmatch'}
        onOpenChange={(o) => !o && setConfirming(null)}
        title="Send back to review?"
        description="Its current match is cleared and this slot reappears in the review queue for you to re-decide."
        confirmLabel="Send to review"
        destructive
        onConfirm={async () => {
          try {
            await onUnmatch();
          } catch (e) {
            toast.error(getErrorMessage(e));
          }
        }}
      />

      <MovePlacementDialog
        placement={placement}
        currentCardId={placement.core_card_id}
        open={moveOpen}
        onOpenChange={setMoveOpen}
        onMoved={onChanged}
      />
    </>
  );
}
