import { CustomersPage } from "../pages/customers-page";
import { PosPage } from "../pages/pos-page";

describe("Customers", () => {
  beforeEach(() => {
    cy.setupScenario();
    CustomersPage.visit();
    cy.seedIndexedDb();
    CustomersPage.visit();
    cy.setOnline();
    CustomersPage.waitUntilLoaded();
  });

  it("loads customers list", () => {
    cy.location("pathname").should("eq", "/customers");
    cy.contains("td", /alice mokoena/i).should("be.visible");
  });

  it("creates customer with zero loyalty points", () => {
    CustomersPage.openAddCustomerDialog();
    cy.findByLabelText(/customer name/i).type("E2E Customer");
    cy.findByLabelText(/contact/i).type("0829990000");
    cy.findByLabelText(/loyalty points/i).clear();
    cy.findByLabelText(/loyalty points/i).type("0");
    cy.findByRole("button", { name: /^create$/i }).click();
    cy.contains("tr", /e2e customer/i).should("contain.text", "0");
  });

  it("edits customer details", () => {
    cy.contains("tr", /brian nkosi/i).within(() => {
      cy.get("button").eq(1).click({ force: true });
    });
    cy.findByLabelText(/customer name/i).clear();
    cy.findByLabelText(/customer name/i).type("Brian Updated");
    cy.findByLabelText(/contact/i).clear();
    cy.findByLabelText(/contact/i).type("0821999000");
    cy.findByRole("button", { name: /^update$/i }).click();
    cy.contains("tr", /brian updated/i).should("be.visible");
  });

  it("deletes customer with confirmation", () => {
    cy.contains("tr", /cindy naidoo/i).within(() => {
      cy.get("button").last().click({ force: true });
    });
    cy.findByRole("alertdialog").within(() => {
      cy.findByRole("button", { name: /^delete$/i }).click();
    });
    cy.contains("td", /cindy naidoo/i).should("not.exist");
  });

  it("opens purchase history dialog", () => {
    cy.contains("tr", /alice mokoena/i).within(() => {
      cy.get("button").first().click({ force: true });
    });
    cy.findByRole("dialog").within(() => {
      cy.findByText(/purchase history for alice mokoena/i).should("be.visible");
      cy.contains(/#txn-001/i, { timeout: 20_000 }).should("be.visible");
    });
  });

  it.skip("updates loyalty points after completed purchase", () => {
    const startingPoints = 12;

    PosPage.visit();
    PosPage.waitUntilLoaded();
    PosPage.addProduct("Cola 330ml", 2);
    PosPage.selectCustomerFromDialog("Alice Mokoena");
    cy.findByRole("button", { name: /alice mokoena/i, timeout: 15_000 }).should(
      "be.visible"
    );
    PosPage.choosePaymentMethod("Cash");
    cy.get("body").then(($body) => {
      if ($body.find("#tendered").length === 0) {
        PosPage.choosePaymentMethod("Cash");
      }
    });
    cy.get("#tendered", { timeout: 15_000 }).should("be.visible");
    cy.contains('h2, [role="heading"]', /^cash payment$/i, { timeout: 15_000 })
      .closest('[role="dialog"]')
      .as("cashDialog");
    cy.get("@cashDialog").within(() => {
      cy.contains("button", /^exact$/i, { timeout: 15_000 }).click({
        force: true,
      });
      cy.contains("button", /complete sale/i, { timeout: 15_000 })
        .should("be.visible")
        .and("not.be.disabled")
        .click({ force: true });
    });
    
    cy.get('[data-testid="receipt-dialog"]', { timeout: 25_000 }).should(
      "be.visible"
    );
    cy.get('[data-testid="receipt-dialog"]')
      .findByRole("button", { name: /^close$/i })
      .click({ force: true });

    cy.wrap(14, { log: false }).as("expectedPoints");

    cy.setOnline();
    cy.get('button[aria-label="Open cloud sync status"]').first().click({ force: true });
    cy.findByRole("dialog", { name: /sync status/i, timeout: 15_000 }).then(
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
          cy.wait("@createTransaction");
        }
      }
    );

    CustomersPage.visit();
    cy.seedIndexedDb();
    cy.setOnline();
    CustomersPage.waitUntilLoaded();
    cy.get<number>("@expectedPoints").then((expectedPoints) => {
      cy.findByPlaceholderText(/search by name or contact/i, {
        timeout: 20_000,
      }).clear();
      cy.findByPlaceholderText(/search by name or contact/i, {
        timeout: 20_000,
      }).type("Alice");
      cy.contains(/alice mokoena/i, { timeout: 20_000 })
        .parents("tr")
        .should("contain.text", String(expectedPoints));
    });
  });

  it.skip("handles customer API failure", () => {
    cy.intercept("POST", "**/customers", {
      statusCode: 500,
      body: { message: "Create failed" },
    }).as("customerCreateFailure");
    CustomersPage.openAddCustomerDialog();
    cy.findByLabelText(/customer name/i).type("Failure User");
    cy.findByLabelText(/contact/i).type("000");
    cy.findByRole("button", { name: /^create$/i }).click();
    cy.wait("@customerCreateFailure");
    cy.findByRole("dialog", { name: /add customer/i, timeout: 15_000 }).should(
      "be.visible"
    );
    cy.contains("tr", /failure user/i).should("not.exist");
  });
});
