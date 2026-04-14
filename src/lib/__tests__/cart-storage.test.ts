/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  cartToStorage,
  cartFromStorage,
  saveCartToSessionStorage,
  loadCartFromSessionStorage,
  loadCartFromSessionStorageAsync,
  CART_STORAGE_KEY,
} from "@/lib/cart-storage";
import type { TransactionItem } from "@/types";

const sampleItem: TransactionItem = {
  productId: "p1",
  productName: "Product A",
  quantity: 2,
  unitPrice: 10,
  totalPrice: 20,
};

function makeCart(
  entries: [string, TransactionItem][],
): Map<string, TransactionItem> {
  return new Map(entries);
}

describe("Cart storage (persistence)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("round-trip serialization preserves cart content", () => {
    const cart = makeCart([["p1", sampleItem]]);
    const raw = cartToStorage(cart);
    const restored = cartFromStorage(raw);
    expect(restored.size).toBe(1);
    expect(restored.get("p1")).toBeDefined();
    expect(restored.get("p1")!.productName).toBe(sampleItem.productName);
    expect(restored.get("p1")!.quantity).toBe(sampleItem.quantity);
    expect(restored.get("p1")!.totalPrice).toBe(sampleItem.totalPrice);
  });

  it("empty cart serializes and deserializes to empty", () => {
    const cart = makeCart([]);
    const raw = cartToStorage(cart);
    const restored = cartFromStorage(raw);
    expect(restored.size).toBe(0);
  });

  it("persisted cart is restored from storage (navigation does not clear)", async () => {
    const cart = makeCart([
      [
        "id1",
        {
          ...sampleItem,
          productId: "id1",
          productName: "Item 1",
          quantity: 1,
          unitPrice: 5,
          totalPrice: 5,
        },
      ],
      [
        "id2",
        {
          ...sampleItem,
          productId: "id2",
          productName: "Item 2",
          quantity: 3,
          unitPrice: 10,
          totalPrice: 30,
        },
      ],
    ]);
    saveCartToSessionStorage(cart);
    await vi.waitFor(
      async () => {
        const loaded = await loadCartFromSessionStorageAsync();
        expect(loaded.size).toBe(2);
      },
      { timeout: 3000, interval: 10 },
    );
    const loaded = await loadCartFromSessionStorageAsync();
    expect(loaded.get("id1")?.productName).toBe("Item 1");
    expect(loaded.get("id1")?.quantity).toBe(1);
    expect(loaded.get("id2")?.productName).toBe("Item 2");
    expect(loaded.get("id2")?.quantity).toBe(3);
    expect(loaded.get("id2")?.totalPrice).toBe(30);
  });

  it("clear cart is explicit: empty cart overwrites stored cart", async () => {
    const cart = makeCart([["p1", sampleItem]]);
    saveCartToSessionStorage(cart);
    await vi.waitFor(
      async () => {
        const raw =
          window.localStorage.getItem(CART_STORAGE_KEY) ??
          window.sessionStorage.getItem(CART_STORAGE_KEY);
        const fromDb = await loadCartFromSessionStorageAsync();
        expect(raw !== null || fromDb.size > 0).toBe(true);
      },
      { timeout: 3000, interval: 10 },
    );
    saveCartToSessionStorage(makeCart([]));
    await vi.waitFor(
      async () => {
        const loaded = await loadCartFromSessionStorageAsync();
        expect(loaded.size).toBe(0);
      },
      { timeout: 3000, interval: 10 },
    );
    expect(loadCartFromSessionStorage().size).toBe(0);
  });

  it("invalid or empty storage returns empty cart", () => {
    expect(cartFromStorage(null).size).toBe(0);
    expect(cartFromStorage("").size).toBe(0);
    expect(cartFromStorage("[]").size).toBe(0);
    expect(cartFromStorage("not json").size).toBe(0);
  });
});
