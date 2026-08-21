import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CardSearchList } from '@/components/CardSearchList';
import type { CoreCard } from '@/api/types';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (card: CoreCard) => void;
  title?: string;
  description?: string;
};

// Thin dialog around the shared catalog search list.
export function CardPickerDialog({
  open,
  onOpenChange,
  onPick,
  title = 'Pick from catalog',
  description = 'Search by name, set, or number. Click a card to assign it to this placement.',
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <CardSearchList autoFocus onSelect={onPick} className="min-h-0 flex-1" />
      </DialogContent>
    </Dialog>
  );
}
