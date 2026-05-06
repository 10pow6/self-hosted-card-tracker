import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, MoreHorizontal, Plus, Scissors, Sparkles, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MovePlacementDialog } from '@/components/MovePlacementDialog';
import { promotePlacementToNew, unmatchPlacement } from '@/api/placementApi';
import { setRepresentative } from '@/api/cardsApi';
import type { Placement } from '@/api/types';

type Props = {
  placement: Placement;
  /** When set, enables "Set as source image" if the placement is linked to that card. */
  hostCardId?: string | null;
  /** True if this placement's crop is the host card's current representative image. */
  isCurrentSource?: boolean;
  onChanged: () => void;
};

export function PlacementActions({
  placement,
  hostCardId,
  isCurrentSource,
  onChanged,
}: Props) {
  const navigate = useNavigate();
  const [moveOpen, setMoveOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (placement.review_status === 'empty') return null;

  const canSetAsSource =
    !!hostCardId &&
    placement.core_card_id === hostCardId &&
    !!placement.crop_url &&
    !isCurrentSource;

  const onPromote = async () => {
    if (busy) return;
    if (!confirm('Promote this placement to its own new CORE card?')) return;
    setBusy(true);
    try {
      const res = await promotePlacementToNew(placement.id);
      onChanged();
      navigate(`/cards/${res.core_card_id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const onSetSource = async () => {
    if (busy || !hostCardId) return;
    setBusy(true);
    try {
      await setRepresentative(hostCardId, placement.id);
      onChanged();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const onUnmatch = async () => {
    if (busy) return;
    if (!confirm('Send this placement back to the review queue? Its current match will be cleared.')) return;
    setBusy(true);
    try {
      await unmatchPlacement(placement.id);
      onChanged();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Placement actions" disabled={busy}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={() => navigate(`/placements/${placement.id}/refine`)}>
            <Scissors className="size-3.5" />
            Refine box
          </DropdownMenuItem>
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
          <DropdownMenuItem onClick={onPromote}>
            <Plus className="size-3.5" />
            Promote to new card
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onUnmatch} className="text-destructive focus:text-destructive">
            <Sparkles className="size-3.5" />
            Send to review queue
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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
