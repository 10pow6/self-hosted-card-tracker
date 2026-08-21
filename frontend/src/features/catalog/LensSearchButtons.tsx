import { useState } from 'react';
import { Check, Clipboard, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

// Two ways to reverse-image-search a crop with Google Lens:
// by URL (fails on localhost/LAN) or by copying the image to the clipboard.
export function LensSearchButtons({ cropUrl }: { cropUrl: string }) {
  const [copyState, setCopyState] = useState<'idle' | 'copying' | 'copied'>('idle');

  const onSearchByUrl = () => {
    const absoluteUrl = new URL(cropUrl, window.location.origin).toString();
    window.open(
      `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(absoluteUrl)}`,
      '_blank',
      'noopener,noreferrer',
    );
  };

  const onCopyAndSearch = async () => {
    setCopyState('copying');
    try {
      // Re-encode through canvas as PNG — broadest clipboard compatibility.
      const res = await fetch(cropUrl);
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
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas.toBlob failed'))), 'image/png');
      });
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
      setCopyState('copied');
      window.open('https://lens.google.com/', '_blank', 'noopener,noreferrer');
      setTimeout(() => setCopyState('idle'), 4000);
    } catch (err) {
      setCopyState('idle');
      toast.error(
        `Could not copy image to clipboard: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };

  return (
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
  );
}
