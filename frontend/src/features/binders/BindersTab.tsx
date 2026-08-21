import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Library, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { CreateBinderDialog } from '@/components/CreateBinderDialog';
import { BinderCard } from '@/features/binders/BinderCard';
import { listBinders } from '@/api/bindersApi';
import { getErrorMessage } from '@/api/client';
import type { Binder } from '@/api/types';

type Sort = 'recent' | 'name';

export function BindersTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [binders, setBinders] = useState<Binder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [sort, setSort] = useState<Sort>('recent');
  const q = searchParams.get('bq') ?? '';

  const load = () => {
    setError(null);
    listBinders()
      .then(setBinders)
      .catch((e) => setError(getErrorMessage(e)));
  };
  useEffect(load, []);

  const setQ = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set('bq', value);
    else next.delete('bq');
    setSearchParams(next, { replace: true });
  };

  const visible = useMemo(() => {
    if (!binders) return null;
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? binders.filter((b) => b.name.toLowerCase().includes(needle))
      : [...binders];
    if (sort === 'name') filtered.sort((a, b) => a.name.localeCompare(b.name));
    else filtered.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return filtered;
  }, [binders, q, sort]);

  if (error) {
    return <ErrorState message={error} onRetry={load} />;
  }

  const showToolbar = (binders?.length ?? 0) > 6;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {showToolbar && (
          <>
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search binders…"
                className="pl-8"
              />
            </div>
            <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
              <SelectTrigger aria-label="Sort binders">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Newest first</SelectItem>
                <SelectItem value="name">By name</SelectItem>
              </SelectContent>
            </Select>
          </>
        )}
        <Button className="ml-auto" onClick={() => setCreateOpen(true)}>
          <Plus />
          New binder
        </Button>
      </div>

      {visible === null ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        q ? (
          <EmptyState icon={Library} title="No binders match" description="Try a different search term." />
        ) : (
          <EmptyState
            icon={Library}
            title="No binders yet"
            description="Create your first binder, then photograph its pages from the Scan tab — the pipeline takes it from there."
            action={
              <Button onClick={() => setCreateOpen(true)}>
                <Plus />
                Create binder
              </Button>
            }
          />
        )
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((b) => (
            <BinderCard key={b.id} binder={b} />
          ))}
        </div>
      )}

      <CreateBinderDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(b) => setBinders((prev) => (prev ? [b, ...prev] : [b]))}
      />
    </>
  );
}
