# KasiPOS - Modern Point of Sale

[![Coverage](https://img.shields.io/endpoint?url=https://%3Cyour_codecov_endpoint%3E)](https://about.codecov.io/)

**Note:** This application is intended for **store admins** only. It is the store-side app used to run the point of sale, manage catalogue, inventory, and optional modules (campaigns, buy stock, BOPH, marketplace).

KasiPOS is a modern, offline-first Point of Sale (POS) application designed for small businesses. It's built with a focus on usability, performance, and providing powerful features to streamline retail operations.

The application is a Progressive Web App (PWA) that works seamlessly online and offline, using a local database to store all your shop's data directly on your device.

## Core Features

- **Point of Sale (POS):** A fast and intuitive interface for processing sales. Browse products by category, scan barcodes (future feature), and manage the shopping cart with ease.
- **Catalogue Management:** Easily add, edit, and delete products and organize them into custom categories. Upload product images or use placeholders.
- **Inventory Management:** Keep track of your stock levels in real-time. Set low-stock alerts to know when to reorder and view detailed stock adjustment history.
- **Customer Database:** Maintain a list of your customers, track their purchase history, and manage a simple loyalty points system.
- **Transaction History:** A comprehensive log of all sales, filterable by date and customer, with detailed transaction drill-downs.

## Opt-In Modules

KasiPOS includes powerful optional modules that you can enable from the Settings screen to extend its functionality.

- **Voucher Campaigns:** Drive sales by creating and managing discount vouchers. You can create percentage-based or fixed-amount discounts for your customers to redeem.
- **Marketplace:** Offer more to your customers by placing orders on their behalf from popular third-party online stores like Takealot, Amazon, and more. Earn a service fee for every order you facilitate.
- **BOPH (Buy Online, Pickup Here):** Turn your store into a local pickup point for online orders. Manage incoming parcels from couriers and handle the final handover to customers, earning a fee for the service.

## Technical Overview

- **Framework:** Next.js with the App Router
- **Language:** TypeScript
- **UI:** React with ShadCN UI components
- **Styling:** Tailwind CSS
- **Local Database:** Dexie.js (a wrapper for IndexedDB) for robust offline storage
- **PWA:** Fully installable Progressive Web App with offline capabilities.

## Cypress Modes

The E2E suite supports two execution modes:

- `mock` (default): uses seeded fixtures and Cypress API intercept mocks.
- `real`: uses real staging credentials and real backend calls.

### Mock mode (default)

```bash
npm run cy:run:mock
```

### Real-credentials mode (staging)

```bash
npm run cy:run:real
```

Real mode requires credentials. You can provide them from:

- environment variables (highest priority), and/or
- `cypress.env.json` (local file).

Environment variables override `cypress.env.json`.

Required keys for real mode:

- `REAL_AUTH_PHONE`
- `REAL_AUTH_PASSWORD`

Optional keys:

- `API_BASE_URL` (staging API URL)
- `REAL_LOGIN_PATH` (default `/login`)
- `REAL_POST_LOGIN_PATH` (default `/`)

Example `cypress.env.json` (do not commit):

```json
{
  "REAL_AUTH_PHONE": "0812345678",
  "REAL_AUTH_PASSWORD": "your-password",
  "API_BASE_URL": "https://staging-api.example.com",
  "REAL_LOGIN_PATH": "/login",
  "REAL_POST_LOGIN_PATH": "/"
}
```

Security note: never commit real credentials to git.