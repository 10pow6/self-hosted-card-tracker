import { useEffect, useState, type ReactNode } from 'react';
import { SearchIcon } from 'lucide-react';
import type { CoreCard } from '@/api/types';
import { listCards } from '@/api/cardsApi';
import { getErrorMessage } from '@/api/client';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type Props = {
  onSelect: (card: CoreCard) => void;
  excludeIds?: string[];
  selectedIds?: string[];
  placeholder?: string;
  autoFocus?: boolean;
  limit?: number;
  // Optional trailing element per row (e.g. a checkbox for multi-select).
  trailing?: (card: CoreCard) => ReactNode;
  className?: string;
};

// The one card-search list — used by every "find a card in the catalog"
// surface (picker dialogs, move, merge). Searches server-side via ?q=.
export function CardSearchList({
  onSelect,
  excludeIds = [],
  selectedIds = [],
  placeholder = 'Search by name, set, or number…',
  autoFocus = false,
  limit = 30,
  trailing,
  className,
}: Props) {
  const [query, setQuery] = useState('');
  const q = useDebouncedValue(query.trim());
  const [cards, setCards] = useState<CoreCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    listCards(q ? { q } : {})
      .then((rows) => {
        if (!cancelled) setCards(rows);
      })
      .catch((e) => {
        if (!cancelled) setError(getErrorMessage(e));
      });
    return () => {
      cancelled = true;
    };
  }, [q]);

  const visible = (cards ?? [])
    .filter((c) => !excludeIds.includes(c.id))
    .slice(0, limit);

  return (
    <div className={cn('flex flex-col gap-2 min-h-0', className)}>
      <div className="relative">
        <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="pl-8"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border">
        {error ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">{error}</div>
        ) : cards === null ? (
          <div className="p-2 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            No cards match{q ? ` “${q}”` : ''}.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((card) => {
              const selected = selectedIds.includes(card.id);
              return (
                <li key={card.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(card)}
                    className={cn(
                      'flex w-full items-center gap-3 px-2.5 py-2 text-left transition-colors hover:bg-muted/60',
                      selected && 'bg-primary/10',
                    )}
                  >
                    <img
                      src={card.representative_crop_url}
                      alt=""
                      className="h-12 w-auto aspect-card rounded-md border border-border object-cover shrink-0"
                      draggable={false}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {card.name ?? 'Unknown card'}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[card.set, card.number, card.year].filter(Boolean).join(' · ') || card.type}
                        {card.placement_count > 0 && (
                          <> · {card.placement_count} in binders</>
                        )}
                      </span>
                    </span>
                    {trailing?.(card)}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
