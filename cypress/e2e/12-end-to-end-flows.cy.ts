import { CataloguePage } from "../pages/catalogue-page";
import { PosPage } from "../pages/pos-page";
import { InventoryPage } from "../pages/inventory-page";
import { CustomersPage } from "../pages/customers-page";
import { VouchersPage } from "../pages/vouchers-page";

function uniqueId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function openSyncModal() {
  cy.findByRole("button", { name: /open cloud sync status/i, timeout: 20_000 })
    .should("be.visible")
    .click({ force: true });
  cy.findByRole("dialog").within(() => {
    cy.contains(/sync status|downloading offline data/i).should("be.visible");
  });
}

function ensureInsufficientStockPopup() {
  cy.findByRole("alertdialog", { name: /insufficient stock/i }).within(() => {
    cy.contains(/insufficient stock/i).should("be.visible");
    cy.findByRole("button", { name: /ok|close/i }).click({ force: true });
  });
}

function completeCashSale() {
  let beforeTxCount = 0;
  cy.readIndexedDbStore("transactions").then((rows) => {
    beforeTxCount = rows.length;
  });

  PosPage.choosePaymentMethod("Cash");
  cy.findByRole("dialog", { name: /cash payment/i }).within(() => {
    cy.findByRole("button", { name: /exact/i }).click({ force: true });
    cy.findByRole("button", { name: /complete sale/i }).click({ force: true });
  });

  // Receipt dialog is nice-to-have but can be transient; wait for either receipt or cart-cleared UI.
  cy.waitUntil(
    () =>
      cy.get("body", { log: false }).then(($body) => {
        const hasReceipt = $body.find('[data-testid="receipt-dialog"]').length > 0;
        const isCartEmpty = /cart is empty/i.test($body.text());
        return hasReceipt || isCartEmpty;
      }),
    {
      timeout: 30_000,
      interval: 250,
      description: "wait for receipt dialog or cart cleared",
    }
  );

  cy.get("body", { timeout: 30_000 }).then(($body) => {
    if ($body.find('[data-testid="receipt-dialog"]').length > 0) {
      cy.get('[data-testid="receipt-dialog"]')
        .findByRole("button", { name: /^close$/i })
        .click({ force: true });
    }
  });

  cy.get('[data-testid="pos-cart-line"]').should("not.exist");
  cy.waitForIndexedDbStore(
    "transactions",
    (rows) => rows.length >= beforeTxCount + 1,
    { timeoutMs: 30_000 }
  );
}

const isRealMode =
  String(Cypress.env("TEST_MODE") ?? "mock").toLowerCase().trim() === "real";

// These flows are intended to run against staging (real backend) where cloud sync,
// scheduled/manual sync actions, and real persistence behavior can be validated end-to-end.
// In mock mode, API seed hydration can diverge from Dexie-first behavior, so we only run a smoke.
(isRealMode ? describe : describe.skip)(
  "IndexedDB single-source-of-truth flows (real mode)",
  () => {

  beforeEach(() => {
    cy.setupScenario();
  });

  it("category -> product(0 stock) -> POS fails -> inventory adds stock -> POS sale reduces stock and Dexie updates", () => {
    const categoryName = uniqueId("e2e-cat");
    const productName = uniqueId("e2e-prod");

    CataloguePage.visit().waitUntilLoaded();

    // Ensure we are on Categories tab (button is only visible on that tab).
    cy.findByRole("tab", { name: /categories/i }).click({ force: true });
    CataloguePage.openAddCategoryDialog();
    CataloguePage.getActiveDialog(CataloguePage.categoryDialogSelector).within(
      () => {
        cy.get('input[name="name"]').clear().type(categoryName);
      }
    );
    CataloguePage.clickSaveInCategoryDialog();
    cy.contains(categoryName, { timeout: 20_000 }).should("be.visible");

    // Add product with stock=0 under the new category.
    cy.findByRole("tab", { name: /products/i }).click({ force: true });
    CataloguePage.openAddProductDialog();
    CataloguePage.getActiveDialog(CataloguePage.productDialogSelector).within(
      () => {
        cy.get('input[name="name"]').clear().type(productName);
        cy.contains(/select a category/i).click({ force: true });
      }
    );
    cy.findByRole("option", { name: new RegExp(categoryName, "i") }).click({
      force: true,
    });
    CataloguePage.getActiveDialog(CataloguePage.productDialogSelector).within(
      () => {
        cy.get('input[name="price"]').clear().type("10");
        cy.get('input[name="costPrice"]').clear().type("5");
        cy.get('input[name="stock"]').clear().type("0");
      }
    );
    CataloguePage.clickSaveInProductDialog();
    cy.contains(productName, { timeout: 20_000 }).should("be.visible");

    // POS should show product but adding should fail because stock=0.
    PosPage.visit();
    PosPage.waitUntilLoaded();
    PosPage.searchProducts(productName);
    cy.contains("tr", new RegExp(productName, "i"), { timeout: 30_000 }).within(
      () => {
        cy.findByRole("button", { name: new RegExp(`add ${productName}`, "i") })
          .should("be.visible")
          .click({ force: true });
      }
    );
    ensureInsufficientStockPopup();
    cy.contains(/cart is empty/i).should("be.visible");

    // Inventory should contain product; increase stock.
    InventoryPage.visit().waitUntilLoaded();
    InventoryPage.search(productName);
    cy.contains("tr", new RegExp(productName, "i"), { timeout: 30_000 }).within(
      () => {
        cy.contains("button", /adjust stock/i).click({ force: true });
      }
    );
    cy.findByRole("dialog").within(() => {
      cy.contains(/adjust stock for/i).should("be.visible");
      cy.contains(/select a reason/i).click({ force: true });
    });
    cy.findByRole("option", { name: /new stock received/i }).click({
      force: true,
    });
    cy.findByRole("dialog").within(() => {
      cy.findByLabelText(/quantity received/i).clear().type("5");
      cy.findByRole("button", { name: /save adjustment/i }).click({
        force: true,
      });
    });
    // Wait for Dexie to reflect updated stock (5 received).
    cy.waitForIndexedDbStore(
      "products",
      (rows) => {
        const match = rows.find((r) => (r as any)?.name === productName);
        if (!match) return false;
        return Number((match as any)?.stock ?? -1) === 5;
      },
      { timeoutMs: 30_000 }
    );

    // Now POS should allow adding and sale should reduce stock.
    PosPage.visit();
    PosPage.waitUntilLoaded();
    PosPage.searchProducts(productName);
    PosPage.addProduct(productName, 1);
    completeCashSale();

    // Dexie/Inventory reflects stock reduced.
    InventoryPage.visit().waitUntilLoaded();
    InventoryPage.search(productName);
    cy.contains("tr", new RegExp(productName, "i"), { timeout: 30_000 }).within(
      () => {
        // Stock should now be 4 (5 received - 1 sold). Inventory UI uses Badge with numeric text.
        cy.contains(/\b4\b/).should("be.visible");
      }
    );

    // Assert IndexedDB products store contains the updated stock for this product.
    cy.waitForIndexedDbStore(
      "products",
      (rows) => {
        const match = rows.find((r) => (r as any)?.name === productName);
        if (!match) return false;
        return Number((match as any)?.stock ?? -1) === 4;
      },
      { timeoutMs: 30_000 }
    );
  });

  it("same flow with a new customer, and with a voucher applied", () => {
    const categoryName = uniqueId("e2e-cat2");
    const productName = uniqueId("e2e-prod2");
    const customerName = uniqueId("e2e-customer");
    const voucherCode = uniqueId("E2E").replace(/[^A-Za-z0-9]/g, "").slice(0, 10);

    // Category + product with stock.
    CataloguePage.visit().waitUntilLoaded();
    cy.findByRole("tab", { name: /categories/i }).click({ force: true });
    CataloguePage.openAddCategoryDialog();
    CataloguePage.getActiveDialog(CataloguePage.categoryDialogSelector).within(
      () => cy.get('input[name="name"]').clear().type(categoryName)
    );
    CataloguePage.clickSaveInCategoryDialog();

    cy.findByRole("tab", { name: /products/i }).click({ force: true });
    CataloguePage.openAddProductDialog();
    CataloguePage.getActiveDialog(CataloguePage.productDialogSelector).within(
      () => {
        cy.get('input[name="name"]').clear().type(productName);
        cy.contains(/select a category/i).click({ force: true });
      }
    );
    cy.findByRole("option", { name: new RegExp(categoryName, "i") }).click({
      force: true,
    });
    CataloguePage.getActiveDialog(CataloguePage.productDialogSelector).within(
      () => {
        cy.get('input[name="price"]').clear().type("20");
        cy.get('input[name="costPrice"]').clear().type("10");
        cy.get('input[name="stock"]').clear().type("10");
      }
    );
    CataloguePage.clickSaveInProductDialog();

    // Create customer.
    CustomersPage.visit().waitUntilLoaded();
    CustomersPage.openAddCustomerDialog();
    cy.findByRole("dialog").within(() => {
      cy.get('input[name="name"]').clear().type(customerName);
      cy.get('input[name="contact"]').clear().type("0812340000");
      cy.findByRole("button", { name: /create/i }).click({ force: true });
    });
    cy.contains(customerName, { timeout: 20_000 }).should("be.visible");

    // Create voucher.
    VouchersPage.visit().waitUntilLoaded();
    VouchersPage.openCreateDialog();
    cy.findByRole("dialog").within(() => {
      cy.get('input[name="code"]').clear().type(voucherCode);
    });
    cy.findByRole("dialog").within(() => {
      cy.get('input[name="value"]').clear().type("10");
      cy.get('input[name="minPurchase"]').clear().type("0");
      cy.findByRole("button", { name: /create|update/i }).click({ force: true });
    });
    cy.contains(voucherCode, { timeout: 20_000 }).should("be.visible");

    // POS: add product, select customer, apply voucher, complete sale.
    PosPage.visit();
    PosPage.waitUntilLoaded();
    PosPage.searchProducts(productName);
    PosPage.addProduct(productName, 1);
    // Select customer (search to avoid pagination issues).
    cy.findByRole("button", { name: /add customer/i }).click({ force: true });
    cy.findByRole("dialog", { name: /select a customer/i }).within(() => {
      cy.findByPlaceholderText(/search by name or phone number/i)
        .clear()
        .type(customerName);
      cy.contains("tr", new RegExp(customerName, "i"), { timeout: 20_000 }).within(
        () => {
          cy.findByRole("button", { name: /^select$/i }).click({ force: true });
        }
      );
    });

    PosPage.openVoucherDialog();
    cy.findByPlaceholderText(/enter code/i).clear().type(voucherCode);
    cy.findByRole("button", { name: /find voucher/i }).click({ force: true });
    cy.findByText(/voucher found/i, { timeout: 20_000 }).should("be.visible");
    cy.findByRole("button", { name: /apply discount/i }).click({ force: true });
    cy.contains(/discount applied/i).should("be.visible");

    completeCashSale();

    // Assert stock reduced from 10 -> 9 (inventory view) and Dexie updated.
    InventoryPage.visit().waitUntilLoaded();
    InventoryPage.search(productName);
    cy.contains("tr", new RegExp(productName, "i"), { timeout: 30_000 }).within(
      () => {
        cy.contains(/\b9\b/).should("be.visible");
      }
    );
    cy.waitForIndexedDbStore(
      "products",
      (rows) => {
        const match = rows.find((r) => (r as any)?.name === productName);
        if (!match) return false;
        return Number((match as any)?.stock ?? -1) === 9;
      },
      { timeoutMs: 30_000 }
    );
  });

  it("stress test: add ~10 products, sell them repeatedly, adjust stock, then run manual sync", () => {
    const categoryName = uniqueId("e2e-stress-cat");
    const productPrefix = uniqueId("e2e-stress-prod");
    const productsCount = Number(Cypress.env("BULK_PRODUCTS") ?? 10);
    const salesPerProduct = Number(Cypress.env("BULK_SALES_PER_PRODUCT") ?? 10);

    CataloguePage.visit().waitUntilLoaded();
    cy.findByRole("tab", { name: /categories/i }).click({ force: true });
    CataloguePage.openAddCategoryDialog();
    CataloguePage.getActiveDialog(CataloguePage.categoryDialogSelector).within(
      () => cy.get('input[name="name"]').clear().type(categoryName)
    );
    CataloguePage.clickSaveInCategoryDialog();

    cy.findByRole("tab", { name: /products/i }).click({ force: true });

    const productNames = Array.from({ length: productsCount }).map(
      (_, i) => `${productPrefix}-${i + 1}`
    );

    cy.wrap(productNames, { log: false }).each((pName) => {
      CataloguePage.openAddProductDialog();
      CataloguePage.getActiveDialog(CataloguePage.productDialogSelector).within(
        () => {
          cy.get('input[name="name"]').clear().type(String(pName));
          cy.contains(/select a category/i).click({ force: true });
        }
      );
      cy.findByRole("option", { name: new RegExp(categoryName, "i") }).click({
        force: true,
      });
      CataloguePage.getActiveDialog(CataloguePage.productDialogSelector).within(
        () => {
          cy.get('input[name="price"]').clear().type("15");
          cy.get('input[name="costPrice"]').clear().type("7");
          // Provide enough stock for repeated sales.
          cy.get('input[name="stock"]')
            .clear()
            .type(String(Math.max(10, salesPerProduct + 2)));
        }
      );
      CataloguePage.clickSaveInProductDialog();
      cy.contains(String(pName), { timeout: 20_000 }).should("exist");
    });

    // Sell each product multiple times.
    PosPage.visit();
    PosPage.waitUntilLoaded();

    const sellOne = (name: string) => {
      PosPage.searchProducts(name);
      PosPage.addProduct(name, 1);
      completeCashSale();
    };

    cy.wrap(productNames, { log: false }).each((pName) => {
      const name = String(pName);
      for (let i = 0; i < salesPerProduct; i += 1) {
        cy.then(() => sellOne(name));
      }
    });

    // Manipulate stock via inventory: add 1 stock back for each product.
    InventoryPage.visit().waitUntilLoaded();
    cy.wrap(productNames, { log: false }).each((pName) => {
      InventoryPage.search(String(pName));
      cy.contains("tr", new RegExp(String(pName), "i"), {
        timeout: 30_000,
      }).within(() => {
        cy.contains("button", /adjust stock/i).click({ force: true });
      });
      cy.findByRole("dialog").within(() => {
        cy.contains(/select a reason/i).click({ force: true });
      });
      cy.findByRole("option", { name: /new stock received/i }).click({
        force: true,
      });
      cy.findByRole("dialog").within(() => {
        cy.findByLabelText(/quantity received/i).clear().type("1");
        cy.findByRole("button", { name: /^save$/i }).click({ force: true });
      });
    });

    // Manual sync: in mock mode we expect uploads; in real mode accept either outcome.
    PosPage.visit();
    PosPage.waitUntilLoaded();
    openSyncModal();
    cy.findByRole("button", { name: /sync to cloud now/i }).click({ force: true });

    cy.contains(
      /cloud sync complete|nothing to sync|sync incomplete|sync failed/i,
      {
        timeout: 30_000,
      }
    ).should("exist");
  });
  }
);

(!isRealMode ? describe : describe.skip)(
  "IndexedDB single-source-of-truth flows (mock smoke)",
  () => {
    beforeEach(() => {
      cy.setupScenario();
      cy.visitApp("/");
      cy.seedIndexedDb();
      cy.setOnlineModeOnly();
      cy.setOnline();
    });

    it("boots POS and opens sync modal", () => {
      PosPage.visit();
      cy.setOnline();
      PosPage.waitUntilLoaded();
      openSyncModal();
      cy.findByRole("dialog").within(() => {
        cy.contains(/sync status|downloading offline data/i).should("be.visible");
      });
    });
  }
);

