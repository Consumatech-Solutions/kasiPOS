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
    return allNavItems.filter(item => {
      if (item.featureFlag && !settings[item.featureFlag]) {
        return false;
      }
      return true;
    });
  }, [settings]);


  return (
    <nav className="sticky bottom-0 left-0 z-10 w-full h-16 bg-card border-t bottom-nav">
      <div className="flex h-full w-full justify-center items-center font-medium gap-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Button key={item.label} variant={isActive ? 'secondary' : 'ghost'} asChild className="flex-col h-full px-4 text-xs">
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
    </nav>
  );
}
