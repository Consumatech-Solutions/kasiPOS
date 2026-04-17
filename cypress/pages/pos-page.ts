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
    return this;
  },

  searchProducts(term: string) {
    cy.findByPlaceholderText(
      /scan barcode or search item|search categories/i,
    ).clear();
    cy.findByPlaceholderText(
      /scan barcode or search item|search categories/i,
    ).type(term);
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
    for (let i = 0; i < times; i += 1) {
      cy.get('[data-testid="pos-product-table"]', { timeout: 25_000 }).within(
        () => {
          cy.contains("tr", new RegExp(escaped, "i"), {
            timeout: 25_000,
          }).within(() => {
            cy.findByRole("button", { name: new RegExp(`add ${name}`, "i") })
              .should("be.visible")
              .click({ force: true });
          });
        },
      );
    }
    return this;
  },

  cartLine(name: string) {
    return cy.get(`[data-testid="pos-cart-line"][data-product-name="${name}"]`);
  },

  selectCustomerFromDialog(customerName: string) {
    cy.findByRole("button", { name: /add customer/i }).click({ force: true });
    cy.findByRole("dialog", { name: /select a customer/i }).within(() => {
      cy.contains("tr", new RegExp(customerName, "i")).within(() => {
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
