import { OfflinePage } from "../pages/offline-page";
import { PosPage } from "../pages/pos-page";

function openCloudSyncModal() {
  cy.findByRole("button", { name: /open cloud sync status/i })
    .should("be.visible")
    .click({ force: true });
}

function ensureCloudSyncModalReady() {
  openCloudSyncModal();
  cy.findByRole("dialog", {
    name: /sync status|downloading offline data/i,
    timeout: 30_000,
  }).should("be.visible");

  cy.waitUntil(
    () =>
      cy.get("body", { log: false }).then(($body) => {
        const hasSyncButton = $body
          .find('[role="dialog"] button')
          .toArray()
          .some((el) =>
            /sync to cloud now/i.test((el.textContent ?? "").trim()),
          );
        return hasSyncButton;
      }),
    {
      timeout: 60_000,
      interval: 500,
      description: "wait for sync status actions",
      errorMsg: "Sync status modal never reached actionable state",
    },
  );
}

describe("Offline mode", () => {
  beforeEach(() => {
    cy.setupScenario();
    PosPage.visit();
    cy.setOnline();
    PosPage.waitUntilLoaded();
  });

  it("allows offline POS sale and opens the cloud sync status modal", () => {
    PosPage.ensureProductCarouselView();
    PosPage.searchProducts("Cola");
    PosPage.addProduct("Cola 330ml", 2);
    cy.setOffline();
    cy.get('button[title*="Offline"]', { timeout: 20_000 }).should(
      "be.visible",
    );
    PosPage.selectCustomerFromDialog("Alice Mokoena");
    PosPage.choosePaymentMethod("Cash");
    cy.findByRole("dialog", { name: /cash payment/i }).within(() => {
      cy.findByRole("button", { name: /exact/i }).click({ force: true });
      cy.findByRole("button", { name: /complete sale/i }).click({
        force: true,
      });
    });
    cy.findByRole("dialog", { name: /receipt/i, timeout: 25_000 }).should(
      "be.visible",
    );
    cy.contains(/cart is empty/i).should("be.visible");
    cy.findByRole("dialog", { name: /receipt/i, timeout: 15_000 }).within(
      () => {
        cy.findByRole("button", { name: /close/i }).click({ force: true });
      },
    );
    cy.findByRole("dialog", { name: /receipt/i }).should("not.exist");
    openCloudSyncModal();
    cy.findByRole("dialog", {
      name: /sync status|downloading offline data/i,
      timeout: 20_000,
    })
      .should("be.visible")
      .invoke("text")
      .should(
        "match",
        /sync status|downloading essential|cloud sync|scheduled at/i,
      );
    cy.setOnline();
  });

  it("loads standalone offline page", () => {
    OfflinePage.visit();
    OfflinePage.waitUntilLoaded();
    cy.location("pathname").should("eq", "/offline");
    cy.findByRole("button", { name: /retry/i }).should("be.visible");
  });

  it("reconnects and allows manual sync trigger", () => {
    cy.setOnline();
    ensureCloudSyncModalReady();
    cy.findByRole("dialog", { name: /sync status/i, timeout: 45_000 }).within(
      () => {
        cy.findByRole("button", {
          name: /sync to cloud now/i,
          timeout: 15_000,
        }).click({ force: true });
      },
    );
    cy.get("body")
      .contains(
        /syncing|completed|pending|nothing to sync|uploaded|cloud sync/i,
        { timeout: 20_000 },
      )
      .should("exist");
  });

  it("simulates backend failure when products API returns an error", () => {
    const api = (
      (Cypress.env("API_BASE_URL") as string) ?? "http://localhost:3000"
    ).replace(/\/+$/, "");
    cy.intercept("GET", `${api}/products*`, {
      statusCode: 503,
      body: { message: "Service unavailable" },
    }).as("products503");
    cy.setOnline();
    PosPage.visit();
    cy.wait("@products503", { timeout: 25_000 });
    cy.contains(/products/i).should("be.visible");
  });
});
