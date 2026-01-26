'use client';

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [wasOffline, setWasOffline] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setWasOffline(true);
      
      // Resume any paused queries/mutations when coming back online
      queryClient.resumePausedMutations();
      
      // Refetch all active queries to ensure data is fresh
      queryClient.refetchQueries();
      
      // Clear the wasOffline flag after a short delay
      setTimeout(() => setWasOffline(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [queryClient]);

  return {
    isOnline,
    wasOffline,
    isOffline: !isOnline,
  };
}
