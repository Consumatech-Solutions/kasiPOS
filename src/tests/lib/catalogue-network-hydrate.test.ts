import { beforeEach, describe, expect, it, vi } from "vitest";

const productsGetAll = vi.fn();
const categoriesGetAll = vi.fn();
const customersGetAll = vi.fn();
const saveProductsToDexie = vi.fn();
const saveCategoriesToDexie = vi.fn();
const saveCustomersToDexie = vi.fn();

vi.mock("@/lib/api/catalogue", () => ({
  catalogueApi: {
    products: { getAll: (...args: unknown[]) => productsGetAll(...args) },
    categories: { getAll: (...args: unknown[]) => categoriesGetAll(...args) },
  },
}));

vi.mock("@/lib/api/customers", () => ({
  customersApi: {
    getAll: (...args: unknown[]) => customersGetAll(...args),
  },
}));

vi.mock("@/lib/entity-cache", () => ({
  saveProductsToDexie: (...args: unknown[]) => saveProductsToDexie(...args),
  saveCategoriesToDexie: (...args: unknown[]) => saveCategoriesToDexie(...args),
  saveCustomersToDexie: (...args: unknown[]) => saveCustomersToDexie(...args),
}));

describe("catalogue-network-hydrate pagination", () => {
  beforeEach(() => {
    productsGetAll.mockReset();
    categoriesGetAll.mockReset();
    customersGetAll.mockReset();
    saveProductsToDexie.mockReset();
    saveCategoriesToDexie.mockReset();
    saveCustomersToDexie.mockReset();
  });

  it("pullAllProductsFromApi fetches all pages with updatedAtAfter", async () => {
    const { pullAllProductsFromApi } =
      await import("@/lib/catalogue-network-hydrate");

    productsGetAll
      .mockResolvedValueOnce({
        data: [{ id: "p1" }, { id: "p2" }],
        meta: { page: 1, limit: 2, total: 4, totalPages: 2 },
      })
      .mockResolvedValueOnce({
        data: [{ id: "p3" }, { id: "p4" }],
        meta: { page: 2, limit: 2, total: 4, totalPages: 2 },
      });

    const saved = await pullAllProductsFromApi("store-1", {
      updatedAtAfter: "2025-01-01T00:00:00.000Z",
      storeIdQueryParam: true,
    });

    expect(saved).toBe(4);
    expect(productsGetAll).toHaveBeenCalledTimes(2);
    expect(productsGetAll).toHaveBeenNthCalledWith(1, {
      page: 1,
      limit: 100,
      updatedAtAfter: "2025-01-01T00:00:00.000Z",
      storeId: "store-1",
    });
    expect(productsGetAll).toHaveBeenNthCalledWith(2, {
      page: 2,
      limit: 100,
      updatedAtAfter: "2025-01-01T00:00:00.000Z",
      storeId: "store-1",
    });
    expect(saveProductsToDexie).toHaveBeenCalledTimes(2);
  });

  it("pullAllCategoriesFromApi fetches all pages", async () => {
    const { pullAllCategoriesFromApi } =
      await import("@/lib/catalogue-network-hydrate");

    categoriesGetAll
      .mockResolvedValueOnce({
        data: [{ id: "c1" }],
        meta: { page: 1, limit: 1, total: 2, totalPages: 2 },
      })
      .mockResolvedValueOnce({
        data: [{ id: "c2" }],
        meta: { page: 2, limit: 1, total: 2, totalPages: 2 },
      });

    const saved = await pullAllCategoriesFromApi("store-1", {
      storeIdQueryParam: true,
    });

    expect(saved).toBe(2);
    expect(categoriesGetAll).toHaveBeenCalledTimes(2);
    expect(saveCategoriesToDexie).toHaveBeenCalledTimes(2);
  });

  it("pullAllCustomersFromApi fetches all pages and saves each page", async () => {
    const { pullAllCustomersFromApi } =
      await import("@/lib/catalogue-network-hydrate");

    customersGetAll
      .mockResolvedValueOnce({
        data: {
          data: [{ id: "u1" }],
          meta: { page: 1, limit: 1, total: 2, totalPages: 2 },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [{ id: "u2" }],
          meta: { page: 2, limit: 1, total: 2, totalPages: 2 },
        },
      });

    const saved = await pullAllCustomersFromApi({
      storeId: "store-1",
      updatedAtAfter: "2025-01-01T00:00:00.000Z",
    });

    expect(saved).toBe(2);
    expect(customersGetAll).toHaveBeenCalledTimes(2);
    expect(customersGetAll).toHaveBeenNthCalledWith(1, {
      page: 1,
      limit: 50,
      updatedAtAfter: "2025-01-01T00:00:00.000Z",
      storeId: "store-1",
    });
    expect(saveCustomersToDexie).toHaveBeenCalledTimes(2);
  });
});
