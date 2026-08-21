import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { updateCard, type UpdateCardFields } from '@/api/cardsApi';
import { getErrorMessage } from '@/api/client';
import type { CoreCard } from '@/api/types';
import { LensSearchButtons } from './LensSearchButtons';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: CoreCard;
  onSaved: (updated: CoreCard) => void;
};

export function EditCardMetadataDialog({ open, onOpenChange, card, onSaved }: Props) {
  const [name, setName] = useState('');
  const [set, setSet] = useState('');
  const [number, setNumber] = useState('');
  const [year, setYear] = useState('');
  const [type, setType] = useState<CoreCard['type']>('other');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the form to the card's current values each time we open.
  useEffect(() => {
    if (!open) return;
    setName(card.name ?? '');
    setSet(card.set ?? '');
    setNumber(card.number ?? '');
    setYear(card.year != null ? String(card.year) : '');
    setType(card.type ?? 'other');
    setNotes(card.notes ?? '');
    setError(null);
  }, [open, card]);

  const onSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      const yearNum = year.trim() ? Number(year) : null;
      if (year.trim() && (Number.isNaN(yearNum) || !Number.isInteger(yearNum))) {
        throw new Error('Year must be an integer (or empty).');
      }
      const fields: UpdateCardFields = {
        name: name.trim() || null,
        set: set.trim() || null,
        number: number.trim() || null,
        year: yearNum as number | null,
        type,
        notes: notes.trim() || null,
      };
      const updated = await updateCard(card.id, fields);
      toast.success('Metadata saved — recorded as edited by you');
      onSaved(updated);
      onOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[min(1100px,90vw)]">
        <DialogHeader>
          <DialogTitle>Edit metadata</DialogTitle>
          <DialogDescription>
            {card.metadata_source === 'claude-skill'
              ? 'These values were suggested by the AI enrichment skill. Saving marks the card as verified by you.'
              : 'Manual entry. Leave any field empty to clear it. Hover the card to zoom.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 sm:grid-cols-[280px_1fr] sm:items-start">
          <div className="space-y-2">
            {card.representative_crop_url ? (
              <HoverCard openDelay={150} closeDelay={80}>
                <HoverCardTrigger asChild>
                  <div className="aspect-card rounded-xl overflow-hidden border border-border bg-muted cursor-zoom-in">
                    <img
                      src={card.representative_crop_url}
                      alt={card.name ?? 'Card preview'}
                      className="size-full object-cover"
                    />
                  </div>
                </HoverCardTrigger>
                <HoverCardContent side="right" align="start" className="w-[420px]">
                  <img
                    src={card.representative_crop_url}
                    alt={card.name ?? 'Card preview (large)'}
                    className="aspect-card w-full rounded-lg object-cover"
                  />
                </HoverCardContent>
              </HoverCard>
            ) : (
              <div className="aspect-card rounded-xl overflow-hidden border border-border bg-muted" />
            )}
            {card.representative_crop_url && <LensSearchButtons cropUrl={card.representative_crop_url} />}
          </div>

          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="meta-name">Name</Label>
              <Input
                id="meta-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Charizard"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="meta-set">Set</Label>
                <Input
                  id="meta-set"
                  value={set}
                  onChange={(e) => setSet(e.target.value)}
                  placeholder="Base Set"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="meta-number">Number</Label>
                <Input
                  id="meta-number"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  placeholder="4/102"
                />
              </div>
            </div>

            <div className="grid grid-cols-[140px_1fr] gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="meta-year">Year</Label>
                <Input
                  id="meta-year"
                  type="number"
                  inputMode="numeric"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  placeholder="1999"
                />
              </div>
              <div className="grid gap-1.5 min-w-0">
                <Label htmlFor="meta-type">Type</Label>
                <Select value={type} onValueChange={(v) => setType(v as CoreCard['type'])}>
                  <SelectTrigger id="meta-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pokemon">Pokémon</SelectItem>
                    <SelectItem value="sports">Sports</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="meta-notes">Notes</Label>
              <Textarea
                id="meta-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Condition, grading, anything else worth remembering."
                className="resize-y"
              />
            </div>

            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive whitespace-pre-wrap">
                {error}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
