import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Check, Search, Sparkles, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/PageHeader';
import { getCard, listCards, mergeCards } from '@/api/cardsApi';
import type { CoreCard } from '@/api/types';
import { cn } from '@/lib/utils';

const SEARCH_DEBOUNCE_MS = 200;

export function MergeCards() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTargetId = searchParams.get('target');

  const [target, setTarget] = useState<CoreCard | null>(null);
  const [sources, setSources] = useState<Map<string, CoreCard>>(new Map());

  const [qTarget, setQTarget] = useState('');
  const [qSources, setQSources] = useState('');
  const [targetResults, setTargetResults] = useState<CoreCard[] | null>(null);
  const [sourceResults, setSourceResults] = useState<CoreCard[] | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Hydrate target from ?target=<id> if present.
  useEffect(() => {
    if (!initialTargetId) return;
    let cancelled = false;
    getCard(initialTargetId).then((c) => {
      if (!cancelled && c) setTarget(c);
    });
    return () => {
      cancelled = true;
    };
  }, [initialTargetId]);

  // Debounced searches.
  useDebouncedSearch(qTarget, setTargetResults);
  useDebouncedSearch(qSources, setSourceResults);

  const onPickTarget = (card: CoreCard) => {
    setTarget(card);
    // If the new target was previously a source, drop it from sources.
    setSources((prev) => {
      if (!prev.has(card.id)) return prev;
      const next = new Map(prev);
      next.delete(card.id);
      return next;
    });
  };

  const toggleSource = (card: CoreCard) => {
    setSources((prev) => {
      const next = new Map(prev);
      if (next.has(card.id)) next.delete(card.id);
      else next.set(card.id, card);
      return next;
    });
  };

  const clearSources = () => setSources(new Map());

  const onConfirm = async () => {
    if (!target || sources.size === 0) return;
    setSubmitting(true);
    setError(null);
    const ids = Array.from(sources.keys());
    setProgress({ done: 0, total: ids.length });
    try {
      for (let i = 0; i < ids.length; i++) {
        await mergeCards(ids[i], target.id);
        setProgress({ done: i + 1, total: ids.length });
      }
      navigate(`/cards/${target.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  };

  const confirmLabel = progress
    ? `Merging ${progress.done}/${progress.total}…`
    : !target
      ? 'Pick a target first'
      : sources.size === 0
        ? 'Pick at least one duplicate'
        : `Merge ${sources.size} into ${target.name ?? 'target'}`;

  return (
    <>
      <PageHeader
        title="Merge duplicates"
        description="Fold one or more duplicate cards into a single canonical entry. Placements get repointed; the duplicates are deleted. This cannot be undone."
        back={{ to: '/cards', label: 'Card database' }}
      />
      <section className="px-4 md:px-8 pb-12 max-w-7xl">
        {error && (
          <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive whitespace-pre-wrap">
            {error}
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-4 lg:gap-6">
          <TargetPane
            target={target}
            results={targetResults}
            q={qTarget}
            onQChange={setQTarget}
            onPick={onPickTarget}
            onClear={() => setTarget(null)}
          />
          <SourcesPane
            target={target}
            sources={sources}
            results={sourceResults}
            q={qSources}
            onQChange={setQSources}
            onToggle={toggleSource}
            onClear={clearSources}
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            <span className="text-foreground font-medium">{sources.size}</span>{' '}
            duplicate{sources.size === 1 ? '' : 's'} selected
            {target && (
              <>
                {' · '}folding into{' '}
                <span className="text-foreground font-medium">
                  {target.name ?? 'unnamed card'}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate('/cards')} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={onConfirm}
              disabled={!target || sources.size === 0 || submitting}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}

// ---------------------------------------------------------------------------
// Target pane

function TargetPane({
  target,
  results,
  q,
  onQChange,
  onPick,
  onClear,
}: {
  target: CoreCard | null;
  results: CoreCard[] | null;
  q: string;
  onQChange: (v: string) => void;
  onPick: (c: CoreCard) => void;
  onClear: () => void;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5 space-y-4">
        <PaneHeader
          icon={<Sparkles className="size-4 text-primary" />}
          title="Target — the keeper"
          subtitle="Survives the merge. All placements from duplicates get repointed here."
        />

        {target ? (
          <div className="rounded-xl border border-primary/40 bg-primary/5 p-3 flex items-start gap-3">
            <div className="aspect-card w-24 rounded-lg overflow-hidden bg-muted shrink-0 shadow-md">
              <img
                src={target.representative_crop_url}
                alt=""
                className="size-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs uppercase tracking-wider text-primary mb-0.5">
                Target
              </div>
              <div className="font-semibold truncate">{target.name ?? 'Unnamed card'}</div>
              <div className="text-xs text-muted-foreground truncate">
                {[target.set, target.number, target.year].filter(Boolean).join(' · ') ||
                  target.type}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {target.placement_count} placement
                {target.placement_count === 1 ? '' : 's'} currently
              </div>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={onClear} aria-label="Clear target">
              <X className="size-4" />
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border-2 border-dashed border-border bg-muted/20 p-4 text-center text-sm text-muted-foreground">
            Pick a target from the list below.
          </div>
        )}

        <SearchInput value={q} onChange={onQChange} placeholder="Search for the keeper…" />

        <ResultsList
          results={results}
          renderRow={(c) => {
            const isTarget = target?.id === c.id;
            return (
              <button
                type="button"
                key={c.id}
                onClick={() => onPick(c)}
                className={cn(
                  'w-full text-left flex items-center gap-3 px-3 py-2 transition-colors',
                  isTarget ? 'bg-primary/10' : 'hover:bg-muted',
                )}
              >
                <div className="aspect-card w-10 rounded overflow-hidden bg-muted shrink-0">
                  <img
                    src={c.representative_crop_url}
                    alt=""
                    className="size-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{c.name ?? 'Unknown'}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {[c.set, c.number, c.year].filter(Boolean).join(' · ') || c.type}
                    {' · '}
                    {c.placement_count} placement{c.placement_count === 1 ? '' : 's'}
                  </div>
                </div>
                {isTarget && <Check className="size-4 text-primary" />}
              </button>
            );
          }}
        />
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sources pane

function SourcesPane({
  target,
  sources,
  results,
  q,
  onQChange,
  onToggle,
  onClear,
}: {
  target: CoreCard | null;
  sources: Map<string, CoreCard>;
  results: CoreCard[] | null;
  q: string;
  onQChange: (v: string) => void;
  onToggle: (c: CoreCard) => void;
  onClear: () => void;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5 space-y-4">
        <PaneHeader
          icon={<Trash2 className="size-4 text-destructive" />}
          title="Duplicates — fold these in"
          subtitle="Each is deleted; its placements move to the target."
        />

        {sources.size > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Badge variant="secondary" className="tabular-nums">
                {sources.size} selected
              </Badge>
              <Button variant="ghost" size="sm" onClick={onClear}>
                Clear all
              </Button>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {Array.from(sources.values()).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onToggle(c)}
                  className="group relative aspect-card rounded-md overflow-hidden border border-destructive/40 bg-card"
                  aria-label={`Remove ${c.name ?? 'card'} from sources`}
                >
                  <img
                    src={c.representative_crop_url}
                    alt=""
                    className="size-full object-cover opacity-90 group-hover:opacity-60 transition-opacity"
                  />
                  <div className="absolute inset-0 grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity bg-background/40">
                    <X className="size-5 text-foreground" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border-2 border-dashed border-border bg-muted/20 p-4 text-center text-sm text-muted-foreground">
            Pick one or more duplicates from the list below.
          </div>
        )}

        <SearchInput value={q} onChange={onQChange} placeholder="Search for duplicates…" />

        <ResultsList
          results={results}
          renderRow={(c) => {
            const isTarget = target?.id === c.id;
            const isSelected = sources.has(c.id);
            return (
              <button
                type="button"
                key={c.id}
                onClick={() => !isTarget && onToggle(c)}
                disabled={isTarget}
                className={cn(
                  'w-full text-left flex items-center gap-3 px-3 py-2 transition-colors',
                  isTarget && 'opacity-50 cursor-not-allowed',
                  !isTarget && (isSelected ? 'bg-destructive/10' : 'hover:bg-muted'),
                )}
                title={isTarget ? "Can't merge target into itself" : undefined}
              >
                <CheckBox selected={isSelected} disabled={isTarget} />
                <div className="aspect-card w-10 rounded overflow-hidden bg-muted shrink-0">
                  <img
                    src={c.representative_crop_url}
                    alt=""
                    className="size-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{c.name ?? 'Unknown'}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {[c.set, c.number, c.year].filter(Boolean).join(' · ') || c.type}
                    {' · '}
                    {c.placement_count} placement{c.placement_count === 1 ? '' : 's'}
                  </div>
                </div>
                {isTarget && (
                  <span className="text-[10px] uppercase tracking-wider text-primary">
                    target
                  </span>
                )}
              </button>
            );
          }}
        />
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Shared helpers

function PaneHeader({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5">{icon}</div>
      <div>
        <div className="font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground">{subtitle}</div>
      </div>
    </div>
  );
}

function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9 pr-9"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

function ResultsList({
  results,
  renderRow,
}: {
  results: CoreCard[] | null;
  renderRow: (c: CoreCard) => React.ReactNode;
}) {
  return (
    <div className="max-h-80 overflow-y-auto rounded-md border border-border bg-muted/20">
      {results === null ? (
        <div className="p-4 text-xs text-muted-foreground">Loading…</div>
      ) : results.length === 0 ? (
        <div className="p-4 text-xs text-muted-foreground">No matches.</div>
      ) : (
        <ul className="divide-y divide-border">
          {results.map((c) => (
            <li key={c.id}>{renderRow(c)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CheckBox({ selected, disabled }: { selected: boolean; disabled?: boolean }) {
  return (
    <div
      className={cn(
        'size-5 rounded border-2 grid place-items-center shrink-0 transition-colors',
        disabled
          ? 'border-muted-foreground/20 bg-muted'
          : selected
            ? 'bg-destructive border-destructive'
            : 'border-muted-foreground/40 bg-background',
      )}
    >
      {selected && !disabled && <Check className="size-3.5 text-destructive-foreground" />}
    </div>
  );
}

function useDebouncedSearch(
  q: string,
  setResults: (results: CoreCard[] | null) => void,
) {
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      listCards(q ? { q } : {})
        .then((cards) => {
          if (!cancelled) setResults(cards);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, setResults]);
}
