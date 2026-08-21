import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Camera, ChevronDown, Download, Library, Loader2, Plus, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Page } from '@/components/Page';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { PageThumb } from '@/features/binders/PageThumb';
import { BinderSettingsDialog } from '@/features/binders/BinderSettingsDialog';
import { getBinder, listPages } from '@/api/bindersApi';
import { getErrorMessage } from '@/api/client';
import { downloadPdf, exportUrls } from '@/api/exportsApi';
import { refreshPendingReview } from '@/hooks/usePendingReview';
import type { Binder, Page as BinderPage } from '@/api/types';
import { parseLayout } from '@/lib/layout';
import { getDetectorSpec } from '@/lib/detectors';

export function BinderDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [binder, setBinder] = useState<Binder | null | undefined>(undefined);
  const [pages, setPages] = useState<BinderPage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const load = () => {
    setError(null);
    setBinder(undefined);
    setPages(null);
    // One request for the binder, one for every page with its full grid.
    getBinder(id)
      .then((b) => {
        setBinder(b);
        if (b) return listPages(b.id).then(setPages);
      })
      .catch((e) => setError(getErrorMessage(e)));
  };
  useEffect(load, [id]);

  if (error) {
    return (
      <Page>
        <PageHeader title="Binder" back={{ to: '/binders', label: 'Binders' }} />
        <ErrorState message={error} onRetry={load} />
      </Page>
    );
  }
  if (binder === undefined) {
    return (
      <Page>
        <PageHeader title={<Skeleton className="h-8 w-64" />} back={{ to: '/binders', label: 'Binders' }} />
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-card rounded-xl" />
          ))}
        </div>
      </Page>
    );
  }
  if (binder === null) {
    return (
      <Page>
        <PageHeader title="Binder not found" back={{ to: '/binders', label: 'Binders' }} />
        <EmptyState icon={Library} title="That binder doesn't exist" />
      </Page>
    );
  }

  const dims = parseLayout(binder.layout);
  const pendingCount =
    pages?.reduce(
      (sum, p) => sum + p.placements.filter((pl) => pl.review_status === 'pending').length,
      0,
    ) ?? 0;

  return (
    <Page>
      <PageHeader
        title={binder.name}
        description={`${binder.page_count} pages · ${binder.card_count} cards`}
        back={{ to: '/binders', label: 'Binders' }}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Binder settings"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings2 />
            </Button>
            <ExportMenu binder={binder} />
            <Button asChild>
              <Link to={`/scan?binder=${binder.id}`}>
                <Camera className="size-4" />
                Scan a page
              </Link>
            </Button>
          </div>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground tabular-nums">
          {dims.rows}×{dims.cols} pockets
        </span>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <Settings2 className="size-3.5" />
          {getDetectorSpec(binder.detector).label}
          {binder.detector_config && Object.keys(binder.detector_config).length > 0
            ? ' · custom'
            : ''}
        </button>
        {pendingCount > 0 && (
          <Link
            to="/review"
            className="inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-2.5 py-1 text-xs font-medium text-warning hover:bg-warning/25 transition-colors tabular-nums"
          >
            {pendingCount} need review →
          </Link>
        )}
      </div>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {(pages ?? Array.from({ length: binder.page_count }).map(() => null)).map((p, i) =>
          p ? (
            <PageThumb key={p.id} binder={binder} page={p} />
          ) : (
            <Skeleton key={i} className="aspect-card rounded-xl" />
          ),
        )}
        <Link
          to={`/scan?binder=${binder.id}`}
          className="group aspect-card rounded-xl border-2 border-dashed border-border bg-card/40 grid place-items-center text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
        >
          <div className="flex flex-col items-center gap-2">
            <Plus className="size-6" />
            <span className="text-xs font-medium">Scan a page</span>
          </div>
        </Link>
      </div>

      <BinderSettingsDialog
        binder={binder}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onSaved={setBinder}
        onDeleted={() => {
          void refreshPendingReview();
          navigate('/binders');
        }}
      />
    </Page>
  );
}

function ExportMenu({ binder }: { binder: Binder }) {
  const [busy, setBusy] = useState(false);
  const run = async (url: string, filename: string) => {
    setBusy(true);
    try {
      await downloadPdf(url, filename);
      toast.success(`Exported ${filename}`);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const slug = binder.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'binder';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <Download />}
          {busy ? 'Preparing…' : 'Export'}
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => run(exportUrls.binderCards(binder.id), `${slug}-cards.pdf`)}>
          Cards PDF — one card per row
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => run(exportUrls.binderPages(binder.id), `${slug}-pages.pdf`)}>
          Pages PDF — one page per sheet
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
