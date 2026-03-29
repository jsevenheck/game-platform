# Jest -> Vitest Migration

## Progress Status

- [x] Root Jest config replaced with [`vitest.config.ts`](./vitest.config.ts)
- [x] [`package.json`](./package.json) updated to Vitest scripts and dependencies
- [x] [`tsconfig.json`](./tsconfig.json) switched from Jest globals to Vitest globals
- [x] All affected unit tests migrated from `jest.*` to `vi.*`
- [x] Special-case Jest APIs in Blackout tests migrated (`jest.requireMock`, `jest.Mock`)
- [x] Docs synced in [`AGENTS.md`](./AGENTS.md), [`docs/adding-a-new-game.md`](./docs/adding-a-new-game.md), and [`PROGRESS.md`](./PROGRESS.md)
- [x] `pnpm install` run and lockfile refreshed
- [x] `pnpm lint` passes
- [x] `pnpm test` — 15 suites, 122 tests passing
- [x] `pnpm test:blackout` / `pnpm test:imposter` / `pnpm test:secret-signals` — all green (scripts fixed to use `vitest run --project <name>`)
- [x] `pnpm typecheck` — passes after adding `"types": ["node", "vitest/globals"]` to `apps/platform/tsconfig.json`
- [x] `pnpm lint` — passes (0 warnings)

## Background

The monorepo already uses Vite for the platform app, but the unit-test runner was still Jest. That mismatch caused a few recurring problems:

- `ts-jest` recompiled TypeScript separately from the rest of the toolchain
- `@shared/*` aliases had to be duplicated manually for each game test project
- Jest was configured through a separate CommonJS root config while the repo otherwise uses modern TS/ESM-style tooling

Vitest keeps the workflow closer to the existing Vite-based setup while still letting us run all tests from the workspace root.

---

## Final Architecture

The migration uses a single root [`vitest.config.ts`](./vitest.config.ts) with `test.projects` for:

- `platform`
- `blackout`
- `imposter`
- `secret-signals`

Important implementation detail:

- We do **not** assume Vitest automatically consumes [`apps/platform/vite.config.ts`](./apps/platform/vite.config.ts) for these root test projects.
- Each game project therefore defines its own explicit `@shared` alias in `vitest.config.ts`.

All unit tests continue to run in the Node environment with globals enabled.

---

## Package Changes

Removed:

- `jest`
- `ts-jest`
- `@types/jest`
- `jest-environment-jsdom`

Added:

- `vitest`

Scripts in [`package.json`](./package.json):

- `pnpm test` -> `vitest run`
- `pnpm test:watch` -> `vitest`
- `pnpm test:blackout` -> `pnpm -C games/blackout test`
- `pnpm test:imposter` -> `pnpm -C games/imposter test`
- `pnpm test:secret-signals` -> `pnpm -C games/secret-signals test`

TypeScript in [`tsconfig.json`](./tsconfig.json):

- `"types": ["node", "vitest/globals"]`
- include `vitest.config.ts` instead of `jest.config.cjs`

To keep the root configuration central while still supporting stable game-specific shortcuts on Windows/pnpm:

- shared project definitions live in [`vitest.projects.ts`](./vitest.projects.ts)
- root [`vitest.config.ts`](./vitest.config.ts) runs all projects
- each game has a tiny local `vitest.config.ts` that imports its shared project definition

---

## Test File Migration

Straight replacements:

| Jest | Vitest |
| --- | --- |
| `jest.mock(...)` | `vi.mock(...)` |
| `jest.fn()` | `vi.fn()` |
| `jest.spyOn(...)` | `vi.spyOn(...)` |
| `jest.useFakeTimers()` | `vi.useFakeTimers()` |
| `jest.useRealTimers()` | `vi.useRealTimers()` |
| `jest.advanceTimersByTime(...)` | `vi.advanceTimersByTime(...)` |
| `jest.restoreAllMocks()` | `vi.restoreAllMocks()` |
| `jest.clearAllMocks()` | `vi.clearAllMocks()` |

Special cases:

1. [`games/blackout/__tests__/roundManager.test.ts`](./games/blackout/__tests__/roundManager.test.ts)
   - replaced `jest.requireMock(...)` with a normal module import plus `vi.mocked(...)`

2. [`games/blackout/__tests__/socketHandlers.test.ts`](./games/blackout/__tests__/socketHandlers.test.ts)
   - replaced `jest.Mock` casts with Vitest-compatible typing and `vi.mocked(...)`

---

## Documentation Changes

Updated to reflect Vitest as the active runner:

- [`AGENTS.md`](./AGENTS.md)
- [`docs/adding-a-new-game.md`](./docs/adding-a-new-game.md)
- [`PROGRESS.md`](./PROGRESS.md)

---

## Verification

Current baseline before the migration:

- `pnpm test` -> 15 suites, 122 tests passing

Post-migration verification should run:

```bash
pnpm install
pnpm test
pnpm test:blackout
pnpm test:imposter
pnpm test:secret-signals
pnpm lint
pnpm typecheck
```

Notes:

- `pnpm typecheck` already had a pre-existing failure in this repo because `source-map-js` is missing from the current install state.
- That issue is tracked separately and should not be treated as caused by the Jest -> Vitest migration unless new Vitest-specific type errors appear.
