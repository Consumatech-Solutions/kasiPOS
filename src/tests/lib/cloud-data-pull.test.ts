import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";

const getLastSyncAt = vi.fn();
const setLastSyncAt = vi.fn();
const getProductsFromDexie = vi.fn();
const getCategoriesFromDexie = vi.fn();
const getCustomersFromDexie = vi.fn();
const purgeTempIdCatalogueRowsAfterCloudSync = vi.fn();
const pullAllProductsFromApi = vi.fn();
const pullAllCategoriesFromApi = vi.fn();
const pullAllCustomersFromApi = vi.fn();
const vouchersGetAll = vi.fn();

vi.mock("@/lib/entity-cache", () => ({
  getLastSyncAt: (...args: unknown[]) => getLastSyncAt(...args),
  setLastSyncAt: (...args: unknown[]) => setLastSyncAt(...args),
  getProductsFromDexie: (...args: unknown[]) => getProductsFromDexie(...args),
  getCategoriesFromDexie: (...args: unknown[]) =>
    getCategoriesFromDexie(...args),
  getCustomersFromDexie: (...args: unknown[]) => getCustomersFromDexie(...args),
  purgeTempIdCatalogueRowsAfterCloudSync: (...args: unknown[]) =>
    purgeTempIdCatalogueRowsAfterCloudSync(...args),
}));

vi.mock("@/lib/catalogue-network-hydrate", () => ({
  pullAllProductsFromApi: (...args: unknown[]) =>
    pullAllProductsFromApi(...args),
  pullAllCategoriesFromApi: (...args: unknown[]) =>
    pullAllCategoriesFromApi(...args),
  pullAllCustomersFromApi: (...args: unknown[]) =>
    pullAllCustomersFromApi(...args),
}));

vi.mock("@/lib/api/vouchers", () => ({
  vouchersApi: {
    getAll: (...args: unknown[]) => vouchersGetAll(...args),
  },
}));

vi.mock("@/lib/mutation-queue", () => ({
  mutationQueue: { processQueue: vi.fn() },
}));

vi.mock("@/lib/offline-detector", () => ({
  offlineDetector: { forceCheck: vi.fn(), setOfflineFirstActive: vi.fn() },
}));

describe("runCloudDataPull", () => {
  beforeEach(() => {
    getLastSyncAt.mockReset();
    setLastSyncAt.mockReset();
    getProductsFromDexie.mockReset();
    getCategoriesFromDexie.mockReset();
    getCustomersFromDexie.mockReset();
    purgeTempIdCatalogueRowsAfterCloudSync.mockReset();
    pullAllProductsFromApi.mockReset();
    pullAllCategoriesFromApi.mockReset();
    pullAllCustomersFromApi.mockReset();
    vouchersGetAll.mockReset();

    getLastSyncAt
      .mockResolvedValueOnce("2025-01-01T00:00:00.000Z")
      .mockResolvedValueOnce("2025-01-02T00:00:00.000Z")
      .mockResolvedValueOnce("2025-01-03T00:00:00.000Z");
    getProductsFromDexie.mockResolvedValue({
      data: [{ id: "p1" }],
      meta: { total: 1, page: 1, limit: 100, totalPages: 1 },
    });
    getCategoriesFromDexie.mockResolvedValue({
      data: [{ id: "c1" }],
      meta: { total: 1, page: 1, limit: 50, totalPages: 1 },
    });
    getCustomersFromDexie.mockResolvedValue({
      data: [{ id: "u1" }],
      meta: { total: 1, page: 1, limit: 50, totalPages: 1 },
    });
    purgeTempIdCatalogueRowsAfterCloudSync.mockResolvedValue({
      productsRemoved: 0,
      categoriesRemoved: 0,
      customersRemoved: 0,
    });
    pullAllProductsFromApi.mockResolvedValue(1);
    pullAllCategoriesFromApi.mockResolvedValue(1);
    pullAllCustomersFromApi.mockResolvedValue(1);
    vouchersGetAll.mockResolvedValue({
      data: {
        data: [],
        meta: { total: 0, page: 1, limit: 50, totalPages: 1 },
      },
    });
  });

  it("passes updatedAtAfter to paginated helpers and updates lastSyncAt after pull", async () => {
    const { runCloudDataPull } = await import("@/lib/cloud-data-pull");
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    await runCloudDataPull({ queryClient, storeId: "store-1" });

    expect(pullAllProductsFromApi).toHaveBeenCalledWith("store-1", {
      storeIdQueryParam: true,
      updatedAtAfter: "2025-01-01T00:00:00.000Z",
    });
    expect(pullAllCategoriesFromApi).toHaveBeenCalledWith("store-1", {
      storeIdQueryParam: true,
      updatedAtAfter: "2025-01-02T00:00:00.000Z",
    });
    expect(pullAllCustomersFromApi).toHaveBeenCalledWith({
      storeId: "store-1",
      updatedAtAfter: "2025-01-03T00:00:00.000Z",
    });
    expect(setLastSyncAt).toHaveBeenCalledWith("products", expect.any(String));
    expect(setLastSyncAt).toHaveBeenCalledWith(
      "categories",
      expect.any(String)
    );
    expect(setLastSyncAt).toHaveBeenCalledWith("customers", expect.any(String));
  });
});
