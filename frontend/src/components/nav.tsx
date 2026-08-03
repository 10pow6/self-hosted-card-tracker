import { NavLink } from 'react-router';
import {
  Home,
  Camera,
  Library,
  LayoutGrid,
  Inbox,
  Settings,
  Info,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  primary: boolean; // true = appears in bottom tab bar
};

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Home', icon: Home, primary: true },
  { to: '/scan', label: 'Scan', icon: Camera, primary: true },
  { to: '/binders', label: 'Collection', icon: Library, primary: true },
  { to: '/cards', label: 'Cards', icon: LayoutGrid, primary: true },
  { to: '/review', label: 'Review', icon: Inbox, primary: true },
  { to: '/settings', label: 'Settings', icon: Settings, primary: false },
  { to: '/about', label: 'About', icon: Info, primary: false },
];

export function BrandMark({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <img
        src="/icon.png"
        alt="10pow6"
        className="size-8 rounded-lg shadow-lg shadow-primary/15"
        draggable={false}
      />
      <div className="leading-tight">
        <div className="font-semibold tracking-tight">Card Tracker</div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">by 10pow6 LLC</div>
      </div>
    </div>
  );
}

export function navLinkClasses(active: boolean) {
  return cn(
    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    active
      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
  );
}

export function SideNav() {
  return (
    <aside className="hidden md:flex md:flex-col w-60 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="px-4 py-5">
        <BrandMark />
      </div>
      <nav className="flex-1 px-3 py-2 flex flex-col gap-1">
        {NAV_ITEMS.filter((i) => i.primary).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => navLinkClasses(isActive)}
          >
            <item.icon className="size-4" />
            <span>{item.label}</span>
          </NavLink>
        ))}
        <div className="my-2 h-px bg-sidebar-border" />
        {NAV_ITEMS.filter((i) => !i.primary).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => navLinkClasses(isActive)}
          >
            <item.icon className="size-4" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="px-4 py-3 text-[11px] text-muted-foreground leading-relaxed">
        Local · offline-first
        <br />
        <NavLink to="/about" className="hover:text-foreground transition-colors">
          © 10pow6 LLC · MIT
        </NavLink>
      </div>
    </aside>
  );
}

export function BottomNav() {
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70 pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-5">
        {NAV_ITEMS.filter((i) => i.primary).map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors',
                  isActive ? 'text-foreground' : 'text-muted-foreground',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    className={cn('size-5', isActive && 'text-primary')}
                  />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
