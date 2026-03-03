
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { navItems as allNavItems } from '@/lib/nav-config';
import { Button } from '../ui/button';
import { useSettings } from '../settings-provider';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';

export default function BottomNav() {
  const pathname = usePathname();
  const { settings } = useSettings();
  const { isOnline } = useNetworkStatus();

  const navItems = useMemo(() => {
    const userRole = settings.currentUser?.role;
    return allNavItems.filter(item => {
      // Hide based on feature flag
      if (item.featureFlag && !settings[item.featureFlag]) {
        return false;
      }
      // Hide based on role
      if (item.roles && (!userRole || !item.roles.includes(userRole))) {
        return false;
      }
      return true;
    });
  }, [settings]);


  return (
    <nav className="sticky bottom-0 left-0 z-30 w-full max-w-full min-w-0 h-16 bg-card border-t bottom-nav pb-[env(safe-area-inset-bottom)]">
      <div className="flex h-full w-full min-w-0 items-center font-medium gap-2 overflow-x-auto overflow-y-hidden scrollbar-hide scroll-smooth">
        <div className="flex h-full items-center gap-2 min-w-fit px-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            const isFeatureGreyed = item.featureFlag && !isOnline;
            return (
              <Button
                key={item.label}
                variant={isActive ? 'secondary' : 'ghost'}
                asChild
                className={cn(
                  'flex-col h-full px-4 text-xs whitespace-nowrap flex-shrink-0 rounded-none border-b-2',
                  isActive ? 'border-destructive' : 'border-transparent',
                  isFeatureGreyed && 'opacity-50 pointer-events-none cursor-not-allowed'
                )}
              >
                <Link href={item.href} aria-disabled={isFeatureGreyed}>
                  <Icon className="w-5 h-5 mb-1" />
                  <span>{item.label}</span>
                </Link>
              </Button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
