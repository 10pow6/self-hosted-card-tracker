import { useState } from 'react';
import { ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { getDetectorSpec } from '@/lib/detectors';
import type { DetectorConfig } from '@/api/types';
import { cn } from '@/lib/utils';

type Props = {
  /** Detector id this config belongs to. Determines which fields render. */
  detectorId: string;
  value: DetectorConfig;
  onChange: (next: DetectorConfig) => void;
  /** Layout chosen on the same form, used to surface a tuning hint. */
  layout?: string;
  className?: string;
};

export function DetectionConfigEditor({
  detectorId,
  value,
  onChange,
  layout,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const spec = getDetectorSpec(detectorId);

  const denseHint =
    detectorId === 'opencv-grid-v1' && layout && /^([4-9]|\d{2,})x/.test(layout)
      ? `Suggestion: dense layouts like ${layout} often work better with min_cell_fill ≈ 0.20.`
      : null;

  const reset = () => onChange({});

  const set = (key: string, raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === '') {
      const next = { ...value };
      delete next[key];
      onChange(next);
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return;
    onChange({ ...value, [key]: parsed });
  };

  const someOverridden = spec.fields.some((f) => value[f.key] !== undefined);

  return (
    <div className={cn('rounded-md border border-border bg-muted/20', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/40 transition-colors"
      >
        <span className="flex items-center gap-2">
          {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          <span className="font-medium">Detection tuning</span>
          <span className="text-xs text-muted-foreground">
            {spec.label} · {someOverridden ? 'custom' : 'defaults'}
          </span>
        </span>
        <span className="text-xs text-muted-foreground">advanced</span>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 space-y-3">
          <p className="text-[11px] text-muted-foreground leading-snug">{spec.description}</p>
          {denseHint && (
            <p className="text-xs text-muted-foreground border border-border bg-background rounded-md px-2 py-1.5">
              {denseHint}
            </p>
          )}
          {spec.fields.map((f) => {
            const current = value[f.key];
            return (
              <div key={f.key} className="grid gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor={`detect-${f.key}`} className="text-xs">
                    {f.label}
                    <span className="ml-1 text-[10px] text-muted-foreground tabular-nums">
                      [{f.min} – {f.max}]
                    </span>
                  </Label>
                  {current !== undefined && (
                    <button
                      type="button"
                      onClick={() => set(f.key, '')}
                      className="text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      reset
                    </button>
                  )}
                </div>
                <Input
                  id={`detect-${f.key}`}
                  type="number"
                  step={0.05}
                  min={f.min}
                  max={f.max}
                  value={current ?? ''}
                  placeholder={String(f.default)}
                  onChange={(e) => set(f.key, e.target.value)}
                  className="h-8 text-sm"
                />
                <p className="text-[11px] text-muted-foreground leading-snug">{f.help}</p>
              </div>
            );
          })}
          {someOverridden && (
            <Button type="button" variant="ghost" size="sm" onClick={reset}>
              <RotateCcw className="size-3.5" />
              Reset all to defaults
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
