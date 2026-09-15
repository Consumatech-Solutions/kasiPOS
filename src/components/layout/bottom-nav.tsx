"use client";

import { NavMenuList } from "@/components/layout/nav-menu-list";

export default function BottomNav() {
  return (
    <nav className="hidden lg:block sticky bottom-0 left-0 z-30 w-full max-w-full min-w-0 h-16 bg-card border-t bottom-nav pb-[env(safe-area-inset-bottom)]">
      <div className="flex h-full w-full min-w-0 items-center font-medium gap-2 overflow-x-auto overflow-y-hidden scrollbar-hide scroll-smooth">
        <NavMenuList variant="horizontal" />
      </div>
    </nav>
  );
}
