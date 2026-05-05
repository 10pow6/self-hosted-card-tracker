import { Link } from 'react-router-dom';
import type { CoreCard } from '@/api/types';
import { cn } from '@/lib/utils';

type Props = {
  card: CoreCard;
  to?: string; // omit to render as static
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const sizeClasses = {
  sm: 'text-[11px]',
  md: 'text-xs',
  lg: 'text-sm',
};

export function CardThumb({ card, to, size = 'md', className }: Props) {
  const inner = (
    <div
      className={cn(
        'group relative aspect-card rounded-xl overflow-hidden border border-border bg-card transition-all',
        to && 'hover:border-primary/60 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-0.5',
        className,
      )}
    >
      <img
        src={card.representative_crop_url}
        alt={card.name ?? 'Unknown card'}
        className="absolute inset-0 size-full object-cover"
        draggable={false}
      />
      {card.needs_metadata && (
        <span className="absolute top-1.5 right-1.5 rounded bg-[var(--card-needs-review)]/90 px-1.5 py-0.5 text-[10px] font-semibold text-black">
          needs info
        </span>
      )}
      <div className={cn('absolute inset-x-0 bottom-0 px-2.5 py-1.5 bg-gradient-to-t from-black/85 to-transparent text-white', sizeClasses[size])}>
        <div className="font-medium truncate">{card.name ?? 'Unknown card'}</div>
        <div className="opacity-80 truncate text-[10px]">
          {[card.set, card.number, card.year].filter(Boolean).join(' · ') || card.type}
        </div>
      </div>
    </div>
  );
  if (to) {
    return (
      <Link to={to} className="block">
        {inner}
      </Link>
    );
  }
  return inner;
}
