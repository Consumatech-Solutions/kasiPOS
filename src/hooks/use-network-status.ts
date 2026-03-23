'use client';

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { offlineDetector } from '@/lib/offline-detector';

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
