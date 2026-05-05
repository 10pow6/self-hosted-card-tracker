import { useEffect, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
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
import { listCards, mergeCards } from '@/api/cardsApi';
import type { CoreCard } from '@/api/types';
import { cn } from '@/lib/utils';

type Props = {
  /** The "winning" card. Sources picked from the list will fold into this. */
  target: CoreCard;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after all merges complete so the parent can refresh state. */
  onMerged: () => void;
};

const SEARCH_DEBOUNCE_MS = 200;

export function MergeCardDialog({ target, open, onOpenChange, onMerged }: Props) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<CoreCard[] | null>(null);
  const [selected, setSelected] = useState<Map<string, CoreCard>>(new Map());
  const [hovered, setHovered] = useState<CoreCard | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset state every time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setQ('');
    setResults(null);
    setSelected(new Map());
    setHovered(null);
    setSubmitting(false);
    setProgress(null);
    setError(null);
  }, [open]);

  // Debounced search.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      listCards(q ? { q } : {})
        .then((cards) => {
          if (!cancelled) setResults(cards.filter((c) => c.id !== target.id));
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : String(err));
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, q, target.id]);

  const toggleSelect = (c: CoreCard) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(c.id)) next.delete(c.id);
      else next.set(c.id, c);
      return next;
    });
  };

  const onConfirm = async () => {
    if (selected.size === 0) return;
    setSubmitting(true);
    setError(null);
    const ids = Array.from(selected.keys());
    setProgress({ done: 0, total: ids.length });
    try {
      for (let i = 0; i < ids.length; i++) {
        await mergeCards(ids[i], target.id);
        setProgress({ done: i + 1, total: ids.length });
      }
      onOpenChange(false);
      onMerged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  };

  const targetLabel = target.name ?? 'this card';
  const confirmLabel = progress
    ? `Merging ${progress.done}/${progress.total}…`
    : selected.size > 0
      ? `Merge ${selected.size} into ${targetLabel}`
      : 'Pick at least one';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="truncate">Merge duplicates into {targetLabel}</DialogTitle>
          <DialogDescription>
            Pick the duplicate cards that should fold into this one. Their placements get
            repointed; the duplicates are deleted. This cannot be undone.
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
                    const isSelected = selected.has(c.id);
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => toggleSelect(c)}
                          onMouseEnter={() => setHovered(c)}
                          onFocus={() => setHovered(c)}
                          className={cn(
                            'w-full text-left flex items-center gap-3 px-3 py-2 transition-colors',
                            isSelected ? 'bg-primary/10' : 'hover:bg-muted',
                          )}
                        >
                          <CheckIndicator selected={isSelected} />
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

            <div className="text-xs text-muted-foreground tabular-nums">
              {selected.size} selected
            </div>
          </div>

          <aside className="hidden md:block">
            <ZoomPreview card={hovered} />
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
          <Button onClick={onConfirm} disabled={selected.size === 0 || submitting}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CheckIndicator({ selected }: { selected: boolean }) {
  return (
    <div
      className={cn(
        'size-5 rounded border-2 grid place-items-center shrink-0 transition-colors',
        selected ? 'bg-primary border-primary' : 'border-muted-foreground/40 bg-background',
      )}
    >
      {selected && <Check className="size-3.5 text-primary-foreground" />}
    </div>
  );
}

function ZoomPreview({ card }: { card: CoreCard | null }) {
  if (!card) {
    return (
      <div className="rounded-lg border-2 border-dashed border-border bg-muted/20 aspect-card grid place-items-center text-xs text-muted-foreground p-3 text-center">
        Hover a card to preview
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="aspect-card overflow-hidden rounded-lg border border-border bg-muted shadow-md">
        <img src={card.representative_crop_url} alt="" className="size-full object-cover" />
      </div>
      <div>
        <div className="font-medium text-sm truncate">{card.name ?? 'Unknown'}</div>
        <div className="text-xs text-muted-foreground truncate">
          {[card.set, card.number, card.year].filter(Boolean).join(' · ') || card.type}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          {card.placement_count} placement{card.placement_count === 1 ? '' : 's'}
        </div>
      </div>
    </div>
  );
}
