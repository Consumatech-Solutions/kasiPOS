import React from "react";
import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterEach,
} from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCategories, useProducts } from "@/hooks/use-catalogue";
import { resetDbInstanceForTests } from "@/lib/db";
import * as entityCache from "@/lib/entity-cache";
import type { ApiCategory, ApiProduct } from "@/types/catalogue";
import type { PaginationMeta } from "@/types/pagination";

const checkOffline = vi.fn();
const categoriesGetAll = vi.fn();
const categoriesCreate = vi.fn();
const categoriesUpdate = vi.fn();
const categoriesDelete = vi.fn();
const productsGetAll = vi.fn();

vi.mock("@/lib/offline-detector", () => ({
  offlineDetector: {
    subscribe: vi.fn(() => () => {}),
    setOfflineFirstActive: vi.fn(),
    getOfflineFirstActive: vi.fn(() => false),
    forceCheck: vi.fn(() => Promise.resolve(false)),
  },
  isOffline: vi.fn(() => false),
  checkOfflineStatus: (...args: unknown[]) => checkOffline(...args),
}));

vi.mock("@/lib/api/catalogue", () => ({
  catalogueApi: {
    categories: {
      getAll: (...args: unknown[]) => categoriesGetAll(...args),
      create: (...args: unknown[]) => categoriesCreate(...args),
      update: (...args: unknown[]) => categoriesUpdate(...args),
      delete: (...args: unknown[]) => categoriesDelete(...args),
    },
    products: {
      getAll: (...args: unknown[]) => productsGetAll(...args),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/catalogue-network-hydrate", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/catalogue-network-hydrate")>();
  return {
    ...actual,
    pullAllProductsFromApi: vi.fn().mockResolvedValue(0),
    pullAllCategoriesFromApi: vi.fn().mockResolvedValue(0),
  };
});

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children);
  };
}

const catRow = {
  id: "c-existing",
  name: "Existing",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

let realGetCategoriesFromDexie: typeof entityCache.getCategoriesFromDexie;
let realGetProductsFromDexie: typeof entityCache.getProductsFromDexie;

beforeAll(async () => {
  const mod = await vi.importActual<typeof entityCache>("@/lib/entity-cache");
  realGetCategoriesFromDexie = mod.getCategoriesFromDexie.bind(mod);
  realGetProductsFromDexie = mod.getProductsFromDexie.bind(mod);
});

describe("useCategories", () => {
  beforeEach(async () => {
    await resetDbInstanceForTests();
    checkOffline.mockReset();
    categoriesGetAll.mockReset();
    categoriesCreate.mockReset();
    categoriesUpdate.mockReset();
    categoriesDelete.mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(entityCache, "getCategoriesFromDexie").mockImplementation(
      async (page, limit, storeIdForOffline) => {
        const offline = await checkOffline();
        if (offline) {
          return realGetCategoriesFromDexie(page, limit, storeIdForOffline);
        }
        const res = await categoriesGetAll({
          page,
          limit,
          ...(storeIdForOffline ? { storeId: storeIdForOffline } : {}),
        });
        const data = Array.isArray(res)
          ? res
          : ((res as { data?: ApiCategory[] }).data ?? []);
        const meta: PaginationMeta = Array.isArray(res)
          ? {
              total: data.length,
              page,
              limit,
              totalPages: Math.max(1, Math.ceil(data.length / limit) || 1),
            }
          : (res as { meta: PaginationMeta }).meta;
        if (data.length && storeIdForOffline) {
          await entityCache.saveCategoriesToDexie(data, storeIdForOffline);
        }
        return { data, meta };
      }
    );
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await resetDbInstanceForTests();
  });

  it("loads from Dexie when offline", async () => {
    checkOffline.mockResolvedValue(true);
    await entityCache.saveCategoriesToDexie([catRow], "s1");
    const { result } = renderHook(
      () => useCategories(1, 10, { storeIdForOffline: "s1" }),
      {
        wrapper: createWrapper(),
      }
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.categories).toHaveLength(1);
    expect(result.current.categories[0].name).toBe("Existing");
  });

  it("loads from API when online and persists categories to Dexie", async () => {
    checkOffline.mockResolvedValue(false);
    categoriesGetAll.mockResolvedValue({
      data: [
        {
          id: "cat-api",
          name: "From API",
          createdAt: "2024-03-01T00:00:00.000Z",
          updatedAt: "2024-03-01T00:00:00.000Z",
        },
      ],
      meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
    });
    const { result } = renderHook(
      () => useCategories(1, 10, { storeIdForOffline: "s1" }),
      {
        wrapper: createWrapper(),
      }
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.categories).toHaveLength(1);
    expect(result.current.categories[0].name).toBe("From API");
    const { getDb } = await import("@/lib/db");
    expect((await getDb().categoryCache.get("cat-api"))?.name).toBe("From API");
    getDb().close();
  });

  it("applies optimistic create while category sync is queued", async () => {
    checkOffline.mockResolvedValue(false);
    categoriesGetAll.mockResolvedValue({
      data: [catRow],
      meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
    });
    categoriesCreate.mockRejectedValue(new Error("network"));
    const { result } = renderHook(
      () => useCategories(1, 10, { storeIdForOffline: "s1" }),
      {
        wrapper: createWrapper(),
      }
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.categories).toHaveLength(1);
    await act(async () => {
      await result.current.createCategory({ name: "NewCat" });
    });
    expect(result.current.categories).toHaveLength(2);
    expect(result.current.categories.some((c) => c.name === "NewCat")).toBe(
      true
    );
  });

  it("shows optimistic category row after create (queued sync)", async () => {
    checkOffline.mockResolvedValue(false);
    categoriesGetAll.mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, limit: 10, totalPages: 1 },
    });
    categoriesCreate.mockResolvedValue({
      id: "srv-cat",
      name: "Server",
      createdAt: "2024-02-01T00:00:00.000Z",
      updatedAt: "2024-02-01T00:00:00.000Z",
    });
    const { result } = renderHook(
      () => useCategories(1, 10, { storeIdForOffline: "s1" }),
      {
        wrapper: createWrapper(),
      }
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.createCategory({ name: "Server" });
    });
    expect(
      result.current.categories.some(
        (c) => c.name === "Server" && String(c.id ?? "").startsWith("temp-")
      )
    ).toBe(true);
  });
});

const prodRow: ApiProduct = {
  id: "prod-1",
  name: "Widget",
  categoryId: "cat-1",
  price: 10,
  costPrice: 5,
  stock: 3,
  barCode: null,
  productImage: null,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

describe("useProducts", () => {
  beforeEach(async () => {
    await resetDbInstanceForTests();
    checkOffline.mockReset();
    productsGetAll.mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(entityCache, "getProductsFromDexie").mockImplementation(
      async (page, limit, storeIdForOffline, filters) => {
        const offline = await checkOffline();
        if (offline) {
          return realGetProductsFromDexie(
            page,
            limit,
            storeIdForOffline,
            filters
          );
        }
        const res = await productsGetAll({
          page,
          limit,
          ...(storeIdForOffline ? { storeId: storeIdForOffline } : {}),
          ...filters,
        });
        const data = Array.isArray(res)
          ? res
          : ((res as { data?: ApiProduct[] }).data ?? []);
        const meta: PaginationMeta = Array.isArray(res)
          ? {
              total: data.length,
              page,
              limit,
              totalPages: Math.max(1, Math.ceil(data.length / limit) || 1),
            }
          : (res as { meta: PaginationMeta }).meta;
        if (data.length && storeIdForOffline) {
          await entityCache.saveProductsToDexie(data, storeIdForOffline);
        }
        return { data, meta };
      }
    );
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await resetDbInstanceForTests();
  });

  it("loads from Dexie when offline", async () => {
    checkOffline.mockResolvedValue(true);
    await entityCache.saveProductsToDexie([prodRow], "s1");
    const { result } = renderHook(
      () => useProducts(1, 10, { storeIdForOffline: "s1" }),
      {
        wrapper: createWrapper(),
      }
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.products).toHaveLength(1);
    expect(result.current.products[0].name).toBe("Widget");
  });

  it("loads from API when online and persists products to Dexie", async () => {
    checkOffline.mockResolvedValue(false);
    productsGetAll.mockResolvedValue({
      data: [prodRow],
      meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
    });
    const { result } = renderHook(
      () => useProducts(1, 10, { storeIdForOffline: "s1" }),
      {
        wrapper: createWrapper(),
      }
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.products).toHaveLength(1);
    const { getDb } = await import("@/lib/db");
    expect((await getDb().productCache.get("prod-1"))?.name).toBe("Widget");
    getDb().close();
  });
});
