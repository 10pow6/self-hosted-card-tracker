import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronRight,
  Library,
  Plus,
  RefreshCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
import { commitScan, previewScan } from '@/api/scanApi';
import { createBinder, getBinder, listBinders } from '@/api/bindersApi';
import { PolygonEditor } from '@/components/PolygonEditor';
import { SlotThumbnails } from '@/components/SlotThumbnails';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { LayoutPicker } from '@/components/LayoutPicker';
import type { Binder, CommitResponse, PreviewResponse, Slot } from '@/api/types';
import { parseLayout } from '@/lib/layout';
import { cn } from '@/lib/utils';

type SavedPage = { pageNumber: number; cropCount: number; firstCropUrl: string | null };

// iOS Safari sometimes evicts pages with `<input type="file">` from memory while
// the camera is open. When the user comes back, Safari reloads the tab and React
// state is gone — even though the upload may have already succeeded server-side.
// Persist the in-flight scan to sessionStorage so the user lands back on the
// polygon editor on /scan?binder=<id> after the reload.
const SCAN_STATE_KEY = 'card_tracker_scan_state_v1';

type PersistedScanState = {
  binderId: string;
  pageNumber: number;
  savedPages: SavedPage[];
  preview: PreviewResponse | null;
  slots: Slot[];
  committed: CommitResponse | null;
};

function loadScanState(binderId: string): PersistedScanState | null {
  try {
    const raw = sessionStorage.getItem(SCAN_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedScanState;
    if (parsed.binderId !== binderId) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveScanState(state: PersistedScanState): void {
  try {
    sessionStorage.setItem(SCAN_STATE_KEY, JSON.stringify(state));
  } catch {
    // Quota exceeded or storage unavailable — silently no-op.
  }
}

function clearScanState(): void {
  try {
    sessionStorage.removeItem(SCAN_STATE_KEY);
  } catch {
    /* ignore */
  }
}

export function Scan() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const binderIdParam = searchParams.get('binder');

  const [binder, setBinder] = useState<Binder | null>(null);
  const [allBinders, setAllBinders] = useState<Binder[] | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [savedPages, setSavedPages] = useState<SavedPage[]>([]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [committed, setCommitted] = useState<CommitResponse | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLayout, setNewLayout] = useState('3x3');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Load binder list for the picker.
  useEffect(() => {
    listBinders().then(setAllBinders);
  }, []);

  // If URL specifies a binder, hydrate it. On hydration we also check
  // sessionStorage for an in-flight scan (see SCAN_STATE_KEY comment) and
  // restore preview/slots/pageNumber/savedPages so an iOS-Safari reload
  // doesn't lose work.
  useEffect(() => {
    if (binderIdParam && (!binder || binder.id !== binderIdParam)) {
      getBinder(binderIdParam).then((b) => {
        if (!b) return;
        setBinder(b);
        const saved = loadScanState(b.id);
        if (saved) {
          setPageNumber(saved.pageNumber);
          setSavedPages(saved.savedPages);
          setPreview(saved.preview);
          setSlots(saved.slots);
          setCommitted(saved.committed);
        } else {
          setPageNumber(b.page_count + 1);
          setSavedPages([]);
        }
      });
    }
  }, [binderIdParam, binder]);

  // Persist scan state to sessionStorage whenever the meaningful slice changes.
  useEffect(() => {
    if (!binder) return;
    if (!preview && !committed && savedPages.length === 0) {
      // Nothing worth persisting yet (still on the capture step of the first page).
      clearScanState();
      return;
    }
    saveScanState({
      binderId: binder.id,
      pageNumber,
      savedPages,
      preview,
      slots,
      committed,
    });
  }, [binder, pageNumber, savedPages, preview, slots, committed]);

  const selectBinder = (b: Binder) => {
    setBinder(b);
    setPageNumber(b.page_count + 1);
    setSavedPages([]);
    setSearchParams({ binder: b.id }, { replace: true });
  };

  const switchBinder = () => {
    setBinder(null);
    setPreview(null);
    setSlots([]);
    setCommitted(null);
    setError(null);
    setSavedPages([]);
    setSearchParams({}, { replace: true });
    clearScanState();
  };

  const onCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const b = await createBinder(newName.trim(), newLayout);
      setAllBinders((prev) => (prev ? [b, ...prev] : [b]));
      selectBinder(b);
      setCreateOpen(false);
      setNewName('');
      setNewLayout('3x3');
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !binder) return;
    setBusy(true);
    setError(null);
    try {
      const res = await previewScan(file, binder.layout);
      setPreview(res);
      setSlots(res.slots);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const onConfirm = async () => {
    if (!preview || !binder) return;
    setBusy(true);
    setError(null);
    try {
      const res = await commitScan({
        scanId: preview.scan_id,
        binderId: binder.id,
        pageNumber: pageNumber,
        slots,
      });
      setCommitted(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const startOverPage = () => {
    setPreview(null);
    setSlots([]);
    setCommitted(null);
    setError(null);
  };

  const startNextPage = () => {
    if (!committed) return;
    setSavedPages((prev) => [
      ...prev,
      {
        pageNumber,
        cropCount: committed.crops.length,
        firstCropUrl: committed.crops[0]?.crop_url ?? null,
      },
    ]);
    setPageNumber((p) => p + 1);
    startOverPage();
  };

  const finishSession = () => {
    clearScanState();
    if (binder) navigate(`/binders/${binder.id}`);
    else navigate('/');
  };

  // ----- Render -----

  if (!binder) {
    return (
      <BinderPicker
        binders={allBinders}
        onPick={selectBinder}
        onCreate={() => setCreateOpen(true)}
        createOpen={createOpen}
        onCreateOpenChange={setCreateOpen}
        newName={newName}
        onNewNameChange={setNewName}
        newLayout={newLayout}
        onNewLayoutChange={setNewLayout}
        createError={createError}
        onConfirmCreate={onCreate}
        creating={creating}
      />
    );
  }

  const dims = parseLayout(binder.layout);
  const refinedCount = slots.filter((s) => s.refined && !s.disabled).length;

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2 flex-wrap">
            <span className="truncate">{binder.name}</span>
            <Badge variant="secondary" className="text-xs">Page {pageNumber}</Badge>
          </span>
        }
        description={
          savedPages.length > 0
            ? `${savedPages.length} page${savedPages.length === 1 ? '' : 's'} saved this session.`
            : 'Capture or upload one page at a time. Repeat as many times as you like, then finish.'
        }
        back={{ to: '/binders', label: 'All binders' }}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={switchBinder} disabled={busy}>
              <ArrowLeft className="size-3.5" />
              Switch binder
            </Button>
            <Button size="sm" onClick={finishSession} disabled={busy}>
              Done
            </Button>
          </div>
        }
      />
      <div className="px-4 md:px-8 pb-12 space-y-4 max-w-4xl">
        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive whitespace-pre-wrap">
            {error}
          </div>
        )}

        {savedPages.length > 0 && <SessionStrip pages={savedPages} />}

        {!preview && !committed && <CaptureStep busy={busy} onFile={onFile} pageNumber={pageNumber} />}

        {preview && !committed && (
          <>
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <div className="px-4 py-3 border-b border-border flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm">
                    <span className="font-medium">{refinedCount}/{dims.total}</span>{' '}
                    <span className="text-muted-foreground">auto-detected</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Drag corners. × to mark empty, + to re-add. Pinch to zoom.
                  </div>
                </div>
                <PolygonEditor
                  imageUrl={preview.image_url}
                  imageSize={preview.image_size}
                  bbox={preview.bbox}
                  rows={preview.rows ?? dims.rows}
                  cols={preview.cols ?? dims.cols}
                  slots={slots}
                  onChange={setSlots}
                />
              </CardContent>
            </Card>

            <div>
              <div className="text-sm text-muted-foreground mb-2">Live previews</div>
              <SlotThumbnails
                imageUrl={preview.image_url}
                imageSize={preview.image_size}
                cols={preview.cols ?? dims.cols}
                slots={slots}
              />
            </div>

            <div className="flex items-center gap-2 justify-end">
              <Button variant="ghost" onClick={startOverPage} disabled={busy}>
                <RefreshCcw className="size-4" />
                Retake photo
              </Button>
              <Button onClick={onConfirm} disabled={busy}>
                <Check className="size-4" />
                {busy ? 'Saving…' : 'Confirm & save page'}
              </Button>
            </div>
          </>
        )}

        {committed && (
          <CommittedStep
            committed={committed}
            pageNumber={pageNumber}
            cols={dims.cols}
            onNext={startNextPage}
            onDone={finishSession}
          />
        )}
      </div>
    </>
  );
}

// ---- Binder picker (initial step) ----

function BinderPicker({
  binders,
  onPick,
  onCreate,
  createOpen,
  onCreateOpenChange,
  newName,
  onNewNameChange,
  newLayout,
  onNewLayoutChange,
  createError,
  onConfirmCreate,
  creating,
}: {
  binders: Binder[] | null;
  onPick: (b: Binder) => void;
  onCreate: () => void;
  createOpen: boolean;
  onCreateOpenChange: (v: boolean) => void;
  newName: string;
  onNewNameChange: (v: string) => void;
  newLayout: string;
  onNewLayoutChange: (v: string) => void;
  createError: string | null;
  onConfirmCreate: () => void;
  creating: boolean;
}) {
  return (
    <>
      <PageHeader
        title="Scan into a binder"
        description="Pick the binder you're scanning into. Each commit becomes its next page. Add as many pages as you want, then click Done."
        actions={
          <Button onClick={onCreate}>
            <Plus className="size-4" />
            New binder
          </Button>
        }
      />
      <section className="px-4 md:px-8 pb-12">
        {binders === null ? (
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
              <Button onClick={onCreate}>
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
              onClick={onCreate}
              className="rounded-xl border-2 border-dashed border-border bg-card/40 p-4 text-left hover:border-primary hover:bg-card transition-colors flex items-center gap-4"
            >
              <div className="size-12 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
                <Plus className="size-5" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold">New binder</div>
                <div className="text-xs text-muted-foreground">
                  Create then start scanning right away.
                </div>
              </div>
            </button>
          </div>
        )}
      </section>

      <Dialog open={createOpen} onOpenChange={onCreateOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create binder</DialogTitle>
            <DialogDescription>
              Name your new binder and pick its pocket layout. You'll start scanning pages into it
              right after.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="new-binder-name">Name</Label>
              <Input
                id="new-binder-name"
                autoFocus
                value={newName}
                onChange={(e) => onNewNameChange(e.target.value)}
                placeholder="e.g. Pokémon — Vintage WOTC"
                onKeyDown={(e) => e.key === 'Enter' && onConfirmCreate()}
              />
            </div>
            <div className="grid gap-2">
              <Label>Layout</Label>
              <LayoutPicker value={newLayout} onChange={onNewLayoutChange} />
            </div>
            {createError && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive whitespace-pre-wrap">
                {createError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => onCreateOpenChange(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={onConfirmCreate} disabled={!newName.trim() || creating}>
              {creating ? 'Creating…' : 'Create & start'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
        <div className="text-xs text-muted-foreground">
          {binder.page_count} pages · {binder.card_count} cards · next page {binder.page_count + 1}
        </div>
      </div>
      <ChevronRight className="size-4 text-muted-foreground group-hover:text-foreground" />
    </button>
  );
}

// ---- Capture step ----

function CaptureStep({
  busy,
  onFile,
  pageNumber,
}: {
  busy: boolean;
  onFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  pageNumber: number;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <label className="flex flex-col items-center justify-center text-center px-6 py-12 md:py-16 cursor-pointer hover:bg-muted/40 transition-colors">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onFile}
            disabled={busy}
            className="hidden"
          />
          <div className="size-14 rounded-2xl bg-primary/10 text-primary grid place-items-center mb-4">
            <Camera className="size-7" />
          </div>
          <div className="text-lg font-semibold">
            {busy ? 'Detecting…' : `Capture page ${pageNumber}`}
          </div>
          <div className="mt-1 text-sm text-muted-foreground max-w-md">
            Frame the binder page so the 3×3 grid fills the photo. On mobile this will go straight
            to the camera.
          </div>
        </label>
      </CardContent>
    </Card>
  );
}

// ---- Committed step ----

function CommittedStep({
  committed,
  pageNumber,
  cols,
  onNext,
  onDone,
}: {
  committed: CommitResponse;
  pageNumber: number;
  cols: number;
  onNext: () => void;
  onDone: () => void;
}) {
  const statusBorder: Record<CommitResponse['crops'][number]['status'], string> = {
    auto_matched: 'border-[var(--card-refined)]',
    new_card: 'border-primary',
    pending: 'border-[var(--card-needs-review)]',
  };
  const statusLabel: Record<CommitResponse['crops'][number]['status'], string> = {
    auto_matched: 'matched',
    new_card: 'new',
    pending: 'review',
  };
  const { summary } = committed;
  return (
    <Card className="overflow-hidden border-primary/40 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
      <CardContent className="p-5 md:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-primary/15 text-primary grid place-items-center">
            <Check className="size-5" />
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Page {pageNumber} saved</div>
            <div className="text-xl font-semibold">
              {committed.crops.length} card{committed.crops.length === 1 ? '' : 's'}
              {committed.empty_slots.length > 0 &&
                ` · ${committed.empty_slots.length} empty`}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          {summary.auto_matched > 0 && (
            <Badge variant="secondary" className="bg-cyan-500/10 text-cyan-300 border-cyan-500/20">
              {summary.auto_matched} auto-matched
            </Badge>
          )}
          {summary.pending > 0 && (
            <Badge variant="secondary" className="bg-amber-500/10 text-amber-300 border-amber-500/20">
              {summary.pending} need review
            </Badge>
          )}
          {summary.new_cards > 0 && (
            <Badge variant="secondary" className="bg-primary/15 text-primary border-primary/20">
              {summary.new_cards} new in database
            </Badge>
          )}
        </div>

        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {committed.crops.map((c) => (
            <div
              key={c.slot_index}
              className={`aspect-card rounded-md overflow-hidden border-2 ${statusBorder[c.status]} relative`}
            >
              <img src={c.crop_url} alt={`slot ${c.slot_index + 1}`} className="size-full object-cover" />
              <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-background/85 text-xs">
                {c.slot_index + 1}
              </span>
              <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-background/85 text-[10px]">
                {statusLabel[c.status]} · {(c.similarity * 100).toFixed(0)}%
              </span>
            </div>
          ))}
          {committed.empty_slots.map((idx) => (
            <div
              key={`e-${idx}`}
              className="aspect-card rounded-md border-2 border-dashed border-border bg-muted/30 grid place-items-center text-muted-foreground text-sm"
            >
              {idx + 1} · empty
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 justify-end">
          <Button variant="outline" onClick={onDone}>
            Done
          </Button>
          <Button onClick={onNext}>
            <Camera className="size-4" />
            Scan page {pageNumber + 1}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---- Session strip (this-session pages) ----

function SessionStrip({ pages }: { pages: SavedPage[] }) {
  const totalCards = useMemo(() => pages.reduce((acc, p) => acc + p.cropCount, 0), [pages]);
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          This session
        </div>
        <div className="text-xs text-muted-foreground">
          {pages.length} page{pages.length === 1 ? '' : 's'} · {totalCards} card{totalCards === 1 ? '' : 's'}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {pages.map((p, i) => (
          <div
            key={i}
            className={cn(
              'flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5',
            )}
          >
            <div className="aspect-card w-6 rounded overflow-hidden bg-muted shrink-0">
              {p.firstCropUrl && (
                <img src={p.firstCropUrl} alt="" className="size-full object-cover" />
              )}
            </div>
            <div className="text-xs leading-tight">
              <div className="font-medium">Page {p.pageNumber}</div>
              <div className="text-muted-foreground">{p.cropCount} cards</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
