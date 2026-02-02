'use client';

import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import type { TransactionItem } from '@/types';
import type { Product } from '@/types';
import { loadCartFromSessionStorage, saveCartToSessionStorage } from '@/lib/cart-storage';

/**
 * Cart state is persisted in localStorage so the payment cart stays operational
 * when navigating to other pages, refreshing, or returning to Home. Cleared only
 * after checkout completes or when the user explicitly clears the cart.
 * In-memory cache ensures cart survives provider remount (e.g. Next.js navigation).
 */
type CartMap = Map<string, TransactionItem>;

/** Cache persisting across CartProvider remounts (same tab). */
let cartMemoryCache: CartMap | null = null;

interface CartContextValue {
  cart: CartMap;
  setCart: React.Dispatch<React.SetStateAction<CartMap>>;
  addToCart: (product: Product) => void;
  updateQuantity: (productId: string, newQuantity: number) => void;
  clearCart: () => void;
  cartItemCount: number;
  /** True once cart has been restored from sessionStorage (avoids showing "empty" during load). */
  isCartHydrated: boolean;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCartState] = useState<CartMap>(() => {
    if (typeof window === 'undefined') return new Map();
    if (cartMemoryCache && cartMemoryCache.size > 0) return new Map(cartMemoryCache);
    return loadCartFromSessionStorage();
  });
  const [hydrated, setHydrated] = useState(false);

  useLayoutEffect(() => {
    if (cartMemoryCache && cartMemoryCache.size > 0) {
      setCartState(new Map(cartMemoryCache));
    } else {
      const loaded = loadCartFromSessionStorage();
      if (loaded.size > 0) cartMemoryCache = new Map(loaded);
      setCartState(loaded);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveCartToSessionStorage(cart);
    if (cart.size > 0) {
      cartMemoryCache = new Map(cart);
    } else {
      cartMemoryCache = null;
    }
  }, [cart, hydrated]);

  const setCart = useCallback((action: React.SetStateAction<CartMap>) => {
    setCartState((prev) => {
      const next = typeof action === 'function' ? action(prev) : action;
      return new Map(next);
    });
  }, []);

  const addToCart = useCallback((product: Product) => {
    const productId = product.id;
    if (!productId) return;
    const unitPrice = typeof product.price === 'number' ? product.price : parseFloat(String(product.price)) || 0;
    setCartState((prev) => {
      const newCart = new Map(prev);
      const existingItem = newCart.get(productId);
      if (existingItem) {
        existingItem.quantity += 1;
        existingItem.totalPrice = existingItem.quantity * existingItem.unitPrice;
      } else {
        newCart.set(productId, {
          productId: productId,
          productName: product.name,
          quantity: 1,
          unitPrice: unitPrice,
          totalPrice: unitPrice,
          imageUrl: (product as Product & { productImage?: string }).productImage ?? product.imageUrl,
          stock: product.stock,
        });
      }
      return newCart;
    });
  }, []);

  const updateQuantity = useCallback((productId: string, newQuantity: number) => {
    setCartState((prev) => {
      const newCart = new Map(prev);
      const item = newCart.get(productId);
      if (item) {
        if (newQuantity <= 0) {
          newCart.delete(productId);
        } else {
          item.quantity = newQuantity;
          item.totalPrice = item.quantity * item.unitPrice;
        }
      }
      return newCart;
    });
  }, []);

  const clearCart = useCallback(() => {
    cartMemoryCache = null;
    setCartState(new Map());
  }, []);

  const cartItemCount = useMemo(() => {
    return Array.from(cart.values()).reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  const value = useMemo<CartContextValue>(
    () => ({ cart, setCart, addToCart, updateQuantity, clearCart, cartItemCount, isCartHydrated: hydrated }),
    [cart, setCart, addToCart, updateQuantity, clearCart, cartItemCount, hydrated]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return ctx;
}
