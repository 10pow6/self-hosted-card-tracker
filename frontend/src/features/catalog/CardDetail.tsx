import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { LayoutGrid, Pencil, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Page } from '@/components/Page';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ProvenanceBadge } from '@/components/decisions/ProvenanceBadge';
import { deleteCard, getCard, listPlacementsForCard } from '@/api/cardsApi';
import { getErrorMessage } from '@/api/client';
import type { CoreCard, Placement } from '@/api/types';
import { EditCardMetadataDialog } from './EditCardMetadataDialog';
import { PlacementList } from './PlacementList';

export function CardDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [card, setCard] = useState<CoreCard | null | undefined>(undefined);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const refresh = useCallback(() => {
    setError(null);
    getCard(id)
      .then((c) => {
        setCard(c);
        if (c) {
          listPlacementsForCard(c.id)
            .then(setPlacements)
            .catch((e) => setError(getErrorMessage(e)));
        }
      })
      .catch((e) => setError(getErrorMessage(e)));
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onDelete = async () => {
    if (!card) return;
    try {
      await deleteCard(card.id);
      toast.success(`Deleted ${card.name ?? 'unnamed card'} from the catalog`);
      navigate('/cards');
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  if (error && card === undefined) {
    return (
      <Page>
        <PageHeader title="Catalog entry" back={{ to: '/cards', label: 'Catalog' }} />
        <ErrorState message={error} onRetry={refresh} />
      </Page>
    );
  }
  if (card === undefined) {
    return (
      <Page>
        <PageHeader title={<Skeleton className="h-8 w-64" />} back={{ to: '/cards', label: 'Catalog' }} />
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <Skeleton className="aspect-card rounded-2xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </Page>
    );
  }
  if (card === null) {
    return (
      <Page>
        <PageHeader title="Card not found" back={{ to: '/cards', label: 'Catalog' }} />
        <EmptyState icon={LayoutGrid} title="No card with that id" />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title={card.name ?? 'Unknown card'}
        description={
          card.set
            ? `${card.set}${card.number ? ` · ${card.number}` : ''}${card.year ? ` · ${card.year}` : ''}`
            : 'No metadata yet.'
        }
        back={{ to: '/cards', label: 'Catalog' }}
      />
      <section className="grid gap-6 lg:grid-cols-[300px_1fr] items-start">
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
            <ProvenanceBadge card={card} />
          </div>
          <div className="text-xs text-muted-foreground">
            Embedded with {card.embedder_name} · {card.embedder_version}
          </div>
          {card.needs_metadata && (
            <div className="rounded-lg border border-ai/30 bg-ai/10 p-3 text-xs leading-relaxed">
              <div className="flex items-center gap-1.5 font-medium text-ai">
                <Sparkles className="size-3.5" />
                Missing metadata
              </div>
              <p className="mt-1 text-muted-foreground">
                Fill it in by hand, or let the Claude enrichment skill propose it — you review
                every suggestion.
              </p>
              <Link
                to="/settings"
                className="mt-1.5 inline-block font-medium text-ai hover:underline underline-offset-2"
              >
                Enrich with the Claude skill →
              </Link>
            </div>
          )}
        </div>

        <div className="space-y-6 min-w-0">
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="microlabel text-muted-foreground">Metadata</div>
                <Button size="sm" onClick={() => setEditOpen(true)}>
                  <Pencil className="size-3.5" />
                  Edit
                </Button>
              </div>
              {card.metadata_source === 'claude-skill' && (
                <p className="text-xs text-muted-foreground">
                  Suggested by the AI enrichment skill — editing any field marks this card as
                  verified by you.
                </p>
              )}
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
                  <div className="microlabel text-muted-foreground">Placements</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Physical instances of this card across your binders.
                  </div>
                </div>
                <Badge variant="secondary" className="tabular-nums">{placements.length}</Badge>
              </div>
              {placements.length === 0 ? (
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground">
                    No placements. This entry exists in the catalog but no physical card is
                    mapped to it — typically because every placement that pointed here was moved
                    elsewhere.
                  </div>
                  <ConfirmDialog
                    trigger={
                      <Button variant="destructive" size="sm">
                        <Trash2 className="size-3.5" />
                        Delete this card
                      </Button>
                    }
                    title={`Delete ${card.name ?? 'this unnamed card'}?`}
                    description="Permanently removes this entry and its metadata from the catalog. It has no placements, so no binder slots are affected. This cannot be undone."
                    confirmLabel="Delete"
                    destructive
                    onConfirm={onDelete}
                  />
                </div>
              ) : (
                <>
                  <PlacementList card={card} placements={placements} onChanged={refresh} />
                  <p className="mt-3 text-xs text-muted-foreground">
                    Deleting this entry is unavailable while it has placements — move or merge
                    its {placements.length} placement{placements.length === 1 ? '' : 's'} first.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <EditCardMetadataDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        card={card}
        onSaved={(updated) => setCard(updated)}
      />
    </Page>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <>
      <dt className="microlabel text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value ?? <span className="text-muted-foreground italic">—</span>}</dd>
    </>
  );
}
