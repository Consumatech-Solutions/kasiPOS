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
    if (typeof window === "undefined") {
      return;
    }

    const initDb = async () => {
      try {
        const db = getDb();

        try {
          await db.open();
        } catch (migrationError: any) {
          if (
            migrationError.name === "UpgradeError" &&
            migrationError.message?.includes("primary key")
          ) {
            console.warn("Migration error detected. Resetting database...");
            await db.close();
            await db.delete();
            await db.open();
          } else {
            throw migrationError;
          }
        }

        await seedDatabase();

        setIsDbReady(true);
      } catch (error) {
        console.error("Failed to initialize database:", error);
        setIsDbReady(true);
      }
    };
    initDb();
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      const registerSW = async () => {
        try {
          if (isKasiPosE2eRuntime()) {
            const existingRegistrations =
              await navigator.serviceWorker.getRegistrations();
            await Promise.allSettled(
              existingRegistrations.map((registration) =>
                registration.unregister(),
              ),
            );
            return;
          }

          const existingRegistrations =
            await navigator.serviceWorker.getRegistrations();
          for (const registration of existingRegistrations) {
            const swUrl =
              registration.active?.scriptURL ||
              registration.installing?.scriptURL ||
              registration.waiting?.scriptURL;
            if (swUrl && !swUrl.includes("/sw.js")) {
              await registration.unregister();
            }
          }

          const registration = await navigator.serviceWorker.register(
            "/sw.js",
            {
              scope: "/",
              updateViaCache: "none",
            },
          );

          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (
                  newWorker.state === "installed" &&
                  navigator.serviceWorker.controller
                ) {
                  console.log("[Service Worker] New version available");
                }
              });
            }
          });

          setInterval(
            () => {
              registration.update();
            },
            60 * 60 * 1000,
          );
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
