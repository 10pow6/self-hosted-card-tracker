import { CloudAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Props = {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
};

// Inline fetch-failure panel. Screens render this instead of permanent skeletons.
export function ErrorState({ title = "Couldn't load this", message, onRetry, className }: Props) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center rounded-2xl border border-dashed border-destructive/40 bg-destructive/5 px-6 py-10',
        className,
      )}
    >
      <div className="size-12 rounded-xl bg-destructive/15 grid place-items-center mb-4 text-destructive">
        <CloudAlert className="size-6" />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground max-w-sm">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
