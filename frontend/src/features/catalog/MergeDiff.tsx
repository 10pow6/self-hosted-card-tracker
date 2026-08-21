import type { CoreCard } from '@/api/types';

const FIELDS: Array<{ key: 'name' | 'set' | 'number' | 'year' | 'notes'; label: string }> = [
  { key: 'name', label: 'Name' },
  { key: 'set', label: 'Set' },
  { key: 'number', label: 'Number' },
  { key: 'year', label: 'Year' },
  { key: 'notes', label: 'Notes' },
];

export function lostFields(target: CoreCard, source: CoreCard): Array<{ label: string; value: string }> {
  const out: Array<{ label: string; value: string }> = [];
  for (const f of FIELDS) {
    const sv = source[f.key];
    const tv = target[f.key];
    if (sv != null && String(sv) !== String(tv ?? '')) {
      out.push({ label: f.label, value: String(sv) });
    }
  }
  return out;
}

// What survives and what gets deleted, spelled out before an irreversible merge.
export function MergeDiff({ target, sources }: { target: CoreCard; sources: CoreCard[] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="microlabel text-muted-foreground">What this merge does</div>
      <p className="text-sm">
        <span className="font-medium">{target.name ?? 'Unnamed card'}</span> keeps its own
        metadata. Every placement from the duplicates is repointed to it.
      </p>
      <ul className="space-y-2 text-xs">
        {sources.map((s) => {
          const lost = lostFields(target, s);
          return (
            <li key={s.id} className="flex items-start gap-2">
              <img
                src={s.representative_crop_url}
                alt=""
                className="aspect-card w-7 rounded border border-border object-cover shrink-0"
              />
              <div className="min-w-0">
                <span className="font-medium text-foreground">{s.name ?? 'Unnamed card'}</span>{' '}
                <span className="text-muted-foreground">
                  — {s.placement_count} placement{s.placement_count === 1 ? '' : 's'} move
                  {s.placement_count === 1 ? 's' : ''};
                </span>{' '}
                {lost.length > 0 ? (
                  <span className="text-destructive">
                    its differing metadata is deleted (
                    {lost.map((l) => `${l.label}: “${l.value}”`).join(', ')})
                  </span>
                ) : (
                  <span className="text-muted-foreground">no differing metadata is lost.</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
