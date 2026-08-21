import { useEffect, useState } from 'react';
import { ArrowRight, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ConfidenceChip } from '@/components/decisions/ConfidenceChip';
import { findDuplicatePairs, type DuplicatePair } from '@/api/cardsApi';
import { getErrorMessage } from '@/api/client';
import type { CoreCard } from '@/api/types';
import { cn } from '@/lib/utils';

// Given a likely-duplicate pair, which entry should survive a merge?
// More placements wins; then having a name; then the older entry.
export function pickKeeper(a: CoreCard, b: CoreCard): [keeper: CoreCard, duplicate: CoreCard] {
  if (a.placement_count !== b.placement_count)
    return a.placement_count > b.placement_count ? [a, b] : [b, a];
  const aNamed = !!a.name?.trim();
  const bNamed = !!b.name?.trim();
  if (aNamed !== bNamed) return aNamed ? [a, b] : [b, a];
  return a.created_at <= b.created_at ? [a, b] : [b, a];
}

type Props = {
  // Entries already staged in the merge panes — pairs touching them are hidden.
  selectedIds: string[];
  onUsePair: (keeper: CoreCard, duplicate: CoreCard) => void;
};

// Model-proposed duplicate pairs (violet = model output). Advisory only:
// the user stages and confirms every merge.
export function DuplicateSuggestions({ selectedIds, onUsePair }: Props) {
  const [pairs, setPairs] = useState<DuplicatePair[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const load = () => {
    setError(null);
    findDuplicatePairs({ limit: 20 })
      .then(setPairs)
      .catch((e) => setError(getErrorMessage(e)));
  };

  useEffect(load, []);

  const pairKey = (p: DuplicatePair) => `${p.a.id}:${p.b.id}`;
  const visible = (pairs ?? []).filter(
    (p) =>
      !dismissed.has(pairKey(p)) &&
      !selectedIds.includes(p.a.id) &&
      !selectedIds.includes(p.b.id),
  );

  return (
    <Card className="border-ai/30">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start gap-2">
          <Sparkles className="size-4 text-ai mt-0.5" />
          <div>
            <div className="font-semibold">Likely duplicates</div>
            <div className="text-xs text-muted-foreground">
              Pairs of catalog entries the embedding model finds nearly identical (≥ 90%).
              Advisory — same-art cards from different sets can score high, so you decide.
            </div>
          </div>
        </div>

        {error ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2">
            <span className="text-xs text-muted-foreground">{error}</span>
            <Button variant="outline" size="xs" onClick={load}>
              Retry
            </Button>
          </div>
        ) : pairs === null ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-3 text-sm text-muted-foreground">
            {pairs.length === 0
              ? 'No likely duplicates found — every catalog entry looks visually distinct to the model.'
              : 'Nothing further — remaining suggestions are dismissed or already staged below.'}
          </div>
        ) : (
          <ul className="space-y-2">
            {visible.map((p) => {
              const [keeper, duplicate] = pickKeeper(p.a, p.b);
              return (
                <li
                  key={pairKey(p)}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-3 py-2"
                >
                  <PairCard card={keeper} role="keeper" />
                  <ArrowRight className="size-4 text-muted-foreground rotate-180 shrink-0" />
                  <PairCard card={duplicate} role="duplicate" />
                  <div className="flex items-center gap-2 ml-auto">
                    <ConfidenceChip similarity={p.similarity} size="sm" />
                    <Button size="sm" variant="outline" onClick={() => onUsePair(keeper, duplicate)}>
                      Stage merge
                    </Button>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Dismiss suggestion"
                          onClick={() =>
                            setDismissed((prev) => new Set(prev).add(pairKey(p)))
                          }
                        >
                          <X className="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Not duplicates — hide this pair for now (it may reappear next visit).
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function PairCard({ card, role }: { card: CoreCard; role: 'keeper' | 'duplicate' }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div
        className={cn(
          'aspect-card w-10 rounded-md overflow-hidden bg-muted shrink-0 border',
          role === 'keeper' ? 'border-primary/50' : 'border-destructive/40',
        )}
      >
        <img src={card.representative_crop_url} alt="" className="size-full object-cover" />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-medium truncate max-w-40">
          {card.name ?? 'Unnamed card'}
        </div>
        <div className="text-[10px] text-muted-foreground truncate max-w-40">
          {[card.set, card.number].filter(Boolean).join(' · ') || card.type}
          {' · '}
          <span className="tabular-nums">{card.placement_count}</span> in binders
        </div>
        <div
          className={cn(
            'microlabel mt-0.5',
            role === 'keeper' ? 'text-primary' : 'text-destructive',
          )}
        >
          {role === 'keeper' ? 'keeper' : 'fold in'}
        </div>
      </div>
    </div>
  );
}
