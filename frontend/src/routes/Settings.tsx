import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/PageHeader';
import { ModelSlotCard } from '@/components/ModelSlotCard';
import { getModelSlots, setActiveOption } from '@/api/settingsApi';
import type { ModelSlot } from '@/api/types';

export function Settings() {
  const [slots, setSlots] = useState<ModelSlot[] | null>(null);

  const refresh = async () => setSlots(await getModelSlots());

  useEffect(() => {
    refresh();
  }, []);

  const onChange = async (slotId: string, optionId: string) => {
    await setActiveOption(slotId, optionId);
    await refresh();
  };

  return (
    <>
      <PageHeader
        title="Settings"
        description="Choose the models that power detection, similarity, and metadata enrichment. Future swaps land here without UI changes."
      />
      <section className="px-4 md:px-8 pb-12 max-w-3xl space-y-4">
        {slots === null
          ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)
          : slots.map((s) => <ModelSlotCard key={s.id} slot={s} onChange={onChange} />)}

        <div className="rounded-xl border border-border bg-muted/20 p-4 text-xs text-muted-foreground leading-relaxed">
          All scoring and matching runs locally by default. The only network call is a one-time
          download of model weights from Hugging Face on first use; everything afterward is offline.
          External-service options (hosted embeddings, agent connections) are opt-in and will require
          credentials when enabled.
        </div>
      </section>
    </>
  );
}
