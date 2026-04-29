"use client";

import { useState, useEffect } from "react";
import { mutationQueue, type SyncStatusData } from "@/lib/mutation-queue";

export function useSyncStatus() {
  const [status, setStatus] = useState<SyncStatusData>(
    mutationQueue.getStatus()
  );

  useEffect(() => {
    const unsubscribe = mutationQueue.subscribe((newStatus) => {
      setStatus(newStatus);
    });

    return unsubscribe;
  }, []);

  return {
    ...status,
    isSyncing: status.status === "syncing",
    isPreloading: status.status === "preloading",
    isIdle: status.status === "idle",
  };
}
