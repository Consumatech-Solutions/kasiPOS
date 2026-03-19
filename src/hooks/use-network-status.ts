'use client';

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { offlineDetector } from '@/lib/offline-detector';

/**
 * Reports network/sync status. "Offline" is true when the detector's effective
 * offline is true: either the network is unreachable, or offline-first mode is
 * active (sync condition not yet met / user has not triggered manual sync).
 * So the app shows offline even when the user is online until sync runs.
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof window !== 'undefined' ? !offlineDetector.isOffline() : true
  );
  const [wasOffline, setWasOffline] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = offlineDetector.subscribe((isOffline) => {
      const online = !isOffline;
      setIsOnline(online);
      if (online) {
        setWasOffline(true);
        queryClient.resumePausedMutations();
        queryClient.refetchQueries();
        setTimeout(() => setWasOffline(false), 3000);
      }
    });
    return unsubscribe;
  }, [queryClient]);

  return {
    isOnline,
    wasOffline,
    isOffline: !isOnline,
  };
}
