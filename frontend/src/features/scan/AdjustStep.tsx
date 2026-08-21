import { Check, RefreshCcw, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PolygonEditor } from '@/components/PolygonEditor';
import { SlotThumbnails } from '@/components/SlotThumbnails';
import type { PreviewResponse, Slot } from '@/api/types';
import type { LayoutDims } from '@/lib/layout';

type Props = {
  preview: PreviewResponse;
  slots: Slot[];
  dims: LayoutDims;
  busy: boolean;
  onSlotsChange: (slots: Slot[]) => void;
  onRetake: () => void;
  onConfirm: () => void;
};

// Step 3 — confirm/adjust the model's proposed boxes. The model proposed;
// nothing is saved until the user confirms.
export function AdjustStep({ preview, slots, dims, busy, onSlotsChange, onRetake, onConfirm }: Props) {
  const detectedCount = slots.filter((s) => s.refined && !s.disabled).length;
  const edited = JSON.stringify(slots) !== JSON.stringify(preview.slots);

  return (
    <>
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b border-border flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm tabular-nums">
              <span className="font-medium">{detectedCount}/{dims.total}</span>{' '}
              <span className="text-muted-foreground">boxes proposed by the detector</span>
            </div>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => onSlotsChange(preview.slots)}
              disabled={busy || !edited}
            >
              <Undo2 />
              Reset all boxes
            </Button>
          </div>
          <PolygonEditor
            imageUrl={preview.image_url}
            imageSize={preview.image_size}
            bbox={preview.bbox}
            rows={preview.rows ?? dims.rows}
            cols={preview.cols ?? dims.cols}
            slots={slots}
            onChange={onSlotsChange}
          />
        </CardContent>
      </Card>

      <div>
        <div className="microlabel text-muted-foreground mb-2">Live previews</div>
        <SlotThumbnails
          imageUrl={preview.image_url}
          imageSize={preview.image_size}
          cols={preview.cols ?? dims.cols}
          slots={slots}
        />
      </div>

      <div className="flex items-center gap-2 justify-end">
        <Button variant="outline" onClick={onRetake} disabled={busy}>
          <RefreshCcw className="size-4" />
          Retake photo
        </Button>
        <Button onClick={onConfirm} disabled={busy}>
          <Check className="size-4" />
          {busy ? 'Saving…' : 'Confirm & save page'}
        </Button>
      </div>
    </>
  );
}
