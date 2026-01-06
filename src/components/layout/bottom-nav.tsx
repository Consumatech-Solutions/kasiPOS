'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Boxes,
  Users,
  Receipt,
  BarChart2,
  Ticket,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/inventory', label: 'Inventory', icon: Boxes },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/transactions', label: 'Transactions', icon: Receipt },
  { href: '/reports', label: 'Reports', icon: BarChart2 },
  { href: '/vouchers', label: 'Vouchers', icon: Ticket },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <div className="md:hidden sticky bottom-0 left-0 z-50 w-full h-20 bg-white border-t bottom-nav">
      <div className="grid h-full max-w-lg grid-cols-7 mx-auto font-medium">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'inline-flex flex-col items-center justify-center px-2 text-gray-500 hover:bg-gray-50 hover:text-primary group',
                isActive && 'text-primary'
              )}
            >
              <item.icon className="w-6 h-6 mb-1" />
              <span className="text-[10px]">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
