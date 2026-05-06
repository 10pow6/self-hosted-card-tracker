import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { listCards } from '@/api/cardsApi';
import { matchPlacement } from '@/api/placementApi';
import type { CoreCard, Placement } from '@/api/types';
import { cn } from '@/lib/utils';

type Props = {
  placement: Placement;
  /** The placement's currently-linked core card, if any. Excluded from results. */
  currentCardId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMoved: () => void;
};

const SEARCH_DEBOUNCE_MS = 200;

export function MovePlacementDialog({
  placement,
  currentCardId,
  open,
  onOpenChange,
  onMoved,
}: Props) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<CoreCard[] | null>(null);
  const [selected, setSelected] = useState<CoreCard | null>(null);
  const [hovered, setHovered] = useState<CoreCard | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setQ('');
    setResults(null);
    setSelected(null);
    setHovered(null);
    setSubmitting(false);
    setError(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const t = setTimeout(() => {
      listCards(q ? { q } : {})
        .then((cards) => {
          if (!cancelled) setResults(cards.filter((c) => c.id !== currentCardId));
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : String(err));
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, q, currentCardId]);

  const onConfirm = async () => {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      await matchPlacement(placement.id, selected.id);
      onOpenChange(false);
      onMoved();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const previewCard = hovered ?? selected;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Move placement to a different card</DialogTitle>
          <DialogDescription>
            Pick the card this placement should belong to. The placement will be linked there as
            <em> user-confirmed</em>; the previous card (if any) loses this one placement.
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-[1fr_240px] gap-4 min-h-0">
          <div className="space-y-2 min-w-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name, set, number…"
                className="pl-9 pr-9"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ('')}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            <div
              className="max-h-72 overflow-y-auto rounded-md border border-border bg-muted/20"
              onMouseLeave={() => setHovered(null)}
            >
              {results === null ? (
                <div className="p-4 text-xs text-muted-foreground">Loading…</div>
              ) : results.length === 0 ? (
                <div className="p-4 text-xs text-muted-foreground">No matches.</div>
              ) : (
                <ul className="divide-y divide-border">
                  {results.map((c) => {
                    const isSelected = selected?.id === c.id;
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => setSelected(c)}
                          onMouseEnter={() => setHovered(c)}
                          onFocus={() => setHovered(c)}
                          className={cn(
                            'w-full text-left flex items-center gap-3 px-3 py-2 transition-colors',
                            isSelected ? 'bg-primary/10' : 'hover:bg-muted',
                          )}
                        >
                          <div className="aspect-card w-8 rounded overflow-hidden bg-muted shrink-0">
                            <img
                              src={c.representative_crop_url}
                              alt=""
                              className="size-full object-cover"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate">
                              {c.name ?? 'Unknown'}
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate">
                              {[c.set, c.number, c.year].filter(Boolean).join(' · ') || c.type}
                              {' · '}
                              {c.placement_count} placement
                              {c.placement_count === 1 ? '' : 's'}
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <aside className="hidden md:block">
            {previewCard ? (
              <div className="space-y-2">
                <div className="aspect-card overflow-hidden rounded-lg border border-border bg-muted shadow-md">
                  <img
                    src={previewCard.representative_crop_url}
                    alt=""
                    className="size-full object-cover"
                  />
                </div>
                <div>
                  <div className="font-medium text-sm truncate">
                    {previewCard.name ?? 'Unknown'}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {[previewCard.set, previewCard.number, previewCard.year]
                      .filter(Boolean)
                      .join(' · ') || previewCard.type}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {previewCard.placement_count} placement
                    {previewCard.placement_count === 1 ? '' : 's'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border-2 border-dashed border-border bg-muted/20 aspect-card grid place-items-center text-xs text-muted-foreground p-3 text-center">
                Hover or pick a card
              </div>
            )}
          </aside>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive whitespace-pre-wrap">
            {error}
          </div>
        )}

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
