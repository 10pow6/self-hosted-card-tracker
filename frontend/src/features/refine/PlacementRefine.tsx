import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { Save, Scissors, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Page } from '@/components/Page';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { PolygonEditor } from '@/components/PolygonEditor';
import { getPlacement, refinePolygon } from '@/api/placementApi';
import { getErrorMessage } from '@/api/client';
import type { PlacementDetail, Point, Slot } from '@/api/types';
import { IdentityPanel } from './IdentityPanel';

// Two separate jobs, visually separated: the crop (left) and the identity
// (sidebar). Saving the crop re-embeds and re-ranks candidates automatically.
export function PlacementRefine() {
  const { id = '' } = useParams<{ id: string }>();

  const [placement, setPlacement] = useState<PlacementDetail | null | undefined>(undefined);
  const [slots, setSlots] = useState<Slot[]>([]);
  // The polygon we compare against for dirtiness. For placements with no
  // stored polygon this is the synthetic default box — so simply loading the
  // page never counts as an edit.
  const [baseline, setBaseline] = useState<Slot[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const p = await getPlacement(id);
      setPlacement(p);
      if (p) {
        const slot = toSlot(p);
        setSlots([slot]);
        setBaseline([slot]);
      }
    } catch (e) {
      setPlacement(undefined);
      setLoadError(getErrorMessage(e));
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = useMemo(() => {
    if (slots.length === 0 || baseline.length === 0) return false;
    const a = baseline[0].polygon;
    const b = slots[0].polygon;
    return a.some((p, i) => p.x !== b[i].x || p.y !== b[i].y);
  }, [slots, baseline]);

  const onSave = async () => {
    if (!placement || slots.length === 0) return;
    setSaving(true);
    try {
      const updated = await refinePolygon(placement.id, slots[0].polygon);
      setPlacement(updated);
      const slot = toSlot(updated);
      setSlots([slot]);
      setBaseline([slot]);
      toast.success('Crop saved and re-embedded — candidates re-ranked');
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const onResetEdit = () => setSlots(baseline);

  if (loadError) {
    return (
      <Page width="wide">
        <PageHeader title="Fix crop" back={{ to: '/cards', label: 'Catalog' }} />
        <ErrorState message={loadError} onRetry={() => void load()} />
      </Page>
    );
  }
  if (placement === undefined) {
    return (
      <Page width="wide">
        <PageHeader title={<Skeleton className="h-8 w-72" />} back={{ to: '/cards', label: 'Catalog' }} />
        <Skeleton className="aspect-video max-w-3xl rounded-xl" />
      </Page>
    );
  }
  if (placement === null) {
    return (
      <Page width="wide">
        <PageHeader title="Placement not found" back={{ to: '/cards', label: 'Catalog' }} />
        <EmptyState icon={Scissors} title="No placement with that id" />
      </Page>
    );
  }

  const { page } = placement;

  return (
    <Page width="wide">
      <PageHeader
        title={`${page.binder_name} · Page ${page.page_number} · slot ${placement.slot_index + 1}`}
        description="Fix the crop on the left; manage what card this is on the right. The two save independently."
        back={{ to: `/binders/${page.binder_id}/pages/${page.page_number}`, label: 'Back to page' }}
      />
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
        {/* Identity first in DOM so actions are never buried below a tall
            canvas on phones/tablets; visually right on lg+. */}
        <aside className="lg:order-2 lg:sticky lg:top-6">
          <IdentityPanel placement={placement} onChanged={load} />
        </aside>

        <div className="min-w-0 space-y-3 lg:order-1">
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border">
                <div>
                  <div className="microlabel text-muted-foreground">Crop</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Drag the corners to match the card's edges. Saving re-warps the crop and
                    re-embeds it.
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="ghost" size="sm" onClick={onResetEdit} disabled={!dirty || saving}>
                    <Undo2 className="size-3.5" />
                    Reset
                  </Button>
                  <Button size="sm" onClick={onSave} disabled={!dirty || saving}>
                    <Save className="size-3.5" />
                    {saving ? 'Saving…' : 'Save crop & re-embed'}
                  </Button>
                </div>
              </div>
              {page.source_image_url && page.image_size[0] > 0 ? (
                <PolygonEditor
                  imageUrl={page.source_image_url}
                  imageSize={page.image_size}
                  bbox={[0, 0, page.image_size[0], page.image_size[1]]}
                  rows={1}
                  cols={1}
                  slots={slots}
                  onChange={setSlots}
                />
              ) : (
                <div className="p-6 text-sm text-muted-foreground">
                  Source page image not available for this placement.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </Page>
  );
}

function toSlot(p: PlacementDetail): Slot {
  // Pre-migration placements have no stored polygon — fall back to a centered
  // box sized to ~80% of the cell as a sensible starting point.
  const polygon: [Point, Point, Point, Point] = p.polygon ?? defaultCellPolygon(p);
  return {
    slot_index: 0, // single-slot view
    polygon,
    refined: p.polygon !== null,
    disabled: false,
  };
}

function defaultCellPolygon(p: PlacementDetail): [Point, Point, Point, Point] {
  const [imgW, imgH] = p.page.image_size;
  const cellW = imgW / p.page.cols;
  const cellH = imgH / p.page.rows;
  const col = p.slot_index % p.page.cols;
  const row = Math.floor(p.slot_index / p.page.cols);
  const cx = col * cellW;
  const cy = row * cellH;
  const m = 0.8;
  const aspect = 88 / 63;
  let pw: number;
  let ph: number;
  if ((cellH * m) / aspect <= cellW * m) {
    ph = cellH * m;
    pw = ph / aspect;
  } else {
    pw = cellW * m;
    ph = pw * aspect;
  }
  const px = cx + (cellW - pw) / 2;
  const py = cy + (cellH - ph) / 2;
  return [
    { x: px, y: py },
    { x: px + pw, y: py },
    { x: px + pw, y: py + ph },
    { x: px, y: py + ph },
  ];
}
