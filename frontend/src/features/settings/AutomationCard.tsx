import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/decisions/StatusBadge';
import { getMatchingSettings, saveMatchThreshold } from '@/api/settingsApi';
import { getErrorMessage } from '@/api/client';
import type { MatchingSettings } from '@/api/types';

// Accountability, in-product: exactly what the pipeline decides on its own,
// how each outcome is labeled, and the user-owned guardrail behind it.
export function AutomationCard() {
  const [matching, setMatching] = useState<MatchingSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState(''); // percent string, e.g. "92"
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoadError(null);
    getMatchingSettings()
      .then((m) => {
        setMatching(m);
        setDraft(String(Math.round(m.match_threshold * 100)));
      })
      .catch((e) => setLoadError(getErrorMessage(e)));
  };

  useEffect(load, []);

  const thresholdPct = matching ? Math.round(matching.match_threshold * 100) : null;
  const draftPct = Number(draft);
  const draftValid = Number.isFinite(draftPct) && draftPct >= 50 && draftPct <= 99;
  const dirty = matching !== null && draftValid && draftPct !== thresholdPct;

  const onSave = async () => {
    if (!draftValid) return;
    setBusy(true);
    try {
      const next = await saveMatchThreshold(draftPct / 100);
      setMatching(next);
      setDraft(String(Math.round(next.match_threshold * 100)));
      toast.success(`Auto-accept threshold set to ${Math.round(next.match_threshold * 100)}%`);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" />
          Automation & guardrails
        </CardTitle>
        <CardDescription>
          What the pipeline is allowed to decide without you — and the threshold you control.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <ul className="space-y-3">
          <li className="flex flex-wrap items-center gap-2">
            <StatusBadge status="auto_matched" />
            <span className="text-muted-foreground text-[13px]">
              Similarity at or above {thresholdPct !== null ? `${thresholdPct}%` : 'the threshold'}{' '}
              files the card automatically. Reversible from the card, its page, or the refine view.
            </span>
          </li>
          <li className="flex flex-wrap items-center gap-2">
            <StatusBadge status="pending" />
            <span className="text-muted-foreground text-[13px]">
              Below it, nothing is written — the match waits for you in Review.
            </span>
          </li>
          <li className="flex flex-wrap items-center gap-2">
            <StatusBadge status="new_card" />
            <span className="text-muted-foreground text-[13px]">
              No close match at all creates a new catalog entry, which you can merge later.
            </span>
          </li>
          <li className="flex flex-wrap items-center gap-2">
            <StatusBadge status="user_confirmed" />
            <span className="text-muted-foreground text-[13px]">
              Your confirmations and edits are final — they override every model suggestion.
            </span>
          </li>
        </ul>

        <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
          {loadError ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">{loadError}</span>
              <Button variant="outline" size="xs" onClick={load}>
                Retry
              </Button>
            </div>
          ) : matching === null ? (
            <Skeleton className="h-8 w-full" />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor="match-threshold" className="text-sm font-medium">
                  Auto-accept threshold
                </Label>
                <div className="flex items-center gap-1 ml-auto">
                  <Input
                    id="match-threshold"
                    inputMode="numeric"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-16 text-right tabular-nums"
                    aria-invalid={!draftValid}
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                  <Button size="sm" className="ml-2" disabled={!dirty || busy} onClick={onSave}>
                    {busy ? 'Saving…' : 'Save'}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Between 50 and 99. Applies to future scans immediately; already-decided placements
                are not re-classified. Default{' '}
                {Math.round(matching.match_threshold_default * 100)}%. Decisions are made by{' '}
                <span className="text-foreground">{matching.matcher_id}</span> over{' '}
                <span className="text-foreground">{matching.embedder_version}</span> embeddings —
                every placement records its status and the similarity behind it.
              </p>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
