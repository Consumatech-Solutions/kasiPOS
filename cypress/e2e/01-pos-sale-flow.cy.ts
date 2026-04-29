import { PosPage } from "../pages/pos-page";
import { InventoryPage } from "../pages/inventory-page";

function cartRow(productName: string) {
  return cy.get(
    `[data-testid="pos-cart-line"][data-product-name="${productName}"]`
  );
}

function addProductWithQty(productName: string, qty: number) {
  PosPage.addProduct(productName);
  for (let i = 1; i < qty; i += 1) {
    cartRow(productName).find("button").eq(1).click({ force: true });
  }
}

describe("POS sale flow", () => {
  beforeEach(() => {
    cy.setupScenario();
    cy.setOnlineModeOnly();
    PosPage.visit();
    cy.setOnline();
    PosPage.waitUntilLoaded();
  });

  it("browses products and supports search", () => {
    PosPage.searchProducts("Cola");
    cy.contains("td", /cola 330ml/i, { timeout: 15_000 }).should("be.visible");

    PosPage.searchProducts("NoSuchProduct");
    // Product filter is debounced (~500ms in page.tsx); assert on the table so Cypress retries until the row is gone.
    cy.get('[data-testid="pos-product-table"]', { timeout: 15_000 }).should(
      "not.contain",
      "Cola 330ml"
    );
  });

  it("adds product to cart and increments quantity", () => {
    PosPage.addProduct("Cola 330ml");
    cartRow("Cola 330ml").should(($row) => {
      expect($row.text()).to.match(/1/);
      expect($row.text()).to.match(/12\.50/i);
    });

    // Increment from the cart row (avoids dev Strict Mode double-invoking duplicate catalog adds).
    cartRow("Cola 330ml").find("button").eq(1).click({ force: true });
    cartRow("Cola 330ml").should(($row) => {
      expect($row.text()).to.match(/2/);
      expect($row.text()).to.match(/25\.00/i);
    });
  });

  it("updates quantity with plus/minus and recalculates total", () => {
    PosPage.addProduct("Cola 330ml");
    cartRow("Cola 330ml").find("button").eq(1).click({ force: true });
    cartRow("Cola 330ml").should(($row) => {
      expect($row.text()).to.match(/2/);
    });
    cartRow("Cola 330ml").find("button").eq(0).click({ force: true });
    cartRow("Cola 330ml").should(($row) => {
      expect($row.text()).to.match(/1/);
    });
    cy.contains(/total to pay/i).should(($el) => {
      const row = $el[0].parentElement;
      expect(row && row.textContent).to.match(/12\.50/);
    });
  });

  it("removes item when quantity updated to zero", () => {
    PosPage.addProduct("Cola 330ml");
    cartRow("Cola 330ml").find("button").eq(2).click({ force: true });
    cy.contains(/cart is empty/i).should("be.visible");
  });

  it("selects customer and applies voucher discount", () => {
    addProductWithQty("Cola 330ml", 2);
    PosPage.selectCustomerFromDialog("Alice Mokoena");
    cy.findByRole("button", { name: /alice mokoena/i }).should("be.visible");

    PosPage.openVoucherDialog();
    cy.findByPlaceholderText(/enter code/i).type("SAVE10");
    cy.findByRole("button", { name: /find voucher/i }).click();
    cy.findByText(/voucher found/i).should("be.visible");
    cy.findByRole("button", { name: /apply discount/i }).click();
    cy.contains(/discount applied/i).should("be.visible");
    cy.contains(/total to pay/i).should(($el) => {
      const row = $el[0].parentElement;
      expect(row && row.textContent).to.match(/22\.50/);
    });
  });

  it("opens payment modal for each payment method", () => {
    PosPage.addProduct("Cola 330ml");
    PosPage.selectCustomerFromDialog("Alice Mokoena");

    PosPage.choosePaymentMethod("Cash");
    cy.findByRole("dialog", { name: /cash payment/i }).within(() => {
      cy.findByText(/cash payment/i).should("be.visible");
      cy.findByRole("button", { name: /^close$/i }).click({ force: true });
    });

    PosPage.choosePaymentMethod("Card");
    cy.findByRole("dialog", { name: /card payment/i }).within(() => {
      cy.findByText(/card payment/i).should("be.visible");
      cy.findByRole("button", { name: /^cancel$/i }).click({ force: true });
    });

    PosPage.choosePaymentMethod("Mobile Money");
    cy.findByRole("dialog", { name: /mobile money/i }).within(() => {
      cy.findByText(/mobile money/i).should("be.visible");
      cy.findByRole("button", { name: /^close$/i }).click({ force: true });
    });
  });

  it("completes sale, shows receipt, and clears cart", () => {
    addProductWithQty("Cola 330ml", 2);
    PosPage.selectCustomerFromDialog("Alice Mokoena");
    PosPage.choosePaymentMethod("Cash");

    cy.findByRole("dialog", { name: /cash payment/i }).within(() => {
      cy.findByRole("button", { name: /exact/i }).click({ force: true });
      cy.findByRole("button", { name: /complete sale/i }).click({
        force: true,
      });
    });

    // Toast can be transient in headless runs; receipt dialog is the stable completion signal.
    cy.get('[data-testid="receipt-dialog"]', { timeout: 25_000 }).should(
      "be.visible"
    );
    cy.get('[data-testid="receipt-dialog"]').within(() => {
      cy.findByText(/^receipt$/i).should("be.visible");
    });
    cy.get('[data-testid="receipt-dialog"]')
      .findByRole("button", { name: /^close$/i })
      .click({ force: true });
    cy.contains(/cart is empty/i).should("be.visible");
  });

  it("decreases stock after completed sale", () => {
    InventoryPage.visit();
    InventoryPage.waitUntilLoaded();
    cy.contains("tr", /cola 330ml/i).within(() => {
      cy.contains("30").should("be.visible");
    });

    PosPage.visit();
    cy.setOnline();
    PosPage.waitUntilLoaded();
    addProductWithQty("Cola 330ml", 2);
    PosPage.selectCustomerFromDialog("Alice Mokoena");
    PosPage.choosePaymentMethod("Cash");
    cy.findByRole("dialog", { name: /cash payment/i }).within(() => {
      cy.findByRole("button", { name: /exact/i }).click({ force: true });
      cy.findByRole("button", { name: /complete sale/i }).click({
        force: true,
      });
    });
    cy.get('[data-testid="receipt-dialog"]', { timeout: 25_000 }).should(
      "be.visible"
    );
    cy.get('[data-testid="receipt-dialog"]')
      .findByRole("button", { name: /^close$/i })
      .click({ force: true });

    InventoryPage.visit();
    InventoryPage.waitUntilLoaded();
    cy.contains("tr", /cola 330ml/i).within(() => {
      cy.contains("28").should("be.visible");
    });
  });
});
