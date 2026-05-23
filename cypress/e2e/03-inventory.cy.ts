import { InventoryPage } from "../pages/inventory-page";

describe("Inventory", () => {
  beforeEach(() => {
    cy.setupScenario();
    InventoryPage.visit();
    cy.seedIndexedDb();
    cy.setOnline();
    InventoryPage.waitUntilLoaded();
  });

  it("loads inventory list with stock levels", () => {
    cy.location("pathname").should("eq", "/inventory");
    cy.contains("td", /cola 330ml/i).should("be.visible");
    cy.contains("td", /still water 500ml/i).should("be.visible");
  });

  it("filters inventory by search and category", () => {
    InventoryPage.search("Water");
    cy.contains("td", /still water 500ml/i).should("be.visible");
    cy.contains("td", /cola 330ml/i).should("not.exist");

    cy.get('button[role="combobox"]', { timeout: 15_000 })
      .first()
      .click({ force: true });
    cy.findByRole("option", { name: /^beverages$/i, timeout: 15_000 }).click({
      force: true,
    });
    cy.contains("td", /still water 500ml/i).should("be.visible");
  });

  it("applies low stock filter view", () => {
    cy.findByLabelText(/low stock only/i).click({ force: true });
    cy.contains("td", /hand soap/i).should("be.visible");
  });

  it("creates stock adjustment with reason and updates stock", () => {
    const api = (
      (Cypress.env("API_BASE_URL") as string) ?? "http://localhost:9002"
    ).replace(/\/+$/, "");
    // Offline applies stock to Dexie immediately; the online path only queues sync.
    // Connectivity HEAD treats non-zero HTTP responses as online — force a network error.
    cy.intercept(
      { method: "HEAD", url: `${api}*` },
      {
        forceNetworkError: true,
      }
    ).as("blockConnectivityHead");
    cy.setOffline();
    // Remount so useNetworkStatus starts while offline (beforeEach leaves the page online).
    InventoryPage.visit();
    InventoryPage.waitUntilLoaded();
    cy.contains("tr", /still water 500ml/i).within(() => {
      cy.findByRole("button", { name: /adjust stock/i }).click();
    });
    cy.findByRole("dialog", { timeout: 15_000 }).as("adjustDialog");
    cy.get("@adjustDialog")
      .findByText(/adjust stock for still water 500ml/i)
      .should("be.visible");
    cy.get("@adjustDialog")
      .find('button[role="combobox"]', { timeout: 15_000 })
      .first()
      .click({ force: true });
    // Radix options render in a portal outside dialog subtree.
    cy.findByRole("option", {
      name: /new stock received/i,
      timeout: 15_000,
    }).click({ force: true });
    cy.get('[role="dialog"]', { timeout: 15_000 })
      .last()
      .within(() => {
        cy.get('input[type="number"]', { timeout: 15_000 }).should(
          "be.visible"
        );
        cy.get('input[type="number"]', { timeout: 15_000 }).clear();
        cy.get('input[type="number"]', { timeout: 15_000 }).type("15");
        cy.findByLabelText(/note/i, { timeout: 15_000 }).type("E2E restock");
        cy.findByRole("button", {
          name: /save adjustment/i,
          timeout: 15_000,
        }).click();
      });
    cy.findByRole("dialog").should("not.exist");
    cy.waitForIndexedDbStore(
      "productCache",
      (rows) =>
        Array.isArray(rows) &&
        rows.some((r: unknown) => {
          const row = r as Record<string, unknown>;
          const id = String(row.id ?? "");
          const stock = Number(row.stock);
          return id === "prod-water-001" && stock === 23;
        }),
      { timeoutMs: 30_000 }
    );
    cy.waitUntil(
      () =>
        cy
          .contains("tr", /still water 500ml/i)
          .then(($tr) => /\b23\b/.test($tr.find("td").eq(3).text())),
      {
        timeout: 20_000,
        interval: 400,
        description: "inventory row shows updated stock",
      }
    );
  });

  it("shows stock adjustment history", () => {
    cy.contains("tr", /still water 500ml/i).within(() => {
      cy.findByRole("button", { name: /history/i }).click();
    });
    cy.findByRole("dialog", { timeout: 15_000 }).as("historyDialog");
    cy.get("@historyDialog")
      .contains(/stock adjustment history for still water 500ml/i)
      .should("be.visible");
    cy.get("@historyDialog")
      .contains(/new stock received/i)
      .should("be.visible");
  });

  it("edits low stock trigger inline", () => {
    cy.contains("td", /cola 330ml/i, { timeout: 15_000 })
      .parents("tr")
      .first()
      .as("colaRow");
    cy.get("@colaRow").within(() => {
      // Low Stock Trigger is the 5th column (Image, Name, Category, Stock, Low Stock Trigger, Actions).
      cy.get("td:nth-child(5) button", { timeout: 15_000 })
        .first()
        .click({ force: true });
    });
    cy.get("@colaRow")
      .find('input[type="number"]', { timeout: 15_000 })
      .as("colaThresholdInput");
    cy.get("@colaThresholdInput").should("be.visible");
    cy.get("@colaThresholdInput").click();
    cy.get("@colaThresholdInput").type("{selectall}7", { delay: 0 });
    cy.get("@colaThresholdInput").should("have.value", "7");
    cy.get("@colaThresholdInput").blur();
    cy.waitForIndexedDbStore(
      "productCache",
      (rows) =>
        Array.isArray(rows) &&
        rows.some((r: unknown) => {
          const row = r as Record<string, unknown>;
          return (
            String(row.id ?? "") === "prod-cola-001" &&
            Number(row.lowStockThreshold) === 7
          );
        }),
      { timeoutMs: 30_000 }
    );
    cy.contains("tr", /cola 330ml/i, { timeout: 20_000 }).should(
      "contain.text",
      "7"
    );
  });
});
