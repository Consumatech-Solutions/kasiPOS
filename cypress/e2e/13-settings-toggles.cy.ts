import { PosPage } from "../pages/pos-page";

function addFirstVisibleProductToCart() {
  cy.get('[data-testid="pos-product-table"]', { timeout: 60_000 })
    .find("button[aria-label]", { timeout: 60_000 })
    .then(($buttons) => {
      const btn = $buttons.toArray().find((el) => {
        const label = (el.getAttribute("aria-label") ?? "").toLowerCase();
        return label.startsWith("add ");
      });
      if (!btn) {
        throw new Error('No "Add <product>" button found in product table.');
      }
      cy.wrap(btn).scrollIntoView().click({ force: true });
    });
}

describe("Settings toggles affect POS (VAT / tax)", () => {
  const isRealMode =
    String(Cypress.env("TEST_MODE") ?? "mock").toLowerCase().trim() === "real";

  beforeEach(() => {
    cy.setupScenario();
    if (!isRealMode) {
      // seedIndexedDb needs an active window context (cy.window()).
      cy.visitApp("/");
      cy.seedIndexedDb();
      cy.setOnlineModeOnly();
      cy.setOnline();
    }
  });

  it("Show VAT in checkout toggle controls VAT line on POS", () => {
    cy.visitApp("/settings");
    cy.waitForAppReady("/settings");

    const setPersistedVat = (nextChecked: boolean) => {
      cy.window().then((win) => {
        const raw = win.localStorage.getItem("kasi-pos-settings");
        const parsed = raw ? (JSON.parse(raw) as any) : {};
        parsed.showVatInCheckout = nextChecked;
        if (parsed.currentStore?.enabledModules) {
          parsed.currentStore.enabledModules.showVatInCheckout = nextChecked;
        }
        win.localStorage.setItem("kasi-pos-settings", JSON.stringify(parsed));
      });
    };

    if (isRealMode) {
      // Real mode: drive via UI (server-backed).
      cy.get("#show-vat-toggle").should("exist").and("not.be.disabled").click({ force: true });
    } else {
      // Mock mode: avoid server reachability races; persist locally and reload.
      setPersistedVat(true);
      cy.reload();
      cy.waitForAppReady("/settings");
      cy.get("#show-vat-toggle").should("have.attr", "aria-checked", "true");
    }

    if (isRealMode) {
      PosPage.visit();
    } else {
      cy.visit("/");
    }
    if (!isRealMode) cy.setOnline();
    PosPage.waitUntilLoaded();
    if (isRealMode) {
      addFirstVisibleProductToCart();
    } else {
      PosPage.addProduct("Cola 330ml");
    }
    cy.get('[data-testid="pos-cart-line"]', { timeout: 20_000 }).should(
      "have.length.at.least",
      1
    );
    cy.contains(/vat is added to the total/i).should("be.visible");
    cy.contains(/subtotal/i)
      .parent()
      .invoke("text")
      .then((text) => {
        const subtotalMatch = text.match(/R\s*([0-9]+(?:\.[0-9]+)?)/i);
        expect(subtotalMatch, "subtotal amount present").to.not.eq(null);
        const subtotal = subtotalMatch ? Number(subtotalMatch[1]) : 0;
        cy.contains(/total to pay/i)
          .parent()
          .invoke("text")
          .then((totalText) => {
            const totalMatch = totalText.match(/R\s*([0-9]+(?:\.[0-9]+)?)/i);
            expect(totalMatch, "total amount present").to.not.eq(null);
            const total = totalMatch ? Number(totalMatch[1]) : 0;
            const expected = Number((subtotal * 1.15).toFixed(2));
            expect(Number(total.toFixed(2))).to.be.closeTo(expected, 0.02);
          });
      });

    // Turn VAT OFF.
    cy.visitApp("/settings");
    cy.waitForAppReady("/settings");
    if (isRealMode) {
      cy.get("#show-vat-toggle").should("exist").and("not.be.disabled").click({ force: true });
    } else {
      setPersistedVat(false);
      cy.reload();
      cy.waitForAppReady("/settings");
      cy.get("#show-vat-toggle").should("have.attr", "aria-checked", "false");
    }

    if (isRealMode) {
      PosPage.visit();
    } else {
      cy.visit("/");
    }
    if (!isRealMode) cy.setOnline();
    PosPage.waitUntilLoaded();
    if (isRealMode) {
      addFirstVisibleProductToCart();
    } else {
      PosPage.addProduct("Cola 330ml");
    }
    cy.get('[data-testid="pos-cart-line"]', { timeout: 20_000 }).should(
      "have.length.at.least",
      1
    );
    cy.contains(/vat is included in the total/i).should("be.visible");
    cy.contains(/subtotal/i)
      .parent()
      .invoke("text")
      .then((text) => {
        const subtotalMatch = text.match(/R\s*([0-9]+(?:\.[0-9]+)?)/i);
        expect(subtotalMatch, "subtotal amount present").to.not.eq(null);
        const subtotal = subtotalMatch ? Number(subtotalMatch[1]) : 0;
        cy.contains(/total to pay/i)
          .parent()
          .invoke("text")
          .then((totalText) => {
            const totalMatch = totalText.match(/R\s*([0-9]+(?:\.[0-9]+)?)/i);
            expect(totalMatch, "total amount present").to.not.eq(null);
            const total = totalMatch ? Number(totalMatch[1]) : 0;
            expect(Number(total.toFixed(2))).to.eq(Number(subtotal.toFixed(2)));
          });
      });
  });
});

