"use client";

import { useEffect, useCallback, useSyncExternalStore } from "react";
import { offlineDetector } from "@/lib/offline-detector";

const PROBE_INTERVAL_MS = 30000;

type SharedProbeState = {
  hasBrowserOnline: boolean;
  backendReachable: boolean;
  isProbing: boolean;
};

let sharedState: SharedProbeState = {
  hasBrowserOnline: typeof window !== "undefined" ? navigator.onLine : true,
  backendReachable: offlineDetector.getLastBackendReachable(),
  isProbing: false,
};

const sharedListeners = new Set<() => void>();
let subscriberCount = 0;
let probeIntervalId: ReturnType<typeof setInterval> | null = null;
let browserListenersAttached = false;

function notifySharedListeners() {
  sharedListeners.forEach((listener) => listener());
}

function setSharedState(patch: Partial<SharedProbeState>) {
  sharedState = { ...sharedState, ...patch };
  notifySharedListeners();
}

async function runSharedProbe(options?: {
  bypassThrottle?: boolean;
}): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!navigator.onLine) {
    setSharedState({ backendReachable: false, isProbing: false });
    return false;
  }

  setSharedState({ isProbing: true });
  try {
    const ok = await offlineDetector.forceCheck(options);
    setSharedState({ backendReachable: ok });
    return ok;
  } finally {
    setSharedState({ isProbing: false });
  }
}

function handleBrowserOnline() {
  setSharedState({ hasBrowserOnline: true });
  void runSharedProbe({ bypassThrottle: true });
}

function handleBrowserOffline() {
  setSharedState({
    hasBrowserOnline: false,
    backendReachable: false,
    isProbing: false,
  });
}

function attachBrowserListeners() {
  if (browserListenersAttached || typeof window === "undefined") return;
  browserListenersAttached = true;
  window.addEventListener("online", handleBrowserOnline);
  window.addEventListener("offline", handleBrowserOffline);
  setSharedState({ hasBrowserOnline: navigator.onLine });
}

function detachBrowserListeners() {
  if (!browserListenersAttached || typeof window === "undefined") return;
  browserListenersAttached = false;
  window.removeEventListener("online", handleBrowserOnline);
  window.removeEventListener("offline", handleBrowserOffline);
}

function startSharedProbeScheduler() {
  if (typeof window === "undefined") return;
  attachBrowserListeners();
  if (probeIntervalId != null) return;

  if (navigator.onLine) {
    void runSharedProbe();
  }

  probeIntervalId = window.setInterval(() => {
    if (navigator.onLine) void runSharedProbe();
  }, PROBE_INTERVAL_MS);
}

function stopSharedProbeScheduler() {
  if (probeIntervalId != null) {
    window.clearInterval(probeIntervalId);
    probeIntervalId = null;
  }
  detachBrowserListeners();
}

function subscribeSharedProbe(onStoreChange: () => void) {
  sharedListeners.add(onStoreChange);
  return () => {
    sharedListeners.delete(onStoreChange);
  };
}

function getSharedProbeSnapshot(): SharedProbeState {
  return sharedState;
}

function getSharedProbeServerSnapshot(): SharedProbeState {
  return {
    hasBrowserOnline: true,
    backendReachable: false,
    isProbing: false,
  };
}

export function useEffectiveOnline() {
  useEffect(() => {
    subscriberCount += 1;
    if (subscriberCount === 1) {
      startSharedProbeScheduler();
    }

    const unsubscribeReachability =
      offlineDetector.subscribeToBackendReachability((reachable) => {
        setSharedState({ backendReachable: reachable });
      });

    return () => {
      unsubscribeReachability();
      subscriberCount -= 1;
      if (subscriberCount === 0) {
        stopSharedProbeScheduler();
      }
    };
  }, []);

  const probeState = useSyncExternalStore(
    subscribeSharedProbe,
    getSharedProbeSnapshot,
    getSharedProbeServerSnapshot
  );

  const refreshEffectiveOnline = useCallback(async (): Promise<boolean> => {
    return await runSharedProbe({ bypassThrottle: true });
  }, []);

  const effectiveOnline =
    probeState.hasBrowserOnline && probeState.backendReachable;

  return {
    effectiveOnline,
    hasBrowserOnline: probeState.hasBrowserOnline,
    backendReachable: probeState.backendReachable,
    isProbing: probeState.isProbing,
    refreshEffectiveOnline,
  };
}
