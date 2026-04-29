# Contributing to KasiPOS Frontend

## Scope of This Document

This file defines the contribution process and review expectations.  
For project setup commands, use `README.md`.  
For AI-assistant behavior rules, use `docs/en/claude.md`.

## 1. Before You Start

Before opening a pull request:
- check existing issues and active PRs to avoid duplicate work,
- discuss large or cross-cutting features before implementation,
- ask for clarification when requirements are ambiguous,
- keep one PR focused on one problem.

## 2. Branch Naming Convention

Use short, descriptive branch names:
- `feat/add-cart-discounts`
- `fix/offline-sync-bug`
- `docs/update-readme`
- `refactor/product-table`

## 3. Commit Message Convention

This repo uses Conventional Commits (`@commitlint/config-conventional`).

Examples:
- `feat: add barcode scanner support`
- `fix: resolve offline sync duplication`
- `docs: update installation guide`
- `refactor: simplify cart logic`
- `test: add sales flow tests`

## 4. Pull Request Process

For each PR:
- keep it focused and reasonably small,
- link the related issue when available,
- describe what changed and why,
- include screenshots for UI changes,
- ensure checks pass before requesting review,
- request review from maintainers.

Minimum pre-PR checks:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

For user-flow changes, also run:

```bash
npm run cypress:run
```

## 5. Review Readiness Checklist

- [ ] PR scope is limited and unrelated edits are removed.
- [ ] Commit messages are clear and conventional.
- [ ] Required checks pass locally.
- [ ] UI changes include screenshots.
- [ ] Migration or risk notes are included when relevant.

## 6. Issue Reporting

Please include:
- a clear title,
- steps to reproduce,
- expected behavior vs actual behavior,
- screenshots or recordings when useful,
- browser, OS, and device details.

If possible, include logs or error messages to speed up triage.

## 7. Community Communication

We welcome thoughtful discussion and collaborative problem solving.

- be clear and respectful in issues and PRs,
- ask for clarification when context is missing,
- help reviewers by keeping communication concise and specific.
