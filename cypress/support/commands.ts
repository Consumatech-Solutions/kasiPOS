/// <reference types="cypress" />
import type { SeedAuthSession, SeedData } from "./types";
import { registerApiMocks } from "./mocks";

const KASI_POS_DB_NAME = "kasiPosDatabase";
const API_BASE_URL =
  (Cypress.env("API_BASE_URL") as string) ?? "http://localhost:9002";
const NORMALIZED_API_BASE_URL = API_BASE_URL.replace(/\/+$/, "");
const TEST_MODE =
  String((Cypress.env("TEST_MODE") as string | undefined) ?? "mock")
    .toLowerCase()
    .trim() === "real"
    ? "real"
    : "mock";
const IS_REAL_MODE = TEST_MODE === "real";
const REAL_AUTH_PHONE = Cypress.env("REAL_AUTH_PHONE") as string | undefined;
const REAL_AUTH_PASSWORD = Cypress.env("REAL_AUTH_PASSWORD") as
  | string
  | undefined;
const REAL_LOGIN_PATH =
  (Cypress.env("REAL_LOGIN_PATH") as string | undefined) ?? "/login";
const REAL_POST_LOGIN_PATH =
  (Cypress.env("REAL_POST_LOGIN_PATH") as string | undefined) ?? "/";

let mockControls: { setOffline: (value: boolean) => void } | null = null;

function ensureMockMode(commandName: string): void {
  if (!IS_REAL_MODE) return;
  throw new Error(
    `${commandName}() is only available in mock mode. Current mode: real.`
  );
}

function ensureRealCredentials(): void {
  if (!IS_REAL_MODE) return;
  if (!REAL_AUTH_PHONE || !REAL_AUTH_PASSWORD) {
    throw new Error(
      "Real mode requires REAL_AUTH_PHONE and REAL_AUTH_PASSWORD."
    );
  }
}

function applySessionToStorage(win: Window, session: SeedAuthSession) {
  win.localStorage.setItem("token", session.token);
  win.localStorage.setItem("user", JSON.stringify(session.user));
  win.localStorage.setItem(
    "kasi-pos-settings",
    JSON.stringify(session.settings)
  );
  win.localStorage.setItem("kasiPOS_hardwareSetupCompleted", "true");
  win.localStorage.setItem("__kasi_pos_e2e", "1");
  win.sessionStorage.setItem("__kasi_pos_e2e", "1");
}

function loginWithRealCredentials(): Cypress.Chainable<void> {
  ensureRealCredentials();
  const phone = REAL_AUTH_PHONE as string;
  const password = REAL_AUTH_PASSWORD as string;
  return cy
    .visit(REAL_LOGIN_PATH, { failOnStatusCode: false })
    .then(() => {
      cy.findByLabelText(/mobile number/i, { timeout: 20_000 }).clear();
      cy.findByLabelText(/mobile number/i, { timeout: 20_000 }).type(phone);
      cy.findByLabelText(/password/i, { timeout: 20_000 }).clear();
      cy.findByLabelText(/password/i, { timeout: 20_000 }).type(password, {
        log: false,
      });
      cy.findByRole("button", { name: /sign in/i, timeout: 20_000 }).click();
      cy.waitUntil(
        () =>
          cy.location("pathname", { log: false }).then((pathname) => {
            return pathname !== "/login";
          }),
        {
          timeout: 30_000,
          interval: 250,
          description: "wait for post-login route transition",
        }
      );
      cy.waitForAppReady(
        REAL_POST_LOGIN_PATH.startsWith("/")
          ? new RegExp(
              `^${REAL_POST_LOGIN_PATH.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`
            )
          : REAL_POST_LOGIN_PATH
      );
    })
    .then(() => {
      cy.window().then((win) => {
        const token = win.localStorage.getItem("token");
        const rawUser = win.localStorage.getItem("user");
        const rawSettings = win.localStorage.getItem("kasi-pos-settings");
        if (!token || !rawUser || !rawSettings) {
          throw new Error(
            "Real login succeeded but auth/session keys were not found in localStorage."
          );
        }
        const user = JSON.parse(rawUser) as SeedAuthSession["user"];
        const settings = JSON.parse(rawSettings) as SeedAuthSession["settings"];
        const store =
          (settings.currentStore as SeedAuthSession["store"]) ??
          ({
            id: user.storeId ?? "unknown-store",
            name: "Real Store",
            vatNumber: null,
            logoUrl: null,
            receiptHeader: null,
            receiptFooter: null,
            isSetupComplete: true,
            ownerId: "real-owner",
            enabledModules: {
              campaigns: false,
              marketplace: false,
              boph: false,
              buyStock: true,
              showVatInCheckout: true,
            },
            credit: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as SeedAuthSession["store"]);

        const session: SeedAuthSession = {
          token,
          user,
          store,
          settings,
        };
        cy.wrap(session, { log: false }).as("seedAuthSession");
        cy.wrap(
          {
            products: [],
            categories: [],
            customers: [],
            transactions: [],
            vouchers: [],
            stockAdjustments: [],
            parcels: [],
            marketplaceStores: [],
            marketplaceOrders: [],
          } as SeedData,
          { log: false }
        ).as("seedData");
      });
    });
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
  rows: unknown[]
) {
  if (!tx.objectStoreNames.contains(storeName)) return;
  const store = tx.objectStore(storeName);
  store.clear();
  rows.forEach((row) => store.put(row));
}

function writeSeedToIndexedDb(
  win: Window,
  seed: SeedData,
  session: SeedAuthSession
): Promise<void> {
  return ensureReadyDatabase(win).then(
    (db: IDBDatabase) =>
      new Cypress.Promise<void>((resolve, reject) => {
        const tx = db.transaction(
          [
            "stores",
            "products",
            "productCache",
            "customers",
            "transactions",
            "transactionCache",
            "vouchers",
            "categories",
            "categoryCache",
            "stockAdjustments",
            "parcels",
          ],
          "readwrite"
        );

        tx.onerror = () =>
          reject(tx.error ?? new Error("Failed to write IndexedDB seed"));
        tx.oncomplete = () => {
          db.close();
          resolve();
        };

        seedObjectStore(tx, "stores", [session.store]);
        seedObjectStore(tx, "products", seed.products);
        seedObjectStore(tx, "productCache", seed.products);
        seedObjectStore(tx, "customers", seed.customers);
        seedObjectStore(tx, "transactions", seed.transactions);
        seedObjectStore(tx, "transactionCache", seed.transactions);
        seedObjectStore(tx, "vouchers", seed.vouchers);
        seedObjectStore(tx, "categories", seed.categories);
        seedObjectStore(tx, "categoryCache", seed.categories);
        seedObjectStore(tx, "stockAdjustments", seed.stockAdjustments);
        seedObjectStore(tx, "parcels", seed.parcels);
      })
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
  if (IS_REAL_MODE) {
    return loginWithRealCredentials();
  }
  cy.task("seedAuthSession", input).then((sessionObj) => {
    const session = sessionObj as SeedAuthSession;
    cy.window().then((win) => {
      applySessionToStorage(win, session);
    });
    cy.wrap(session, { log: false }).as("seedAuthSession");
  });
});

Cypress.Commands.add("seedIndexedDb", (input = {}) => {
  ensureMockMode("seedIndexedDb");
  cy.task("loadSeedData", input).then((seedObj) => {
    const seed = seedObj as SeedData;
    cy.get<SeedAuthSession>("@seedAuthSession").then((session) => {
      cy.window().then((win) => writeSeedToIndexedDb(win, seed, session));
      cy.wrap(seed, { log: false }).as("seedData");
    });
  });
});

Cypress.Commands.add("mockApi", (input = {}) => {
  ensureMockMode("mockApi");
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
  ensureMockMode("setOffline");
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
  ensureMockMode("setOnlineModeOnly");
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
  ensureMockMode("setOnline");
  if (!mockControls) {
    throw new Error(
      "setOnline() called before cy.setupScenario() — API mocks are not registered."
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
          ".opacity-60.pointer-events-none.select-none"
        );
      }),
    {
      timeout: 20_000,
      interval: 250,
      description: "wait for online-interactable marketplace or BOPH UI",
    }
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
      }
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
      }
    );

    cy.waitUntil(
      () =>
        cy.get("body", { log: false }).then(($body) => {
          const text = $body.text();
          return (
            text.includes("KasiPOS") ||
            text.includes("Home") ||
            text.includes("Catalogue") ||
            text.includes("Transaction History") ||
            text.includes("Customers")
          );
        }),
      {
        timeout: 20_000,
        interval: 250,
        description: "wait for app shell",
      }
    );
  }
);

Cypress.Commands.add("visitApp", (path = "/") => {
  const normalized = path || "/";
  if (IS_REAL_MODE) {
    cy.visit(normalized, {
      onBeforeLoad(win) {
        Object.defineProperty(win.navigator, "onLine", {
          configurable: true,
          value: true,
        });
      },
    });
    return cy.wrap(undefined, { log: false });
  }
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
        normalized
      );
      load();
    }
  }) as unknown as Cypress.Chainable<void>;
});

Cypress.Commands.add("setupScenario", (input = {}) => {
  if (IS_REAL_MODE) {
    Cypress.session.clearAllSavedSessions();
    cy.clearCookies();
    cy.clearLocalStorage();
    return loginWithRealCredentials();
  }
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

function readAllFromObjectStore<T>(
  win: Window,
  dbName: string,
  storeName: string
): Promise<T[]> {
  return new Cypress.Promise<T[]>((resolve, reject) => {
    const openReq = win.indexedDB.open(dbName);
    openReq.onerror = () =>
      reject(openReq.error ?? new Error(`Failed to open IndexedDB: ${dbName}`));
    openReq.onsuccess = () => {
      const db = openReq.result;
      try {
        if (!db.objectStoreNames.contains(storeName)) {
          db.close();
          resolve([]);
          return;
        }
        const tx = db.transaction([storeName], "readonly");
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onerror = () =>
          reject(req.error ?? new Error(`Failed to read store: ${storeName}`));
        req.onsuccess = () => resolve((req.result ?? []) as T[]);
        tx.oncomplete = () => db.close();
        tx.onerror = () => {
          db.close();
          reject(tx.error ?? new Error(`Transaction failed: ${storeName}`));
        };
      } catch (e) {
        db.close();
        reject(e);
      }
    };
  });
}

Cypress.Commands.add(
  "readIndexedDbStore",
  <T = unknown>(storeName: string, options?: { dbName?: string }) => {
    const dbName = options?.dbName ?? KASI_POS_DB_NAME;
    return cy
      .window()
      .then((win) => readAllFromObjectStore<T>(win, dbName, storeName));
  }
);

Cypress.Commands.add(
  "waitForIndexedDbStore",
  (
    storeName: string,
    predicate: (rows: unknown[]) => boolean,
    options?: { timeoutMs?: number; intervalMs?: number; dbName?: string }
  ) => {
    const timeoutMs = options?.timeoutMs ?? 20_000;
    const intervalMs = options?.intervalMs ?? 250;
    const dbName = options?.dbName ?? KASI_POS_DB_NAME;
    return cy.waitUntil(
      () =>
        cy
          .window({ log: false })
          .then((win) =>
            readAllFromObjectStore<unknown>(win, dbName, storeName).then(
              (rows) => predicate(rows)
            )
          ),
      {
        timeout: timeoutMs,
        interval: intervalMs,
        description: `wait for IndexedDB store ${storeName}`,
      }
    );
  }
);
