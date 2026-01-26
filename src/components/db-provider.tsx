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
  
  // This registers the service worker with progress tracking
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const registerSW = async () => {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js', {
            scope: '/',
          });
          
          console.log('[Service Worker] Registered:', registration);

          // Listen for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New service worker available
                  console.log('[Service Worker] New version available');
                }
              });
            }
          });

          // Check for updates periodically
          setInterval(() => {
            registration.update();
          }, 60 * 60 * 1000); // Check every hour
        } catch (registrationError) {
          console.error('[Service Worker] Registration failed:', registrationError);
        }
      };

      if (document.readyState === 'complete') {
        registerSW();
      } else {
        window.addEventListener('load', registerSW);
      }
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
