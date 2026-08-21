import { apiGet, apiSend } from './client';

export type EnrichmentSettings = {
  enabled: boolean;
  allowlist: string[];
};

export async function getEnrichmentSettings(): Promise<EnrichmentSettings> {
  return apiGet<EnrichmentSettings>('/api/enrich/settings', 'getEnrichmentSettings');
}

export async function saveEnrichmentSettings(
  patch: Partial<EnrichmentSettings>,
): Promise<EnrichmentSettings> {
  return apiSend<EnrichmentSettings>('/api/enrich/settings', 'PUT', patch, 'saveEnrichmentSettings');
}

// The generated skill file with the allowlist baked in.
export const ENRICH_SKILL_URL = '/api/enrich/skill.md';
