# Jest → Vitest Migration
 
## Background
 
The project uses Vite as its build tool with a custom `sharedAliasPlugin` and several `resolve.alias` entries in `vite.config.ts`. Jest has no awareness of Vite's config, which means:
 
- `ts-jest` must re-compile TypeScript independently of Vite's pipeline
- The `@shared/*` alias is **manually duplicated** from `vite.config.ts` into every Jest project's `moduleNameMapper`
- Jest runs in CommonJS mode while the rest of the project uses ESM/ESNext
 
Vitest is Vite-native: it reads `vite.config.ts` automatically, shares the same module resolution, and runs TypeScript natively without an extra transform layer.
 
---
 
## Overview of Changes
 
| Category | Remove | Add |
|---|---|---|
| Dependencies | `jest`, `ts-jest`, `@types/jest`, `jest-environment-jsdom` | `vitest` |
| Config files | `jest.config.cjs` | `vitest.workspace.ts` |
| tsconfig | `"jest"` in types | `"vitest/globals"` in types |
| package.json scripts | `jest`, `jest --selectProjects` | `vitest run`, `vitest run --project` |
| Test code | `jest.*` APIs | `vi.*` equivalents |
 
---
 
## Step 1 — Update Dependencies
 
```bash
# Remove Jest packages
pnpm remove jest ts-jest @types/jest jest-environment-jsdom
 
# Add Vitest
pnpm add -D vitest
```
 
---
 
## Step 2 — Create `vitest.workspace.ts`
 
Create this file at the workspace root. It replaces `jest.config.cjs` entirely and resolves `@shared/*` per-project using native Vite aliases — no more manual duplication.
 
```typescript
// vitest.workspace.ts
import { defineWorkspace } from 'vitest/config';
import { resolve } from 'path';
 
const GAMES_ROOT = resolve(__dirname, 'games');
 
export default defineWorkspace([
  {
    test: {
      name: 'platform',
      include: ['apps/platform/__tests__/**/*.test.ts'],
      environment: 'node',
      clearMocks: true,
      globals: true,
    },
  },
  {
    resolve: {
      alias: [{ find: '@shared', replacement: resolve(GAMES_ROOT, 'blackout/core/src') }],
    },
    test: {
      name: 'blackout',
      include: ['games/blackout/__tests__/**/*.test.ts'],
      environment: 'node',
      globals: true,
    },
  },
  {
    resolve: {
      alias: [{ find: '@shared', replacement: resolve(GAMES_ROOT, 'imposter/core/src') }],
    },
    test: {
      name: 'imposter',
      include: ['games/imposter/__tests__/**/*.test.ts'],
      environment: 'node',
      clearMocks: true,
      globals: true,
    },
  },
  {
    resolve: {
      alias: [{ find: '@shared', replacement: resolve(GAMES_ROOT, 'secret-signals/core/src') }],
    },
    test: {
      name: 'secret-signals',
      include: ['games/secret-signals/__tests__/**/*.test.ts'],
      environment: 'node',
      clearMocks: true,
      globals: true,
    },
  },
]);
```
 
> `globals: true` makes `describe`, `it`, `expect`, and `vi` available globally in every test file — no imports needed.
 
---
 
## Step 3 — Delete `jest.config.cjs`
 
```bash
rm jest.config.cjs
```
 
---
 
## Step 4 — Update `tsconfig.json` (root)
 
```diff
 {
   "extends": "./tsconfig.base.json",
   "compilerOptions": {
     "noEmit": true,
     "module": "CommonJS",
     "moduleResolution": "node",
     "resolveJsonModule": true,
-    "types": ["node", "jest"]
+    "types": ["node", "vitest/globals"]
   },
   "include": [
-    "jest.config.cjs",
+    "vitest.workspace.ts",
     "playwright.config.ts",
     "games/*/core/src/**/*",
     "games/*/server/src/**/*",
     "games/*/__tests__/**/*",
     "games/*/e2e/**/*",
     "apps/platform/server/**/*"
   ],
   "exclude": ["node_modules", "apps/platform/src", "games/*/ui-vue"]
 }
```
 
---
 
## Step 5 — Update `package.json` Scripts
 
```diff
-"test": "jest",
-"test:blackout": "jest --selectProjects blackout",
-"test:imposter": "jest --selectProjects imposter",
-"test:secret-signals": "jest --selectProjects secret-signals",
+"test": "vitest run",
+"test:watch": "vitest",
+"test:blackout": "vitest run --project blackout",
+"test:imposter": "vitest run --project imposter",
+"test:secret-signals": "vitest run --project secret-signals",
```
 
> `vitest run` executes once and exits (CI-friendly). `vitest` (without `run`) starts in interactive watch mode.
 
---
 
## Step 6 — Migrate Test Files
 
### 6.1 — Global search & replace
 
Run these substitutions across all files matching `**/__tests__/**/*.test.ts`:
 
| Find | Replace |
|---|---|
| `jest.mock(` | `vi.mock(` |
| `jest.fn(` | `vi.fn(` |
| `jest.spyOn(` | `vi.spyOn(` |
| `jest.useFakeTimers(` | `vi.useFakeTimers(` |
| `jest.useRealTimers(` | `vi.useRealTimers(` |
| `jest.advanceTimersByTime(` | `vi.advanceTimersByTime(` |
| `jest.restoreAllMocks(` | `vi.restoreAllMocks(` |
| `jest.clearAllMocks(` | `vi.clearAllMocks(` |
 
With `globals: true` enabled, no import statements need to be added for `vi`.
 
### 6.2 — Special case: `jest.requireMock` (`games/blackout/__tests__/roundManager.test.ts`)
 
`jest.requireMock()` has no direct Vitest equivalent. Replace with `vi.mocked()`:
 
```typescript
// Before
const mockGetCategory = jest.requireMock('../server/src/managers/categoryManager').getCategory as jest.Mock;
 
// After — the module is already mocked via vi.mock() at the top of the file
import * as categoryManager from '../server/src/managers/categoryManager';
vi.mock('../server/src/managers/categoryManager');
const mockGetCategory = vi.mocked(categoryManager.getCategory);
```
 
### 6.3 — Special case: `jest.Mock` type imports
 
```typescript
// Before
import type { Mock } from 'jest';
// or inline: jest.Mock<ReturnType, Args>
 
// After
import type { Mock } from 'vitest';
```
 
---
 
## Step 7 — Update `AGENTS.md`
 
In the **Commands** section, update the test entry:
 
```diff
-pnpm test           # run all unit tests (jest, all 3 games)
+pnpm test           # run all unit tests (vitest, all 3 games)
```
 
---
 
## Verification
 
After all changes, run the full check sequence:
 
```bash
pnpm install                 # refresh lockfile after dependency changes
pnpm test                    # all 15 tests pass across 4 projects
pnpm test:blackout           # 5 tests (blackout)
pnpm test:imposter           # 4 tests (imposter)
pnpm test:secret-signals     # 3 tests (secret-signals)
pnpm typecheck               # no TypeScript errors
pnpm lint                    # no lint errors (max-warnings 0)
pnpm test:e2e                # Playwright E2E suite still passes
```