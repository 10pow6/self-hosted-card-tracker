import { Camera, ScanLine } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { LayoutDims } from '@/lib/layout';

type Props = {
  busy: boolean;
  ready: boolean; // false while the binder is still being hydrated
  pageNumber: number;
  dims: LayoutDims;
  onFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

// Step 2 — capture/upload the page photo. Copy is layout-aware and sets
// honest expectations about what detection can and can't do.
export function CaptureStep({ busy, ready, pageNumber, dims, onFile }: Props) {
  const disabled = busy || !ready;
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <label
          className={
            disabled
              ? 'flex flex-col items-center justify-center text-center px-6 py-12 md:py-16 opacity-60 cursor-wait'
              : 'flex flex-col items-center justify-center text-center px-6 py-12 md:py-16 cursor-pointer hover:bg-muted/40 transition-colors'
          }
        >
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onFile}
            disabled={disabled}
            className="hidden"
          />
          <div className="size-14 rounded-2xl bg-primary/10 text-primary grid place-items-center mb-4">
            <Camera className="size-7" />
          </div>
          <div className="text-lg font-semibold">
            {!ready ? 'Loading binder…' : busy ? 'Detecting cards…' : `Capture page ${pageNumber}`}
          </div>
          <div className="mt-1 text-sm text-muted-foreground max-w-md">
            Frame the page so the {dims.rows}×{dims.cols} grid ({dims.total}{' '}
            {dims.total === 1 ? 'pocket' : 'pockets'}) fills the photo. On mobile this goes straight
            to the camera.
          </div>
        </label>
        <div className="border-t border-border bg-muted/20 px-4 py-3 flex items-start gap-2.5 text-xs text-muted-foreground">
          <ScanLine className="size-4 shrink-0 mt-0.5 text-ai" />
          <p className="leading-relaxed max-w-xl text-left">
            The detection model proposes a box for each pocket — you confirm every one before
            anything is saved. It does best with a flat page, even light, and a straight-on shot;
            glare, blur, and steep angles make it miss.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
