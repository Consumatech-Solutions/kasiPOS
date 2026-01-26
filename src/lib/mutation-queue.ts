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

class MutationQueue {
  private queue: QueuedMutation[] = [];
  private processing = false;
  private queryClient: QueryClient | null = null;

  setQueryClient(queryClient: QueryClient) {
    this.queryClient = queryClient;
  }

  add(mutation: Omit<QueuedMutation, 'id' | 'timestamp' | 'retries'>) {
    const queuedMutation: QueuedMutation = {
      ...mutation,
      id: `mutation-${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      retries: 0,
    };

    this.queue.push(queuedMutation);
    this.processQueue();
  }

  async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const mutation = this.queue[0];

      try {
        await mutation.mutationFn();
        // Success - remove from queue
        this.queue.shift();
      } catch (error) {
        // Check if we should retry
        if (mutation.retries < MAX_RETRIES) {
          mutation.retries++;
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * mutation.retries));
          // Try again (mutation stays at front of queue)
        } else {
          // Max retries reached - remove from queue
          console.error('Mutation failed after max retries:', mutation);
          this.queue.shift();
        }
      }
    }

    this.processing = false;
  }

  getQueue() {
    return [...this.queue];
  }

  clear() {
    this.queue = [];
  }

  getPendingCount() {
    return this.queue.length;
  }
}

export const mutationQueue = new MutationQueue();
