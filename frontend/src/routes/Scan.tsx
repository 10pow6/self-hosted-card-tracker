import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Page } from '@/components/Page';
import { PageHeader } from '@/components/PageHeader';
import { commitScan, previewScan } from '@/api/scanApi';
import { getBinder, listBinders } from '@/api/bindersApi';
import { getErrorMessage } from '@/api/client';
import { refreshPendingReview } from '@/hooks/usePendingReview';
import { parseLayout } from '@/lib/layout';
import type { Binder, CommitResponse, PreviewResponse, Slot } from '@/api/types';
import { Stepper, type ScanStep } from '@/features/scan/Stepper';
import { BinderPickStep } from '@/features/scan/BinderPickStep';
import { CaptureStep } from '@/features/scan/CaptureStep';
import { AdjustStep } from '@/features/scan/AdjustStep';
import { CommittedStep } from '@/features/scan/CommittedStep';
import { SessionStrip } from '@/features/scan/SessionStrip';
import {
  clearScanState,
  loadScanState,
  saveScanState,
  type SavedPage,
} from '@/features/scan/persistence';

// The scan wizard: pick binder → capture → adjust boxes → committed.
// Step components live in features/scan; this file only orchestrates.
export function Scan() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const binderIdParam = searchParams.get('binder');

  const [binder, setBinder] = useState<Binder | null>(null);
  const [allBinders, setAllBinders] = useState<Binder[] | null>(null);
  const [bindersError, setBindersError] = useState<string | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [savedPages, setSavedPages] = useState<SavedPage[]>([]);

  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [committed, setCommitted] = useState<CommitResponse | null>(null);

  const fetchBinders = useCallback(() => {
    setBindersError(null);
    listBinders()
      .then(setAllBinders)
      .catch((e) => setBindersError(getErrorMessage(e)));
  }, []);

  useEffect(() => {
    fetchBinders();
  }, [fetchBinders]);

  // If URL specifies a binder, hydrate it. On hydration also check
  // sessionStorage for an in-flight scan (see features/scan/persistence.ts)
  // so an iOS-Safari reload doesn't lose work.
  useEffect(() => {
    if (binderIdParam && (!binder || binder.id !== binderIdParam)) {
      getBinder(binderIdParam)
        .then((b) => {
          if (!b) {
            toast.error('That binder no longer exists.');
            setSearchParams({}, { replace: true });
            return;
          }
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
        })
        .catch((e) => toast.error(getErrorMessage(e)));
    }
  }, [binderIdParam, binder, setSearchParams]);

  // Persist scan state to sessionStorage whenever the meaningful slice changes.
  useEffect(() => {
    if (!binder) return;
    if (!preview && !committed && savedPages.length === 0) {
      clearScanState();
      return;
    }
    saveScanState({ binderId: binder.id, pageNumber, savedPages, preview, slots, committed });
  }, [binder, pageNumber, savedPages, preview, slots, committed]);

  const selectBinder = (b: Binder) => {
    setBinder(b);
    setPageNumber(b.page_count + 1);
    setSavedPages([]);
    setAllBinders((prev) => (prev && !prev.some((x) => x.id === b.id) ? [b, ...prev] : prev));
    setSearchParams({ binder: b.id }, { replace: true });
  };

  const switchBinder = () => {
    setBinder(null);
    setPreview(null);
    setSlots([]);
    setCommitted(null);
    setSavedPages([]);
    setSearchParams({}, { replace: true });
    clearScanState();
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !binder) return;
    setBusy(true);
    try {
      const res = await previewScan(file, { binderId: binder.id });
      setPreview(res);
      setSlots(res.slots);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const onConfirm = async () => {
    if (!preview || !binder) return;
    setBusy(true);
    try {
      const res = await commitScan({
        scanId: preview.scan_id,
        binderId: binder.id,
        pageNumber,
        slots,
      });
      setCommitted(res);
      toast.success(`Page ${pageNumber} saved`);
      void refreshPendingReview();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const startOverPage = () => {
    setPreview(null);
    setSlots([]);
    setCommitted(null);
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
    navigate(binder ? `/binders/${binder.id}` : '/');
  };

  const step: ScanStep = !binder ? 0 : committed ? 3 : preview ? 2 : 1;
  const dims = parseLayout(binder?.layout);

  return (
    <Page>
      {step === 0 ? (
        <PageHeader
          title="Scan into a binder"
          description="Pick the binder you're scanning into. Each commit becomes its next page."
        />
      ) : (
        <PageHeader
          title={
            <span className="flex items-center gap-2 flex-wrap">
              <span className="truncate">{binder!.name}</span>
              <Badge variant="secondary" className="text-xs tabular-nums">Page {pageNumber}</Badge>
            </span>
          }
          back={{ to: '/binders', label: 'All binders' }}
          actions={
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={switchBinder} disabled={busy}>
                <ArrowLeft className="size-3.5" />
                Switch binder
              </Button>
              {step !== 3 && (
                <Button variant="ghost" size="sm" onClick={finishSession} disabled={busy}>
                  Done
                </Button>
              )}
            </div>
          }
        />
      )}

      <div className="mb-4">
        <Stepper current={step} />
      </div>

      <div className="space-y-4">
        {savedPages.length > 0 && binder && (
          <SessionStrip binderId={binder.id} pages={savedPages} />
        )}

        {step === 0 && (
          <BinderPickStep
            binders={allBinders}
            error={bindersError}
            onRetry={fetchBinders}
            onPick={selectBinder}
          />
        )}

        {step === 1 && (
          <CaptureStep
            busy={busy}
            ready={binder !== null}
            pageNumber={pageNumber}
            dims={dims}
            onFile={onFile}
          />
        )}

        {step === 2 && preview && (
          <AdjustStep
            preview={preview}
            slots={slots}
            dims={dims}
            busy={busy}
            onSlotsChange={setSlots}
            onRetake={startOverPage}
            onConfirm={onConfirm}
          />
        )}

        {step === 3 && committed && (
          <CommittedStep
            committed={committed}
            pageNumber={pageNumber}
            cols={dims.cols}
            onNext={startNextPage}
            onDone={finishSession}
          />
        )}
      </div>
    </Page>
  );
}
