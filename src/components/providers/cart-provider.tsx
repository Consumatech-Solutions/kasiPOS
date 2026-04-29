"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import type { TransactionItem } from "@/types";
import type { Product } from "@/types";
import {
  loadCartFromSessionStorageAsync,
  saveCartToSessionStorage,
} from "@/lib/cart-storage";
import { feedback } from "@/lib/feedback";

type CartMap = Map<string, TransactionItem>;

let cartMemoryCache: CartMap | null = null;

export function resetCartMemoryCacheForTests(): void {
  cartMemoryCache = null;
}

interface CartContextValue {
  cart: CartMap;
  setCart: React.Dispatch<React.SetStateAction<CartMap>>;
  addToCart: (product: Product) => void;
  updateQuantity: (productId: string, newQuantity: number) => void;
  clearCart: () => void;
  cartItemCount: number;
  isCartHydrated: boolean;
}

const CartContext = createContext<CartContextValue | null>(null);

const E2E_RESET_CART_FLAG = "__kasi_pos_e2e_reset_cart";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCartState] = useState<CartMap>(() => new Map());
  const [hydrated, setHydrated] = useState(false);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    if (
      window.sessionStorage.getItem("__kasi_pos_e2e") === "1" &&
      window.sessionStorage.getItem(E2E_RESET_CART_FLAG) === "1"
    ) {
      window.sessionStorage.removeItem(E2E_RESET_CART_FLAG);
      cartMemoryCache = new Map();
      setCartState(new Map());
      setHydrated(true);
      return;
    }
    if (cartMemoryCache && cartMemoryCache.size > 0) {
      setCartState(new Map(cartMemoryCache));
      setHydrated(true);
      return;
    }
    if (cartMemoryCache && cartMemoryCache.size === 0) {
      setCartState(new Map(cartMemoryCache));
      setHydrated(true);
      return;
    }
    loadCartFromSessionStorageAsync().then((loaded) => {
      if (loaded.size > 0) cartMemoryCache = new Map(loaded);
      setCartState(loaded);
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveCartToSessionStorage(cart);
    if (cart.size > 0) {
      cartMemoryCache = new Map(cart);
    } else {
      const emptySentinel =
        cartMemoryCache !== null && cartMemoryCache.size === 0;
      if (!emptySentinel) cartMemoryCache = null;
    }
  }, [cart, hydrated]);

  const setCart = useCallback((action: React.SetStateAction<CartMap>) => {
    setCartState((prev) => {
      const next = typeof action === "function" ? action(prev) : action;
      return new Map(next);
    });
  }, []);

  const addToCart = useCallback((product: Product) => {
    const productId = product.id;
    if (!productId) return;
    const unitPrice =
      typeof product.price === "number"
        ? product.price
        : parseFloat(String(product.price)) || 0;
    const maxStock = product.stock;
    setCartState((prev) => {
      const newCart = new Map(prev);
      const existingItem = newCart.get(productId);
      const nextQty = (existingItem?.quantity ?? 0) + 1;
      if (
        typeof maxStock === "number" &&
        Number.isFinite(maxStock) &&
        nextQty > maxStock
      ) {
        queueMicrotask(() => {
          feedback.error(
            "Insufficient stock",
            `Only ${maxStock} available for this product.`,
            "Reduce the quantity or restock before adding more."
          );
        });
        return prev;
      }
      if (existingItem) {
        existingItem.quantity += 1;
        existingItem.totalPrice =
          existingItem.quantity * existingItem.unitPrice;
      } else {
        newCart.set(productId, {
          productId: productId,
          productName: product.name,
          quantity: 1,
          unitPrice: unitPrice,
          totalPrice: unitPrice,
          imageUrl:
            (product as Product & { productImage?: string }).productImage ??
            product.imageUrl,
          stock: product.stock,
        });
      }
      return newCart;
    });
  }, []);

  const updateQuantity = useCallback(
    (productId: string, newQuantity: number) => {
      setCartState((prev) => {
        const newCart = new Map(prev);
        const item = newCart.get(productId);
        if (item) {
          if (newQuantity <= 0) {
            newCart.delete(productId);
          } else {
            const maxStock = item.stock;
            if (
              typeof maxStock === "number" &&
              Number.isFinite(maxStock) &&
              newQuantity > maxStock
            ) {
              queueMicrotask(() => {
                feedback.error(
                  "Insufficient stock",
                  `Only ${maxStock} available for this product.`,
                  "Lower the quantity or restock before selling more."
                );
              });
              return prev;
            }
            item.quantity = newQuantity;
            item.totalPrice = item.quantity * item.unitPrice;
          }
        }
        return newCart;
      });
    },
    []
  );

  const clearCart = useCallback(() => {
    cartMemoryCache = null;
    setCartState(new Map());
  }, []);

  const cartItemCount = useMemo(() => {
    return Array.from(cart.values()).reduce(
      (sum, item) => sum + item.quantity,
      0
    );
  }, [cart]);

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      setCart,
      addToCart,
      updateQuantity,
      clearCart,
      cartItemCount,
      isCartHydrated: hydrated,
    }),
    [
      cart,
      setCart,
      addToCart,
      updateQuantity,
      clearCart,
      cartItemCount,
      hydrated,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return ctx;
}
