import { Link } from 'react-router';
import { Crop, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { StatusBadge } from '@/components/decisions/StatusBadge';
import { PlacementActions } from './PlacementActions';
import type { CoreCard, Placement } from '@/api/types';

type Props = {
  card: CoreCard;
  placements: Placement[];
  onChanged: () => void;
};

// One row per physical instance: where it lives, who decided its match,
// one visible "Fix crop" action, the rest behind the overflow menu.
export function PlacementList({ card, placements, onChanged }: Props) {
  return (
    <ul className="divide-y divide-border">
      {placements.map((p) => {
        const isSource = !!p.crop_url && p.crop_url === card.representative_crop_url;
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
                  <img src={p.crop_url} alt="" className="aspect-card w-full rounded-lg object-cover" />
                </HoverCardContent>
              </HoverCard>
            ) : (
              <div className="relative aspect-card w-12 rounded-md overflow-hidden bg-muted shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate flex items-center gap-1.5">
                {p.binder_name}
                {isSource && (
                  <span className="microlabel text-primary">source</span>
                )}
              </div>
              <div className="text-xs text-muted-foreground tabular-nums">
                <Link
                  to={`/binders/${p.binder_id}/pages/${p.page_number}`}
                  className="hover:text-foreground hover:underline underline-offset-2"
                >
                  p. {p.page_number} · slot {p.slot_index + 1}
                </Link>
              </div>
            </div>
            <StatusBadge status={p.review_status} size="sm" className="hidden sm:inline-flex" />
            <Button asChild variant="ghost" size="sm">
              <Link to={`/placements/${p.id}/refine`}>
                <Crop className="size-3.5" />
                Fix crop
              </Link>
            </Button>
            <PlacementActions
              placement={p}
              hostCardId={card.id}
              hostCardName={card.name}
              isCurrentSource={isSource}
              onChanged={onChanged}
            />
          </li>
        );
      })}
    </ul>
  );
}
