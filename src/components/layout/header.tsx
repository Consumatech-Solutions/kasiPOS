'use client';

import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import SidebarNav from './sidebar-nav';
import { PanelLeft, User } from 'lucide-react';
import { usePathname } from 'next/navigation';

const pageTitles: Record<string, string> = {
    '/': 'Dashboard & POS',
    '/inventory': 'Inventory',
    '/customers': 'Customers',
    '/transactions': 'Transactions',
    '/reports': 'Reports',
    '/vouchers': 'Vouchers',
    '/settings': 'Settings',
};

export default function Header() {
    const pathname = usePathname();
    const title = pageTitles[pathname] || 'KasiPOS';

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4 lg:h-[60px] lg:px-6">
      <div className="md:hidden">
        <Sheet>
            <SheetTrigger asChild>
                <Button variant="outline" size="icon">
                    <PanelLeft className="h-5 w-5" />
                    <span className="sr-only">Toggle Menu</span>
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-60">
                <SidebarNav isMobile={true} />
            </SheetContent>
        </Sheet>
      </div>

      <div className="w-full flex-1">
        <h1 className="text-lg font-semibold">{title}</h1>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-10 w-10 rounded-full bg-accent hover:bg-accent/80">
            <Avatar className="h-10 w-10">
              <AvatarImage src="/avatars/01.png" alt="@user" />
              <AvatarFallback>
                <User />
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">Shop Owner</p>
              <p className="text-xs leading-none text-muted-foreground">
                owner@kasipos.co.za
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>Profile</DropdownMenuItem>
          <DropdownMenuItem>Settings</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>Log out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
