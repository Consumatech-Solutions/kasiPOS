'use client';

import {
  SidebarProvider,
  Sidebar,
  SidebarInset,
} from '@/components/ui/sidebar';
import SidebarNav from './sidebar-nav';
import Header from './header';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
        <div className="grid grid-cols-1 md:grid-cols-[auto_1fr]">
            <Sidebar
                className="peer hidden md:flex"
                collapsible="icon"
                variant="sidebar"
                side="left"
            >
                <SidebarNav />
            </Sidebar>
            <SidebarInset className="bg-background">
                <Header />
                <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
                    {children}
                </main>
            </SidebarInset>
        </div>
    </SidebarProvider>
  );
}
