import { useState } from 'react';
import { Pencil, Plug, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import type { ModelOption, ModelSlot } from '@/api/types';
import { cn } from '@/lib/utils';

type Props = {
  slot: ModelSlot;
  onChange: (slotId: string, optionId: string) => Promise<void> | void;
};

export function ModelSlotCard({ slot, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const active = slot.options.find((o) => o.id === slot.active_option_id) ?? slot.options[0];

  const apply = async (optId: string) => {
    setPending(optId);
    setError(null);
    try {
      await onChange(slot.id, optId);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(null);
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              {slot.title}
            </CardTitle>
            <CardDescription className="mt-1">{slot.description}</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            <Pencil className="size-3.5" />
            Edit
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ActiveOption option={active} />
        {slot.connections && (
          <>
            <Separator className="my-5" />
            <div>
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
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground ml-1">
                          {c.kind}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{c.description}</div>
                    </div>
                    <Badge variant={c.status === 'configured' ? 'default' : 'secondary'}>
                      {c.status === 'configured' ? 'Configured' : c.status === 'available' ? 'Available' : 'Coming soon'}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{slot.title}</DialogTitle>
            <DialogDescription>{slot.description}</DialogDescription>
          </DialogHeader>
          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive whitespace-pre-wrap mt-2">
              {error}
            </div>
          )}
          <div className="grid gap-2 mt-2">
            {slot.options.map((opt) => {
              const isActive = opt.id === slot.active_option_id;
              const disabled = opt.status === 'coming-soon' || opt.status === 'not-configured';
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={disabled || pending !== null}
                  onClick={() => !isActive && apply(opt.id)}
                  className={cn(
                    'group relative text-left rounded-xl border p-4 transition-colors disabled:opacity-60 disabled:cursor-not-allowed',
                    isActive
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-card hover:bg-muted',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium">
                        {opt.name}
                        {opt.version && (
                          <span className="ml-1.5 text-xs text-muted-foreground">{opt.version}</span>
                        )}
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">{opt.description}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <StatusBadge option={opt} active={isActive} />
                      {opt.local && (
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          local · offline
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function ActiveOption({ option }: { option: ModelOption }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Active</div>
          <div className="mt-1 font-medium">
            {option.name}
            {option.version && (
              <span className="ml-1.5 text-xs text-muted-foreground">v{option.version}</span>
            )}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">{option.description}</div>
        </div>
        <StatusBadge option={option} active />
      </div>
    </div>
  );
}

function StatusBadge({ option, active }: { option: ModelOption; active: boolean }) {
  if (active) return <Badge>Active</Badge>;
  if (option.status === 'coming-soon') return <Badge variant="secondary">Coming soon</Badge>;
  if (option.status === 'not-configured') return <Badge variant="outline">Not configured</Badge>;
  if (option.status === 'requires-key') return <Badge variant="outline">Requires key</Badge>;
  return <Badge variant="secondary">Available</Badge>;
}
