import type { Binder, Page } from './types';

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

export async function createBinder(name: string, layout: string = '3x3'): Promise<Binder> {
  return fetchJson<Binder>('/api/binders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, layout }),
  });
}

export async function getPage(binderId: string, pageNumber: number): Promise<Page | null> {
  const res = await fetch(
    `/api/binders/${encodeURIComponent(binderId)}/pages/${pageNumber}`,
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`getPage → ${res.status}: ${await res.text()}`);
  return (await res.json()) as Page;
}
