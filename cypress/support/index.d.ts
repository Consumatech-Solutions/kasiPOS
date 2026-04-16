/// <reference types="cypress" />
/// <reference types="cypress-wait-until" />

declare namespace Cypress {
  interface Chainable {
    /** Clears cookies, localStorage, and the kasiPos IndexedDB database. */
    clearAppData(): Chainable<void>;

    /** Seeds authenticated test session into localStorage. */
    bootstrapAuth(input?: {
      userOverrides?: Record<string, unknown>;
      storeOverrides?: Record<string, unknown>;
    }): Chainable<void>;

    /** Populates IndexedDB `kasiPosDatabase` with fixture seed data. */
    seedIndexedDb(input?: {
      fixtureSet?: Partial<{
        products: string;
        categories: string;
        customers: string;
        transactions: string;
        vouchers: string;
        stockAdjustments: string;
        parcels: string;
        marketplaceStores: string;
        marketplaceOrders: string;
      }>;
    }): Chainable<void>;

    /** Registers stateful API interceptors backed by in-memory fixture data. */
    mockApi(input?: Record<string, unknown>): Chainable<void>;

    /** Toggles app/network simulation into offline mode. */
    setOffline(): Chainable<void>;

    /** Toggles app/network simulation back to online mode. */
    setOnline(): Chainable<void>;

    /** Sets mocks + navigator online without waiting for marketplace UI (use in afterEach hooks). */
    setOnlineModeOnly(): Chainable<void>;

    /** Waits for auth/session and route shell rendering before test assertions. */
    waitForAppReady(expectedPath?: string | RegExp): Chainable<void>;

    /** Visits a route with preloaded seeded auth in localStorage. */
    visitApp(path?: string): Chainable<void>;

    /** One-command scenario setup: clear, auth seed, DB seed, mock API. */
    setupScenario(input?: {
      userOverrides?: Record<string, unknown>;
      storeOverrides?: Record<string, unknown>;
      fixtureSet?: Partial<{
        products: string;
        categories: string;
        customers: string;
        transactions: string;
        vouchers: string;
        stockAdjustments: string;
        parcels: string;
        marketplaceStores: string;
        marketplaceOrders: string;
      }>;
    }): Chainable<void>;
  }
}
