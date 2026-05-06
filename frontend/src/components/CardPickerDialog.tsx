import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { listCards } from '@/api/cardsApi';
import type { CoreCard } from '@/api/types';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (card: CoreCard) => void;
  title?: string;
  description?: string;
};

export function CardPickerDialog({
  open,
  onOpenChange,
  onPick,
  title = 'Pick from card database',
  description = 'Search by name, set, or number. Click any card to assign it to this placement.',
}: Props) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<CoreCard[] | null>(null);

  // Reset state on open so each invocation starts fresh.
  useEffect(() => {
    if (open) {
      setQ('');
      setResults(null);
      listCards({}).then(setResults);
    }
  }, [open]);

  // Debounce search by 200ms — backend accepts ?q= and full result set is small in v1.
  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(() => {
      listCards(q ? { q } : {}).then(setResults);
    }, 200);
    return () => clearTimeout(handle);
  }, [q, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search…"
            className="pl-9 pr-9"
          />
          {q && (
            <button
              onClick={() => setQ('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto -mx-2 px-2">
          {results === null ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              No cards match.
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {results.map((c) => {
                const meta = [c.set, c.number, c.year].filter(Boolean).join(' · ');
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => onPick(c)}
                      className="w-full flex items-center gap-3 p-2.5 text-left hover:bg-muted transition-colors"
                    >
                      <div className="aspect-card w-10 shrink-0 rounded-md overflow-hidden bg-muted">
                        {c.representative_crop_url && (
                          <img
                            src={c.representative_crop_url}
                            alt=""
                            className="size-full object-cover"
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {c.name ?? <span className="text-muted-foreground italic">Unnamed</span>}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {meta || c.type}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
