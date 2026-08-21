import { Link } from 'react-router';
import { Camera, Inbox, Library, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { ActivityItem } from '@/api/types';

const ACTIVITY_ICON: Record<ActivityItem['kind'], typeof Camera> = {
  scan: Camera,
  review: Inbox,
  enrich: Sparkles,
  binder: Library,
};

// Where an activity item leads, when the backend gave us an entity ref.
function activityHref(a: ActivityItem): string | null {
  if (a.kind === 'scan' && a.binder_id && a.page_number)
    return `/binders/${a.binder_id}/pages/${a.page_number}`;
  if (a.core_card_id) return `/cards/${a.core_card_id}`;
  if (a.binder_id) return `/binders/${a.binder_id}`;
  return null;
}

type Props = {
  activity: ActivityItem[] | null;
  error: string | null;
};

export function ActivityCard({ activity, error }: Props) {
  return (
    <Card className="lg:col-span-2 overflow-hidden">
      <CardContent className="p-0">
        <header className="px-5 py-4 border-b border-border">
          <div className="font-semibold">Recent activity</div>
          <div className="text-xs text-muted-foreground">Local events from your collection.</div>
        </header>
        {error ? (
          <div className="px-5 py-8 text-sm text-muted-foreground text-center">{error}</div>
        ) : activity === null ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : activity.length === 0 ? (
          <div className="px-5 py-8 text-sm text-muted-foreground text-center">
            Nothing yet — activity shows up here as you scan and review.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {activity.map((a) => {
              const Icon = ACTIVITY_ICON[a.kind];
              const href = activityHref(a);
              const row = (
                <>
                  <div className="size-9 rounded-lg bg-muted grid place-items-center text-muted-foreground shrink-0">
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{a.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{a.detail}</div>
                  </div>
                  <time className="text-xs text-muted-foreground tabular-nums shrink-0">
                    {formatRelative(a.when)}
                  </time>
                </>
              );
              return (
                <li key={a.id}>
                  {href ? (
                    <Link
                      to={href}
                      className="px-5 py-3.5 flex items-center gap-3 transition-colors hover:bg-muted/40"
                    >
                      {row}
                    </Link>
                  ) : (
                    <div className="px-5 py-3.5 flex items-center gap-3">{row}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60_000);
  if (min < 1) return 'now';
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h`;
  const d = Math.round(hr / 24);
  if (d < 30) return `${d}d`;
  return `${Math.round(d / 30)}mo`;
}
