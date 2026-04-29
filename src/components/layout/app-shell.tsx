"use client";

import Header from "./header";
import BottomNav from "./bottom-nav";
import { useSettings } from "../settings-provider";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();

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
