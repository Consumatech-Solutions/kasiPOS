
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { navItems as allNavItems } from '@/lib/nav-config';
import { Button } from '../ui/button';
import { useSettings } from '../settings-provider';
import { useMemo } from 'react';

export default function BottomNav() {
  const pathname = usePathname();
  const { settings } = useSettings();

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
    <nav className="sticky bottom-0 left-0 z-30 w-full h-16 bg-card border-t bottom-nav">
      <div className="flex h-full w-full items-center font-medium gap-2 overflow-x-auto overflow-y-hidden scrollbar-hide scroll-smooth">
        <div className="flex h-full items-center gap-2 min-w-fit px-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Button key={item.label} variant={isActive ? 'secondary' : 'ghost'} asChild className="flex-col h-full px-4 text-xs whitespace-nowrap flex-shrink-0">
                <Link
                  href={item.href}
                >
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
