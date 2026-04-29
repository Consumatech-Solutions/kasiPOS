import type { TransactionItem } from "@/types";
import { getDb } from "@/lib/db";

const CART_STORAGE_KEY = "kasiPOS-cart";

function isBlobUrl(url: string | undefined): boolean {
  return typeof url === "string" && url.startsWith("blob:");
}

export function cartToStorage(cart: Map<string, TransactionItem>): string {
  const entries = Array.from(cart.entries()).map(([key, item]) => {
    const safe = { ...item };
    if (isBlobUrl(safe.imageUrl)) safe.imageUrl = undefined;
    return [key, safe] as [string, TransactionItem];
  });
  return JSON.stringify(entries);
}

export function cartFromStorage(
  raw: string | null
): Map<string, TransactionItem> {
  if (!raw || typeof raw !== "string") return new Map();
  try {
    const parsed = JSON.parse(raw) as [string, TransactionItem][];
    if (!Array.isArray(parsed)) return new Map();
    const map = new Map<string, TransactionItem>();
    for (const [key, value] of parsed) {
      if (
        key &&
        value &&
        typeof value.quantity === "number" &&
        value.unitPrice != null &&
        value.totalPrice != null
      ) {
        let imageUrl = value.imageUrl;
        if (isBlobUrl(imageUrl)) imageUrl = undefined;
        map.set(String(key), {
          productId: String(value.productId ?? key),
          productName: String(value.productName ?? ""),
          quantity: value.quantity,
          unitPrice: Number(value.unitPrice),
          totalPrice: Number(value.totalPrice),
          imageUrl,
          stock: value.stock,
        });
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

export function saveCartToSessionStorage(
  cart: Map<string, TransactionItem>
): void {
  if (typeof window === "undefined") return;
  const payload = cartToStorage(cart);
  try {
    getDb()
      .keyVal.put({ key: CART_STORAGE_KEY, value: payload })
      .catch(() => {
        try {
          if (window.localStorage)
            window.localStorage.setItem(CART_STORAGE_KEY, payload);
        } catch {
          if (window.sessionStorage)
            window.sessionStorage.setItem(CART_STORAGE_KEY, payload);
        }
      });
  } catch {
    try {
      if (window.localStorage)
        window.localStorage.setItem(CART_STORAGE_KEY, payload);
    } catch {
      if (window.sessionStorage)
        window.sessionStorage.setItem(CART_STORAGE_KEY, payload);
    }
  }
}

export function loadCartFromSessionStorage(): Map<string, TransactionItem> {
  return new Map();
}

export async function loadCartFromSessionStorageAsync(): Promise<
  Map<string, TransactionItem>
> {
  if (typeof window === "undefined") return new Map();
  try {
    const db = getDb();
    const record = await db.keyVal.get(CART_STORAGE_KEY);
    const raw = record?.value ?? null;
    if (raw != null) return cartFromStorage(raw);
    let legacy: string | null = null;
    try {
      if (window.localStorage)
        legacy = window.localStorage.getItem(CART_STORAGE_KEY);
    } catch {
      // ignore
    }
    if (legacy === null && window.sessionStorage) {
      try {
        legacy = window.sessionStorage.getItem(CART_STORAGE_KEY);
      } catch {
        // ignore
      }
    }
    return cartFromStorage(legacy);
  } catch {
    return new Map();
  }
}

export { CART_STORAGE_KEY };
