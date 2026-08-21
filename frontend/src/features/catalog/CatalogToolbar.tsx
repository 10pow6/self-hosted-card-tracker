import { ArrowDownNarrowWide, ArrowUpNarrowWide, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CardType } from '@/api/types';
import {
  DIR_HINT,
  SORT_DEFAULT_DIR,
  SORT_LABELS,
  SORTS,
  type CatalogSort,
  type SortDir,
} from './catalogSort';

export type TypeFilter = CardType | 'all';

type Props = {
  type: TypeFilter;
  onTypeChange: (t: TypeFilter) => void;
  needsInfo: boolean;
  onNeedsInfoChange: (v: boolean) => void;
  unnamed: boolean;
  onUnnamedChange: (v: boolean) => void;
  q: string;
  onQChange: (q: string) => void;
  sort: CatalogSort;
  dir: SortDir;
  onSortChange: (s: CatalogSort, d: SortDir) => void;
  count: number | null;
};

// The single-row (wrapping) filter toolbar for the catalog.
export function CatalogToolbar({
  type,
  onTypeChange,
  needsInfo,
  onNeedsInfoChange,
  unnamed,
  onUnnamedChange,
  q,
  onQChange,
  sort,
  dir,
  onSortChange,
  count,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-5">
      <Select value={type} onValueChange={(v) => onTypeChange(v as TypeFilter)}>
        <SelectTrigger className="w-32" aria-label="Card type">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          <SelectItem value="pokemon">Pokémon</SelectItem>
          <SelectItem value="sports">Sports</SelectItem>
          <SelectItem value="other">Other</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex items-center gap-1">
        <Select
          value={sort}
          onValueChange={(v) => onSortChange(v as CatalogSort, SORT_DEFAULT_DIR[v as CatalogSort])}
        >
          <SelectTrigger className="w-40" aria-label="Sort by">
            <span className="text-muted-foreground">Sort:</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORTS.map((s) => (
              <SelectItem key={s} value={s}>
                {SORT_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          onClick={() => onSortChange(sort, dir === 'asc' ? 'desc' : 'asc')}
          aria-label={`Sort direction: ${DIR_HINT[sort][dir]}`}
        >
          {dir === 'asc' ? (
            <ArrowUpNarrowWide className="size-3.5" />
          ) : (
            <ArrowDownNarrowWide className="size-3.5" />
          )}
        </Button>
      </div>

      <ToggleChip active={needsInfo} onClick={() => onNeedsInfoChange(!needsInfo)}>
        Needs info
      </ToggleChip>
      <ToggleChip active={unnamed} onClick={() => onUnnamedChange(!unnamed)}>
        Unnamed
      </ToggleChip>

      <div className="relative flex-1 min-w-44">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <Input
          value={q}
          onChange={(e) => onQChange(e.target.value)}
          placeholder="Search by name, set, number…"
          className="pl-8 pr-8 h-8"
        />
        {q && (
          <button
            onClick={() => onQChange('')}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      <span className="text-xs text-muted-foreground tabular-nums">
        {count === null ? '—' : `${count} card${count === 1 ? '' : 's'}`}
      </span>
    </div>
  );
}

function ToggleChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant={active ? 'default' : 'outline'}
      size="sm"
      onClick={onClick}
      className="h-8 rounded-full"
    >
      {children}
    </Button>
  );
}
