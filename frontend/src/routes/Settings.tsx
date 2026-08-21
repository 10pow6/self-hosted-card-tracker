import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Page } from '@/components/Page';
import { PageHeader } from '@/components/PageHeader';
import { ErrorState } from '@/components/ErrorState';
import { ModelSlotCard } from '@/features/settings/ModelSlotCard';
import { AutomationCard } from '@/features/settings/AutomationCard';
import { EnrichmentPanel } from '@/features/settings/EnrichmentPanel';
import { getModelSlots, setActiveOption } from '@/api/settingsApi';
import { getErrorMessage } from '@/api/client';
import type { ModelSlot } from '@/api/types';

export function Settings() {
  const [slots, setSlots] = useState<ModelSlot[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    setError(null);
    getModelSlots()
      .then(setSlots)
      .catch((e) => setError(getErrorMessage(e)));
  };

  useEffect(refresh, []);

  const onChange = async (slotId: string, optionId: string) => {
    await setActiveOption(slotId, optionId);
    refresh();
  };

  return (
    <Page width="narrow">
      <PageHeader
        title="Settings"
        description="The models behind each pipeline step, the rules they operate under, and the enrichment workflow."
      />
      <div className="space-y-8">
        <Section title="Automation" hint="What the AI may decide without you.">
          <AutomationCard />
        </Section>

        <Section title="Model slots" hint="Swap the engine behind each pipeline step.">
          {error ? (
            <ErrorState message={error} onRetry={refresh} />
          ) : slots === null ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)
          ) : (
            slots.map((s) => <ModelSlotCard key={s.id} slot={s} onChange={onChange} />)
          )}
        </Section>

        <Section title="Metadata enrichment" hint="An AI workflow you run yourself, with a domain allowlist.">
          <EnrichmentPanel />
        </Section>

        <div className="rounded-xl border border-border bg-muted/20 p-4 text-xs text-muted-foreground leading-relaxed">
          All scoring and matching runs locally by default. The only network call is a one-time
          download of model weights from Hugging Face on first use; everything afterward is
          offline. External-service options (hosted embeddings, agent connections) are opt-in and
          will require credentials when enabled.
        </div>
      </div>
    </Page>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
      </div>
      {children}
    </section>
  );
}
