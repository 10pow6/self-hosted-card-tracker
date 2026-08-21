import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LayoutPicker } from '@/components/LayoutPicker';
import { DetectionConfigEditor } from '@/components/DetectionConfigEditor';
import { createBinder } from '@/api/bindersApi';
import { getErrorMessage } from '@/api/client';
import { DEFAULT_DETECTOR } from '@/lib/detectors';
import type { Binder, DetectorConfig } from '@/api/types';

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: (binder: Binder) => void;
};

// The one create-binder dialog — shared by Scan and Binders so layout and
// detection tuning always look and behave the same. Owns its own form state.
export function CreateBinderDialog({ open, onOpenChange, onCreated }: Props) {
  const [name, setName] = useState('');
  const [layout, setLayout] = useState('3x3');
  const [detectorConfig, setDetectorConfig] = useState<DetectorConfig>({});
  const [creating, setCreating] = useState(false);

  const reset = () => {
    setName('');
    setLayout('3x3');
    setDetectorConfig({});
  };

  const onConfirm = async () => {
    if (!name.trim() || creating) return;
    setCreating(true);
    try {
      const binder = await createBinder(name.trim(), layout, DEFAULT_DETECTOR, detectorConfig);
      toast.success(`Created “${binder.name}”`);
      reset();
      onOpenChange(false);
      onCreated(binder);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !creating && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create binder</DialogTitle>
          <DialogDescription>
            Name the binder and pick its pocket layout. Detection tuning can stay on defaults —
            adjust it if boxes come out wrong for this binder's pockets.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="new-binder-name">Name</Label>
            <Input
              id="new-binder-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Pokémon — Vintage WOTC"
              onKeyDown={(e) => e.key === 'Enter' && onConfirm()}
            />
          </div>
          <div className="grid gap-2">
            <Label>Layout</Label>
            <LayoutPicker value={layout} onChange={setLayout} />
          </div>
          <DetectionConfigEditor
            detectorId={DEFAULT_DETECTOR}
            value={detectorConfig}
            onChange={setDetectorConfig}
            layout={layout}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={creating}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={!name.trim() || creating}>
            {creating ? 'Creating…' : 'Create binder'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
