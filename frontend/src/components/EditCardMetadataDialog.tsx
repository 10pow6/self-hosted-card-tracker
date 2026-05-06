import { useEffect, useState } from 'react';
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
import { updateCard, type UpdateCardFields } from '@/api/cardsApi';
import type { CoreCard } from '@/api/types';

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
      onSaved(updated);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit metadata</DialogTitle>
          <DialogDescription>
            Manual entry. Leave any field empty to clear it.
          </DialogDescription>
        </DialogHeader>

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

          <div className="grid grid-cols-2 gap-3">
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
            <div className="grid gap-1.5">
              <Label htmlFor="meta-type">Type</Label>
              <select
                id="meta-type"
                value={type}
                onChange={(e) => setType(e.target.value as CoreCard['type'])}
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="pokemon">Pokémon</option>
                <option value="sports">Sports</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="meta-notes">Notes</Label>
            <textarea
              id="meta-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Condition, grading, anything else worth remembering."
              className="rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
            />
          </div>

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive whitespace-pre-wrap">
              {error}
            </div>
          )}
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
