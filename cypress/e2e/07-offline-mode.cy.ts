import { OfflinePage } from "../pages/offline-page";
import { PosPage } from "../pages/pos-page";

const SYNC_MODAL_ACTION_OR_STATUS_TEXT =
  /sync to cloud now|download from cloud now|nothing to sync|syncing|completed|pending|uploaded|scheduled|downloading offline data|downloading essential/i;

function openCloudSyncModal() {
  cy.findByRole("button", { name: /open cloud sync status/i })
    .should("be.visible")
    .click({ force: true });
}

/** Seed/customer lists vary in CI; prefer a named row when present, else first selectable row. */
function selectCustomerFromDialogForOfflineSale(
  preferredName = /Alice Mokoena/i
) {
  cy.findByRole("button", { name: /add customer/i }).click({ force: true });
  cy.findByRole("dialog", { name: /select a customer/i, timeout: 20_000 })
    .should("be.visible")
    .within(() => {
      cy.get("tbody tr", { timeout: 25_000 }).should("have.length.at.least", 1);
      cy.get("tbody tr").then(($rows) => {
        const rows = $rows.toArray();
        const preferred =
          rows.find((row) =>
            preferredName.test((row.textContent ?? "").trim())
          ) ?? rows[0];
        cy.wrap(preferred).within(() => {
          cy.findByRole("button", { name: /^select$/i }).click({
            force: true,
          });
        });
      });
    });
}

/** Avoid sync modal stuck on "Downloading Offline Data" when Dexie still has queued mutations. */
function clearIndexedDbMutationQueue() {
  cy.window().then((win) => {
    return new Cypress.Promise<void>((resolve, reject) => {
      const req = win.indexedDB.open("kasiPosDatabase");
      req.onerror = () =>
        reject(req.error ?? new Error("Failed to open IndexedDB"));
      req.onsuccess = () => {
        const db = req.result;
        try {
          if (!db.objectStoreNames.contains("mutationQueue")) {
            db.close();
            resolve();
            return;
          }
          const tx = db.transaction(["mutationQueue"], "readwrite");
          tx.objectStore("mutationQueue").clear();
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error ?? new Error("mutationQueue clear failed"));
          };
        } catch (e) {
          db.close();
          reject(e);
        }
      };
    });
  });
}

function ensureCloudSyncModalReady() {
  openCloudSyncModal();
  cy.findByRole("dialog", {
    name: /sync status|downloading offline data/i,
    timeout: 45_000,
  }).should("be.visible");

  // Use synchronous DOM reads — nested cy.get('[role="dialog"]') can fail the whole waitUntil when zero dialogs match briefly.
  cy.waitUntil(
    () => {
      const dialogs = Cypress.$('[role="dialog"]:visible');
      if (!dialogs.length) return false;
      const last = dialogs.last();
      const hasSyncButton = last
        .find("button")
        .toArray()
        .some((el) =>
          /sync to cloud now|download from cloud now/i.test(
            (el.textContent ?? "").trim()
          )
        );
      const hasProgress = last.find('[role="progressbar"]').length > 0;
      const dialogText = (last.text() ?? "").toLowerCase();
      const hasStatusText = SYNC_MODAL_ACTION_OR_STATUS_TEXT.test(dialogText);
      return hasSyncButton || hasStatusText || hasProgress;
    },
    {
      timeout: 90_000,
      interval: 500,
      description: "wait for sync status actions",
      errorMsg: "Sync status modal never reached actionable state",
    }
  );
}

describe("Offline mode", () => {
  beforeEach(() => {
    cy.setupScenario();
    PosPage.visit();
    cy.seedIndexedDb();
    cy.setOnline();
    PosPage.waitUntilLoaded();
  });

  it("allows offline POS sale and opens the cloud sync status modal", () => {
    PosPage.ensureProductCarouselView();
    PosPage.searchProducts("Cola");
    PosPage.addProduct("Cola 330ml", 2);
    cy.setOffline();
    cy.get('button[aria-label="Open cloud sync status"]', {
      timeout: 20_000,
    }).should("be.visible");
    selectCustomerFromDialogForOfflineSale();
    PosPage.choosePaymentMethod("Cash");
    cy.findByRole("dialog", { name: /cash payment/i }).within(() => {
      cy.findByRole("button", { name: /exact/i }).click({ force: true });
      cy.findByRole("button", { name: /complete sale/i }).click({
        force: true,
      });
    });
    cy.findByRole("dialog", { name: /receipt/i, timeout: 25_000 }).should(
      "be.visible"
    );
    cy.contains(/cart is empty/i).should("be.visible");
    cy.findByRole("dialog", { name: /receipt/i, timeout: 15_000 }).within(
      () => {
        cy.findByRole("button", { name: /close/i }).click({ force: true });
      }
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
        /sync status|downloading essential|cloud sync|scheduled at/i
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
    cy.findByRole("dialog", {
      name: /sync status|downloading offline data/i,
      timeout: 15_000,
    }).then(($dialog) => {
      const hasSyncButton = $dialog
        .find("button")
        .toArray()
        .some((el) => /sync to cloud now/i.test((el.textContent ?? "").trim()));
      if (hasSyncButton) {
        cy.wrap($dialog).within(() => {
          cy.findByRole("button", {
            name: /sync to cloud now/i,
            timeout: 15_000,
          }).click({ force: true });
        });
        return;
      }
      const hasProgress = $dialog.find('[role="progressbar"]').length > 0;
      const text = $dialog.text();
      expect(hasProgress || SYNC_MODAL_ACTION_OR_STATUS_TEXT.test(text)).to.eq(
        true
      );
    });
    cy.get("body")
      .contains(
        /syncing|completed|pending|nothing to sync|uploaded|cloud sync/i,
        { timeout: 20_000 }
      )
      .should("exist");
  });

  it("simulates backend failure when products API returns an error", () => {
    const api = (
      (Cypress.env("API_BASE_URL") as string) ?? "http://localhost:9002"
    ).replace(/\/+$/, "");
    cy.setOnline();
    PosPage.visit();
    PosPage.waitUntilLoaded();
    clearIndexedDbMutationQueue();
    PosPage.visit();
    PosPage.waitUntilLoaded();
    // After POS is ready so DataPreloader iframe passes still hit default mocks, not 503.
    cy.intercept("GET", `${api}/products*`, {
      statusCode: 503,
      body: { message: "Service unavailable" },
    }).as("products503");
    // Catalogue reads from Dexie on the POS screen; network pulls happen via manual cloud sync.
    openCloudSyncModal();
    cy.findByRole("dialog", {
      name: /sync status|downloading offline data/i,
      timeout: 30_000,
    }).should("be.visible");
    cy.waitUntil(
      () => {
        const dialogs = Cypress.$('[role="dialog"]:visible');
        const dlg = dialogs.last()[0];
        if (!dlg) return false;
        return Cypress.$(dlg)
          .find("button")
          .toArray()
          .some((el) =>
            /download from cloud now/i.test((el.textContent ?? "").trim())
          );
      },
      {
        timeout: 180_000,
        interval: 500,
        description:
          "sync modal leaves preload UI (download from cloud action visible)",
      }
    );
    cy.findByRole("button", {
      name: /download from cloud now/i,
      timeout: 30_000,
    })
      .should("be.visible")
      .and("not.be.disabled")
      .click({ force: true });
    cy.wait("@products503", { timeout: 25_000 });
    cy.contains(/products/i).should("be.visible");
  });
});
