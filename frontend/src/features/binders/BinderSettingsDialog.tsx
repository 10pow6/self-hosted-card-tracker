import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DetectionConfigEditor } from '@/components/DetectionConfigEditor';
import { deleteBinder, updateBinder } from '@/api/bindersApi';
import { getErrorMessage } from '@/api/client';
import { getDetectorSpec } from '@/lib/detectors';
import type { Binder, DetectorConfig } from '@/api/types';

type Props = {
  binder: Binder;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (binder: Binder) => void;
  // Parent handles navigation away; deletion itself happens here.
  onDeleted: () => void;
};

// Rename, re-tune detection, or delete a binder. Layout is immutable —
// pages were committed against it.
export function BinderSettingsDialog({ binder, open, onOpenChange, onSaved, onDeleted }: Props) {
  const [name, setName] = useState(binder.name);
  const [config, setConfig] = useState<DetectorConfig>(binder.detector_config ?? {});
  const [busy, setBusy] = useState(false);

  // Re-seed the form whenever the dialog opens for current values.
  useEffect(() => {
    if (open) {
      setName(binder.name);
      setConfig(binder.detector_config ?? {});
    }
  }, [open, binder]);

  const spec = getDetectorSpec(binder.detector);

  const onSave = async () => {
    const cleaned = name.trim();
    if (!cleaned) {
      toast.error('Binder name cannot be empty.');
      return;
    }
    setBusy(true);
    try {
      const updated = await updateBinder(binder.id, {
        name: cleaned,
        detector: binder.detector,
        detector_config: Object.keys(config).length > 0 ? config : null,
      });
      toast.success('Binder settings saved');
      onSaved(updated);
      onOpenChange(false);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    await deleteBinder(binder.id);
    toast.success(`Deleted binder “${binder.name}”`);
    onDeleted();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Binder settings</DialogTitle>
          <DialogDescription>
            {binder.layout} layout · layout is fixed once pages are scanned.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-1.5">
            <Label htmlFor="binder-name">Name</Label>
            <Input
              id="binder-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
            />
          </div>

          <div className="grid gap-1.5">
            <Label>Detection</Label>
            <p className="text-xs text-muted-foreground">
              {spec.label}. Changes apply to pages you scan from now on — existing pages keep
              their crops.
            </p>
            <DetectionConfigEditor
              detectorId={binder.detector}
              value={config}
              onChange={setConfig}
              layout={binder.layout}
            />
          </div>

          <Separator />

          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-destructive">Delete binder</div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Removes its {binder.page_count} pages and their placements permanently. Catalog
                entries survive.
              </p>
            </div>
            <ConfirmDialog
              trigger={
                <Button variant="destructive" size="sm" disabled={busy}>
                  <Trash2 />
                  Delete…
                </Button>
              }
              title={`Delete “${binder.name}”?`}
              description={`This permanently deletes the binder, its ${binder.page_count} pages, and their ${binder.card_count} placements. Catalog entries remain — any left with no placements can be deleted from the Catalog.`}
              confirmLabel="Delete binder"
              destructive
              onConfirm={onDelete}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={busy}>
            {busy ? 'Saving…' : 'Save settings'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
