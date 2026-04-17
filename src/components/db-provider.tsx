"use client";

import { useEffect, useState } from "react";
import { seedDatabase } from "@/lib/seed";
import { getDb } from "@/lib/db";
import { Skeleton } from "./ui/skeleton";

function isKasiPosE2eRuntime(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (
      window.localStorage.getItem("__kasi_pos_e2e") === "1" ||
      window.sessionStorage.getItem("__kasi_pos_e2e") === "1"
    );
  } catch {
    return false;
  }
}

function DbProvider({ children }: { children: React.ReactNode }) {
  const [isDbReady, setIsDbReady] = useState(false);

  useEffect(() => {
    const isResizeObserverNoise = (value: unknown): boolean =>
      /ResizeObserver loop (completed with undelivered notifications|limit exceeded)/i.test(
        String(value ?? ""),
      );

    const onWindowError = (event: ErrorEvent) => {
      const message = event.message || event.error?.message;
      if (!isResizeObserverNoise(message)) return;
      // Ignore browser ResizeObserver noise to avoid false-positive uncaught app errors in E2E/runtime.
      event.preventDefault();
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message =
        typeof reason === "string"
          ? reason
          : (reason as { message?: string } | null | undefined)?.message;
      if (!isResizeObserverNoise(message)) return;
      event.preventDefault();
    };

    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    // Check that we are on the client side
    if (typeof window === "undefined") {
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
          if (
            migrationError.name === "UpgradeError" &&
            migrationError.message?.includes("primary key")
          ) {
            console.warn("Migration error detected. Resetting database...");
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
        console.error("Failed to initialize database:", error);
        setIsDbReady(true); // Still allow app to load even if seeding fails
      }
    };
    initDb();
  }, []);

  // This registers the service worker with progress tracking
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      const registerSW = async () => {
        try {
          // In Cypress E2E, keep SW disabled to prevent stale cached shells/chunks.
          if (isKasiPosE2eRuntime()) {
            const existingRegistrations =
              await navigator.serviceWorker.getRegistrations();
            await Promise.allSettled(
              existingRegistrations.map((registration) =>
                registration.unregister(),
              ),
            );
            console.log(
              "[Service Worker] Skipped registration in Cypress E2E runtime",
            );
            return;
          }

          // First, unregister any existing non-app service workers to clear old workbox caches
          const existingRegistrations =
            await navigator.serviceWorker.getRegistrations();
          for (const registration of existingRegistrations) {
            // Only unregister if it's not our current service worker
            const swUrl =
              registration.active?.scriptURL ||
              registration.installing?.scriptURL ||
              registration.waiting?.scriptURL;
            if (swUrl && !swUrl.includes("/sw.js")) {
              console.log(
                "[Service Worker] Unregistering old service worker:",
                swUrl,
              );
              await registration.unregister();
            }
          }

          // Register our service worker
          const registration = await navigator.serviceWorker.register(
            "/sw.js",
            {
              scope: "/",
              updateViaCache: "none", // Always check for updates
            },
          );

          console.log("[Service Worker] Registered:", registration);

          // Listen for updates
          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (
                  newWorker.state === "installed" &&
                  navigator.serviceWorker.controller
                ) {
                  // New service worker available
                  console.log("[Service Worker] New version available");
                }
              });
            }
          });

          // Check for updates periodically
          setInterval(
            () => {
              registration.update();
            },
            60 * 60 * 1000,
          ); // Check every hour
        } catch (registrationError) {
          console.error(
            "[Service Worker] Registration failed:",
            registrationError,
          );
        }
      };

      if (document.readyState === "complete") {
        registerSW();
      } else {
        window.addEventListener("load", registerSW);
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

export { DbProvider };
export default DbProvider;
