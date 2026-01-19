'use client';

import Header from './header';
import BottomNav from './bottom-nav';
import { useSettings } from '../settings-provider';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();

  // If the user is not logged in, or the store is not set up, don't render the shell
  if (!settings.isLoggedIn || !settings.currentStore?.isSetupComplete) {
    return <main className="flex-1">{children}</main>;
  }
  
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
