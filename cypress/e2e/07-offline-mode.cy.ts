import { OfflinePage } from "../pages/offline-page";
import { PosPage } from "../pages/pos-page";

const SYNC_MODAL_ACTION_OR_STATUS_TEXT =
  /sync to cloud now|download from cloud now|nothing to sync|syncing|completed|pending|uploaded|scheduled|downloading offline data|downloading essential/i;

/** Matches sync modal / toasts / empty state while preloading or idle (see sync-status-modal). */
const SYNC_RELATED_BODY_TEXT =
  /syncing|completed|pending|nothing to sync|uploaded|cloud sync|scheduled|downloading|progress|operations synced|sync status|sync incomplete|sync failed/i;

function openCloudSyncModal() {
  cy.findByRole("button", { name: /open cloud sync status/i })
    .should("be.visible")
    .click({ force: true });
}

/** Avoid sync modal stuck on "Downloading Offline Data" when Dexie still has queued mutations. */
function clearIndexedDbMutationQueue() {
  cy.window().then((win) => {
    try {
      win.localStorage.removeItem("kasipos-mutation-queue");
    } catch {
      /* ignore */
    }
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

/**
 * DataPreloader only shows "Sync Status" actions (incl. Download) when preload is complete.
 * In Cypress runtime this can be forced by marking the current preload version in localStorage.
 */
function markPreloadAsReady() {
  cy.window().then((win) => {
    try {
      win.localStorage.setItem("kasipos-preload-version", "kasipos-v4");
      win.localStorage.setItem("kasipos-preload-timestamp", String(Date.now()));
    } catch {
      /* ignore */
    }
  });
}

function getOpenRoleDialogs(): JQuery<HTMLElement> {
  const withState = Cypress.$('[role="dialog"][data-state="open"]');
  if (withState.length) return withState;
  return Cypress.$('[role="dialog"]').filter((_, el) => {
    const r = el.getBoundingClientRect();
    return r.width > 2 && r.height > 2;
  });
}

/** "Download from cloud now" only mounts after preloading ends (title switches to "Sync Status"). */
function waitForSyncModalDownloadCloudReady() {
  cy.waitUntil(
    () => {
      const dlg = getOpenRoleDialogs().filter((_, el) => {
        const t = el.textContent ?? "";
        return (
          /sync status/i.test(t) &&
          /download from cloud now/i.test(t.toLowerCase())
        );
      });
      if (!dlg.length) return false;
      const btn = dlg
        .last()
        .find("button")
        .filter((_, b) =>
          /download from cloud now/i.test((b.textContent ?? "").trim())
        );
      const first = btn.first()[0];
      return Boolean(first && !(first as HTMLButtonElement).disabled);
    },
    {
      timeout: 240_000,
      interval: 500,
      description:
        'Sync modal shows "Sync Status" with enabled Download from cloud button',
    }
  );
}

function triggerManualSync() {
  openCloudSyncModal();
  cy.findByRole("dialog", {
    name: /sync status|downloading offline data/i,
    timeout: 45_000,
  }).should("be.visible");

  cy.waitUntil(
    () => {
      const dialogs = Cypress.$('[role="dialog"]:visible');
      if (!dialogs.length) return false;
      const last = dialogs.last();
      const hasSyncButton = last
        .find("button")
        .toArray()
        .some((el) => /sync to cloud now/i.test((el.textContent ?? "").trim()));
      const hasProgress = last.find('[role="progressbar"]').length > 0;
      const dialogText = (last.text() ?? "").toLowerCase();
      const hasStatusText = SYNC_MODAL_ACTION_OR_STATUS_TEXT.test(dialogText);
      return hasSyncButton || hasStatusText || hasProgress;
    },
    {
      timeout: 90_000,
      interval: 500,
      description: "wait for sync modal content (preload or actions)",
      errorMsg: "Sync status modal never reached a recognizable state",
    }
  );

  cy.waitUntil(
    () => {
      const dlg = Cypress.$('[role="dialog"]:visible').filter((_, el) => {
        const t = el.textContent ?? "";
        return /sync status|downloading offline data/i.test(t);
      });
      if (!dlg.length) return false;
      return dlg
        .last()
        .find("button")
        .toArray()
        .some((el) => /sync to cloud now/i.test((el.textContent ?? "").trim()));
    },
    {
      timeout: 180_000,
      interval: 500,
      description: 'wait for enabled "Sync to cloud now" after preload',
      errorMsg: '"Sync to cloud now" did not appear in cloud sync modal',
    }
  );

  cy.findByRole("dialog", {
    name: /sync status|downloading offline data/i,
    timeout: 45_000,
  }).within(() => {
    cy.contains("button", /sync to cloud now/i, { timeout: 20_000 })
      .should("be.visible")
      .click({ force: true });
  });
}

describe("Offline mode", () => {
  beforeEach(() => {
    cy.setupScenario();
    PosPage.visit();
    cy.seedIndexedDb();
    markPreloadAsReady();
    clearIndexedDbMutationQueue();
    cy.reload();
    cy.waitForAppReady("/");
    cy.setOnline();
    // Customers (and other Dexie-backed lists) load on mount; seed runs after first visit, so reload POS.
    PosPage.visit();
    PosPage.waitUntilLoaded();
  });

  it("allows offline POS sale and opens the cloud sync status modal", () => {
    PosPage.ensureProductCarouselView();
    PosPage.searchProducts("Cola");
    PosPage.addProduct("Cola 330ml", 2);
    PosPage.selectCustomerFromDialog("Alice Mokoena");
    cy.setOffline();
    cy.get('button[aria-label="Open cloud sync status"]', {
      timeout: 20_000,
    }).should("be.visible");
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
    triggerManualSync();
    cy.get("body", { timeout: 30_000 })
      .invoke("text")
      .should("match", SYNC_MODAL_ACTION_OR_STATUS_TEXT);
  });

  it("simulates backend failure when products API returns an error", () => {
    cy.setOnline();
    PosPage.visit();
    PosPage.waitUntilLoaded();
    clearIndexedDbMutationQueue();
    markPreloadAsReady();
    PosPage.visit();
    PosPage.waitUntilLoaded();
    // After POS is ready so DataPreloader iframe passes still hit default mocks, not 503.
    cy.intercept(
      {
        method: "GET",
        url: /\/products(\?.*)?$/,
      },
      {
        statusCode: 503,
        body: { message: "Service unavailable" },
      }
    ).as("products503");
    // Catalogue reads from Dexie on the POS screen; network pulls happen via manual cloud sync.
    openCloudSyncModal();
    cy.findByRole("dialog", {
      name: /sync status|downloading offline data/i,
      timeout: 30_000,
    }).should("be.visible");
    waitForSyncModalDownloadCloudReady();
    cy.findByRole("button", {
      name: /download from cloud now/i,
      timeout: 30_000,
    })
      .should("be.visible")
      .and("not.be.disabled")
      .click({ force: true });
    cy.wait("@products503", { timeout: 45_000 });
    cy.contains(/products/i).should("be.visible");
  });
});
