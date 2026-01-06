'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  LayoutGrid,
  Users,
  ScrollText,
  Ticket,
  BarChart,
  Settings,
} from 'lucide-react';
import { Button } from '../ui/button';

const navItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/inventory', label: 'Catalogue', icon: LayoutGrid },
  { href: '/transactions', label: 'Orders', icon: ScrollText },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/vouchers', label: 'Vouchers', icon: Ticket },
  { href: '/reports', label: 'Reports', icon: BarChart },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 left-0 z-10 w-full h-16 bg-white border-t bottom-nav">
      <div className="flex h-full w-full justify-center items-center font-medium gap-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Button key={item.label} variant={isActive ? 'secondary' : 'ghost'} asChild className="flex-col h-full px-4 text-xs">
              <Link
                href={item.href}
              >
                <item.icon className="w-5 h-5 mb-1" />
                <span>{item.label}</span>
              </Link>
            </Button>
          );
        })}
      </div>
    </nav>
  );
}
