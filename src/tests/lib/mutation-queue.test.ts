import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  offlineFirst: true,
  executeMutationImpl: vi.fn(async (_key: string[], _variables: unknown) => ({ ok: true })),
  checkOffline: vi.fn(() => Promise.resolve(false)),
  isOfflineFn: vi.fn(() => false),
  mqRows: [] as Array<{
    id?: number;
    mutationKey: string;
    variables: unknown;
    timestamp: number;
    retries: number;
    status?: string;
  }>,
}));

vi.mock('@/lib/db', () => ({
  getDb: () => ({
    mutationQueue: {
      orderBy: () => ({
        toArray: () =>
          Promise.resolve(
            hoisted.mqRows.map((r, i) => ({
              ...r,
              id: i + 1,
            }))
          ),
      }),
      clear: async () => {
        hoisted.mqRows.length = 0;
      },
      bulkAdd: async (
        rows: Array<{
          mutationKey: string;
          variables: unknown;
          timestamp: number;
          retries: number;
          status?: string;
        }>
      ) => {
        for (const r of rows) hoisted.mqRows.push(r);
      },
    },
  }),
}));

vi.mock('@/lib/mutation-registry', () => ({
  executeMutation: (key: string[], variables: unknown) =>
    hoisted.executeMutationImpl(key, variables),
}));

vi.mock('@/lib/offline-detector', () => ({
  offlineDetector: {
    setOfflineFirstActive(v: boolean) {
      hoisted.offlineFirst = v;
    },
    getOfflineFirstActive() {
      return hoisted.offlineFirst;
    },
    forceCheck: () => Promise.resolve(true),
    subscribe: () => () => {},
  },
  isOffline: () => hoisted.isOfflineFn(),
  checkOfflineStatus: () => hoisted.checkOffline(),
}));

vi.mock('@/lib/feedback', () => ({
  feedback: { error: vi.fn() },
  genLogId: () => 'test-log',
}));

import { feedback } from '@/lib/feedback';
import { mutationQueue } from '@/lib/mutation-queue';

describe('mutationQueue', () => {
  beforeEach(() => {
    hoisted.offlineFirst = true;
    hoisted.mqRows.length = 0;
    hoisted.checkOffline.mockResolvedValue(false);
    hoisted.isOfflineFn.mockReturnValue(false);
    hoisted.executeMutationImpl.mockReset();
    hoisted.executeMutationImpl.mockImplementation(async () => ({ ok: true }));
    vi.mocked(feedback.error).mockClear();
    mutationQueue.clear();
  });

  it('subscribe invokes callback with pending count and on add', () => {
    const cb = vi.fn();
    const unsub = mutationQueue.subscribe(cb);
    expect(cb).toHaveBeenCalled();
    const n = cb.mock.calls.length;
    mutationQueue.add({
      mutationKey: ['vouchers', 'create'],
      mutationFn: () => Promise.resolve(),
      variables: {},
    });
    expect(cb.mock.calls.length).toBeGreaterThan(n);
    expect(cb.mock.calls.some((c) => c[0].pendingCount >= 1)).toBe(true);
    unsub();
  });

  it('processQueue returns empty when queue is empty', async () => {
    const result = await mutationQueue.processQueue({ force: true });
    expect(result.stoppedReason).toBe('empty');
    expect(result.syncedCount).toBe(0);
  });

  it('processQueue skips when offline (checkOfflineStatus true)', async () => {
    hoisted.checkOffline.mockResolvedValue(true);
    mutationQueue.add({
      mutationKey: ['categories', 'create'],
      mutationFn: () => Promise.resolve(),
      variables: {},
    });
    const result = await mutationQueue.processQueue({ force: false });
    expect(result.stoppedReason).toBe('offline');
    expect(result.syncedCount).toBe(0);
  });

  it('processQueue runs mutations in dependency order', async () => {
    const order: string[] = [];
    hoisted.executeMutationImpl.mockImplementation(async (key: string[]) => {
      order.push(`${key[0]}/${key[1]}`);
      return { ok: true };
    });
    mutationQueue.add({
      mutationKey: ['transactions', 'create'],
      mutationFn: () => hoisted.executeMutationImpl(['transactions', 'create'], {}),
      variables: {},
    });
    mutationQueue.add({
      mutationKey: ['categories', 'create'],
      mutationFn: () => hoisted.executeMutationImpl(['categories', 'create'], {}),
      variables: {},
    });
    mutationQueue.add({
      mutationKey: ['customers', 'create'],
      mutationFn: () => hoisted.executeMutationImpl(['customers', 'create'], {}),
      variables: {},
    });
    mutationQueue.add({
      mutationKey: ['products', 'create'],
      mutationFn: () => hoisted.executeMutationImpl(['products', 'create'], {}),
      variables: {},
    });
    await mutationQueue.processQueue({ force: true });
    expect(order).toEqual(['categories/create', 'products/create', 'customers/create', 'transactions/create']);
  });

  it('processQueue pauses on network error and keeps mutation on queue', async () => {
    hoisted.executeMutationImpl.mockRejectedValueOnce(new Error('Network Error'));
    mutationQueue.add({
      mutationKey: ['categories', 'create'],
      mutationFn: () => hoisted.executeMutationImpl(['categories', 'create'], {}),
      variables: {},
    });
    const result = await mutationQueue.processQueue({ force: true });
    expect(result.stoppedReason).toBe('network_pause');
    expect(mutationQueue.getPendingCount()).toBe(1);
  });

  it('processQueue removes mutation after MAX_RETRIES and calls feedback.error', async () => {
    vi.useFakeTimers();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      hoisted.executeMutationImpl.mockRejectedValue(new Error('Server says no'));
      mutationQueue.add({
        mutationKey: ['categories', 'create'],
        mutationFn: () => hoisted.executeMutationImpl(['categories', 'create'], {}),
        variables: {},
      });
      const done = mutationQueue.processQueue({ force: true });
      await vi.runAllTimersAsync();
      await done;
      expect(mutationQueue.getPendingCount()).toBe(0);
      expect(feedback.error).toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
      vi.useRealTimers();
    }
  });
});
