import { QueryClient } from '@tanstack/react-query';

interface QueuedMutation {
  id: string;
  mutationKey: string[];
  mutationFn: () => Promise<any>;
  variables: any;
  timestamp: number;
  retries: number;
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second
const STORAGE_KEY = 'kasipos-mutation-queue';

class MutationQueue {
  private queue: QueuedMutation[] = [];
  private processing = false;
  private queryClient: QueryClient | null = null;
  private onlineHandler: (() => void) | null = null;

  constructor() {
    // Restore queue from localStorage on initialization
    this.restoreQueue();
    // Setup online listener
    this.setupOnlineListener();
  }

  private setupOnlineListener() {
    if (typeof window !== 'undefined') {
      this.onlineHandler = () => {
        console.log('[MutationQueue] Network online - processing queued mutations');
        this.processQueue();
      };
      window.addEventListener('online', this.onlineHandler);
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
    // Try to process queue when client is set (might be online now)
    if (typeof window !== 'undefined' && navigator.onLine) {
      this.processQueue();
    }
  }

  add(mutation: Omit<QueuedMutation, 'id' | 'timestamp' | 'retries'>) {
    const queuedMutation: QueuedMutation = {
      ...mutation,
      id: `mutation-${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      retries: 0,
    };

    this.queue.push(queuedMutation);
    this.persistQueue();
    
    // Only process if online
    if (typeof window !== 'undefined' && navigator.onLine) {
      this.processQueue();
    } else {
      console.log('[MutationQueue] Offline - mutation queued for later sync');
    }
  }

  async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    // Check if we're online before processing
    if (typeof window !== 'undefined' && !navigator.onLine) {
      console.log('[MutationQueue] Still offline - skipping queue processing');
      return;
    }

    this.processing = true;
    console.log(`[MutationQueue] Processing ${this.queue.length} queued mutations`);

    while (this.queue.length > 0) {
      // Re-check online status before each mutation
      if (typeof window !== 'undefined' && !navigator.onLine) {
        console.log('[MutationQueue] Went offline during processing - pausing');
        break;
      }

      const mutation = this.queue[0];

      try {
        await mutation.mutationFn();
        // Success - remove from queue
        this.queue.shift();
        this.persistQueue();
        console.log(`[MutationQueue] Successfully synced mutation: ${mutation.mutationKey.join('/')}`);
        
        // Invalidate related queries to refresh data
        if (this.queryClient && mutation.mutationKey.length > 0) {
          this.queryClient.invalidateQueries({ 
            queryKey: [mutation.mutationKey[0]],
            refetchType: 'all',
          });
        }
      } catch (error: any) {
        // Check if it's a network error
        const isNetworkError = !navigator.onLine || 
          error?.code === 'ECONNABORTED' || 
          error?.message?.includes('Network Error');
        
        if (isNetworkError) {
          console.log('[MutationQueue] Network error - will retry when online');
          break;
        }
        
        // Check if we should retry
        if (mutation.retries < MAX_RETRIES) {
          mutation.retries++;
          console.log(`[MutationQueue] Retrying mutation (attempt ${mutation.retries}/${MAX_RETRIES})`);
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * mutation.retries));
          // Try again (mutation stays at front of queue)
        } else {
          // Max retries reached - remove from queue
          console.error('[MutationQueue] Mutation failed after max retries:', mutation.mutationKey, error);
          this.queue.shift();
          this.persistQueue();
        }
      }
    }

    this.processing = false;
    
    if (this.queue.length === 0) {
      console.log('[MutationQueue] All mutations synced successfully');
    }
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
      window.removeEventListener('online', this.onlineHandler);
    }
  }
}

export const mutationQueue = new MutationQueue();
