# KasiPOS Frontend

KasiPOS Frontend is the store-facing web app for **KasiPOS**, designed for fast daily operations with offline-aware behavior in retail environments.

## What This Repository Contains

- Point-of-sale and operational modules built with Next.js App Router.
- Local-first patterns for unstable connectivity scenarios.
- Test and quality tooling for production-facing workflows.

## Quickstart

### Prerequisites

- Node.js 20.x LTS
- npm

### Install

```bash
git clone <your-fork-or-repo-url>
cd kasiPOS
npm install
```

### Run

Start the **KasiPOS backend API** (default `http://localhost:3001`), then the frontend:

```bash
# Copy env and point at your backend if needed
cp .env.example .env

npm run dev
```

The app runs at `http://localhost:9002`. API calls are proxied to `NEXT_PUBLIC_API_URL` in development.

### Verify

```bash
npm run lint
npm run typecheck
npm run test
```

## Documentation Map

- Architecture overview: `docs/en/ARCHITECTURE.md`
- Contribution workflow: `docs/en/contribution.md`
- AI assistant instructions: `docs/en/claude.md`

French equivalents are available under `docs/fr`.

## License

This project is licensed under the [Apache License, Version 2.0](https://www.apache.org/licenses/LICENSE-2.0). See [LICENSE](LICENSE) in the repository root for the full license text.

Copyright 2026 KasiPOS Contributors.