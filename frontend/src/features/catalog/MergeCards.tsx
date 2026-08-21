import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Check, Sparkles, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Page } from '@/components/Page';
import { PageHeader } from '@/components/PageHeader';
import { CardSearchList } from '@/components/CardSearchList';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { getCard, mergeCards } from '@/api/cardsApi';
import { getErrorMessage } from '@/api/client';
import type { CoreCard } from '@/api/types';
import { DuplicateSuggestions } from './DuplicateSuggestions';
import { MergeDiff } from './MergeDiff';

type MergeOutcome = { card: CoreCard; ok: boolean; error?: string };

export function MergeCards() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTargetId = searchParams.get('target');

  const [target, setTarget] = useState<CoreCard | null>(null);
  const [sources, setSources] = useState<Map<string, CoreCard>>(new Map());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [outcomes, setOutcomes] = useState<MergeOutcome[] | null>(null);

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

  const onPickTarget = (card: CoreCard) => {
    setTarget(card);
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

  const sourceList = Array.from(sources.values());
  const merging = progress !== null;

  const runMerge = async () => {
    if (!target || sourceList.length === 0) return;
    setOutcomes(null);
    setProgress({ done: 0, total: sourceList.length });
    const results: MergeOutcome[] = [];
    for (let i = 0; i < sourceList.length; i++) {
      const src = sourceList[i];
      try {
        await mergeCards(src.id, target.id);
        results.push({ card: src, ok: true });
      } catch (e) {
        // Stop at the first failure — report exactly what did and didn't merge.
        results.push({ card: src, ok: false, error: getErrorMessage(e) });
        setOutcomes(results);
        setProgress(null);
        // Keep the failed source and any not-yet-attempted ones selected.
        setSources(new Map(sourceList.slice(i).map((c) => [c.id, c])));
        toast.error(`Merge stopped: ${getErrorMessage(e)}`);
        return;
      }
      setProgress({ done: i + 1, total: sourceList.length });
    }
    toast.success(
      `Merged ${results.length} duplicate${results.length === 1 ? '' : 's'} into ${target.name ?? 'target'}`,
    );
    navigate(`/cards/${target.id}`);
  };

  return (
    <Page width="wide">
      <PageHeader
        title="Merge duplicates"
        description="Fold duplicate catalog entries into one keeper. Placements are repointed; the duplicates are deleted. Irreversible — you'll confirm before anything happens."
        back={{ to: '/cards', label: 'Catalog' }}
      />

      {outcomes && (
        <div className="mb-6 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm space-y-2">
          <div className="font-medium text-destructive">The merge stopped partway.</div>
          <ul className="text-xs space-y-1">
            {outcomes.map((o) => (
              <li key={o.card.id} className="flex items-center gap-1.5">
                {o.ok ? (
                  <Check className="size-3.5 text-success" />
                ) : (
                  <X className="size-3.5 text-destructive" />
                )}
                <span className="font-medium">{o.card.name ?? 'Unnamed card'}</span>
                <span className="text-muted-foreground">
                  {o.ok ? 'merged' : `failed — ${o.error}`}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Merged sources are already folded in. The failed source and any remaining ones are
            still selected below — fix the problem and merge again.
          </p>
        </div>
      )}

      <div className="mb-4 lg:mb-6">
        <DuplicateSuggestions
          selectedIds={[...(target ? [target.id] : []), ...sources.keys()]}
          onUsePair={(keeper, duplicate) => {
            onPickTarget(keeper);
            setSources((prev) => new Map(prev).set(duplicate.id, duplicate));
          }}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 lg:gap-6">
        <Card className="overflow-hidden">
          <CardContent className="p-5 space-y-4">
            <PaneHeader
              icon={<Sparkles className="size-4 text-primary" />}
              title="Keeper"
              subtitle="Survives the merge and keeps its metadata. The search below covers your whole catalog — it's a picker, not a list of duplicates."
            />
            {target ? (
              <div className="rounded-xl border border-primary/40 bg-primary/5 p-3 flex items-start gap-3">
                <div className="aspect-card w-24 rounded-lg overflow-hidden bg-muted shrink-0 shadow-md">
                  <img src={target.representative_crop_url} alt="" className="size-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="microlabel text-primary mb-1">Keeper</div>
                  <div className="font-semibold truncate">{target.name ?? 'Unnamed card'}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {[target.set, target.number, target.year].filter(Boolean).join(' · ') || target.type}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 tabular-nums">
                    {target.placement_count} placement{target.placement_count === 1 ? '' : 's'} currently
                  </div>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={() => setTarget(null)} aria-label="Clear target">
                  <X className="size-4" />
                </Button>
              </div>
            ) : (
              <div className="rounded-xl border-2 border-dashed border-border bg-muted/20 p-4 text-center text-sm text-muted-foreground">
                Pick the keeper from the list below.
              </div>
            )}
            <CardSearchList
              onSelect={onPickTarget}
              excludeIds={Array.from(sources.keys())}
              selectedIds={target ? [target.id] : []}
              placeholder="Search for the keeper…"
              className="max-h-96"
            />
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="p-5 space-y-4">
            <PaneHeader
              icon={<Trash2 className="size-4 text-destructive" />}
              title="Duplicates — fold these in"
              subtitle="Each is deleted; its placements move to the keeper. A card appearing in both search lists is one entry shown twice, not a duplicate."
            />
            {sources.size > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="secondary" className="tabular-nums">
                    {sources.size} selected
                  </Badge>
                  <Button variant="ghost" size="sm" onClick={() => setSources(new Map())}>
                    Clear all
                  </Button>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {sourceList.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleSource(c)}
                      className="group relative aspect-card rounded-md overflow-hidden border border-destructive/40 bg-card"
                      aria-label={`Remove ${c.name ?? 'card'} from duplicates`}
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
            {target ? (
              <CardSearchList
                onSelect={toggleSource}
                excludeIds={[target.id]}
                selectedIds={Array.from(sources.keys())}
                placeholder="Search for duplicates…"
                className="max-h-96"
                trailing={(c) => (
                  <Checkbox checked={sources.has(c.id)} className="pointer-events-none" tabIndex={-1} />
                )}
              />
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-muted/10 px-3 py-6 text-center text-sm text-muted-foreground">
                Pick the keeper first — then choose which entries to fold into it.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {target && sourceList.length > 0 && (
        <div className="mt-6">
          <MergeDiff target={target} sources={sourceList} />
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          <span className="text-foreground font-medium tabular-nums">{sources.size}</span>{' '}
          duplicate{sources.size === 1 ? '' : 's'} selected
          {target && (
            <>
              {' · '}folding into{' '}
              <span className="text-foreground font-medium">{target.name ?? 'unnamed card'}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          {merging && progress && (
            <div className="flex items-center gap-2 w-48">
              <Progress value={(progress.done / progress.total) * 100} />
              <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                {progress.done}/{progress.total}
              </span>
            </div>
          )}
          <Button variant="ghost" onClick={() => navigate('/cards')} disabled={merging}>
            Cancel
          </Button>
          <Button
            onClick={() => setConfirmOpen(true)}
            disabled={!target || sources.size === 0 || merging}
          >
            {merging
              ? 'Merging…'
              : !target
                ? 'Pick a target first'
                : sources.size === 0
                  ? 'Pick at least one duplicate'
                  : `Merge ${sources.size} into ${target.name ?? 'target'}`}
          </Button>
        </div>
      </div>

      {target && (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={`Merge ${sources.size} duplicate${sources.size === 1 ? '' : 's'}?`}
          description={`Irreversible. ${sourceList.reduce((n, c) => n + c.placement_count, 0)} placement${
            sourceList.reduce((n, c) => n + c.placement_count, 0) === 1 ? '' : 's'
          } move to ${target.name ?? 'the target'}; the source entries and their metadata are deleted.`}
          confirmLabel="Merge"
          destructive
          // Close immediately so the page-level progress bar is visible.
          onConfirm={() => {
            setConfirmOpen(false);
            void runMerge();
          }}
        />
      )}
    </Page>
  );
}

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
