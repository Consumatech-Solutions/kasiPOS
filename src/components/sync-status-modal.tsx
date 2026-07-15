"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSyncStatus } from "@/hooks/use-sync-status";
import { useSettings } from "@/components/settings-provider";
import { useToast } from "@/hooks/use-toast";
import {
  getCloudSyncUnavailableMessage,
  offlineDetector,
} from "@/lib/offline-detector";
import {
  runManualFullCloudSync,
  runManualPushSync,
  CLOUD_SYNC_LOCAL_HOURS,
} from "@/lib/cloud-data-pull";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Download,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";

interface SyncStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SyncStatusModal({ isOpen, onClose }: SyncStatusModalProps) {
  const { queue, currentMutation, isPreloading, preloadProgress } =
    useSyncStatus();
  const queryClient = useQueryClient();
  const { settings } = useSettings();
  const { toast } = useToast();
  const [isManualPulling, setIsManualPulling] = useState(false);
  const [isManualPushing, setIsManualPushing] = useState(false);

  const scheduleLabel = CLOUD_SYNC_LOCAL_HOURS.map((h) => `${h}:00`).join(", ");

  const handleDownloadFromCloud = async () => {
    const reachable = await offlineDetector.forceCheck({
      bypassThrottle: true,
    });
    if (!reachable) {
      const reason =
        offlineDetector.getLastConnectivityFailureReason() ??
        "server_unreachable";
      toast({
        variant: "destructive",
        title: "Sync unavailable",
        description: getCloudSyncUnavailableMessage(reason),
      });
      return;
    }
    setIsManualPulling(true);
    try {
      await runManualFullCloudSync({
        queryClient,
        storeId: settings?.currentStore?.id ?? undefined,
      });
      toast({
        title: "Cloud data updated",
        description:
          "Queued changes were uploaded and the latest catalogue data was downloaded.",
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Something went wrong.";
      toast({
        variant: "destructive",
        title: "Sync failed",
        description: message,
      });
    } finally {
      setIsManualPulling(false);
    }
  };

  const handleSyncToCloud = async () => {
    setIsManualPushing(true);
    try {
      const result = await runManualPushSync();
      if (result.initialPending === 0) {
        toast({
          title: "Nothing to sync",
          description: "There are no queued local changes to upload right now.",
        });
      } else if (result.remainingPending === 0 && result.syncedCount > 0) {
        toast({
          title: "Cloud sync complete",
          description: `Uploaded ${result.syncedCount} queued change${result.syncedCount === 1 ? "" : "s"} to the backend.`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Sync incomplete",
          description: `${result.remainingPending} queued item${result.remainingPending === 1 ? "" : "s"} still pending (${result.stoppedReason.replace("_", " ")}).`,
        });
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Something went wrong.";
      toast({
        variant: "destructive",
        title: "Sync failed",
        description: message,
      });
    } finally {
      setIsManualPushing(false);
    }
  };

  const getStatusIcon = (mutationStatus?: string) => {
    switch (mutationStatus) {
      case "syncing":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (mutationStatus?: string) => {
    switch (mutationStatus) {
      case "syncing":
        return (
          <Badge variant="default" className="bg-blue-500">
            Syncing
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="default" className="bg-green-500">
            Completed
          </Badge>
        );
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const getMutationLabel = (mutationKey: string[]) => {
    if (mutationKey.length === 0) return "Unknown";
    const [type, action] = mutationKey;
    if (action) {
      return `${type.charAt(0).toUpperCase() + type.slice(1)} ${action}`;
    }
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isPreloading ? (
              <>
                <Download className="h-5 w-5" />
                Downloading Offline Data
              </>
            ) : (
              <>
                Sync Status
                {queue.length > 0 && (
                  <Badge variant="secondary">{queue.length} pending</Badge>
                )}
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isPreloading
              ? "Downloading essential data for offline use..."
              : "Cloud sync is scheduled at " +
                scheduleLabel +
                " (local time). If a slot is missed while offline, it runs on next connection. You can also pull updates manually anytime."}
          </DialogDescription>
        </DialogHeader>

        {!isPreloading && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="default"
              disabled={isManualPushing}
              onClick={() => void handleSyncToCloud()}
              className="gap-2"
            >
              {isManualPushing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Sync to cloud now
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={isManualPulling || isManualPushing}
              onClick={() => void handleDownloadFromCloud()}
              className="gap-2"
            >
              {isManualPulling ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Download from cloud now
            </Button>
          </div>
        )}

        {isPreloading && preloadProgress && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>
                {preloadProgress.completed} / {preloadProgress.total}
              </span>
            </div>
            <Progress
              value={(preloadProgress.completed / preloadProgress.total) * 100}
              className="h-2"
            />
          </div>
        )}

        {currentMutation && (
          <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 mb-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              <span className="font-semibold">Currently Syncing</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {getMutationLabel(currentMutation.mutationKey)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {format(new Date(currentMutation.timestamp), "PPp")}
            </p>
          </div>
        )}

        <ScrollArea className="max-h-[400px]">
          {queue.length === 0 && !isPreloading ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-500" />
              <p>All operations synced successfully!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {queue.map((mutation) => (
                <div
                  key={mutation.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {getStatusIcon(mutation.status)}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {getMutationLabel(mutation.mutationKey)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(mutation.timestamp), "PPp")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(mutation.status)}
                    {mutation.retries > 0 && (
                      <Badge variant="outline" className="text-xs">
                        Retry {mutation.retries}/{3}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
