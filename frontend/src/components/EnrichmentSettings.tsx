import { useEffect, useState } from 'react';
import { Download, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type EnrichmentSettings = {
  enabled: boolean;
  allowlist: string[];
};

async function fetchSettings(): Promise<EnrichmentSettings> {
  const res = await fetch('/api/enrich/settings');
  if (!res.ok) throw new Error(`fetchSettings → ${res.status}`);
  return (await res.json()) as EnrichmentSettings;
}

async function saveSettings(s: Partial<EnrichmentSettings>): Promise<EnrichmentSettings> {
  const res = await fetch('/api/enrich/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(s),
  });
  if (!res.ok) throw new Error(`saveSettings → ${res.status}: ${await res.text()}`);
  return (await res.json()) as EnrichmentSettings;
}

export function EnrichmentSettingsPanel() {
  const [state, setState] = useState<EnrichmentSettings | null>(null);
  const [allowlistText, setAllowlistText] = useState('');
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    fetchSettings().then((s) => {
      setState(s);
      setAllowlistText(s.allowlist.join('\n'));
    });
  }, []);

  const onToggle = async (enabled: boolean) => {
    if (!state) return;
    setBusy(true);
    try {
      const next = await saveSettings({ enabled });
      setState(next);
      setSavedAt(Date.now());
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
      const next = await saveSettings({ allowlist: list });
      setState(next);
      setAllowlistText(next.allowlist.join('\n'));
      setSavedAt(Date.now());
    } finally {
      setBusy(false);
    }
  };

  if (!state) {
    return <Skeleton className="h-64 rounded-xl" />;
  }

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              Claude Code enrichment skill
            </div>
            <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
              When enabled, you can run a Claude Code skill that views each
              card's representative crop, optionally web-searches an
              allowlisted source, and proposes metadata. Card numbers are only
              accepted at ≥95% confidence. Manual edits override and clear the AI flag.
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={
                'text-sm font-medium tabular-nums ' +
                (state.enabled ? 'text-primary' : 'text-muted-foreground')
              }
            >
              {state.enabled ? 'On' : 'Off'}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={state.enabled}
              aria-label="Enable Claude Code enrichment skill"
              disabled={busy}
              onClick={() => onToggle(!state.enabled)}
              className={
                'relative h-6 w-11 rounded-full transition-colors disabled:opacity-50 ' +
                (state.enabled ? 'bg-primary' : 'bg-muted border border-border')
              }
            >
              <span
                className={
                  'absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform ' +
                  (state.enabled ? 'translate-x-5' : 'translate-x-0.5')
                }
              />
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground">
            Allowed domains for web search
          </label>
          <textarea
            value={allowlistText}
            onChange={(e) => setAllowlistText(e.target.value)}
            disabled={busy}
            rows={Math.max(4, state.allowlist.length)}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono leading-tight focus:outline-none focus:ring-2 focus:ring-primary/40"
            placeholder="one domain per line, e.g. tcdb.com"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              The skill will refuse to fetch URLs outside this list.
            </span>
            <Button size="sm" onClick={onSaveAllowlist} disabled={busy}>
              Save allowlist
            </Button>
          </div>
        </div>

        <div className="border-t border-border pt-4">
          <div className="text-sm font-medium">Download the skill</div>
          <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Save the file to{' '}
            <code className="text-foreground">.claude/skills/enrich-cards.md</code>{' '}
            in this project. The allowlist above is baked into the file at
            download time — re-download after editing it.
          </div>
          <div className="mt-3">
            <Button asChild variant="outline" size="sm">
              <a href="/api/enrich/skill.md" download="enrich-cards.md">
                <Download className="size-3.5" />
                Download enrich-cards.md
              </a>
            </Button>
          </div>
        </div>

        {savedAt && (
          <div className="text-xs text-muted-foreground">
            Saved · {new Date(savedAt).toLocaleTimeString()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
