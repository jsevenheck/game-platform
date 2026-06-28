---
name: vitest
description: Use when writing unit/integration tests for Vite projects - configure vitest.config.ts, write test suites with describe/it, create mock implementations with vi.fn and vi.mock, set up code coverage thresholds, and run tests in parallel
license: MIT
---

# Vitest

Vite-native testing framework with Jest-compatible API.

## When to Use

- Writing unit/integration tests for Vite projects
- Testing Vue/React/Svelte components
- Mocking modules, timers, or dates
- Running concurrent/parallel tests
- Type testing with TypeScript

## Quick Start

```bash
npm i -D vitest
```

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node', // or 'jsdom' for DOM tests
  },
});
```

```ts
// example.test.ts
import { describe, expect, it, vi } from 'vitest';

describe('math', () => {
  it('adds numbers', () => {
    expect(1 + 1).toBe(2);
  });
});
```

## Reference Files

| Task                                     | File                                    |
| ---------------------------------------- | --------------------------------------- |
| Configuration, CLI, projects             | [config.md](references/config.md)       |
| test/describe, hooks, fixtures           | [test-api.md](references/test-api.md)   |
| vi.fn, vi.mock, timers, spies            | [mocking.md](references/mocking.md)     |
| expect, snapshots, coverage, filtering   | [utilities.md](references/utilities.md) |
| Environments, type testing, browser mode | [advanced.md](references/advanced.md)   |

## Loading Files

**Consider loading these reference files based on your task:**

- [ ] [references/config.md](references/config.md) - if setting up vitest.config.ts, CLI, or workspace projects
- [ ] [references/test-api.md](references/test-api.md) - if writing test/describe blocks, using hooks, or test fixtures
- [ ] [references/mocking.md](references/mocking.md) - if mocking modules, timers, dates, or using spies
- [ ] [references/utilities.md](references/utilities.md) - if writing assertions, snapshots, or configuring coverage
- [ ] [references/advanced.md](references/advanced.md) - if configuring test environments, type testing, or browser mode

**DO NOT load all files at once.** Load only what's relevant to your current task.

## Project Patterns: Socket.IO Game Unit Tests

When testing platform game Socket.IO server modules in this repository:

- Prefer lightweight in-process namespace/socket fakes for handler logic instead of starting a real Socket.IO server when transport behavior is not under test.
- Mock a namespace with `use`, `on('connection')`, `to().emit`, and a `sockets` map; capture middleware and the connection handler so tests can call `connect(fakeSocket)` deterministically.
- Fake sockets should expose `id`, `data`, `handshake.auth`, `join/leave/disconnect/emit` spies, and an `on()` method that stores handlers in `socket.handlers`. Invoke `socket.handlers.<event>(payload, cb)` directly for assertions.
- For ack-based handlers, assert callbacks are called exactly once with `{ ok: ... }`. Also cover malformed payloads and missing-callback/no-callback paths when instrumentation depends on callback wrapping.
- Build regression tests around lifecycle edge cases: host disconnect/reconnect, platform host changes, stale socket indexes, room deletion cleanup, and active-match authorization.
- Reset global in-memory state in `afterEach` (`deleteRoom`/`clearAllParties`/mock cleanup). If a test mutates `process.env` (for deterministic E2E deals, timers, or feature flags), restore or delete the variable in `finally`.
- When deterministic card/deck behavior is needed, assert the resolved host receives the scripted opening hand even if join order differs from host order.

## Cross-Skill References

- **Vue component testing** → Use `vue` skill for component patterns
- **Library testing** → Use `ts-library` skill for library patterns
- **Vite configuration** → Use `vite` skill for shared config
