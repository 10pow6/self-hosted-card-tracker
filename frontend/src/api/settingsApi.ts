import type { ModelSlot } from './types';

export async function getModelSlots(): Promise<ModelSlot[]> {
  const res = await fetch('/api/settings/model-slots');
  if (!res.ok) throw new Error(`getModelSlots → ${res.status}: ${await res.text()}`);
  return (await res.json()) as ModelSlot[];
}

export async function setActiveOption(slotId: string, optionId: string): Promise<void> {
  const res = await fetch(
    `/api/settings/model-slots/${encodeURIComponent(slotId)}/active`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ option_id: optionId }),
    },
  );
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`setActiveOption → ${res.status}: ${detail}`);
  }
}
