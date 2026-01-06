'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Boxes,
  Users,
  Receipt,
  BarChart2,
  Ticket,
  Settings,
  Store,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/inventory', label: 'Inventory', icon: Boxes },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/transactions', label: 'Transactions', icon: Receipt },
  { href: '/reports', label: 'Reports', icon: BarChart2 },
  { href: '/vouchers', label: 'Vouchers', icon: Ticket },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function SidebarNav({ isMobile = false }) {
  const pathname = usePathname();

  const navContent = (
    <nav className="flex flex-col gap-2 p-2">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return isMobile ? (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary',
              isActive && 'bg-muted text-primary'
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ) : (
          <Tooltip key={item.href}>
            <TooltipTrigger asChild>
              <Link href={item.href}>
                <Button
                  variant={isActive ? 'secondary' : 'ghost'}
                  size="icon"
                  className={cn(
                    'w-full justify-start gap-2',
                    isActive && 'text-primary'
                  )}
                  aria-label={item.label}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="sr-only group-data-[collapsible=icon]:hidden">{item.label}</span>
                </Button>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">{item.label}</TooltipContent>
          </Tooltip>
        );
      })}
    </nav>
  );

  return (
    <TooltipProvider delayDuration={0}>
        <div className="flex h-full max-h-screen flex-col">
            <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
                <Link href="/" className="flex items-center gap-2 font-semibold">
                    <Store className="h-6 w-6 text-primary" />
                    <span className="">KasiPOS</span>
                </Link>
            </div>
            <div className="flex-1 overflow-auto py-2">
                {navContent}
            </div>
        </div>
    </TooltipProvider>
  );
}
