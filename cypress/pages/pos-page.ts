export const PosPage = {
  path: "/" as const,

  visit() {
    cy.visitApp(this.path);
    return this;
  },

  waitUntilLoaded() {
    cy.location("pathname").should("eq", "/");
    cy.location("pathname").should("not.eq", "/login");
    cy.url().should("not.match", /\/login(\?|$)/);
    cy.contains(/welcome back!/i).should("not.exist");
    cy.findByPlaceholderText(/scan barcode or search item|search categories/i, {
      timeout: 60_000,
    }).should("be.visible");
    // Do not use `contains(/loading cart/).should('not.exist')` alone — it passes on an empty document.
    cy.contains(/sale #/i, { timeout: 30_000 }).should("be.visible");
    cy.contains(/loading cart/i).should("not.exist");
    this.ensureProductCarouselView();
    cy.get('[data-testid="pos-product-table"]', { timeout: 90_000 }).should(
      "not.contain",
      "Loading products"
    );
    return this;
  },

  searchProducts(term: string) {
    cy.findByPlaceholderText(
      /scan barcode or search item|search categories/i
    ).clear();
    cy.findByPlaceholderText(
      /scan barcode or search item|search categories/i
    ).type(term, { delay: 0 });
    return this;
  },

  /** POS search input toggles between product search (carousel) and category search (grid). */
  ensureProductCarouselView() {
    cy.get("body").then(($body) => {
      if ($body.find("svg.lucide-list").length > 0) {
        cy.get("svg.lucide-list").closest("button").click({ force: true });
      }
    });
    return this;
  },

  addProduct(name: string, times = 1) {
    this.ensureProductCarouselView();
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const addBtnPattern = new RegExp(`add ${escaped}`, "i");
    for (let i = 0; i < times; i += 1) {
      cy.get('[data-testid="pos-product-table"]', { timeout: 25_000 }).within(
        () => {
          cy.contains("tr", new RegExp(escaped, "i"), {
            timeout: 25_000,
          }).within(() => {
            cy.findByRole("button", { name: addBtnPattern })
              .should("be.visible")
              .click({ force: true });
          });
        }
      );
    }
    this.ensureCartVisible();
    return this;
  },

  ensureCartVisible() {
    cy.get("body").then(($body) => {
      if ($body.find('[data-testid="pos-cart-line"]:visible').length > 0) {
        return;
      }
      if ($body.find('[data-testid="pos-mobile-cart-bar"]').length > 0) {
        cy.get('[data-testid="pos-mobile-cart-bar"]').click({ force: true });
      }
    });
    return this;
  },

  cartLine(name: string) {
    this.ensureCartVisible();
    const safe =
      typeof CSS !== "undefined" && typeof CSS.escape === "function"
        ? CSS.escape(name)
        : name.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return cy.get(`[data-testid="pos-cart-line"][data-product-name="${safe}"]`);
  },

  selectCustomerFromDialog(customerName: string) {
    const escaped = customerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    cy.findByRole("button", { name: /add customer/i }).click({ force: true });
    cy.findByRole("dialog", { name: /select a customer/i }).within(() => {
      cy.contains("tr", new RegExp(escaped, "i")).within(() => {
        cy.findByRole("button", { name: /^select$/i }).click({ force: true });
      });
    });
    return this;
  },

  openVoucherDialog() {
    cy.findByRole("button", { name: /^redeem voucher$/i, timeout: 15_000 })
      .should("be.visible")
      .and("not.be.disabled")
      .click();
    cy.get("#voucherCode", { timeout: 15_000 }).should("be.visible");
    return this;
  },

  openDiscountDialog() {
    cy.findByRole("button", { name: /discount/i }).click({ force: true });
    return this;
  },

  choosePaymentMethod(method: "Cash" | "Card" | "Mobile Money") {
    this.ensureCartVisible();
    // Match checkout row only — loose /cash/i matches e.g. "CashSend (ABSA)" in the Mobile Money form.
    const map: Record<"Cash" | "Card" | "Mobile Money", RegExp> = {
      Cash: /^CASH$/i,
      Card: /^CARD$/i,
      "Mobile Money": /^MOBILE$/i,
    };
    if (method === "Cash") {
      cy.get("body").then(($body) => {
        // If cash modal is already open, avoid re-clicking detached checkout buttons.
        if ($body.find("#tendered").length > 0) return;
        cy.contains("button", map[method], { timeout: 15_000 })
          .should("be.visible")
          .and("not.be.disabled")
          .click({ force: true });
      });
      return this;
    }
    cy.contains("button", map[method], { timeout: 15_000 })
      .should("be.visible")
      .and("not.be.disabled")
      .click({ force: true });
    return this;
  },
};
