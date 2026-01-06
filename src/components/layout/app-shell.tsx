'use client';

import Header from './header';
import BottomNav from './bottom-nav';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-screen bg-background">
      <Header />
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
