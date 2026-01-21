'use client';

import Header from './header';
import BottomNav from './bottom-nav';
import { useSettings } from '../settings-provider';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();

  // If the user is not logged in, or the store is not set up, don't render the shell
  // If the user is not logged in, don't render the shell
  // We temporarily removed strict store checks until store API is integrated
  if (!settings.isLoggedIn) {
    return <main className="flex-1">{children}</main>;
  }
  
  return (
    <div className="flex flex-col h-screen bg-background">
      <Header />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
