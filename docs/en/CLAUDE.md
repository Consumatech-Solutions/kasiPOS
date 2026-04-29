# CLAUDE.md

## Scope of This Document

This file is only for AI assistant behavior in this repository.

For project onboarding and local setup, use `README.md`.  
For contribution workflow and PR process, use `docs/en/contribution.md`.

## 1. Core Rules for AI Changes

AI assistants must:
- inspect nearby files before generating code,
- match existing feature patterns and naming style,
- reuse existing components/hooks/providers before creating new ones,
- keep changes minimal, scoped, and reviewable,
- preserve UX and accessibility behavior in changed screens.

AI assistants must NOT:
- rewrite unrelated files,
- perform large refactors without explicit request,
- add dead code or unused abstractions,
- leave debugging `console` noise in final code,
- ignore verification feedback after making changes,
- duplicate existing components or hooks,
- invent backend APIs or response shapes not already used,
- introduce new libraries unless strictly necessary and requested.

## 2. Implementation Guardrails

When changing UI:
- keep responsive behavior across mobile/tablet/desktop,
- provide loading states for async content,
- provide clear empty states for missing data,
- provide actionable error states with recovery hints,
- maintain keyboard usability and semantic structure,
- preserve consistent spacing and hierarchy.

State and data rules:

- Keep server state in the query layer (TanStack Query).
- Keep local UI state in component state, context providers, or focused hooks.
- Avoid unnecessary prop drilling; use existing providers where appropriate.
- Do not overuse global state when local state is enough.
- Respect offline-first behavior (`networkMode: "offlineFirst"` and queue/sync flow).
## 3. AI-Suitable Task Examples

- Add a filter to an existing products table using existing hook/query patterns.
- Fix a loading spinner that never resolves on a known page flow.
- Improve mobile checkout spacing using existing Tailwind and UI primitives.
- Add a clear empty state to the customers list.
- Refactor a duplicated helper into `src/lib/utils` without changing behavior.

## 4. Tasks to Avoid Without Explicit Request

- Rewrite the entire app architecture in one PR.
- Replace TanStack Query or IndexedDB strategy without request.
- Rename large folder trees for style preferences.
- Add random dependencies to solve local coding convenience issues.
- Rebuild existing components instead of reusing `src/components/ui`.

## 5. Final Instruction

Make the smallest high-quality change that fits the current architecture.
