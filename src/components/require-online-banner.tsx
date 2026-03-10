'use client';

import { useNetworkStatus } from '@/hooks/use-network-status';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { WifiOff } from 'lucide-react';

/**
 * Banner shown on pages that require internet (Buy Stock, BOPH, Marketplace, Campaigns).
 * When offline, the nav already greys these items; this banner informs users who landed
 * on the page directly or were already on it when going offline.
 */
export function RequireOnlineBanner() {
  const { isOnline } = useNetworkStatus();
  if (isOnline) return null;
  return (
    <Alert variant="default" className="mb-4 border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-200 dark:bg-amber-500/10 dark:border-amber-400/50">
      <WifiOff className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertTitle>Offline</AlertTitle>
      <AlertDescription>
        This section requires an internet connection. It is disabled while you are offline. Reconnect to use it.
      </AlertDescription>
    </Alert>
  );
}
