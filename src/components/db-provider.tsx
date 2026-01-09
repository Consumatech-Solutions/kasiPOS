'use client';

import { useEffect, useState } from 'react';
import { seedDatabase } from '@/lib/seed';
import { db } from '@/lib/db';
import { Skeleton } from './ui/skeleton';

export function DbProvider({ children }: { children: React.ReactNode }) {
  const [isDbReady, setIsDbReady] = useState(false);

  useEffect(() => {
    const initDb = async () => {
      try {
        // This will now check for products and parcels and seed if necessary.
        // The seedDatabase function is now idempotent.
        await seedDatabase();
        setIsDbReady(true);
      } catch (error) {
        console.error('Failed to initialize database:', error);
      }
    };
    initDb();
  }, []);
  
  // This registers the service worker.
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(registration => {
          console.log('SW registered: ', registration);
        }).catch(registrationError => {
          console.log('SW registration failed: ', registrationError);
        });
      });
    }
  }, []);

  if (!isDbReady) {
    return (
        <div className="flex h-screen w-screen items-center justify-center">
            <div className="w-1/2 space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-12 w-full" />
            </div>
        </div>
    );
  }

  return <>{children}</>;
}
