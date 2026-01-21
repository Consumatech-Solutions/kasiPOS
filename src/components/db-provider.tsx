'use client';

import { useEffect, useState } from 'react';
import { seedDatabase } from '@/lib/seed';
import { getDb } from '@/lib/db';
import { Skeleton } from './ui/skeleton';
import { removeAllMockData } from '@/lib/utils/catalogue-cleanup';

export function DbProvider({ children }: { children: React.ReactNode }) {
  const [isDbReady, setIsDbReady] = useState(false);

  useEffect(() => {
    // Vérifier que nous sommes côté client
    if (typeof window === 'undefined') {
      return;
    }

    const initDb = async () => {
      try {
        // Initialiser la base de données
        const db = getDb();
        await db.open();
        
        // This will now check for products and parcels and seed if necessary.
        // The seedDatabase function is now idempotent.
        await seedDatabase();
        
        // Remove all mock data immediately on startup
        try {
          await removeAllMockData();
        } catch (error) {
          console.error('Failed to remove mock data:', error);
          // Continue even if mock data removal fails
        }
        
        setIsDbReady(true);
      } catch (error) {
        console.error('Failed to initialize database:', error);
        setIsDbReady(true); // Still allow app to load even if seeding fails
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
