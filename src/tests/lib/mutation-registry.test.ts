import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  transactionsCreate: vi.fn(async (..._args: unknown[]) => ({ id: "tx" })),
  productsCreate: vi.fn(async (..._args: unknown[]) => ({ id: "srv-p1" })),
  productsUpdate: vi.fn(async (..._args: unknown[]) => ({})),
  productsDelete: vi.fn(async (..._args: unknown[]) => ({})),
  categoriesCreate: vi.fn(async (..._args: unknown[]) => ({
    id: "cat1",
    name: "C",
  })),
  categoriesUpdate: vi.fn(async (..._args: unknown[]) => ({})),
  categoriesDelete: vi.fn(async (..._args: unknown[]) => ({})),
  customersCreate: vi.fn(async (..._args: unknown[]) => ({
    data: { id: "cust-srv" },
  })),
  customersUpdate: vi.fn(async (..._args: unknown[]) => ({})),
  customersDelete: vi.fn(async (..._args: unknown[]) => ({})),
  stockCreate: vi.fn(async (..._args: unknown[]) => ({})),
  poCreate: vi.fn(async (..._args: unknown[]) => ({})),
  poUpdateStatus: vi.fn(async (..._args: unknown[]) => ({})),
  vouchersCreate: vi.fn(async (..._args: unknown[]) => ({})),
  vouchersUpdate: vi.fn(async (..._args: unknown[]) => ({})),
  vouchersDelete: vi.fn(async (..._args: unknown[]) => ({})),
  categoriesGetAll: vi.fn(async (..._args: unknown[]) => [
    { id: "resolved-cat", name: "Beverages" },
  ]),
  parcelsCreate: vi.fn(async (..._args: unknown[]) => ({})),
  usersCreate: vi.fn(async (..._args: unknown[]) => ({})),
  usersUpdate: vi.fn(async (..._args: unknown[]) => ({})),
  usersRemove: vi.fn(async (..._args: unknown[]) => ({})),
  settingsPatch: vi.fn(async (..._args: unknown[]) => ({})),
}));

vi.mock("@/lib/api/transactions", () => ({
  transactionsApi: {
    create: (data: unknown, opts?: { idempotencyKey?: string }) =>
      mocks.transactionsCreate(data, opts),
  },
  toCreateTransactionDto: (x: unknown) => x,
}));

vi.mock("@/lib/api/catalogue", () => ({
  catalogueApi: {
    products: {
      create: (data: unknown) => mocks.productsCreate(data),
      update: (id: string, data: unknown) => mocks.productsUpdate(id, data),
      delete: (id: string) => mocks.productsDelete(id),
    },
    categories: {
      getAll: () => mocks.categoriesGetAll(),
      create: (data: unknown) => mocks.categoriesCreate(data),
      update: (id: string, data: unknown) => mocks.categoriesUpdate(id, data),
      delete: (id: string) => mocks.categoriesDelete(id),
    },
  },
}));

vi.mock("@/lib/api/customers", () => ({
  customersApi: {
    create: (data: unknown) => mocks.customersCreate(data),
    update: (id: string, data: unknown) => mocks.customersUpdate(id, data),
    delete: (id: string) => mocks.customersDelete(id),
  },
}));

vi.mock("@/lib/api/stock-adjustments", () => ({
  stockAdjustmentsApi: { create: (data: unknown) => mocks.stockCreate(data) },
}));

vi.mock("@/lib/api/purchase-orders", () => ({
  purchaseOrdersApi: {
    create: (data: unknown) => mocks.poCreate(data),
    updateStatus: (id: string, body: unknown) => mocks.poUpdateStatus(id, body),
  },
}));

vi.mock("@/lib/api/vouchers", () => ({
  vouchersApi: {
    create: (data: unknown) => mocks.vouchersCreate(data),
    update: (id: string, data: unknown) => mocks.vouchersUpdate(id, data),
    delete: (id: string) => mocks.vouchersDelete(id),
  },
}));

vi.mock("@/lib/api/parcels", () => ({
  parcelsApi: { create: (data: unknown) => mocks.parcelsCreate(data) },
}));

vi.mock("@/lib/api/users", () => ({
  usersApi: {
    create: (data: unknown) => mocks.usersCreate(data),
    update: (id: string, data: unknown) => mocks.usersUpdate(id, data),
    remove: (id: string) => mocks.usersRemove(id),
  },
}));

vi.mock("@/lib/api/settings", () => ({
  settingsApi: {
    patch: (body: unknown, storeId?: unknown) =>
      mocks.settingsPatch(body, storeId),
  },
}));

import { getDb, resetDbInstanceForTests } from "@/lib/db";
import { executeMutation } from "@/lib/mutation-registry";

describe("executeMutation", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await resetDbInstanceForTests();
  });

  afterEach(async () => {
    await resetDbInstanceForTests();
  });

  it("transactions/create maps temp ids via syncIdMapping", async () => {
    await getDb().syncIdMapping.put({
      tempId: "temp-p",
      serverId: "real-p",
      createdAt: Date.now(),
    });
    await getDb().syncIdMapping.put({
      tempId: "temp-cust",
      serverId: "real-cust",
      createdAt: Date.now(),
    });
    await executeMutation(["transactions", "create"], {
      storeId: "store-1",
      items: [
        {
          productId: "temp-p",
          productName: "X",
          quantity: 1,
          unitPrice: 5,
          totalPrice: 5,
        },
      ],
      total: 5,
      paymentMethod: "Cash",
      customerId: "temp-cust",
    });
    expect(mocks.transactionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({ productId: "real-p" }),
        ]),
        customerId: "real-cust",
      }),
      expect.objectContaining({ idempotencyKey: undefined })
    );
  });

  it("transactions/create passes idempotencyKey to API", async () => {
    await executeMutation(["transactions", "create"], {
      storeId: "store-1",
      idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
      items: [
        {
          productId: "p1",
          productName: "X",
          quantity: 1,
          unitPrice: 5,
          totalPrice: 5,
        },
      ],
      total: 5,
      paymentMethod: "Cash",
    });
    expect(mocks.transactionsCreate).toHaveBeenCalledWith(expect.anything(), {
      idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
    });
  });

  it("products/create uses categoryId and syncIdMapping for _tempId", async () => {
    await executeMutation(["products", "create"], {
      name: "P",
      price: 1,
      costPrice: 0,
      stock: 1,
      categoryId: "cid-1",
      _tempId: "temp-prod",
    });
    expect(mocks.productsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: "cid-1", _tempId: "temp-prod" })
    );
    expect((await getDb().syncIdMapping.get("temp-prod"))?.serverId).toBe(
      "srv-p1"
    );
  });

  it("products/create resolves category by name when categoryId missing", async () => {
    await executeMutation(["products", "create"], {
      name: "P",
      price: 1,
      costPrice: 0,
      stock: 1,
      category: "Beverages",
    });
    expect(mocks.categoriesGetAll).toHaveBeenCalled();
    expect(mocks.productsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: "resolved-cat" })
    );
  });

  it("products/update resolves category from name when category set without categoryId", async () => {
    await executeMutation(["products", "update"], {
      id: "pid",
      data: {
        name: "N",
        price: 2,
        costPrice: 0,
        stock: 1,
        category: "Beverages",
      },
    });
    expect(mocks.productsUpdate).toHaveBeenCalledWith(
      "pid",
      expect.objectContaining({ categoryId: "resolved-cat" })
    );
  });

  it("products/delete calls API", async () => {
    await executeMutation(["products", "delete"], { id: "x" });
    expect(mocks.productsDelete).toHaveBeenCalledWith("x");
  });

  it("categories CRUD", async () => {
    await executeMutation(["categories", "create"], { name: "N" });
    expect(mocks.categoriesCreate).toHaveBeenCalled();
    await executeMutation(["categories", "update"], {
      id: "1",
      data: { name: "Z" },
    });
    expect(mocks.categoriesUpdate).toHaveBeenCalledWith("1", { name: "Z" });
    await executeMutation(["categories", "delete"], { id: "1" });
    expect(mocks.categoriesDelete).toHaveBeenCalledWith("1");
  });

  it("customers CRUD and syncIdMapping on create", async () => {
    await executeMutation(["customers", "create"], {
      name: "A",
      contact: "c",
      _tempId: "temp-cu",
    });
    expect(mocks.customersCreate).toHaveBeenCalled();
    expect((await getDb().syncIdMapping.get("temp-cu"))?.serverId).toBe(
      "cust-srv"
    );
    await executeMutation(["customers", "update"], {
      id: "1",
      data: { name: "B" },
    });
    expect(mocks.customersUpdate).toHaveBeenCalled();
    await executeMutation(["customers", "delete"], { id: "1" });
    expect(mocks.customersDelete).toHaveBeenCalled();
  });

  it("stockAdjustments/create resolves temp product id", async () => {
    await getDb().syncIdMapping.put({
      tempId: "temp-pr",
      serverId: "real-pr",
      createdAt: Date.now(),
    });
    await executeMutation(["stockAdjustments", "create"], {
      productId: "temp-pr",
      newStock: 5,
      reason: "New stock received",
    });
    expect(mocks.stockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ productId: "real-pr", newStock: 5 })
    );
  });

  it("purchaseOrders create and updateStatus", async () => {
    await executeMutation(["purchaseOrders", "create"], {
      cart: [],
      subtotal: 1,
      total: 1,
      deliveryMethod: "collection",
    });
    expect(mocks.poCreate).toHaveBeenCalledWith(
      expect.objectContaining({ deliveryFee: 0, deliveryMethod: "collection" })
    );
    await executeMutation(["purchaseOrders", "create"], {
      cart: [],
      subtotal: 1,
      total: 1,
      deliveryMethod: "delivery",
    });
    expect(mocks.poCreate).toHaveBeenCalledWith(
      expect.objectContaining({ deliveryFee: 150, deliveryMethod: "delivery" })
    );
    await executeMutation(["purchaseOrders", "updateStatus"], {
      id: "o1",
      status: "completed",
    });
    expect(mocks.poUpdateStatus).toHaveBeenCalledWith("o1", {
      status: "completed",
    });
  });

  it("parcels/create calls API", async () => {
    await executeMutation(["parcels", "create"], {
      storeId: "s",
      deliveryNumber: "D1",
      customerName: "Alice",
    });
    expect(mocks.parcelsCreate).toHaveBeenCalled();
  });

  it("users create, update, delete", async () => {
    await executeMutation(["users", "create"], {
      name: "U",
      email: "u@example.com",
      phone: "+1",
      role: "staff",
      storeId: "s",
    });
    expect(mocks.usersCreate).toHaveBeenCalled();
    await executeMutation(["users", "update"], {
      id: "u1",
      data: { name: "V" },
    });
    expect(mocks.usersUpdate).toHaveBeenCalledWith("u1", { name: "V" });
    await executeMutation(["users", "delete"], { id: "u1" });
    expect(mocks.usersRemove).toHaveBeenCalledWith("u1");
  });

  it("settings/patch calls API", async () => {
    await executeMutation(["settings", "patch"], {
      storeId: "st",
      body: { receiptHeader: "H" },
    });
    expect(mocks.settingsPatch).toHaveBeenCalledWith(
      { receiptHeader: "H" },
      "st"
    );
  });

  it("vouchers CRUD", async () => {
    await executeMutation(["vouchers", "create"], {
      code: "X",
      type: "fixed",
      value: 1,
      minPurchase: 0,
      isActive: true,
    });
    expect(mocks.vouchersCreate).toHaveBeenCalled();
    await executeMutation(["vouchers", "update"], {
      id: "v1",
      data: { isActive: false },
    });
    expect(mocks.vouchersUpdate).toHaveBeenCalled();
    await executeMutation(["vouchers", "delete"], { id: "v1" });
    expect(mocks.vouchersDelete).toHaveBeenCalled();
  });

  it("throws on unknown mutation key", async () => {
    await expect(executeMutation(["unknown", "op"], {})).rejects.toThrow(
      "Unknown mutation"
    );
  });
});
