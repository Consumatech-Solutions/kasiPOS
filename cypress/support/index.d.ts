/// <reference types="cypress" />
/// <reference types="cypress-wait-until" />

declare namespace Cypress {
  interface Chainable {
    clearAppData(): Chainable<void>;
    bootstrapAuth(input?: {
      userOverrides?: Record<string, unknown>;
      storeOverrides?: Record<string, unknown>;
    }): Chainable<void>;

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

    mockApi(input?: Record<string, unknown>): Chainable<void>;

    setOffline(): Chainable<void>;

    setOnline(): Chainable<void>;

    setOnlineModeOnly(): Chainable<void>;

    waitForAppReady(expectedPath?: string | RegExp): Chainable<void>;

    visitApp(path?: string): Chainable<void>;

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

    readIndexedDbStore<T = unknown>(
      storeName: string,
      options?: { dbName?: string }
    ): Chainable<T[]>;

    waitForIndexedDbStore(
      storeName: string,
      predicate: (rows: unknown[]) => boolean,
      options?: { timeoutMs?: number; intervalMs?: number; dbName?: string }
    ): Chainable<void>;
  }
}
