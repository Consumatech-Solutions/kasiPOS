import { TransactionsPage } from "../pages/transactions-page";

describe("Transactions", () => {
  beforeEach(() => {
    cy.setupScenario();
    TransactionsPage.visit();
    cy.seedIndexedDb();
    cy.setOnline();
    TransactionsPage.waitUntilLoaded();
  });

  it("loads transaction list", () => {
    cy.location("pathname").should("eq", "/transactions");
    cy.contains(/transaction #/i).should("be.visible");
  });

  it("filters transactions by search", () => {
    cy.findByPlaceholderText(/search by order # or customer/i).type("Alice");
    cy.contains(/customer: alice mokoena/i).should("be.visible");
  });

  it("filters transactions by date", () => {
    cy.findByRole("button", { name: /filter by date/i }).click();
    cy.findByRole("gridcell", { name: /^12$/ }).click({ force: true });
    cy.contains(/transaction #txn-001/i).should("be.visible");
  });

  it("expands transaction details with payment and item totals", () => {
    cy.contains(/transaction #txn-001/i).click();
    cy.contains(/cola 330ml/i).should("be.visible");
    cy.contains(/2 x r12\.50/i).should("be.visible");
    cy.contains(/^cash$/i).should("be.visible");
    cy.contains(/r25\.00/i).should("be.visible");
  });

  it("clears applied filters", () => {
    cy.findByPlaceholderText(/search by order # or customer/i).type("Alice");
    cy.findByRole("button", { name: /clear filters/i }).click();
    cy.findByPlaceholderText(/search by order # or customer/i).should(
      "have.value",
      ""
    );
  });

  it.skip("handles backend failure state", () => {
    cy.intercept("GET", "**/transactions*", {
      statusCode: 500,
      body: { message: "Server error" },
    }).as("transactionsFailure");
    cy.reload();
    cy.wait("@transactionsFailure");
    cy.contains(/server error/i).should("be.visible");
  });
});
