import type { ActivityItem, DashboardStats } from './types';

export async function getStats(): Promise<DashboardStats> {
  const res = await fetch('/api/dashboard/stats');
  if (!res.ok) throw new Error(`getStats → ${res.status}: ${await res.text()}`);
  return (await res.json()) as DashboardStats;
}

export async function getActivity(limit: number = 10): Promise<ActivityItem[]> {
  const res = await fetch(`/api/dashboard/activity?limit=${limit}`);
  if (!res.ok) throw new Error(`getActivity → ${res.status}: ${await res.text()}`);
  return (await res.json()) as ActivityItem[];
}
