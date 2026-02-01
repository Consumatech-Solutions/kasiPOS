import type { TransactionItem } from '@/types';

const CART_STORAGE_KEY = 'kasiPOS-cart';

/** Blob URLs (e.g. from local images) are invalid after refresh/navigation; do not persist them. */
function isBlobUrl(url: string | undefined): boolean {
  return typeof url === 'string' && url.startsWith('blob:');
}

/** Serialize cart Map to a JSON-serializable format. Omits blob imageUrl so restored cart does not load invalid URLs. */
export function cartToStorage(cart: Map<string, TransactionItem>): string {
  const entries = Array.from(cart.entries()).map(([key, item]) => {
    const safe = { ...item };
    if (isBlobUrl(safe.imageUrl)) safe.imageUrl = undefined;
    return [key, safe] as [string, TransactionItem];
  });
  return JSON.stringify(entries);
}

/** Deserialize cart from storage string. Strips blob imageUrl so we never try to load invalid blob URLs. */
export function cartFromStorage(raw: string | null): Map<string, TransactionItem> {
  if (!raw || typeof raw !== 'string') return new Map();
  try {
    const parsed = JSON.parse(raw) as [string, TransactionItem][];
    if (!Array.isArray(parsed)) return new Map();
    const map = new Map<string, TransactionItem>();
    for (const [key, value] of parsed) {
      if (key && value && typeof value.quantity === 'number' && value.unitPrice != null && value.totalPrice != null) {
        let imageUrl = value.imageUrl;
        if (isBlobUrl(imageUrl)) imageUrl = undefined;
        map.set(String(key), {
          productId: String(value.productId ?? key),
          productName: String(value.productName ?? ''),
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

/** Persist cart to localStorage (survives refresh and navigation). Cleared only on checkout or explicit clear. */
export function saveCartToSessionStorage(cart: Map<string, TransactionItem>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, cartToStorage(cart));
  } catch {
    // fallback to sessionStorage if localStorage full/disabled
    try {
      window.sessionStorage.setItem(CART_STORAGE_KEY, cartToStorage(cart));
    } catch {
      // ignore
    }
  }
}

/** Load cart from localStorage (or sessionStorage fallback). */
export function loadCartFromSessionStorage(): Map<string, TransactionItem> {
  if (typeof window === 'undefined') return new Map();
  try {
    let raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (raw === null) raw = window.sessionStorage.getItem(CART_STORAGE_KEY);
    return cartFromStorage(raw);
  } catch {
    return new Map();
  }
}

export { CART_STORAGE_KEY };
