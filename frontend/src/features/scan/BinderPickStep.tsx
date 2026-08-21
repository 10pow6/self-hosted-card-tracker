import { useState } from 'react';
import { ChevronRight, Library, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { CreateBinderDialog } from '@/components/CreateBinderDialog';
import type { Binder } from '@/api/types';

type Props = {
  binders: Binder[] | null;
  error: string | null;
  onRetry: () => void;
  onPick: (b: Binder) => void;
};

// Step 1 — choose (or create) the binder this session scans into.
export function BinderPickStep({ binders, error, onRetry, onPick }: Props) {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      {error ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : binders === null ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : binders.length === 0 ? (
        <EmptyState
          icon={Library}
          title="No binders yet"
          description="Create your first binder to start scanning pages into it."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              Create binder
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {binders.map((b) => (
            <BinderPickRow key={b.id} binder={b} onPick={() => onPick(b)} />
          ))}
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="rounded-xl border-2 border-dashed border-border bg-card/40 p-4 text-left hover:border-primary hover:bg-card transition-colors flex items-center gap-4"
          >
            <div className="size-12 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
              <Plus className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold">New binder</div>
              <div className="text-xs text-muted-foreground">Create then start scanning right away.</div>
            </div>
          </button>
        </div>
      )}

      <CreateBinderDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={onPick} />
    </>
  );
}

function BinderPickRow({ binder, onPick }: { binder: Binder; onPick: () => void }) {
  const cover = binder.cover_thumbs.slice(0, 4);
  return (
    <button
      type="button"
      onClick={onPick}
      className="group rounded-xl border border-border bg-card p-4 text-left hover:border-primary/60 hover:-translate-y-0.5 transition-all flex items-center gap-4"
    >
      <div className="grid grid-cols-2 gap-0.5 size-14 shrink-0 rounded-md overflow-hidden bg-muted">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-muted/60">
            {cover[i] && <img src={cover[i]} alt="" className="size-full object-cover" draggable={false} />}
          </div>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold truncate">{binder.name}</div>
        <div className="text-xs text-muted-foreground tabular-nums">
          {binder.page_count} pages · {binder.card_count} cards · next page {binder.page_count + 1}
        </div>
      </div>
      <ChevronRight className="size-4 text-muted-foreground group-hover:text-foreground" />
    </button>
  );
}
