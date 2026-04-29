"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { offlineDetector } from "@/lib/offline-detector";

const PROBE_INTERVAL_MS = 20000;

export function useEffectiveOnline() {
  const [hasBrowserOnline, setHasBrowserOnline] = useState(
    typeof window !== "undefined" ? navigator.onLine : true
  );
  const [backendReachable, setBackendReachable] = useState(false);
  const [isProbing, setIsProbing] = useState(false);
  const mountedRef = useRef(true);

  const runProbe = useCallback(async (): Promise<boolean> => {
    if (typeof window === "undefined") return false;
    if (!navigator.onLine) {
      if (mountedRef.current) setBackendReachable(false);
      return false;
    }
    if (mountedRef.current) setIsProbing(true);
    try {
      const ok = await offlineDetector.forceCheck();
      if (mountedRef.current) setBackendReachable(ok);
      return ok;
    } finally {
      if (mountedRef.current) setIsProbing(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    const onOnline = () => {
      setHasBrowserOnline(true);
      void runProbe();
    };
    const onOffline = () => {
      setHasBrowserOnline(false);
      setBackendReachable(false);
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    setHasBrowserOnline(navigator.onLine);
    if (navigator.onLine) void runProbe();

    const intervalId = window.setInterval(() => {
      if (navigator.onLine) void runProbe();
    }, PROBE_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.clearInterval(intervalId);
    };
  }, [runProbe]);

  const refreshEffectiveOnline = useCallback(async (): Promise<boolean> => {
    return await runProbe();
  }, [runProbe]);

  const effectiveOnline = hasBrowserOnline && backendReachable;

  return {
    effectiveOnline,
    hasBrowserOnline,
    backendReachable,
    isProbing,
    refreshEffectiveOnline,
  };
}
