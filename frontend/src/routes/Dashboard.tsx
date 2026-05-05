import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Camera,
  Inbox,
  LayoutGrid,
  Library,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { getActivity, getStats } from '@/api/dashboardApi';
import type { ActivityItem, DashboardStats } from '@/api/types';

const ACTIVITY_ICON: Record<ActivityItem['kind'], typeof Camera> = {
  scan: Camera,
  review: Inbox,
  enrich: Sparkles,
  binder: Library,
};

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[] | null>(null);

  useEffect(() => {
    getStats().then(setStats);
    getActivity().then(setActivity);
  }, []);

  return (
    <div className="relative isolate">
      <div className="brand-band absolute top-0 inset-x-0 h-72 -z-10 pointer-events-none" />
      <PageHeader
        title={
          <>
            Welcome back<span className="text-muted-foreground"> ·</span>{' '}
            <span className="text-primary">your collection</span>
          </>
        }
        description="A self-hosted home for every card in every binder. Scan a page, resolve matches, and keep your card database tidy."
      />
      <section className="px-4 md:px-8 grid gap-3 grid-cols-2 lg:grid-cols-4">
        {stats ? (
          <>
            <StatCard icon={Library} label="Binders" value={stats.binders} tone="accent" />
            <StatCard icon={Camera} label="Pages scanned" value={stats.pages} />
            <StatCard icon={LayoutGrid} label="Card database" value={stats.core_cards} />
            <StatCard
              icon={Inbox}
              label="Pending review"
              value={stats.pending_review}
              tone={stats.pending_review > 0 ? 'warn' : 'default'}
              hint={stats.pending_review > 0 ? 'similar matches need a yes/no' : 'queue is clear'}
            />
          </>
        ) : (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        )}
      </section>

      <section className="px-4 md:px-8 mt-6 grid gap-4 lg:grid-cols-3">
        <QuickAction
          to="/scan"
          icon={Camera}
          title="Upload a page"
          subtitle="Capture or upload a binder page (any layout); auto-detect cards, review, then commit."
          accent
        />
        <QuickAction
          to="/review"
          icon={Inbox}
          title="Resolve the queue"
          subtitle="Confirm or reject auto-match candidates with keyboard shortcuts."
        />
        <QuickAction
          to="/cards"
          icon={LayoutGrid}
          title="Browse the card database"
          subtitle="Every distinct card you've cataloged. Filter and enrich metadata."
        />
      </section>

      <section className="px-4 md:px-8 mt-8 mb-12 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 overflow-hidden">
          <CardContent className="p-0">
            <header className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div>
                <div className="font-semibold">Recent activity</div>
                <div className="text-xs text-muted-foreground">
                  Local events from your collection.
                </div>
              </div>
            </header>
            <ul className="divide-y divide-border">
              {(activity ?? Array.from({ length: 4 }).map(() => null)).map((a, i) => {
                if (!a)
                  return (
                    <li key={i} className="px-5 py-4">
                      <Skeleton className="h-10 w-full" />
                    </li>
                  );
                const Icon = ACTIVITY_ICON[a.kind];
                return (
                  <li key={a.id} className="px-5 py-4 flex items-center gap-3">
                    <div className="size-9 rounded-lg bg-muted grid place-items-center text-muted-foreground">
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{a.title}</div>
                      <div className="text-xs text-muted-foreground truncate">{a.detail}</div>
                    </div>
                    <time className="text-xs text-muted-foreground tabular-nums">
                      {formatRelative(a.when)}
                    </time>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="size-4 text-primary" />
              How matching works
            </div>
            <ol className="mt-3 space-y-3 text-sm text-muted-foreground">
              <li>
                <span className="text-foreground font-medium">1. Capture</span>
                <p>Photograph or upload a binder page in any layout (1×1 up to 4×4).</p>
              </li>
              <li>
                <span className="text-foreground font-medium">2. Detect</span>
                <p>The detection model parses each card slot; you confirm boxes.</p>
              </li>
              <li>
                <span className="text-foreground font-medium">3. Embed & match</span>
                <p>Each crop is embedded and compared to your card database.</p>
              </li>
              <li>
                <span className="text-foreground font-medium">4. Resolve</span>
                <p>Ambiguous matches land in the work queue for a quick yes/no.</p>
              </li>
            </ol>
            <Button variant="ghost" size="sm" className="mt-4" asChild>
              <Link to="/settings">
                Configure models
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function QuickAction({
  to,
  icon: Icon,
  title,
  subtitle,
  accent,
}: {
  to: string;
  icon: typeof Camera;
  title: string;
  subtitle: string;
  accent?: boolean;
}) {
  return (
    <Link to={to} className="group focus:outline-none">
      <Card
        className={
          accent
            ? 'overflow-hidden border-primary/40 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent transition-all group-hover:border-primary group-hover:-translate-y-0.5'
            : 'overflow-hidden transition-all group-hover:border-primary/60 group-hover:-translate-y-0.5'
        }
      >
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className="size-10 rounded-lg bg-background/60 backdrop-blur grid place-items-center border border-border">
              <Icon className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold flex items-center gap-1.5">
                {title}
                <ArrowRight className="size-3.5 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
              </div>
              <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h`;
  const d = Math.round(hr / 24);
  if (d < 30) return `${d}d`;
  return `${Math.round(d / 30)}mo`;
}
