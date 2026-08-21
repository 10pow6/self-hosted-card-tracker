import { useEffect, useState } from 'react';
import { Download, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ErrorState } from '@/components/ErrorState';
import {
  ENRICH_SKILL_URL,
  getEnrichmentSettings,
  saveEnrichmentSettings,
  type EnrichmentSettings,
} from '@/api/enrichApi';
import { getErrorMessage } from '@/api/client';

// The metadata-enrichment workflow: an explicitly user-run Claude Code skill,
// gated by this toggle and a domain allowlist (its guardrails, stated plainly).
export function EnrichmentPanel() {
  const [state, setState] = useState<EnrichmentSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [allowlistText, setAllowlistText] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => {
    setError(null);
    getEnrichmentSettings()
      .then((s) => {
        setState(s);
        setAllowlistText(s.allowlist.join('\n'));
      })
      .catch((e) => setError(getErrorMessage(e)));
  };

  useEffect(load, []);

  const onToggle = async (enabled: boolean) => {
    setBusy(true);
    try {
      const next = await saveEnrichmentSettings({ enabled });
      setState(next);
      toast.success(enabled ? 'Enrichment skill enabled' : 'Enrichment skill disabled');
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const onSaveAllowlist = async () => {
    setBusy(true);
    try {
      const list = allowlistText
        .split('\n')
        .map((d) => d.trim())
        .filter(Boolean);
      const next = await saveEnrichmentSettings({ allowlist: list });
      setState(next);
      setAllowlistText(next.allowlist.join('\n'));
      toast.success('Allowlist saved — re-download the skill to bake it in');
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!state) return <Skeleton className="h-64 rounded-xl" />;

  return (
    <Card id="enrichment" className="scroll-mt-6">
      <CardContent className="p-5 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="size-4 text-ai" />
              Claude Code enrichment skill
            </div>
            <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed max-w-prose">
              A skill you run yourself in Claude Code: it views each card's crop, optionally
              searches an allowlisted source, and proposes metadata. Suggestions arrive labeled{' '}
              <span className="text-ai font-medium">AI-enriched</span> with a confidence score —
              card numbers are only accepted at ≥95% confidence, and your manual edits always
              override.
            </p>
          </div>
          <Switch
            checked={state.enabled}
            disabled={busy}
            onCheckedChange={onToggle}
            aria-label="Enable Claude Code enrichment skill"
          />
        </div>

        <div>
          <Label htmlFor="allowlist" className="microlabel text-muted-foreground">
            Allowed domains for web search
          </Label>
          <Textarea
            id="allowlist"
            value={allowlistText}
            onChange={(e) => setAllowlistText(e.target.value)}
            disabled={busy}
            rows={Math.max(4, state.allowlist.length)}
            className="mt-1.5 font-mono text-[13px] leading-tight"
            placeholder="one domain per line, e.g. tcdb.com"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              The skill refuses to fetch URLs outside this list.
            </span>
            <Button size="sm" onClick={onSaveAllowlist} disabled={busy}>
              Save allowlist
            </Button>
          </div>
        </div>

        <div className="border-t border-border pt-4">
          <div className="text-sm font-medium">Download the skill</div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            The allowlist above is baked into the file at download time — re-download after
            editing it.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-3">
            <a href={ENRICH_SKILL_URL} download="enrich-cards.md">
              <Download className="size-3.5" />
              Download enrich-cards.md
            </a>
          </Button>

          <div className="mt-4 text-xs text-muted-foreground leading-relaxed">
            <div className="font-medium text-foreground mb-1">Then, to run it:</div>
            <ol className="list-decimal list-inside space-y-1">
              <li>
                Save the file to{' '}
                <code className="text-foreground">.claude/skills/enrich-cards.md</code> inside any
                project directory.
              </li>
              <li>
                Run <code className="text-foreground">claude</code> in that project's terminal.
              </li>
              <li>
                Type <code className="text-foreground">/enrich-cards</code> (or say "enrich my
                cards, limit 10").
              </li>
            </ol>
            <div className="mt-2">
              The backend must be running at{' '}
              <code className="text-foreground">http://localhost:8000</code> (the URL baked into
              the skill) and the toggle above must be on.
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
