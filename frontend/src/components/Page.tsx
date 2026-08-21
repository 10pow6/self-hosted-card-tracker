import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Width = 'narrow' | 'default' | 'wide' | 'full';

const widthClasses: Record<Width, string> = {
  narrow: 'max-w-[44rem]',
  default: 'max-w-6xl',
  wide: 'max-w-[90rem]',
  full: '',
};

type Props = {
  width?: Width;
  className?: string;
  children: ReactNode;
};

// The single source of page gutters and content width (DESIGN.md · Layout).
// Screens never re-declare their own horizontal padding.
export function Page({ width = 'default', className, children }: Props) {
  return (
    <div className={cn('mx-auto w-full px-4 pb-12 md:px-8', widthClasses[width], className)}>
      {children}
    </div>
  );
}
