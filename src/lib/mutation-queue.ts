import { QueryClient } from '@tanstack/react-query';
import { offlineDetector, isOffline, checkOfflineStatus } from '@/lib/offline-detector';

export interface QueuedMutation {
  id: string;
  mutationKey: string[];
  mutationFn: () => Promise<any>;
  variables: any;
  timestamp: number;
  retries: number;
  status?: 'pending' | 'syncing' | 'completed' | 'failed';
}

export type SyncStatus = 'idle' | 'syncing' | 'preloading';

export interface SyncStatusData {
  status: SyncStatus;
  pendingCount: number;
  currentMutation: QueuedMutation | null;
  queue: QueuedMutation[];
  preloadProgress?: {
    completed: number;
    total: number;
  };
}

type StatusChangeCallback = (status: SyncStatusData) => void;

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second
const STORAGE_KEY = 'kasipos-mutation-queue';

class MutationQueue {
  private queue: QueuedMutation[] = [];
  private processing = false;
  private queryClient: QueryClient | null = null;
  private onlineHandler: (() => void) | null = null;
  private statusChangeCallbacks: StatusChangeCallback[] = [];
  private currentStatus: SyncStatus = 'idle';
  private currentMutation: QueuedMutation | null = null;
  private preloadProgress: { completed: number; total: number } | undefined = undefined;

  constructor() {
    // Restore queue from localStorage on initialization
    this.restoreQueue();
    // Setup online listener
    this.setupOnlineListener();
  }

  private notifyStatusChange() {
    const statusData: SyncStatusData = {
      status: this.currentStatus,
      pendingCount: this.queue.length,
      currentMutation: this.currentMutation,
      queue: [...this.queue],
      preloadProgress: this.preloadProgress,
    };
    this.statusChangeCallbacks.forEach(callback => callback(statusData));
  }

  subscribe(callback: StatusChangeCallback): () => void {
    this.statusChangeCallbacks.push(callback);
    // Immediately call with current status
    callback(this.getStatus());
    // Return unsubscribe function
    return () => {
      const index = this.statusChangeCallbacks.indexOf(callback);
      if (index > -1) {
        this.statusChangeCallbacks.splice(index, 1);
      }
    };
  }

  setPreloadProgress(completed: number, total: number) {
    this.preloadProgress = { completed, total };
    if (completed < total) {
      this.currentStatus = 'preloading';
    } else {
      this.preloadProgress = undefined;
      if (this.queue.length === 0) {
        this.currentStatus = 'idle';
      }
    }
    this.notifyStatusChange();
  }

  getStatus(): SyncStatusData {
    return {
      status: this.currentStatus,
      pendingCount: this.queue.length,
      currentMutation: this.currentMutation,
      queue: [...this.queue],
      preloadProgress: this.preloadProgress,
    };
  }

  getCurrentMutation(): QueuedMutation | null {
    return this.currentMutation;
  }

  private setupOnlineListener() {
    if (typeof window !== 'undefined') {
      // Use enhanced offline detector instead of native online event
      const unsubscribe = offlineDetector.subscribe((isOffline) => {
        if (!isOffline) {
          console.log('[MutationQueue] Network online - processing queued mutations');
          this.processQueue();
        }
      });
      
      // Store unsubscribe function for cleanup
      this.onlineHandler = unsubscribe;
    }
  }

  private restoreQueue() {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          // We can only restore metadata, not the actual functions
          // The functions will be re-created when the app reconnects
          console.log(`[MutationQueue] Found ${parsed.length} queued mutations from previous session`);
        }
      } catch (error) {
        console.error('[MutationQueue] Failed to restore queue:', error);
      }
    }
  }

  private persistQueue() {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        // Only persist metadata (we can't serialize functions)
        const toStore = this.queue.map(m => ({
          id: m.id,
          mutationKey: m.mutationKey,
          variables: m.variables,
          timestamp: m.timestamp,
          retries: m.retries,
        }));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
      } catch (error) {
        console.error('[MutationQueue] Failed to persist queue:', error);
      }
    }
  }

  setQueryClient(queryClient: QueryClient) {
    this.queryClient = queryClient;
    // Try to process queue when client is set (check if online using enhanced detector)
    if (typeof window !== 'undefined') {
      checkOfflineStatus().then((isOffline) => {
        if (!isOffline) {
          this.processQueue();
        }
      });
    }
  }

  add(mutation: Omit<QueuedMutation, 'id' | 'timestamp' | 'retries' | 'status'>) {
    const queuedMutation: QueuedMutation = {
      ...mutation,
      id: `mutation-${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      retries: 0,
      status: 'pending',
    };

    this.queue.push(queuedMutation);
    this.persistQueue();
    
    // Update status if not preloading
    if (this.currentStatus !== 'preloading') {
      this.currentStatus = 'idle';
    }
    this.notifyStatusChange();
    
    // Only process if online (using enhanced offline detection)
    if (typeof window !== 'undefined') {
      checkOfflineStatus().then((isOffline) => {
        if (!isOffline) {
          this.processQueue();
        } else {
          console.log('[MutationQueue] Offline - mutation queued for later sync');
        }
      });
    } else {
      console.log('[MutationQueue] Offline - mutation queued for later sync');
    }
  }

  async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    // Check if we're online before processing (using enhanced offline detection)
    if (typeof window !== 'undefined') {
      const isOfflineStatus = await checkOfflineStatus();
      if (isOfflineStatus) {
        console.log('[MutationQueue] Still offline - skipping queue processing');
        return;
      }
    }

    this.processing = true;
    this.currentStatus = 'syncing';
    console.log(`[MutationQueue] Processing ${this.queue.length} queued mutations`);
    this.notifyStatusChange();

    while (this.queue.length > 0) {
      // Re-check online status before each mutation (using enhanced offline detection)
      if (typeof window !== 'undefined') {
        const isOfflineStatus = isOffline(); // Use cached value for quick check
        if (isOfflineStatus) {
          // Verify with fresh check
          const verifiedOffline = await checkOfflineStatus(true);
          if (verifiedOffline) {
            console.log('[MutationQueue] Went offline during processing - pausing');
            this.currentStatus = 'idle';
            this.currentMutation = null;
            this.notifyStatusChange();
            break;
          }
        }
      }

      const mutation = this.queue[0];
      this.currentMutation = mutation;
      mutation.status = 'syncing';
      this.notifyStatusChange();

      try {
        await mutation.mutationFn();
        // Success - remove from queue
        mutation.status = 'completed';
        this.queue.shift();
        this.currentMutation = null;
        this.persistQueue();
        console.log(`[MutationQueue] Successfully synced mutation: ${mutation.mutationKey.join('/')}`);
        
        // Invalidate related queries to refresh data
        if (this.queryClient && mutation.mutationKey.length > 0) {
          this.queryClient.invalidateQueries({ 
            queryKey: [mutation.mutationKey[0]],
            refetchType: 'all',
          });
        }
        
        this.notifyStatusChange();
      } catch (error: any) {
        // Check if it's a network error (using enhanced offline detection)
        const isOfflineStatus = isOffline();
        const isNetworkError = isOfflineStatus ||
          error?.code === 'ECONNABORTED' || 
          error?.message?.includes('Network Error') ||
          error?.isOffline ||
          error?.isNetworkError;
        
        if (isNetworkError) {
          console.log('[MutationQueue] Network error - will retry when online');
          mutation.status = 'pending';
          this.currentMutation = null;
          this.currentStatus = 'idle';
          this.notifyStatusChange();
          break;
        }
        
        // Check if we should retry
        if (mutation.retries < MAX_RETRIES) {
          mutation.retries++;
          mutation.status = 'pending';
          console.log(`[MutationQueue] Retrying mutation (attempt ${mutation.retries}/${MAX_RETRIES})`);
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * mutation.retries));
          // Try again (mutation stays at front of queue)
        } else {
          // Max retries reached - remove from queue
          mutation.status = 'failed';
          console.error('[MutationQueue] Mutation failed after max retries:', mutation.mutationKey, error);
          this.queue.shift();
          this.currentMutation = null;
          this.persistQueue();
          this.notifyStatusChange();
        }
      }
    }

    this.processing = false;
    this.currentStatus = this.queue.length > 0 ? 'idle' : 'idle';
    this.currentMutation = null;
    
    if (this.queue.length === 0) {
      console.log('[MutationQueue] All mutations synced successfully');
    }
    
    this.notifyStatusChange();
  }

  getQueue() {
    return [...this.queue];
  }

  clear() {
    this.queue = [];
    this.persistQueue();
  }

  getPendingCount() {
    return this.queue.length;
  }

  destroy() {
    if (typeof window !== 'undefined' && this.onlineHandler) {
      // onlineHandler is now an unsubscribe function from offlineDetector
      if (typeof this.onlineHandler === 'function') {
        this.onlineHandler();
      }
    }
  }
}

export const mutationQueue = new MutationQueue();
