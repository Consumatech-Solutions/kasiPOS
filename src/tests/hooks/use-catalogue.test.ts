import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCategories, useProducts } from "@/hooks/use-catalogue";
import { resetDbInstanceForTests } from "@/lib/db";
import { saveCategoriesToDexie, saveProductsToDexie } from "@/lib/entity-cache";
import type { ApiProduct } from "@/types/catalogue";

const checkOffline = vi.fn();
const categoriesGetAll = vi.fn();
const categoriesCreate = vi.fn();
const categoriesUpdate = vi.fn();
const categoriesDelete = vi.fn();
const productsGetAll = vi.fn();

vi.mock("@/lib/offline-detector", () => ({
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

describe("useCategories", () => {
  beforeEach(async () => {
    await resetDbInstanceForTests();
    checkOffline.mockReset();
    categoriesGetAll.mockReset();
    categoriesCreate.mockReset();
    categoriesUpdate.mockReset();
    categoriesDelete.mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await resetDbInstanceForTests();
  });

  it("loads from Dexie when offline", async () => {
    checkOffline.mockResolvedValue(true);
    await saveCategoriesToDexie([catRow], "s1");
    const { result } = renderHook(
      () => useCategories(1, 10, { storeIdForOffline: "s1" }),
      {
        wrapper: createWrapper(),
      },
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
      },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.categories).toHaveLength(1);
    expect(result.current.categories[0].name).toBe("From API");
    const { getDb } = await import("@/lib/db");
    expect((await getDb().categoryCache.get("cat-api"))?.name).toBe("From API");
    getDb().close();
  });

  it("rolls back optimistic create when API fails", async () => {
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
      },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.categories).toHaveLength(1);
    await expect(
      result.current.createCategory({ name: "NewCat" }),
    ).rejects.toThrow("network");
    await waitFor(() => expect(result.current.categories).toHaveLength(1));
    expect(result.current.categories[0].name).toBe("Existing");
  });

  it("replaces optimistic row after successful create", async () => {
    checkOffline.mockResolvedValue(false);
    const serverCat = {
      id: "srv-cat",
      name: "Server",
      createdAt: "2024-02-01T00:00:00.000Z",
      updatedAt: "2024-02-01T00:00:00.000Z",
    };
    const emptyMeta = { total: 0, page: 1, limit: 10, totalPages: 1 };
    const filledMeta = { total: 1, page: 1, limit: 10, totalPages: 1 };
    let getAllCall = 0;
    categoriesGetAll.mockImplementation(async () => {
      getAllCall += 1;
      if (getAllCall === 1) {
        return { data: [], meta: emptyMeta };
      }
      return { data: [serverCat], meta: filledMeta };
    });
    categoriesCreate.mockResolvedValue(serverCat);
    const { result } = renderHook(
      () => useCategories(1, 10, { storeIdForOffline: "s1" }),
      {
        wrapper: createWrapper(),
      },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.createCategory({ name: "Server" });
    });
    await waitFor(() =>
      expect(result.current.categories.some((c) => c.id === "srv-cat")).toBe(
        true,
      ),
    );
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
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await resetDbInstanceForTests();
  });

  it("loads from Dexie when offline", async () => {
    checkOffline.mockResolvedValue(true);
    await saveProductsToDexie([prodRow], "s1");
    const { result } = renderHook(
      () => useProducts(1, 10, { storeIdForOffline: "s1" }),
      {
        wrapper: createWrapper(),
      },
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
      },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.products).toHaveLength(1);
    const { getDb } = await import("@/lib/db");
    expect((await getDb().productCache.get("prod-1"))?.name).toBe("Widget");
    getDb().close();
  });
});
