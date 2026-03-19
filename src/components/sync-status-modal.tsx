'use client';

import { useState } from 'react';
import { useSyncStatus } from '@/hooks/use-sync-status';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle2, XCircle, Clock, Download, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { offlineDetector } from '@/lib/offline-detector';
import { useToast } from '@/hooks/use-toast';

interface SyncStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SyncStatusModal({ isOpen, onClose }: SyncStatusModalProps) {
  const { status, queue, currentMutation, isPreloading, preloadProgress } = useSyncStatus();
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const { toast } = useToast();

  const handleForceSync = async () => {
    setIsSyncingNow(true);
    try {
      const online = await offlineDetector.trySyncNow();
      if (!online) {
        toast({
          title: 'No connection',
          description: 'Unable to sync. Check your connection.',
          variant: 'destructive',
        });
      }
    } finally {
      setIsSyncingNow(false);
    }
  };

  const getStatusIcon = (mutationStatus?: string) => {
    switch (mutationStatus) {
      case 'syncing':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (mutationStatus?: string) => {
    switch (mutationStatus) {
      case 'syncing':
        return <Badge variant="default" className="bg-blue-500">Syncing</Badge>;
      case 'completed':
        return <Badge variant="default" className="bg-green-500">Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const getMutationLabel = (mutationKey: string[]) => {
    if (mutationKey.length === 0) return 'Unknown';
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
              ? 'Downloading essential data for offline use...'
              : 'View and monitor pending synchronization operations'}
          </DialogDescription>
        </DialogHeader>

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
              {format(new Date(currentMutation.timestamp), 'PPp')}
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
                        {format(new Date(mutation.timestamp), 'PPp')}
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

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              window.location.reload();
            }}
            disabled={isSyncingNow || isPreloading}
          >
            {isSyncingNow ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Sync now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


