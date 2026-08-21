import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CardSearchList } from '@/components/CardSearchList';
import { matchPlacement } from '@/api/placementApi';
import { getErrorMessage } from '@/api/client';
import { refreshPendingReview } from '@/hooks/usePendingReview';
import type { CoreCard, Placement } from '@/api/types';

type Props = {
  placement: Placement;
  /** The placement's currently-linked catalog entry, if any. Excluded from results. */
  currentCardId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMoved: () => void;
};

export function MovePlacementDialog({
  placement,
  currentCardId,
  open,
  onOpenChange,
  onMoved,
}: Props) {
  const [selected, setSelected] = useState<CoreCard | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected(null);
    setSubmitting(false);
  }, [open]);

  const onConfirm = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await matchPlacement(placement.id, selected.id);
      toast.success(`Moved to ${selected.name ?? 'selected card'} — recorded as confirmed by you`);
      void refreshPendingReview();
      onOpenChange(false);
      onMoved();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Move placement to a different card</DialogTitle>
          <DialogDescription>
            Pick the catalog entry this physical card belongs to. It will be recorded as{' '}
            <em>confirmed by you</em>; the previous entry loses this one placement.
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-[1fr_200px] gap-4 min-h-0">
          <CardSearchList
            autoFocus
            onSelect={setSelected}
            excludeIds={currentCardId ? [currentCardId] : []}
            selectedIds={selected ? [selected.id] : []}
            className="max-h-80"
          />
          <aside className="hidden md:block">
            {selected ? (
              <div className="space-y-2">
                <div className="aspect-card overflow-hidden rounded-lg border border-border bg-muted shadow-md">
                  <img
                    src={selected.representative_crop_url}
                    alt=""
                    className="size-full object-cover"
                  />
                </div>
                <div>
                  <div className="font-medium text-sm truncate">{selected.name ?? 'Unknown'}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {[selected.set, selected.number, selected.year].filter(Boolean).join(' · ') ||
                      selected.type}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border-2 border-dashed border-border bg-muted/20 aspect-card grid place-items-center text-xs text-muted-foreground p-3 text-center">
                Pick a card to preview it
              </div>
            )}
          </aside>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={!selected || submitting}>
            {submitting
              ? 'Moving…'
              : selected
                ? `Move to ${selected.name ?? 'selected card'}`
                : 'Pick a card'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
