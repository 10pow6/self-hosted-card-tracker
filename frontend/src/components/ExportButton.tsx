import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { downloadPdf } from '@/api/exportsApi';
import { getErrorMessage } from '@/api/client';

type Props = {
  url: string;
  filename: string;
  children: React.ReactNode;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'xs';
  className?: string;
};

// PDF download with a pending state — exports can take seconds on large
// collections, so the button must show that something is happening.
export function ExportButton({ url, filename, children, variant = 'outline', size = 'sm', className }: Props) {
  const [busy, setBusy] = useState(false);
  const onClick = async () => {
    setBusy(true);
    try {
      await downloadPdf(url, filename);
      toast.success(`Exported ${filename}`);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button variant={variant} size={size} className={className} disabled={busy} onClick={onClick}>
      {busy ? <Loader2 className="animate-spin" /> : <Download />}
      {busy ? 'Preparing…' : children}
    </Button>
  );
}
