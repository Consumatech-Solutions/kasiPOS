/// <reference types="cypress" />
import type { SeedAuthSession, SeedData } from "./types";
import { registerApiMocks } from "./mocks";

const KASI_POS_DB_NAME = "kasiPosDatabase";
const API_BASE_URL =
  (Cypress.env("API_BASE_URL") as string) ?? "http://localhost:9002";
const NORMALIZED_API_BASE_URL = API_BASE_URL.replace(/\/+$/, "");

let mockControls: { setOffline: (value: boolean) => void } | null = null;

function applySessionToStorage(win: Window, session: SeedAuthSession) {
  win.localStorage.setItem("token", session.token);
  win.localStorage.setItem("user", JSON.stringify(session.user));
  win.localStorage.setItem(
    "kasi-pos-settings",
    JSON.stringify(session.settings),
  );
  win.localStorage.setItem("kasiPOS_hardwareSetupCompleted", "true");
  win.localStorage.setItem("__kasi_pos_e2e", "1");
  win.sessionStorage.setItem("__kasi_pos_e2e", "1");
}

function deleteKasiPosDb(win: Window): Promise<void> {
  return new Cypress.Promise<void>((resolve) => {
    const req = win.indexedDB.deleteDatabase(KASI_POS_DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

function ensureReadyDatabase(win: Window): Promise<IDBDatabase> {
  return new Cypress.Promise<IDBDatabase>((resolve, reject) => {
    const req = win.indexedDB.open(KASI_POS_DB_NAME);
    req.onerror = () =>
      reject(req.error ?? new Error("Failed to open IndexedDB"));
    req.onsuccess = () => resolve(req.result);
  });
}

function seedObjectStore(
  tx: IDBTransaction,
  storeName: string,
  rows: unknown[],
) {
  if (!tx.objectStoreNames.contains(storeName)) return;
  const store = tx.objectStore(storeName);
  store.clear();
  rows.forEach((row) => store.put(row));
}

function writeSeedToIndexedDb(
  win: Window,
  seed: SeedData,
  session: SeedAuthSession,
): Promise<void> {
  return ensureReadyDatabase(win).then(
    (db: IDBDatabase) =>
      new Cypress.Promise<void>((resolve, reject) => {
        const tx = db.transaction(
          [
            "stores",
            "products",
            "customers",
            "transactions",
            "vouchers",
            "categories",
            "stockAdjustments",
            "parcels",
          ],
          "readwrite",
        );

        tx.onerror = () =>
          reject(tx.error ?? new Error("Failed to write IndexedDB seed"));
        tx.oncomplete = () => {
          db.close();
          resolve();
        };

        seedObjectStore(tx, "stores", [session.store]);
        seedObjectStore(tx, "products", seed.products);
        seedObjectStore(tx, "customers", seed.customers);
        seedObjectStore(tx, "transactions", seed.transactions);
        seedObjectStore(tx, "vouchers", seed.vouchers);
        seedObjectStore(tx, "categories", seed.categories);
        seedObjectStore(tx, "stockAdjustments", seed.stockAdjustments);
        seedObjectStore(tx, "parcels", seed.parcels);
      }),
  );
}

Cypress.Commands.add("clearAppData", () => {
  Cypress.session.clearAllSavedSessions();
  cy.visit("/login", { failOnStatusCode: false });
  cy.window().then((win) => deleteKasiPosDb(win));
  cy.clearCookies();
  cy.clearLocalStorage();
});

Cypress.Commands.add("bootstrapAuth", (input = {}) => {
  cy.task("seedAuthSession", input).then((sessionObj) => {
    const session = sessionObj as SeedAuthSession;
    cy.window().then((win) => {
      applySessionToStorage(win, session);
    });
    cy.wrap(session, { log: false }).as("seedAuthSession");
  });
});

Cypress.Commands.add("seedIndexedDb", (input = {}) => {
  cy.task("loadSeedData", input).then((seedObj) => {
    const seed = seedObj as SeedData;
    cy.get<SeedAuthSession>("@seedAuthSession").then((session) => {
      cy.window().then((win) => writeSeedToIndexedDb(win, seed, session));
      cy.wrap(seed, { log: false }).as("seedData");
    });
  });
});

Cypress.Commands.add("mockApi", (input = {}) => {
  cy.get<SeedAuthSession>("@seedAuthSession").then((session) => {
    cy.get<SeedData>("@seedData").then((seed) => {
      mockControls = registerApiMocks({
        apiBaseUrl: NORMALIZED_API_BASE_URL,
        seedAuth: session,
        seedData: seed,
        ...(input as object),
      });
    });
  });
});

Cypress.Commands.add("setOffline", () => {
  mockControls?.setOffline(true);
  cy.window().then((win) => {
    const bridge = (
      win as Window & {
        __KASI_POS_E2E_OFFLINE?: (forcedOffline: boolean) => void;
      }
    ).__KASI_POS_E2E_OFFLINE;
    bridge?.(true);
    Object.defineProperty(win.navigator, "onLine", {
      configurable: true,
      value: false,
    });
    win.dispatchEvent(new Event("offline"));
  });
});

Cypress.Commands.add("setOnlineModeOnly", () => {
  if (!mockControls) return;
  mockControls.setOffline(false);
  cy.window().then((win) => {
    const bridge = (
      win as Window & {
        __KASI_POS_E2E_OFFLINE?: (forcedOffline: boolean) => void;
      }
    ).__KASI_POS_E2E_OFFLINE;
    bridge?.(false);
    Object.defineProperty(win.navigator, "onLine", {
      configurable: true,
      value: true,
    });
    win.dispatchEvent(new Event("online"));
  });
});

Cypress.Commands.add("setOnline", () => {
  if (!mockControls) {
    throw new Error(
      "setOnline() called before cy.setupScenario() — API mocks are not registered.",
    );
  }
  mockControls.setOffline(false);
  cy.window().then((win) => {
    const bridge = (
      win as Window & {
        __KASI_POS_E2E_OFFLINE?: (forcedOffline: boolean) => void;
      }
    ).__KASI_POS_E2E_OFFLINE;
    bridge?.(false);
    Object.defineProperty(win.navigator, "onLine", {
      configurable: true,
      value: true,
    });
    win.dispatchEvent(new Event("online"));
  });

  cy.waitUntil(
    () =>
      cy.document({ log: false }).then((doc) => {
        if (!doc?.location?.pathname) return true;
        const pathname = doc.location.pathname;
        if (
          !pathname.startsWith("/marketplace") &&
          !pathname.startsWith("/boph")
        )
          return true;
        return !doc.querySelector(
          ".opacity-60.pointer-events-none.select-none",
        );
      }),
    {
      timeout: 20_000,
      interval: 250,
      description: "wait for online-interactable marketplace or BOPH UI",
    },
  );
});

Cypress.Commands.add(
  "waitForAppReady",
  (expectedPath: string | RegExp = "/") => {
    cy.waitUntil(
      () =>
        cy.window({ log: false }).then((win) => {
          const user = win.localStorage.getItem("user");
          return Boolean(user);
        }),
      {
        timeout: 20_000,
        interval: 250,
        description: "wait for auth bootstrap",
      },
    );

    cy.waitUntil(
      () =>
        cy.location("pathname", { log: false }).then((pathname) => {
          if (expectedPath instanceof RegExp) {
            return expectedPath.test(pathname);
          }
          return pathname === expectedPath;
        }),
      {
        timeout: 20_000,
        interval: 250,
        description: "wait for expected route",
      },
    );

    cy.waitUntil(
      () =>
        cy.get("body", { log: false }).then(($body) => {
          const text = $body.text();
          return (
            text.includes("KasiPOS") ||
            text.includes("Home") ||
            text.includes("Catalogue") ||
            text.includes("Transaction History")
          );
        }),
      {
        timeout: 20_000,
        interval: 250,
        description: "wait for app shell",
      },
    );
  },
);

Cypress.Commands.add("visitApp", (path = "/") => {
  const normalized = path || "/";
  return cy.get<SeedAuthSession>("@seedAuthSession").then((session) => {
    const load = () =>
      cy.visit(normalized, {
        onBeforeLoad(win) {
          applySessionToStorage(win, session);
          Object.defineProperty(win.navigator, "onLine", {
            configurable: true,
            value: true,
          });
          // CartProvider reads this so each Cypress navigation to `/` starts from an empty cart and
          // overwrites Dexie (avoids stale lines and React re-persist races from raw IDB deletes).
          if (normalized === "/") {
            try {
              win.sessionStorage.setItem("__kasi_pos_e2e_reset_cart", "1");
            } catch {
              /* ignore */
            }
          }
        },
      });
    load();
    // POS home (`/`), catalogue, and inventory are sensitive to setupScenario clearing + hydration ordering.
    if (
      normalized === "/" ||
      normalized === "/catalogue" ||
      normalized === "/inventory"
    ) {
      cy.location("pathname", { log: false, timeout: 20_000 }).should(
        "eq",
        normalized,
      );
      load();
    }
  }) as unknown as Cypress.Chainable<void>;
});

Cypress.Commands.add("setupScenario", (input = {}) => {
  Cypress.session.clearAllSavedSessions();
  cy.clearCookies();
  cy.clearLocalStorage();
  // While the previous test's window is still active, restore the harness marker cleared from localStorage
  // so SettingsProvider does not redirect to /login before the next cy.visitApp onBeforeLoad runs.
  cy.window({ log: false }).then((win) => {
    try {
      win.sessionStorage.setItem("__kasi_pos_e2e", "1");
    } catch {
      /* ignore */
    }
  });
  return cy
    .then(() => cy.task("seedAuthSession", input))
    .then((sessionObj) => {
      const session = sessionObj as SeedAuthSession;
      cy.wrap(session, { log: false }).as("seedAuthSession");
      return cy
        .task("loadSeedData", input)
        .then((seedObj) => ({ session, seed: seedObj as SeedData }));
    })
    .then(({ session, seed }) => {
      cy.wrap(seed, { log: false }).as("seedData");

      mockControls = registerApiMocks({
        apiBaseUrl: NORMALIZED_API_BASE_URL,
        seedAuth: session,
        seedData: seed,
      });
    }) as unknown as Cypress.Chainable<void>;
});
