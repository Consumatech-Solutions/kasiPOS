import { defineConfig } from "cypress";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config();

type SeedAuthSessionInput = {
  userOverrides?: Record<string, unknown>;
  storeOverrides?: Record<string, unknown>;
};

type SeedDataFixtureSet = {
  products: string;
  categories: string;
  customers: string;
  transactions: string;
  vouchers: string;
  stockAdjustments: string;
  parcels: string;
  marketplaceStores: string;
  marketplaceOrders: string;
};

type LoadSeedDataInput = {
  fixtureSet?: Partial<SeedDataFixtureSet>;
};

function readJsonFixture<T>(projectRoot: string, fixtureName: string): T {
  const fixturePath = path.join(
    projectRoot,
    "cypress",
    "fixtures",
    `${fixtureName}.json`,
  );
  const raw = fs.readFileSync(fixturePath, "utf8");
  return JSON.parse(raw) as T;
}

function buildSeedAuthSession(input: SeedAuthSessionInput = {}) {
  const now = new Date().toISOString();
  const store = {
    id: "store-e2e-001",
    name: "KasiPOS E2E Store",
    vatNumber: "VAT-001",
    logoUrl: null,
    receiptHeader: "KasiPOS E2E",
    receiptFooter: "Thank you for your purchase",
    isSetupComplete: true,
    ownerId: "owner-e2e-001",
    enabledModules: {
      campaigns: true,
      marketplace: true,
      boph: true,
      buyStock: true,
      showVatInCheckout: false,
    },
    credit: {
      customerCredit: {
        creditLimit: 5000,
        termType: "fixed",
        term: 30,
      },
    },
    createdAt: now,
    updatedAt: now,
    ...input.storeOverrides,
  };

  const user = {
    id: "user-e2e-001",
    name: "E2E Store Admin",
    phone: "0812345678",
    role: "store_admin",
    storeId: String(store.id),
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...input.userOverrides,
  };

  return {
    token: process.env.CYPRESS_E2E_AUTH_STUB ?? "kasi-pos-e2e-local-auth-stub",
    user,
    store,
    settings: {
      theme: "light",
      currentStore: store,
      showVatInCheckout: false,
    },
  };
}

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:9002",
    env: {
      API_BASE_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:9002",
    },
    supportFile: "cypress/support/e2e.ts",
    specPattern: "cypress/e2e/**/*.cy.ts",
    viewportWidth: 1280,
    viewportHeight: 800,
    video: Boolean(process.env.CI),
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 15_000,
    pageLoadTimeout: 120_000,
    setupNodeEvents(on, config) {
      on("task", {
        seedAuthSession(input: SeedAuthSessionInput = {}) {
          return buildSeedAuthSession(input);
        },
        loadSeedData(input: LoadSeedDataInput = {}) {
          const fixtureSet: SeedDataFixtureSet = {
            products: "products",
            categories: "categories",
            customers: "customers",
            transactions: "transactions",
            vouchers: "vouchers",
            stockAdjustments: "stock-adjustments",
            parcels: "parcels",
            marketplaceStores: "marketplace-stores",
            marketplaceOrders: "marketplace-orders",
            ...input.fixtureSet,
          };

          return {
            products: readJsonFixture(config.projectRoot, fixtureSet.products),
            categories: readJsonFixture(
              config.projectRoot,
              fixtureSet.categories,
            ),
            customers: readJsonFixture(
              config.projectRoot,
              fixtureSet.customers,
            ),
            transactions: readJsonFixture(
              config.projectRoot,
              fixtureSet.transactions,
            ),
            vouchers: readJsonFixture(config.projectRoot, fixtureSet.vouchers),
            stockAdjustments: readJsonFixture(
              config.projectRoot,
              fixtureSet.stockAdjustments,
            ),
            parcels: readJsonFixture(config.projectRoot, fixtureSet.parcels),
            marketplaceStores: readJsonFixture(
              config.projectRoot,
              fixtureSet.marketplaceStores,
            ),
            marketplaceOrders: readJsonFixture(
              config.projectRoot,
              fixtureSet.marketplaceOrders,
            ),
          };
        },
      });
      return config;
    },
  },

  component: {
    devServer: {
      framework: "next",
      bundler: "webpack",
    },
  },
});
