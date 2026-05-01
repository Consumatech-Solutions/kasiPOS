import { CataloguePage } from "../pages/catalogue-page";
import { CustomersPage } from "../pages/customers-page";
import { PosPage } from "../pages/pos-page";

const SYNC_MODAL_ACTION_OR_STATUS_TEXT =
  /sync to cloud now|nothing to sync|syncing|completed|pending|uploaded|scheduled/i;

function openCloudSyncModal() {
  cy.findByRole("button", { name: /open cloud sync status/i })
    .should("be.visible")
    .click({ force: true });
}

function triggerManualSync() {
  openCloudSyncModal();
  cy.waitUntil(
    () =>
      cy.get('[role="dialog"]', { log: false }).then(($dialog) => {
        const hasSyncButton = $dialog
          .last()
          .find("button")
          .toArray()
          .some((el) =>
            /sync to cloud now/i.test((el.textContent ?? "").trim())
          );
        const dialogText = ($dialog.last().text() ?? "").toLowerCase();
        const hasStatusText = SYNC_MODAL_ACTION_OR_STATUS_TEXT.test(dialogText);
        return hasSyncButton || hasStatusText;
      }),
    {
      timeout: 60_000,
      interval: 500,
      description: "wait for sync action button",
      errorMsg: "Sync action button was not rendered in cloud sync modal",
    }
  );
  // CI can validly settle in a terminal sync state where no manual action button is shown.
  cy.findByRole("dialog", { name: /sync status/i, timeout: 45_000 }).then(
    ($dialog) => {
      const hasSyncButton = $dialog
        .find("button")
        .toArray()
        .some((el) => /sync to cloud now/i.test((el.textContent ?? "").trim()));
      if (hasSyncButton) {
        cy.wrap($dialog)
          .contains("button", /sync to cloud now/i, { timeout: 20_000 })
          .should("be.visible")
          .click({ force: true });
        return;
      }
      expect($dialog.text()).to.match(SYNC_MODAL_ACTION_OR_STATUS_TEXT);
    }
  );
}

function createCustomerOffline(name: string, contact: string) {
  CustomersPage.visit();
  CustomersPage.waitUntilLoaded();
  cy.setOffline();
  CustomersPage.openAddCustomerDialog();
  cy.findByLabelText(/customer name/i).type(name);
  cy.findByLabelText(/contact/i).type(contact);
  cy.findByLabelText(/loyalty points/i).clear();
  cy.findByLabelText(/loyalty points/i).type("0");
  cy.findByRole("button", { name: /^create$/i }).click({ force: true });
  cy.contains(/queued|offline/i, { timeout: 15_000 }).should("be.visible");
}

describe("Offline sync regressions", () => {
  beforeEach(() => {
    cy.setupScenario();
    cy.visitApp("/");
    cy.seedIndexedDb();
    cy.setOnline();
  });

  it("syncs offline-created customer after reconnect without store load errors", () => {
    createCustomerOffline("Offline Queue Customer", "0821110000");

    cy.setOnline();
    triggerManualSync();

    cy.wait("@createCustomer", { timeout: 30_000 })
      .its("response.statusCode")
      .should("eq", 201);
    cy.contains(/failed to load store/i).should("not.exist");
    cy.get("body")
      .invoke("text")
      .should("not.match", /failed to load store/i);
  });

  it("syncs offline category and product in dependency order after reconnect", () => {
    const categoryName = `Offline Cat ${Date.now()}`;
    const productName = `Offline Product ${Date.now()}`;

    CataloguePage.visit();
    CataloguePage.waitUntilLoaded();
    cy.setOffline();

    cy.findByRole("tab", { name: /^categories$/i })
      .first()
      .click({ force: true });
    CataloguePage.openAddCategoryDialog();
    CataloguePage.getActiveDialog(CataloguePage.categoryDialogSelector)
      .find('input[name="name"]')
      .clear()
      .type(categoryName);
    CataloguePage.clickSaveInCategoryDialog();

    cy.findByRole("tab", { name: /^products$/i })
      .first()
      .click({ force: true });
    CataloguePage.openAddProductDialog();
    cy.get('input[name="name"]').last().clear();
    cy.get('input[name="name"]').last().type(productName);
    cy.get('input[name="price"]').last().clear();
    cy.get('input[name="price"]').last().type("25");
    cy.get('input[name="costPrice"]').last().clear();
    cy.get('input[name="costPrice"]').last().type("15");
    cy.get(CataloguePage.productDialogSelector)
      .last()
      .find('[role="combobox"]')
      .first()
      .click({ force: true });
    cy.findByRole("option", {
      name: new RegExp(categoryName, "i"),
      timeout: 10_000,
    }).click({ force: true });
    CataloguePage.clickSaveInProductDialog();

    cy.setOnline();
    triggerManualSync();

    cy.wait("@createCategory", { timeout: 30_000 }).then((interception) => {
      expect(interception.response?.statusCode).to.eq(201);
      expect(interception.request.body?.name).to.match(
        new RegExp(categoryName, "i")
      );
    });
    cy.wait("@createProduct", { timeout: 30_000 }).then((interception) => {
      expect(interception.response?.statusCode).to.eq(201);
      expect(String(interception.request.body?.name ?? "")).to.match(
        new RegExp(productName, "i")
      );
      expect(interception.request.body?.categoryId).to.be.a("string");
      expect(
        String(interception.request.body?.categoryId ?? "").length
      ).to.be.greaterThan(0);
    });

    cy.contains(/failed to load store/i).should("not.exist");
  });

  it("completes cash sale after reconnect using synced offline-created customer id", () => {
    const customerName = `Reconnect Cash ${Date.now()}`;
    createCustomerOffline(customerName, "0823330000");

    cy.setOnline();
    triggerManualSync();
    cy.wait("@createCustomer", { timeout: 30_000 })
      .its("response.statusCode")
      .should("eq", 201);

    PosPage.visit();
    PosPage.waitUntilLoaded();
    PosPage.ensureProductCarouselView();
    PosPage.searchProducts("Cola");
    PosPage.addProduct("Cola 330ml", 1);
    PosPage.selectCustomerFromDialog(customerName);
    PosPage.choosePaymentMethod("Cash");
    cy.findByRole("dialog", { name: /cash payment/i }).within(() => {
      cy.findByRole("button", { name: /exact/i }).click({ force: true });
      cy.findByRole("button", { name: /complete sale/i }).click({
        force: true,
      });
    });
    cy.wait("@createTransaction", { timeout: 30_000 }).then((interception) => {
      const body = interception.request.body as { customerId?: string };
      expect(String(body.customerId ?? "")).to.match(/^cust-/i);
      expect(String(body.customerId ?? "")).not.to.match(/^temp-/i);
    });
    cy.contains(/failed to load store/i).should("not.exist");
  });

  it("completes credit sale after reconnect", () => {
    PosPage.visit();
    PosPage.waitUntilLoaded();
    cy.setOffline();
    cy.setOnline();

    PosPage.ensureProductCarouselView();
    PosPage.searchProducts("Cola");
    PosPage.addProduct("Cola 330ml", 1);
    cy.contains("button", /^credit$/i, { timeout: 15_000 }).click({
      force: true,
    });
    cy.findByRole("dialog", {
      name: /sell on credit/i,
      timeout: 20_000,
    }).within(() => {
      cy.contains("button", /select customer/i).click({ force: true });
    });
    cy.contains("button", /alice mokoena/i, { timeout: 15_000 }).click({
      force: true,
    });
    cy.contains("button", /confirm credit sale/i, { timeout: 15_000 }).click({
      force: true,
    });

    cy.wait("@createTransaction", { timeout: 30_000 }).then((interception) => {
      const body = interception.request.body as {
        paymentMethod?: string;
        customerId?: string;
        creditDetails?: unknown;
      };
      expect(body.paymentMethod).to.eq("Credit");
      expect(String(body.customerId ?? "")).not.to.match(/^temp-/i);
      expect(body.creditDetails).not.to.equal(undefined);
    });
    cy.contains(/failed to load store/i).should("not.exist");
  });
});
