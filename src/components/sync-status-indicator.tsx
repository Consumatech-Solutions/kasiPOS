'use client';

import { useState } from 'react';
import { useSyncStatus } from '@/hooks/use-sync-status';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sync, CheckCircle2, Loader2, Download } from 'lucide-react';
import { SyncStatusModal } from './sync-status-modal';

export function SyncStatusIndicator() {
  const { status, pendingCount, isSyncing, isPreloading, preloadProgress } = useSyncStatus();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Don't show if idle and no pending mutations
  if (status === 'idle' && pendingCount === 0 && !isPreloading) {
    return null;
  }

  const getIcon = () => {
    if (isPreloading) {
      return <Download className="h-4 w-4 animate-pulse" />;
    }
    if (isSyncing) {
      return <Loader2 className="h-4 w-4 animate-spin" />;
    }
    if (pendingCount > 0) {
      return <Sync className="h-4 w-4" />;
    }
    return <CheckCircle2 className="h-4 w-4" />;
  };

  const getColor = () => {
    if (isPreloading || isSyncing) {
      return 'bg-blue-500 hover:bg-blue-600';
    }
    if (pendingCount > 0) {
      return 'bg-orange-500 hover:bg-orange-600';
    }
    return 'bg-green-500 hover:bg-green-600';
  };

  return (
    <>
      <Button
        onClick={() => setIsModalOpen(true)}
        className={`fixed bottom-4 right-4 z-50 h-12 w-12 rounded-full shadow-lg ${getColor()} text-white p-0`}
        size="icon"
      >
        {getIcon()}
        {pendingCount > 0 && (
          <Badge 
            variant="destructive" 
            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
          >
            {pendingCount > 9 ? '9+' : pendingCount}
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
      <SyncStatusModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}

