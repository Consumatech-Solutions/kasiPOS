"use client";

import { useState, useMemo } from "react";
import { useSyncStatus } from "@/hooks/use-sync-status";
import { useSettings } from "@/components/settings-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, FolderSync, Cloud } from "lucide-react";
import { SyncStatusModal } from "./sync-status-modal";

export function SyncStatusIndicator() {
  // ALL HOOKS MUST BE CALLED FIRST - in the same order every render
  // Hook 1: useSyncStatus (contains useState and useEffect internally)
  const syncStatus = useSyncStatus();

  const { settings } = useSettings();

  // Hook 2: useState
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Hook 3: useMemo for icon
  const icon = useMemo(() => {
    const isPreloading = syncStatus?.isPreloading ?? false;
    const isSyncing = syncStatus?.isSyncing ?? false;
    const pendingCount = syncStatus?.pendingCount ?? 0;

    if (isPreloading) {
      return <Download className="h-4 w-4 animate-pulse" />;
    }
    if (isSyncing) {
      return <Loader2 className="h-4 w-4 animate-spin" />;
    }
    if (pendingCount > 0) {
      return <FolderSync className="h-4 w-4" />;
    }
    return <Cloud className="h-4 w-4" />;
  }, [
    syncStatus?.isPreloading,
    syncStatus?.isSyncing,
    syncStatus?.pendingCount,
  ]);

  // Hook 4: useMemo for colorClass
  const colorClass = useMemo(() => {
    const isPreloading = syncStatus?.isPreloading ?? false;
    const isSyncing = syncStatus?.isSyncing ?? false;
    const pendingCount = syncStatus?.pendingCount ?? 0;

    if (isPreloading || isSyncing) {
      return "bg-blue-500 hover:bg-blue-600";
    }
    if (pendingCount > 0) {
      return "bg-orange-500 hover:bg-orange-600";
    }
    return "bg-slate-600 hover:bg-slate-700";
  }, [
    syncStatus?.isPreloading,
    syncStatus?.isSyncing,
    syncStatus?.pendingCount,
  ]);

  // Extract values with defaults to handle undefined case (after all hooks)
  const status = syncStatus?.status ?? "idle";
  const pendingCount = syncStatus?.pendingCount ?? 0;
  const isPreloading = syncStatus?.isPreloading ?? false;
  const preloadProgress = syncStatus?.preloadProgress;

  const idleQuiet = status === "idle" && pendingCount === 0 && !isPreloading;

  if (!settings.isLoggedIn) {
    return null;
  }

  return (
    <>
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          type="button"
          aria-label="Open cloud sync status"
          onClick={() => setIsModalOpen(true)}
          title={
            idleQuiet ? "Cloud sync — tap for status and download" : undefined
          }
          className={`h-12 w-12 rounded-full shadow-lg ${colorClass} text-white p-0 relative ${idleQuiet ? "opacity-90" : ""}`}
          size="icon"
        >
          {icon}
          {pendingCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {pendingCount > 9 ? "9+" : pendingCount}
            </Badge>
          )}
          {isPreloading && preloadProgress && (
            <Badge
              variant="secondary"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {preloadProgress.completed}/{preloadProgress.total}
            </Badge>
          )}
        </Button>
      </div>
      {isModalOpen && (
        <SyncStatusModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
}
