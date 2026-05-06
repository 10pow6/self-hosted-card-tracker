import { useEffect, useState } from 'react';
import { Check, Clipboard, Search } from 'lucide-react';
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
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
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
  const [copyState, setCopyState] = useState<'idle' | 'copying' | 'copied'>('idle');

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
    setCopyState('idle');
  }, [open, card]);

  const onSearchByUrl = () => {
    if (!card.representative_crop_url) return;
    const absoluteUrl = new URL(
      card.representative_crop_url,
      window.location.origin,
    ).toString();
    window.open(
      `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(absoluteUrl)}`,
      '_blank',
      'noopener,noreferrer',
    );
  };

  const onCopyAndSearch = async () => {
    if (!card.representative_crop_url) return;
    setCopyState('copying');
    try {
      // Re-encode through canvas as PNG — broadest clipboard compatibility.
      const res = await fetch(card.representative_crop_url);
      if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
      const sourceBlob = await res.blob();
      const objectUrl = URL.createObjectURL(sourceBlob);
      const img = new Image();
      img.src = objectUrl;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('image decode failed'));
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas 2d unsupported');
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(objectUrl);
      const pngBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('canvas.toBlob failed'))),
          'image/png',
        );
      });
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
      setCopyState('copied');
      window.open('https://lens.google.com/', '_blank', 'noopener,noreferrer');
      setTimeout(() => setCopyState('idle'), 4000);
    } catch (err) {
      console.warn('Clipboard copy failed:', err);
      setCopyState('idle');
      alert(
        `Could not copy image to clipboard: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  };

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
      <DialogContent className="sm:max-w-[min(1100px,90vw)]">
        <DialogHeader>
          <DialogTitle>Edit metadata</DialogTitle>
          <DialogDescription>
            Manual entry. Leave any field empty to clear it. Hover the card to zoom.
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
            {card.representative_crop_url && (
              <div className="space-y-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={onSearchByUrl}
                  title="Sends the image URL to Google Lens. Won't work for localhost or LAN — Google can't reach private addresses."
                >
                  <Search className="size-3.5" />
                  Reverse image search
                </Button>
                <p className="text-[11px] text-muted-foreground leading-snug px-0.5">
                  URL-based · won't work on localhost
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={onCopyAndSearch}
                  disabled={copyState === 'copying'}
                  title="Copies the image to your clipboard and opens Google Lens. Paste with Ctrl+V to search."
                >
                  {copyState === 'copied' ? (
                    <>
                      <Check className="size-3.5" />
                      Copied — paste in Lens
                    </>
                  ) : (
                    <>
                      <Clipboard className="size-3.5" />
                      {copyState === 'copying' ? 'Copying…' : 'Copy + reverse search'}
                    </>
                  )}
                </Button>
                <p className="text-[11px] text-muted-foreground leading-snug px-0.5">
                  Paste with Ctrl+V · works anywhere
                </p>
              </div>
            )}
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
              <select
                id="meta-type"
                value={type}
                onChange={(e) => setType(e.target.value as CoreCard['type'])}
                className="w-full h-9 rounded-md border border-input bg-background text-foreground px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="pokemon" className="bg-background text-foreground">Pokémon</option>
                <option value="sports" className="bg-background text-foreground">Sports</option>
                <option value="other" className="bg-background text-foreground">Other</option>
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
