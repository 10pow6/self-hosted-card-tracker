import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check, ExternalLink, Plus, RefreshCcw, Save, Scissors, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { PolygonEditor } from '@/components/PolygonEditor';
import { MovePlacementDialog } from '@/components/MovePlacementDialog';
import {
  getPlacement,
  matchPlacement,
  promotePlacementToNew,
  refinePolygon,
  unmatchPlacement,
} from '@/api/placementApi';
import type { PlacementDetail, Point, Slot } from '@/api/types';

const REVIEW_STATUS_LABEL: Record<string, string> = {
  pending: 'Pending review',
  auto_matched: 'Auto-matched',
  user_confirmed: 'Confirmed',
  new_card: 'New card',
  empty: 'Empty pocket',
};

export function PlacementRefine() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [placement, setPlacement] = useState<PlacementDetail | null | undefined>(undefined);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);

  const refresh = useCallback(async () => {
    const p = await getPlacement(id);
    setPlacement(p);
    if (p) setSlots([toSlot(p)]);
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const dirty = useMemo(() => {
    if (!placement || slots.length === 0) return false;
    const original = placement.polygon;
    if (!original) return true; // pre-migration polygon — any edit is a "dirty" save
    const current = slots[0].polygon;
    return original.some((p, i) => p.x !== current[i].x || p.y !== current[i].y);
  }, [placement, slots]);

  const onSave = async () => {
    if (!placement || slots.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await refinePolygon(placement.id, slots[0].polygon);
      setPlacement(updated);
      setSlots([toSlot(updated)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const onResetEdit = () => {
    if (placement) setSlots([toSlot(placement)]);
  };

  const onPromote = async () => {
    if (!placement || busy) return;
    if (!confirm('Promote this placement to its own new CORE card?')) return;
    setBusy(true);
    try {
      const res = await promotePlacementToNew(placement.id);
      navigate(`/cards/${res.core_card_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  const onUnmatch = async () => {
    if (!placement || busy) return;
    if (!confirm('Send this placement back to the review queue? Match will be cleared.')) return;
    setBusy(true);
    try {
      await unmatchPlacement(placement.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const onConfirmCandidate = async (coreCardId: string) => {
    if (!placement || busy) return;
    setBusy(true);
    setError(null);
    try {
      await matchPlacement(placement.id, coreCardId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  if (placement === undefined) {
    return (
      <>
        <PageHeader title={<Skeleton className="h-8 w-72" />} back={{ to: '/cards', label: 'Cards' }} />
        <div className="px-4 md:px-8">
          <Skeleton className="aspect-video max-w-3xl rounded-xl" />
        </div>
      </>
    );
  }
  if (placement === null) {
    return (
      <>
        <PageHeader title="Placement not found" back={{ to: '/cards', label: 'Cards' }} />
        <div className="px-4 md:px-8">
          <EmptyState icon={Scissors} title="No placement with that id" />
        </div>
      </>
    );
  }

  const { page, candidates } = placement;
  const status = placement.review_status;

  return (
    <>
      <PageHeader
        title={`${page.binder_name} · Page ${page.page_number} · slot ${placement.slot_index + 1}`}
        description="Drag the corners to refine the card boundary. Saving re-warps the crop and re-embeds it."
        back={{ to: `/binders/${page.binder_id}/pages/${page.page_number}`, label: 'Back to page' }}
      />
      <section className="px-4 md:px-8 pb-12 grid lg:grid-cols-[1fr_320px] gap-6 items-start">
        <div className="min-w-0 space-y-3">
          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive whitespace-pre-wrap">
              {error}
            </div>
          )}
          {page.source_image_url && page.image_size[0] > 0 ? (
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <PolygonEditor
                  imageUrl={page.source_image_url}
                  imageSize={page.image_size}
                  bbox={[0, 0, page.image_size[0], page.image_size[1]]}
                  rows={1}
                  cols={1}
                  slots={slots}
                  onChange={setSlots}
                />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                Source page image not available.
              </CardContent>
            </Card>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={onResetEdit} disabled={!dirty || busy}>
              <Undo2 className="size-4" />
              Reset edits
            </Button>
            <Button onClick={onSave} disabled={!dirty || busy}>
              <Save className="size-4" />
              {busy ? 'Saving…' : 'Save & re-embed'}
            </Button>
          </div>
        </div>

        <aside className="space-y-4 min-w-0">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold">Current match</div>
                <Badge variant="secondary">{REVIEW_STATUS_LABEL[status] ?? status}</Badge>
              </div>
              {placement.core_card ? (
                <div className="flex items-start gap-3">
                  <ZoomThumb
                    src={placement.core_card.representative_crop_url}
                    className="aspect-card w-14 rounded-md overflow-hidden bg-muted shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {placement.core_card.name ?? 'Unknown'}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {[placement.core_card.set, placement.core_card.number, placement.core_card.year]
                        .filter(Boolean)
                        .join(' · ') || placement.core_card.type}
                    </div>
                    {placement.similarity_score != null && (
                      <div
                        className="text-xs text-muted-foreground mt-1 tabular-nums"
                        title="Visual similarity between this scan and the closest other placement of the same card. Higher = stronger corroborating evidence."
                      >
                        {(placement.similarity_score * 100).toFixed(0)}% similar to this card's other placements
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  No card linked. The review queue will surface it.
                </div>
              )}
              <div className="grid grid-cols-1 gap-1 pt-1">
                {placement.core_card && (
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/cards/${placement.core_card.id}`}>
                      <ExternalLink className="size-3.5" />
                      View in card database
                    </Link>
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setMoveOpen(true)} disabled={busy}>
                  Move to a different card
                </Button>
                <Button variant="outline" size="sm" onClick={onPromote} disabled={busy}>
                  <Plus className="size-3.5" />
                  Promote to new card
                </Button>
                {status !== 'pending' && (
                  <Button variant="ghost" size="sm" onClick={onUnmatch} disabled={busy} className="text-destructive">
                    Send to review queue
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-sm font-semibold">Top candidates</div>
                  <div className="text-xs text-muted-foreground">
                    Re-computed from the current embedding. Save edits first to refresh.
                  </div>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={refresh} aria-label="Refresh candidates">
                  <RefreshCcw className="size-3.5" />
                </Button>
              </div>
              {candidates.length === 0 ? (
                <div className="text-xs text-muted-foreground">No candidates.</div>
              ) : (
                <ul className="space-y-2">
                  {candidates.map((c) => {
                    const isCurrent = placement.core_card_id === c.core_card.id;
                    return (
                      <li key={c.core_card.id}>
                        <button
                          type="button"
                          onClick={() => onConfirmCandidate(c.core_card.id)}
                          disabled={isCurrent || busy}
                          className="w-full text-left flex items-center gap-2 rounded-md border border-border bg-card px-2 py-2 hover:bg-muted disabled:opacity-60 disabled:cursor-default"
                        >
                          <ZoomThumb
                            src={c.core_card.representative_crop_url}
                            className="aspect-card w-8 rounded overflow-hidden bg-muted shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium truncate">
                              {c.core_card.name ?? 'Unknown'}
                            </div>
                            <div className="text-[10px] text-muted-foreground truncate">
                              {(c.similarity * 100).toFixed(0)}%{' '}
                              {[c.core_card.set, c.core_card.number].filter(Boolean).join(' · ')}
                            </div>
                          </div>
                          {isCurrent && <Check className="size-3.5 text-primary shrink-0" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </aside>
      </section>

      <MovePlacementDialog
        placement={placement}
        currentCardId={placement.core_card_id}
        open={moveOpen}
        onOpenChange={setMoveOpen}
        onMoved={refresh}
      />
    </>
  );
}

function toSlot(p: PlacementDetail): Slot {
  // Pre-migration placements have no stored polygon — fall back to the cell rect
  // sized to ~80% of the cell, centered. This gives the user a sensible starting box.
  const polygon: [Point, Point, Point, Point] = p.polygon ?? defaultCellPolygon(p);
  return {
    slot_index: 0, // single-slot view
    polygon,
    refined: p.polygon !== null,
    disabled: false,
  };
}

function ZoomThumb({ src, className }: { src: string; className?: string }) {
  return (
    <HoverCard openDelay={120} closeDelay={60}>
      <HoverCardTrigger asChild>
        <div className={className}>
          <img src={src} alt="" className="size-full object-cover" />
        </div>
      </HoverCardTrigger>
      <HoverCardContent side="left" className="p-1 w-auto">
        <img
          src={src}
          alt=""
          className="aspect-card w-56 rounded-md object-cover"
        />
      </HoverCardContent>
    </HoverCard>
  );
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
