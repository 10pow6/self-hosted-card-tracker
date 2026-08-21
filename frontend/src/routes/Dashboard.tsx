import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowRight,
  Camera,
  Inbox,
  Layers,
  LayoutGrid,
  Library,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Page } from '@/components/Page';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { ErrorState } from '@/components/ErrorState';
import { ActivityCard } from '@/features/home/ActivityCard';
import { FirstRunHero } from '@/features/home/FirstRunHero';
import { GuardrailsCard } from '@/features/home/GuardrailsCard';
import { getActivity, getStats } from '@/api/dashboardApi';
import { getErrorMessage } from '@/api/client';
import type { ActivityItem, DashboardStats } from '@/api/types';

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityItem[] | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);

  const load = useCallback(() => {
    setStatsError(null);
    setActivityError(null);
    getStats()
      .then(setStats)
      .catch((e) => setStatsError(getErrorMessage(e)));
    getActivity()
      .then(setActivity)
      .catch((e) => setActivityError(getErrorMessage(e)));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const firstRun = stats !== null && stats.binders === 0 && stats.core_cards === 0;

  return (
    <div className="relative isolate">
      <div className="brand-band absolute top-0 inset-x-0 h-72 -z-10 pointer-events-none" />
      <Page>
        <PageHeader
          title={
            <>
              Welcome back<span className="text-muted-foreground"> ·</span>{' '}
              <span className="text-primary">your collection</span>
            </>
          }
          description="A self-hosted home for every card in every binder. The model proposes matches; you make the calls."
        />

        {statsError ? (
          <ErrorState message={statsError} onRetry={load} />
        ) : firstRun ? (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <FirstRunHero />
            </div>
            <GuardrailsCard />
          </div>
        ) : (
          <>
            <section className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
              {stats ? (
                <>
                  <StatCard icon={Library} label="Binders" value={stats.binders} tone="accent" to="/binders" />
                  <StatCard icon={Camera} label="Pages scanned" value={stats.pages} to="/binders" />
                  <StatCard
                    icon={LayoutGrid}
                    label="Catalog entries"
                    value={stats.core_cards}
                    hint={
                      stats.needs_metadata > 0
                        ? `${stats.needs_metadata} still need info`
                        : 'distinct cards in your catalog'
                    }
                    to={stats.needs_metadata > 0 ? '/cards?needs=1' : '/cards'}
                  />
                  <StatCard
                    icon={Layers}
                    label="Physical cards"
                    value={stats.total_cards}
                    hint="across all binders, incl. duplicates"
                    to="/binders?tab=cards"
                  />
                  <StatCard
                    icon={Inbox}
                    label="Pending review"
                    value={stats.pending_review}
                    tone={stats.pending_review > 0 ? 'warn' : 'default'}
                    hint={stats.pending_review > 0 ? 'matches waiting on you' : 'queue is clear'}
                    to="/review"
                  />
                </>
              ) : (
                Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
              )}
            </section>

            <section className="mt-6 grid gap-4 lg:grid-cols-3">
              <QuickAction
                to="/scan"
                icon={Camera}
                title="Scan a page"
                subtitle="Photograph a binder page; the detector proposes card boxes for you to confirm."
                accent
              />
              <QuickAction
                to="/review"
                icon={Inbox}
                title="Resolve the queue"
                subtitle={
                  stats && stats.pending_review > 0
                    ? `${stats.pending_review} proposed matches are waiting on your judgment.`
                    : 'Confirm or reject proposed matches — keyboard-first.'
                }
              />
              <QuickAction
                to="/cards"
                icon={LayoutGrid}
                title="Browse the catalog"
                subtitle={
                  stats && stats.needs_metadata > 0
                    ? `${stats.needs_metadata} cards are missing metadata — edit by hand or run the enrichment skill.`
                    : "Every distinct card you've filed. Filter, edit, and enrich metadata."
                }
              />
            </section>

            <section className="mt-8 grid gap-6 lg:grid-cols-3">
              <ActivityCard activity={activity} error={activityError} />
              <GuardrailsCard />
            </section>
          </>
        )}
      </Page>
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
    <Link to={to} className="group focus:outline-none h-full">
      <Card
        className={
          accent
            ? 'h-full overflow-hidden border-primary/40 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent transition-all group-hover:border-primary group-hover:-translate-y-0.5'
            : 'h-full overflow-hidden transition-all group-hover:border-primary/60 group-hover:-translate-y-0.5'
        }
      >
        <CardContent className="p-5 h-full">
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
