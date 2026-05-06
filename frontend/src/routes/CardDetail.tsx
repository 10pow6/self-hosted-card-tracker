import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Crop, LayoutGrid, MapPin, Pencil, Sparkles, Star, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { PlacementActions } from '@/components/PlacementActions';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { EditCardMetadataDialog } from '@/components/EditCardMetadataDialog';
import { deleteCard, getCard, listPlacementsForCard } from '@/api/cardsApi';
import type { CoreCard, Placement } from '@/api/types';

export function CardDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [card, setCard] = useState<CoreCard | null | undefined>(undefined);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const refresh = useCallback(() => {
    getCard(id).then((c) => {
      setCard(c);
      if (c) listPlacementsForCard(c.id).then(setPlacements);
    });
  }, [id]);

  const onDelete = async () => {
    if (!card) return;
    const label = card.name ?? 'this unnamed card';
    if (!confirm(`Delete ${label}? This card has no placements; the row will be removed permanently.`)) return;
    setDeleting(true);
    try {
      await deleteCard(card.id);
      navigate('/cards');
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
      setDeleting(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (card === undefined) {
    return (
      <>
        <PageHeader title={<Skeleton className="h-8 w-64" />} back={{ to: '/cards', label: 'Cards' }} />
      </>
    );
  }
  if (card === null) {
    return (
      <>
        <PageHeader title="Card not found" back={{ to: '/cards', label: 'Cards' }} />
        <div className="px-4 md:px-8">
          <EmptyState icon={LayoutGrid} title="No card with that id" />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={card.name ?? 'Unknown card'}
        description={
          card.set
            ? `${card.set}${card.number ? ` · ${card.number}` : ''}${card.year ? ` · ${card.year}` : ''}`
            : 'No metadata yet — enrich it below.'
        }
        back={{ to: '/cards', label: 'Cards' }}
      />
      <section className="px-4 md:px-8 pb-12 grid gap-6 lg:grid-cols-[300px_1fr] items-start">
        <div className="space-y-3">
          <div className="aspect-card rounded-2xl overflow-hidden border border-border bg-card shadow-xl shadow-primary/5">
            <img
              src={card.representative_crop_url}
              alt={card.name ?? 'Unknown card'}
              className="size-full object-cover"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary">{card.type}</Badge>
            {card.needs_metadata && (
              <Badge className="bg-[var(--card-needs-review)]/20 text-[var(--card-needs-review)]">
                needs metadata
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {card.embedder_name} · {card.embedder_version}
            </span>
          </div>
        </div>

        <div className="space-y-6 min-w-0">
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-sm font-semibold">Metadata</div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled title="Coming soon">
                    <Sparkles className="size-3.5" />
                    Enrich via agent
                  </Button>
                  <Button size="sm" onClick={() => setEditOpen(true)}>
                    <Pencil className="size-3.5" />
                    Edit
                  </Button>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <Field label="Name" value={card.name} />
                <Field label="Set" value={card.set} />
                <Field label="Number" value={card.number} />
                <Field label="Year" value={card.year?.toString() ?? null} />
                <Field label="Type" value={card.type} />
                <Field label="Notes" value={card.notes} />
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm font-semibold">Placements</div>
                  <div className="text-xs text-muted-foreground">
                    Physical instances of this card across your binders.
                  </div>
                </div>
                <Badge variant="secondary">{placements.length}</Badge>
              </div>
              {placements.length === 0 ? (
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground">
                    No placements yet. This card is in the database but no physical
                    instance is currently mapped to it — typically because every placement
                    that pointed here has been moved elsewhere.
                  </div>
                  <Button variant="destructive" size="sm" onClick={onDelete} disabled={deleting}>
                    <Trash2 className="size-3.5" />
                    {deleting ? 'Deleting…' : 'Delete this card'}
                  </Button>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {placements.map((p) => {
                    const isSource =
                      !!p.crop_url && p.crop_url === card.representative_crop_url;
                    return (
                      <li key={p.id} className="py-3 flex items-center gap-3">
                        {p.crop_url ? (
                          <HoverCard openDelay={200} closeDelay={80}>
                            <HoverCardTrigger asChild>
                              <div className="relative aspect-card w-12 rounded-md overflow-hidden bg-muted shrink-0 cursor-zoom-in">
                                <img src={p.crop_url} alt="" className="size-full object-cover" />
                                {isSource && (
                                  <span
                                    className="absolute top-0.5 right-0.5 rounded-full bg-primary text-primary-foreground p-0.5"
                                    title="Current source image"
                                  >
                                    <Star className="size-2.5 fill-current" />
                                  </span>
                                )}
                              </div>
                            </HoverCardTrigger>
                            <HoverCardContent side="right" className="w-64">
                              <img
                                src={p.crop_url}
                                alt=""
                                className="aspect-card w-full rounded-lg object-cover"
                              />
                            </HoverCardContent>
                          </HoverCard>
                        ) : (
                          <div className="relative aspect-card w-12 rounded-md overflow-hidden bg-muted shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate flex items-center gap-1.5">
                            {p.binder_name}
                            {isSource && (
                              <span className="text-[10px] uppercase tracking-wider text-primary">
                                source
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Page {p.page_number} · slot {p.slot_index + 1}
                          </div>
                        </div>
                        <Button asChild variant="ghost" size="sm">
                          <Link to={`/binders/${p.binder_id}/pages/${p.page_number}`}>
                            <MapPin className="size-3.5" />
                            View page
                          </Link>
                        </Button>
                        <Button asChild variant="ghost" size="sm">
                          <Link to={`/placements/${p.id}/refine`}>
                            <Crop className="size-3.5" />
                            Refine
                          </Link>
                        </Button>
                        <PlacementActions
                          placement={p}
                          hostCardId={card.id}
                          isCurrentSource={isSource}
                          onChanged={refresh}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {card && (
        <EditCardMetadataDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          card={card}
          onSaved={(updated) => setCard(updated)}
        />
      )}
    </>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value ?? <span className="text-muted-foreground italic">—</span>}</dd>
    </>
  );
}
