import type { MatchingSettings, ModelSlot } from './types';

export async function getMatchingSettings(): Promise<MatchingSettings> {
  const res = await fetch('/api/settings/matching');
  if (!res.ok) throw new Error(`getMatchingSettings → ${res.status}: ${await res.text()}`);
  return (await res.json()) as MatchingSettings;
}

export async function saveMatchThreshold(value: number): Promise<MatchingSettings> {
  const res = await fetch('/api/settings/matching', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ match_threshold: value }),
  });
  if (!res.ok) throw new Error(`saveMatchThreshold → ${res.status}: ${await res.text()}`);
  return (await res.json()) as MatchingSettings;
}

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
