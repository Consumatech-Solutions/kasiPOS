
'use client';

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
import { Store, User, Bell, Wifi } from 'lucide-react';
import Link from 'next/link';
import { useSettings } from '../settings-provider';

export default function Header() {
  const { settings, logout } = useSettings();
  const { currentUser } = settings;

  return (
    <header className="sticky top-0 z-20 flex h-20 items-center justify-between gap-4 border-b bg-white dark:bg-card px-4 lg:px-8">
      <div className="flex items-center gap-2">
        <div className="bg-green-500 p-2 rounded-md">
          <Store className="h-6 w-6 text-white" />
        </div>
        <span className="text-xl font-bold">kasiPOS</span>
      </div>

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon">
          <Bell className="h-6 w-6" />
        </Button>
        <div className="flex items-center gap-2 text-sm font-medium text-green-600 bg-green-100 px-3 py-1.5 rounded-full">
            <Wifi className="h-4 w-4" />
            <span>Online</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full">
              <Avatar className="h-10 w-10 border">
                <AvatarImage src={`https://i.pravatar.cc/40?u=${currentUser?.phone}`} alt={currentUser?.name || ''} />
                <AvatarFallback>
                  {currentUser?.name ? currentUser.name.charAt(0) : <User className="h-6 w-6" />}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{currentUser?.name}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {currentUser?.phone}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <Link href="/profile"><DropdownMenuItem>Profile</DropdownMenuItem></Link>
            {currentUser?.role === 'admin' && (
                <Link href="/settings"><DropdownMenuItem>Settings</DropdownMenuItem></Link>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout}>Log out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
