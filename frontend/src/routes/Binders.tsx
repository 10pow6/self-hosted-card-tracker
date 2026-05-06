import { useEffect, useState } from 'react';
import { Library, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/PageHeader';
import { BinderCard } from '@/components/BinderCard';
import { EmptyState } from '@/components/EmptyState';
import { LayoutPicker } from '@/components/LayoutPicker';
import { DetectionConfigEditor } from '@/components/DetectionConfigEditor';
import { DEFAULT_DETECTOR } from '@/lib/detectors';
import { createBinder, listBinders } from '@/api/bindersApi';
import type { Binder, DetectorConfig } from '@/api/types';

export function Binders() {
  const [binders, setBinders] = useState<Binder[] | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [layout, setLayout] = useState('3x3');
  const [detectorConfig, setDetectorConfig] = useState<DetectorConfig>({});
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    listBinders().then(setBinders);
  }, []);

  const onCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const b = await createBinder(name.trim(), layout, DEFAULT_DETECTOR, detectorConfig);
      setBinders((prev) => (prev ? [b, ...prev] : [b]));
      setOpen(false);
      setName('');
      setLayout('3x3');
      setDetectorConfig({});
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Your binders"
        description="Each binder is a stack of physical pages, every slot mapped back to your card database."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            New binder
          </Button>
        }
      />
      <section className="px-4 md:px-8 pb-12">
        {binders === null ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-72 rounded-xl" />
            ))}
          </div>
        ) : binders.length === 0 ? (
          <EmptyState
            icon={Library}
            title="No binders yet"
            description="Create your first binder, then scan its pages from the Scan tab."
            action={
              <Button onClick={() => setOpen(true)}>
                <Plus className="size-4" />
                Create binder
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {binders.map((b) => (
              <BinderCard key={b.id} binder={b} />
            ))}
          </div>
        )}
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create binder</DialogTitle>
            <DialogDescription>
              Pick a name and the binder's pocket layout.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="binder-name">Name</Label>
              <Input
                id="binder-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Pokémon — Vintage WOTC"
                onKeyDown={(e) => e.key === 'Enter' && onCreate()}
              />
            </div>
            <div className="grid gap-2">
              <Label>Layout</Label>
              <LayoutPicker value={layout} onChange={setLayout} />
            </div>
            <DetectionConfigEditor
              detectorId={DEFAULT_DETECTOR}
              value={detectorConfig}
              onChange={setDetectorConfig}
              layout={layout}
            />
            {createError && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive whitespace-pre-wrap">
                {createError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={onCreate} disabled={!name.trim() || creating}>
              {creating ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
