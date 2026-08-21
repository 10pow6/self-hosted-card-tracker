import type { Binder, DetectorConfig, Page } from './types';

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`${url} → ${res.status}: ${detail}`);
  }
  return (await res.json()) as T;
}

export async function listBinders(): Promise<Binder[]> {
  return fetchJson<Binder[]>('/api/binders');
}

export async function getBinder(id: string): Promise<Binder | null> {
  const res = await fetch(`/api/binders/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`getBinder → ${res.status}: ${await res.text()}`);
  return (await res.json()) as Binder;
}

export async function createBinder(
  name: string,
  layout: string = '3x3',
  detector?: string | null,
  detectorConfig?: DetectorConfig | null,
): Promise<Binder> {
  const body: Record<string, unknown> = { name, layout };
  if (detector) body.detector = detector;
  if (detectorConfig && Object.keys(detectorConfig).length > 0) {
    body.detector_config = detectorConfig;
  }
  return fetchJson<Binder>('/api/binders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function updateBinder(
  id: string,
  patch: { name?: string; detector?: string; detector_config?: DetectorConfig | null },
): Promise<Binder> {
  return fetchJson<Binder>(`/api/binders/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

export async function deleteBinder(id: string): Promise<void> {
  const res = await fetch(`/api/binders/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`deleteBinder → ${res.status}: ${await res.text()}`);
}

// Every page of a binder with its full placement grid — one request.
export async function listPages(binderId: string): Promise<Page[]> {
  return fetchJson<Page[]>(`/api/binders/${encodeURIComponent(binderId)}/pages`);
}

export async function getPage(binderId: string, pageNumber: number): Promise<Page | null> {
  const res = await fetch(
    `/api/binders/${encodeURIComponent(binderId)}/pages/${pageNumber}`,
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`getPage → ${res.status}: ${await res.text()}`);
  return (await res.json()) as Page;
}
