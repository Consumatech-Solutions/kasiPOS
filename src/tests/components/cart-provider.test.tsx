import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  CartProvider,
  resetCartMemoryCacheForTests,
  useCart,
} from "@/components/providers/cart-provider";
import type { Product } from "@/types";

const loadCartAsync = vi.fn();
const saveCart = vi.fn();

vi.mock("@/lib/cart-storage", () => ({
  loadCartFromSessionStorageAsync: () => loadCartAsync(),
  saveCartToSessionStorage: (cart: Map<string, unknown>) => saveCart(cart),
}));

const feedbackError = vi.fn();
vi.mock("@/lib/feedback", () => ({
  feedback: {
    error: (...args: unknown[]) => feedbackError(...args),
    success: vi.fn(),
    fromError: vi.fn(),
  },
}));

function product(
  p: Partial<Product> & Pick<Product, "id" | "name" | "price">
): Product {
  return { ...p } as Product;
}

function Harness() {
  const {
    cart,
    addToCart,
    updateQuantity,
    clearCart,
    cartItemCount,
    isCartHydrated,
  } = useCart();
  return (
    <div>
      <span data-testid="hydrated">{isCartHydrated ? "yes" : "no"}</span>
      <span data-testid="count">{cartItemCount}</span>
      <span data-testid="size">{cart.size}</span>
      <span data-testid="qty-p1">{cart.get("p1")?.quantity ?? 0}</span>
      <span data-testid="total-p1">{cart.get("p1")?.totalPrice ?? 0}</span>
      <button
        type="button"
        data-testid="add-p1"
        onClick={() =>
          addToCart(product({ id: "p1", name: "One", price: 12, stock: 3 }))
        }
      >
        add
      </button>
      <button
        type="button"
        data-testid="add-unlimited"
        onClick={() => addToCart(product({ id: "p2", name: "Two", price: 5 }))}
      >
        add unlimited
      </button>
      <button
        type="button"
        data-testid="inc-qty"
        onClick={() => updateQuantity("p1", 2)}
      >
        set qty 2
      </button>
      <button
        type="button"
        data-testid="set-qty-5"
        onClick={() => updateQuantity("p1", 5)}
      >
        set qty 5
      </button>
      <button
        type="button"
        data-testid="remove"
        onClick={() => updateQuantity("p1", 0)}
      >
        remove
      </button>
      <button type="button" data-testid="clear" onClick={() => clearCart()}>
        clear
      </button>
    </div>
  );
}

describe("CartProvider", () => {
  beforeEach(() => {
    resetCartMemoryCacheForTests();
    loadCartAsync.mockResolvedValue(new Map());
    saveCart.mockClear();
    feedbackError.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("hydrates then persists cart on change", async () => {
    render(
      <CartProvider>
        <Harness />
      </CartProvider>
    );
    await waitFor(() =>
      expect(screen.getByTestId("hydrated").textContent).toBe("yes")
    );
    const user = userEvent.setup();
    await user.click(screen.getByTestId("add-p1"));
    await waitFor(() => expect(saveCart).toHaveBeenCalled());
    const lastCall = saveCart.mock.calls.at(-1)?.[0] as Map<
      string,
      { quantity: number }
    >;
    expect(lastCall?.get("p1")?.quantity).toBe(1);
  });

  it("addToCart increments quantity and recalculates totalPrice", async () => {
    render(
      <CartProvider>
        <Harness />
      </CartProvider>
    );
    await waitFor(() =>
      expect(screen.getByTestId("hydrated").textContent).toBe("yes")
    );
    const user = userEvent.setup();
    await user.click(screen.getByTestId("add-p1"));
    await user.click(screen.getByTestId("add-p1"));
    expect(screen.getByTestId("qty-p1").textContent).toBe("2");
    expect(screen.getByTestId("total-p1").textContent).toBe("24");
    expect(screen.getByTestId("count").textContent).toBe("2");
  });

  it("parses string price on add", async () => {
    function PriceHarness() {
      const { addToCart, cart } = useCart();
      return (
        <>
          <span data-testid="total">{cart.get("x")?.totalPrice ?? 0}</span>
          <button
            type="button"
            onClick={() =>
              addToCart(
                product({
                  id: "x",
                  name: "X",
                  price: "9.5" as unknown as number,
                })
              )
            }
          >
            go
          </button>
        </>
      );
    }
    render(
      <CartProvider>
        <PriceHarness />
      </CartProvider>
    );
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /go/i })).toBeTruthy()
    );
    await userEvent.click(screen.getByRole("button", { name: /go/i }));
    expect(screen.getByTestId("total").textContent).toBe("9.5");
  });

  it("updateQuantity removes item when qty <= 0", async () => {
    render(
      <CartProvider>
        <Harness />
      </CartProvider>
    );
    await waitFor(() =>
      expect(screen.getByTestId("hydrated").textContent).toBe("yes")
    );
    const user = userEvent.setup();
    await user.click(screen.getByTestId("add-p1"));
    await user.click(screen.getByTestId("remove"));
    expect(screen.getByTestId("size").textContent).toBe("0");
  });

  it("clearCart empties cart", async () => {
    render(
      <CartProvider>
        <Harness />
      </CartProvider>
    );
    await waitFor(() =>
      expect(screen.getByTestId("hydrated").textContent).toBe("yes")
    );
    const user = userEvent.setup();
    await user.click(screen.getByTestId("add-p1"));
    await user.click(screen.getByTestId("clear"));
    expect(screen.getByTestId("size").textContent).toBe("0");
  });

  it("blocks addToCart when stock would be exceeded and shows feedback", async () => {
    render(
      <CartProvider>
        <Harness />
      </CartProvider>
    );
    await waitFor(() =>
      expect(screen.getByTestId("hydrated").textContent).toBe("yes")
    );
    const user = userEvent.setup();
    await user.click(screen.getByTestId("add-p1"));
    await user.click(screen.getByTestId("add-p1"));
    await user.click(screen.getByTestId("add-p1"));
    expect(screen.getByTestId("qty-p1").textContent).toBe("3");
    await act(async () => {
      await user.click(screen.getByTestId("add-p1"));
    });
    expect(screen.getByTestId("qty-p1").textContent).toBe("3");
    await waitFor(() => expect(feedbackError).toHaveBeenCalled());
    expect(feedbackError.mock.calls[0][0]).toBe("Insufficient stock");
  });

  it("blocks updateQuantity above stock", async () => {
    render(
      <CartProvider>
        <Harness />
      </CartProvider>
    );
    await waitFor(() =>
      expect(screen.getByTestId("hydrated").textContent).toBe("yes")
    );
    const user = userEvent.setup();
    await user.click(screen.getByTestId("add-p1"));
    await act(async () => {
      await user.click(screen.getByTestId("set-qty-5"));
    });
    expect(screen.getByTestId("qty-p1").textContent).toBe("1");
    await waitFor(() => expect(feedbackError).toHaveBeenCalled());
  });
});
