import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PersistedClient } from "@tanstack/query-persist-client-core";
import { createIDBPersister } from "@/lib/query-persister";
import { getDb, resetDbInstanceForTests } from "@/lib/db";

const QUERY_CACHE_KEY = "REACT_QUERY_OFFLINE_CACHE";
const LARGE_TEXT = "x".repeat(120_000);

function makePersistedClient(queries: unknown[]): PersistedClient {
  return {
    timestamp: Date.now(),
    buster: "test",
    clientState: {
      mutations: [],
      queries,
    },
  } as unknown as PersistedClient;
}

function makeQuery(
  root: string,
  data: unknown,
  dataUpdatedAt: number
): unknown {
  return {
    queryKey: [root, "list"],
    queryHash: `${root}-${dataUpdatedAt}`,
    state: {
      data,
      dataUpdatedAt,
      status: "success",
      dataUpdateCount: 1,
      error: null,
      errorUpdateCount: 0,
      errorUpdatedAt: 0,
      fetchFailureCount: 0,
      fetchFailureReason: null,
      fetchMeta: null,
      isInvalidated: false,
      fetchStatus: "idle",
    },
  };
}

describe("query-persister", () => {
  beforeEach(async () => {
    vi.stubGlobal("window", {});
    await resetDbInstanceForTests();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await resetDbInstanceForTests();
  });

  it("persists cache when payload is under size limit", async () => {
    const persister = createIDBPersister();
    const persistedClient = makePersistedClient([
      makeQuery(
        "customers",
        { data: [{ id: "c-1", name: "Alice" }] },
        Date.now()
      ),
    ]);

    await persister.persistClient(persistedClient);

    const record = await getDb().keyVal.get(QUERY_CACHE_KEY);
    expect(record?.value).toBeTruthy();
  });

  it("drops non-protected queries when oversized and keeps protected roots", async () => {
    const persister = createIDBPersister();
    const persistedClient = makePersistedClient([
      makeQuery(
        "transactions",
        {
          data: Array.from({ length: 220 }, (_, i) => ({
            id: `tx-${i}`,
            payload: LARGE_TEXT,
          })),
        },
        1
      ),
      makeQuery(
        "customers",
        {
          data: [{ id: "cust-1", name: "Primary Customer" }],
        },
        2
      ),
    ]);

    await persister.persistClient(persistedClient);

    const record = await getDb().keyVal.get(QUERY_CACHE_KEY);
    expect(record?.value).toBeTruthy();
    const sizeInBytes = new Blob([record!.value]).size;
    expect(sizeInBytes).toBeLessThanOrEqual(5 * 1024 * 1024);

    const restored = JSON.parse(record!.value) as PersistedClient;
    const roots = restored.clientState.queries.map(
      (query: any) => query.queryKey?.[0]
    );
    expect(roots).toContain("customers");
    expect(roots).not.toContain("transactions");
  });

  it("skips persist when only protected queries remain and payload is still oversized", async () => {
    const persister = createIDBPersister();
    const persistedClient = makePersistedClient([
      makeQuery(
        "customers",
        {
          data: Array.from({ length: 80 }, (_, i) => ({
            id: `cust-${i}`,
            payload: LARGE_TEXT,
          })),
        },
        1
      ),
    ]);

    await persister.persistClient(persistedClient);

    const record = await getDb().keyVal.get(QUERY_CACHE_KEY);
    expect(record).toBeUndefined();
  });
});
