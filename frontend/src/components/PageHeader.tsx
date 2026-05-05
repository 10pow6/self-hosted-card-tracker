import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  title: ReactNode;
  description?: ReactNode;
  back?: { to: string; label: string };
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({ title, description, back, actions, className }: Props) {
  return (
    <header className={cn('px-4 md:px-8 pt-6 md:pt-10 pb-4 md:pb-6', className)}>
      {back && (
        <Link
          to={back.to}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ChevronLeft className="size-4" />
          {back.label}
        </Link>
      )}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{title}</h1>
          {description && (
            <p className="mt-1 text-sm md:text-base text-muted-foreground max-w-2xl">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
