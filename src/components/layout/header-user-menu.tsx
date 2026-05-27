"use client";

import Link from "next/link";
import { User, Store, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { Store as StoreType, User as UserType } from "@/types";

function getUserInitials(name: string | undefined): string | null {
  if (!name?.trim()) return null;
  return name
    .split(" ")
    .map((n) => n.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function canAccessSettings(
  currentUser: UserType | null | undefined,
  currentStore: StoreType | null | undefined
): boolean {
  if (!currentUser) return false;
  return (
    currentUser.role === "admin" ||
    currentStore?.ownerId === currentUser.id ||
    currentUser.role === "store_admin"
  );
}

type HeaderUserMenuProps = {
  currentUser: UserType | null | undefined;
  currentStore: StoreType | null | undefined;
  onOpenHardwareSetup: () => void;
  onLogout: () => void;
};

export function HeaderUserMenu({
  currentUser,
  currentStore,
  onOpenHardwareSetup,
  onLogout,
}: Readonly<HeaderUserMenuProps>) {
  const initials = getUserInitials(currentUser?.name);
  const showSettings = canAccessSettings(currentUser, currentStore);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative h-9 w-9 sm:h-10 sm:w-10 rounded-full touch-target"
        >
          <Avatar className="h-9 w-9 sm:h-10 sm:w-10 border-2 border-border">
            <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
              {initials ?? <User className="h-4 w-4" />}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-56 sm:w-56 p-2"
        align="end"
        sideOffset={8}
        alignOffset={-4}
        collisionPadding={8}
      >
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {currentUser?.name || "User"}
            </p>
            <p className="text-xs leading-none text-muted-foreground">
              {currentUser?.phone || "No phone"}
            </p>
            {currentUser?.role ? (
              <Badge
                variant="secondary"
                className="w-fit mt-1 text-[10px] px-1.5 py-0"
              >
                {currentUser.role}
              </Badge>
            ) : null}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <Link href="/profile">
          <DropdownMenuItem className="min-h-[44px] touch-target">
            <User className="mr-2 h-4 w-4" />
            Profile
          </DropdownMenuItem>
        </Link>
        <DropdownMenuItem
          onClick={onOpenHardwareSetup}
          className="min-h-[44px] touch-target"
        >
          <Printer className="mr-2 h-4 w-4" />
          Hardware setup
        </DropdownMenuItem>
        {showSettings ? (
          <Link href="/settings">
            <DropdownMenuItem className="min-h-[44px] touch-target">
              <Store className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
          </Link>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onLogout}
          className="text-destructive focus:text-destructive min-h-[44px] touch-target"
        >
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
