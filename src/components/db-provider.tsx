'use client';

import { useEffect, useState } from 'react';
import { seedDatabase } from '@/lib/seed';
import { getDb } from '@/lib/db';
import { Skeleton } from './ui/skeleton';

export function DbProvider({ children }: { children: React.ReactNode }) {
  const [isDbReady, setIsDbReady] = useState(false);

  useEffect(() => {
    // Check that we are on the client side
    if (typeof window === 'undefined') {
      return;
    }

    const initDb = async () => {
      try {
        // Initialize database (only for products, transactions, etc. - not for customers/stores)
        const db = getDb();
        
        // Handle Dexie migration errors (primary key changes)
        try {
          await db.open();
        } catch (migrationError: any) {
          if (migrationError.name === 'UpgradeError' && migrationError.message?.includes('primary key')) {
            console.warn('Migration error detected. Resetting database...');
            // Close the database
            await db.close();
            // Delete the database
            await db.delete();
            // Recreate the database
            await db.open();
          } else {
            throw migrationError;
          }
        }
        
        // This will now check for products and parcels and seed if necessary.
        // The seedDatabase function is now idempotent.
        // Note: Customers and stores are now managed via API only
        await seedDatabase();
        
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
