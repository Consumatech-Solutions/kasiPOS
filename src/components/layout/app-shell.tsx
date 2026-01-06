'use client';

import Header from './header';
import BottomNav from './bottom-nav';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-screen bg-background">
      <Header />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
