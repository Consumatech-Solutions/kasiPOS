'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  LayoutGrid,
  Boxes,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/inventory', label: 'Catalogue', icon: LayoutGrid },
  { href: '/inventory', label: 'Inventory', icon: Boxes },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <div className="md:hidden sticky bottom-0 left-0 z-50 w-full h-20 bg-white border-t bottom-nav">
      <div className="grid h-full max-w-lg grid-cols-3 mx-auto font-medium">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                'inline-flex flex-col items-center justify-center px-2 text-gray-500 hover:bg-gray-50 hover:text-primary group',
                isActive && 'text-primary'
              )}
            >
              <item.icon className="w-6 h-6 mb-1" />
              <span className="text-sm">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
