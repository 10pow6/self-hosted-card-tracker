import { useState } from 'react';
import { Plug, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { getErrorMessage } from '@/api/client';
import type { ModelOption, ModelSlot } from '@/api/types';
import { cn } from '@/lib/utils';

type Props = {
  slot: ModelSlot;
  onChange: (slotId: string, optionId: string) => Promise<void> | void;
};

// One pipeline slot (detection / embeddings / matching / metadata) with its
// options inline as a radio-style list — choosing a model is one click, not
// a dialog trip.
export function ModelSlotCard({ slot, onChange }: Props) {
  const [pending, setPending] = useState<string | null>(null);

  const apply = async (opt: ModelOption) => {
    setPending(opt.id);
    try {
      await onChange(slot.id, opt.id);
      toast.success(`${slot.title}: switched to ${opt.name}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setPending(null);
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          {slot.title}
        </CardTitle>
        <CardDescription>{slot.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div role="radiogroup" aria-label={slot.title} className="grid gap-2">
          {slot.options.map((opt) => {
            const isActive = opt.id === slot.active_option_id;
            const unavailable = opt.status === 'coming-soon' || opt.status === 'not-configured';
            return (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={isActive}
                disabled={unavailable || pending !== null}
                onClick={() => !isActive && apply(opt)}
                className={cn(
                  'group relative flex items-start gap-3 text-left rounded-xl border p-3 transition-colors',
                  'disabled:opacity-55 disabled:cursor-not-allowed',
                  isActive ? 'border-primary bg-primary/10' : 'border-border bg-card hover:bg-muted',
                )}
              >
                <span
                  className={cn(
                    'mt-1 size-3.5 shrink-0 rounded-full border-2 transition-colors',
                    isActive ? 'border-primary bg-primary' : 'border-muted-foreground/50',
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    {opt.name}
                    {opt.version && (
                      <span className="ml-1.5 text-xs text-muted-foreground">v{opt.version}</span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">
                    {opt.description}
                  </span>
                </span>
                <span className="flex flex-col items-end gap-1 shrink-0">
                  <OptionBadge option={opt} active={isActive} pending={pending === opt.id} />
                  {opt.local && <span className="microlabel text-muted-foreground">local · offline</span>}
                </span>
              </button>
            );
          })}
        </div>

        {slot.connections && (
          <>
            <Separator className="my-5" />
            <div className="flex items-center gap-2 mb-3">
              <Plug className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium">Connections</span>
              <span className="text-xs text-muted-foreground">
                Future MCP / agent / API hooks for metadata enrichment.
              </span>
            </div>
            <div className="grid gap-2">
              {slot.connections.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {c.name}{' '}
                      <span className="microlabel text-muted-foreground ml-1">{c.kind}</span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{c.description}</div>
                  </div>
                  <Badge variant={c.status === 'configured' ? 'default' : 'secondary'}>
                    {c.status === 'configured' ? 'Configured' : c.status === 'available' ? 'Available' : 'Coming soon'}
                  </Badge>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function OptionBadge({
  option,
  active,
  pending,
}: {
  option: ModelOption;
  active: boolean;
  pending: boolean;
}) {
  if (pending) return <Badge variant="secondary">Switching…</Badge>;
  if (active) return <Badge>Active</Badge>;
  if (option.status === 'coming-soon') return <Badge variant="secondary">Coming soon</Badge>;
  if (option.status === 'not-configured') return <Badge variant="outline">Not configured</Badge>;
  if (option.status === 'requires-key') return <Badge variant="outline">Requires key</Badge>;
  return <Badge variant="secondary">Available</Badge>;
}
