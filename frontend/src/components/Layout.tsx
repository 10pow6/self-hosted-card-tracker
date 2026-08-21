import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { EllipsisVertical, Info, Settings as SettingsIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { BottomNav, BrandMark, SideNav } from '@/components/nav';
import { refreshPendingReview } from '@/hooks/usePendingReview';

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();

  // Keep the review badge honest as the user moves around; it's a cheap call.
  useEffect(() => {
    void refreshPendingReview();
  }, [location.pathname]);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-svh flex bg-background text-foreground">
        <SideNav />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="md:hidden sticky top-0 z-20 flex items-center justify-between px-4 py-3 border-b border-border bg-background/85 backdrop-blur">
            <BrandMark />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="More">
                  <EllipsisVertical />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate('/settings')}>
                  <SettingsIcon /> Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/about')}>
                  <Info /> About
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>
          <main className="flex-1 min-w-0 pb-20 md:pb-0">
            <Outlet />
          </main>
          <BottomNav />
        </div>
      </div>
      <Toaster position="bottom-right" />
    </TooltipProvider>
  );
}
