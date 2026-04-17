import { describe, it, expect, vi, beforeEach } from "vitest";

type MqRow = {
  id?: number;
  mutationKey: string;
  variables: unknown;
  timestamp: number;
  retries: number;
  status?: string;
  idempotencyKey?: string;
};

const hoisted = vi.hoisted(() => ({
  offlineFirst: true,
  executeMutationImpl: vi.fn(async (_key: string[], _variables: unknown) => ({
    ok: true,
  })),
  checkOffline: vi.fn(() => Promise.resolve(false)),
  isOfflineFn: vi.fn(() => false),
  mqRows: [] as MqRow[],
}));

function persistedMqRecords(): Array<MqRow & { id: number }> {
  return hoisted.mqRows.map((r, i) => ({
    ...r,
    id: i + 1,
  }));
}

function mutationQueueTableToArray(): Promise<Array<MqRow & { id: number }>> {
  return Promise.resolve(persistedMqRecords());
}

function createMockMutationQueueTable() {
  return {
    orderBy() {
      return {
        toArray: mutationQueueTableToArray,
      };
    },
    clear: async () => {
      hoisted.mqRows.length = 0;
    },
    bulkAdd: async (rows: MqRow[]) => {
      for (const r of rows) {
        hoisted.mqRows.push(r);
      }
    },
  };
}

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    mutationQueue: createMockMutationQueueTable(),
  }),
}));

vi.mock("@/lib/mutation-registry", () => ({
  executeMutation: (key: string[], variables: unknown) =>
    hoisted.executeMutationImpl(key, variables),
}));

function setOfflineFirst(v: boolean) {
  hoisted.offlineFirst = v;
}

function getOfflineFirst() {
  return hoisted.offlineFirst;
}

function noopUnsubscribe() {
  return () => {};
}

vi.mock("@/lib/offline-detector", () => ({
  offlineDetector: {
    setOfflineFirstActive: setOfflineFirst,
    getOfflineFirstActive: getOfflineFirst,
    forceCheck: () => Promise.resolve(true),
    subscribe: noopUnsubscribe,
  },
  isOffline: () => hoisted.isOfflineFn(),
  checkOfflineStatus: () => hoisted.checkOffline(),
}));

vi.mock("@/lib/feedback", () => ({
  feedback: { error: vi.fn() },
  genLogId: () => "test-log",
}));

import { feedback } from "@/lib/feedback";
import { mutationQueue } from "@/lib/mutation-queue";

function addQueuedMutation(mutationKey: string[]) {
  mutationQueue.add({
    mutationKey,
    mutationFn: () => hoisted.executeMutationImpl(mutationKey, {}),
    variables: {},
  });
}

async function runMaxRetriesFailureTest() {
  hoisted.executeMutationImpl.mockRejectedValue(new Error("Server says no"));
  addQueuedMutation(["categories", "create"]);
  const done = mutationQueue.processQueue({ force: true });
  await vi.runAllTimersAsync();
  await done;
  expect(mutationQueue.getPendingCount()).toBe(0);
  expect(feedback.error).toHaveBeenCalled();
}

describe("mutationQueue", () => {
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

  it("subscribe invokes callback with pending count and on add", () => {
    const cb = vi.fn();
    const unsub = mutationQueue.subscribe(cb);
    expect(cb).toHaveBeenCalled();
    const n = cb.mock.calls.length;
    mutationQueue.add({
      mutationKey: ["vouchers", "create"],
      mutationFn: () => Promise.resolve(),
      variables: {},
    });
    expect(cb.mock.calls.length).toBeGreaterThan(n);
    expect(cb.mock.calls.some((c) => c[0].pendingCount >= 1)).toBe(true);
    unsub();
  });

  it("processQueue returns empty when queue is empty", async () => {
    const result = await mutationQueue.processQueue({ force: true });
    expect(result.stoppedReason).toBe("empty");
    expect(result.syncedCount).toBe(0);
  });

  it("processQueue skips when offline (checkOfflineStatus true)", async () => {
    hoisted.checkOffline.mockResolvedValue(true);
    mutationQueue.add({
      mutationKey: ["categories", "create"],
      mutationFn: () => Promise.resolve(),
      variables: {},
    });
    const result = await mutationQueue.processQueue({ force: false });
    expect(result.stoppedReason).toBe("offline");
    expect(result.syncedCount).toBe(0);
  });

  it("dedupes identical mutationKey + variables (e.g. double queue add)", () => {
    const vars = { name: "Widgets", _tempId: "temp-1" };
    mutationQueue.add({
      mutationKey: ["categories", "create"],
      mutationFn: () => Promise.resolve(),
      variables: vars,
    });
    mutationQueue.add({
      mutationKey: ["categories", "create"],
      mutationFn: () => Promise.resolve(),
      variables: { ...vars },
    });
    expect(mutationQueue.getPendingCount()).toBe(1);
  });

  it("treats same category payload as duplicate regardless of object key order", () => {
    mutationQueue.add({
      mutationKey: ["categories", "create"],
      mutationFn: () => Promise.resolve(),
      variables: { b: 1, a: 2 },
    });
    mutationQueue.add({
      mutationKey: ["categories", "create"],
      mutationFn: () => Promise.resolve(),
      variables: { a: 2, b: 1 },
    });
    expect(mutationQueue.getPendingCount()).toBe(1);
  });

  it("allows two queued mutations when variables differ", () => {
    mutationQueue.add({
      mutationKey: ["categories", "create"],
      mutationFn: () => Promise.resolve(),
      variables: { name: "A" },
    });
    mutationQueue.add({
      mutationKey: ["categories", "create"],
      mutationFn: () => Promise.resolve(),
      variables: { name: "B" },
    });
    expect(mutationQueue.getPendingCount()).toBe(2);
  });

  it("dedupes transactions/create when idempotencyKey matches an item already in queue", () => {
    const idem = "550e8400-e29b-41d4-a716-446655440000";
    const base = {
      mutationKey: ["transactions", "create"] as string[],
      mutationFn: () => Promise.resolve(),
      variables: {
        idempotencyKey: idem,
        storeId: "s",
        items: [],
        total: 1,
        paymentMethod: "Cash" as const,
      },
    };
    mutationQueue.add(base);
    mutationQueue.add(base);
    expect(mutationQueue.getPendingCount()).toBe(1);
  });

  it("processQueue runs mutations in dependency order", async () => {
    const order: string[] = [];
    hoisted.executeMutationImpl.mockImplementation(async (key: string[]) => {
      order.push(`${key[0]}/${key[1]}`);
      return { ok: true };
    });
    addQueuedMutation(["transactions", "create"]);
    addQueuedMutation(["categories", "create"]);
    addQueuedMutation(["customers", "create"]);
    addQueuedMutation(["products", "create"]);
    await mutationQueue.processQueue({ force: true });
    expect(order).toEqual([
      "categories/create",
      "products/create",
      "customers/create",
      "transactions/create",
    ]);
  });

  it("processQueue pauses on network error and keeps mutation on queue", async () => {
    hoisted.executeMutationImpl.mockRejectedValueOnce(
      new Error("Network Error"),
    );
    addQueuedMutation(["categories", "create"]);
    const result = await mutationQueue.processQueue({ force: true });
    expect(result.stoppedReason).toBe("network_pause");
    expect(mutationQueue.getPendingCount()).toBe(1);
  });

  it("processQueue removes mutation after MAX_RETRIES and calls feedback.error", async () => {
    vi.useFakeTimers();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await runMaxRetriesFailureTest();
    } finally {
      errorSpy.mockRestore();
      vi.useRealTimers();
    }
  });
});
