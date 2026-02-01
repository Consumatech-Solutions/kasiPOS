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
    <div className="flex flex-col min-h-screen h-screen max-h-[100dvh] w-full max-w-full bg-background overflow-hidden">
      <Header />
      <main className="flex-1 min-h-0 min-w-0 w-full overflow-y-auto overflow-x-hidden">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
