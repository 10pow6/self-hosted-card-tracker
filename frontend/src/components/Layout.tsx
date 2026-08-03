import { Outlet, useNavigate } from 'react-router';
import { Settings as SettingsIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BottomNav, BrandMark, SideNav } from '@/components/nav';

export function Layout() {
  const navigate = useNavigate();
  return (
    <div className="min-h-svh flex bg-background text-foreground">
      <SideNav />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden sticky top-0 z-20 flex items-center justify-between px-4 py-3 border-b border-border bg-background/85 backdrop-blur">
          <BrandMark />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Settings"
            onClick={() => navigate('/settings')}
          >
            <SettingsIcon />
          </Button>
        </header>
        <main className="flex-1 min-w-0 pb-20 md:pb-0">
          <Outlet />
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
