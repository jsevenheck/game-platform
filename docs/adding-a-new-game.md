# Adding a New Game

This guide walks through every step required to integrate a new game into the platform. The example assumes a game called **"quiz-rush"** — replace with your actual game id (kebab-case).

## Overview

A game consists of three parts:

| Layer      | Location                      | Purpose                                            |
| ---------- | ----------------------------- | -------------------------------------------------- |
| **Core**   | `games/quiz-rush/core/src/`   | Shared types, constants, event definitions         |
| **Server** | `games/quiz-rush/server/src/` | Socket.IO game logic (runs on the platform server) |
| **UI**     | `games/quiz-rush/ui-vue/src/` | Vue 3 components for the platform runtime only     |

Games are **internal source modules** — they have no standalone server, client, or build step. The platform imports them directly.

---

## Step 1 — Scaffold the Directory Structure

```
games/quiz-rush/
├── package.json
├── core/
│   └── src/
│       ├── types.ts          ← room, player, round types
│       ├── constants.ts      ← min/max players, timers, defaults
│       └── events.ts         ← Socket.IO event type maps
├── server/
│   └── src/
│       └── index.ts          ← entry point: register + cleanupMatch
├── ui-vue/
│   ├── tsconfig.json
│   ├── env.d.ts
│   └── src/
│       ├── App.vue           ← platform-only game root component
│       └── PlatformAdapter.vue ← platform wrapper (loaded directly by platform)
├── __tests__/                ← Vitest unit tests
├── e2e/                      ← Playwright E2E specs
└── docs/                     ← game-specific documentation
```

### `package.json`

```json
{
  "name": "quiz-rush",
  "version": "1.0.0",
  "private": true,
  "type": "commonjs"
}
```

### `ui-vue/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "noEmit": true,
    "jsx": "preserve",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["../core/src/*"],
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.vue", "src/**/*.d.ts", "env.d.ts"]
}
```

### `ui-vue/env.d.ts`

```ts
/// <reference types="vite/client" />
declare module '*.vue';
```

---

## Step 2 — Define Core Types and Events

### `core/src/constants.ts`

```ts
export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 10;
export const DEFAULT_ROUND_COUNT = 5;
```

### `core/src/types.ts`

Define at minimum:

- **Room** — server-side game state (phase, players, round data)
- **Player** — id, name, socketId, connected, isHost
- **RoomView / PlayerView** — client-safe versions (strip secrets)

### `core/src/events.ts`

Define the Socket.IO event type maps:

```ts
export interface ClientToServerEvents {
  autoJoinRoom: (
    data: {
      sessionId: string;
      name: string;
      playerId?: string;
      isHost?: boolean; // UI hint only; server must derive host from party state
      joinToken?: string;
      resumeToken?: string;
    },
    cb: (
      res:
        | { ok: true; roomCode: string; playerId: string; resumeToken: string }
        | { ok: false; error: string }
    ) => void
  ) => void;
  // ... game-specific events
}

export interface ServerToClientEvents {
  roomUpdate: (data: RoomView) => void;
  // ... game-specific events
}
```

> **Important:** The `autoJoinRoom` event is required. The platform calls it with `sessionId` (the matchKey), `name`, `playerId`, `joinToken`, and `isHost` for every player entering the game. Treat `isHost` as a UI hint only; authorize the player and derive host status from platform party state on the server.

---

## Step 3 — Implement the Server

### `server/src/index.ts`

Every game server module must export three things:

```ts
import type { Server } from 'socket.io';
import { createComponentLogger } from '../../../../apps/platform/server/logging/logger';
import {
  attachSocketEventDebugLogging,
  createSocketLogger,
} from '../../../../apps/platform/server/logging/socketLogger';
import { MIN_PLAYERS, MAX_PLAYERS } from '../../core/src/constants';

export const definition = {
  id: 'quiz-rush',
  name: 'Quiz Rush',
  minPlayers: MIN_PLAYERS,
  maxPlayers: MAX_PLAYERS,
};

const gameLogger = createComponentLogger('game-server', { gameId: definition.id });

export function register(io: Server, namespace = `/g/${definition.id}`): void {
  const nsp = io.of(namespace);

  nsp.on('connection', (socket) => {
    const socketLogger = createSocketLogger(gameLogger, socket, { namespace });
    attachSocketEventDebugLogging(socket, socketLogger);

    socket.on('autoJoinRoom', (data: unknown, cb: unknown) => {
      // Validate the unknown payload shape before reading fields.
      // Create or rejoin a room using data.sessionId as the room key.
      // Validate data.joinToken against the active platform party member.
      // Derive host status from party state; do not trust data.isHost.
      // Call cb({ ok: true, roomCode, playerId, resumeToken }) on success.
    });

    // ... other game event handlers
  });
}

export function cleanupMatch(matchKey: string): void {
  // Tear down the room identified by matchKey.
  // Called by the platform when a match ends or the party returns to lobby.
  gameLogger.info({ matchKey }, 'cleaned up match');
}
```

### `autoJoinRoom` Contract

This is the critical integration point. The handler must:

1. **Authorize with `joinToken`** — call `authorizePartyJoin(gameId, sessionId, stablePlayerId, joinToken)` from `apps/platform/server/party/gameAuth.ts` at the top of the handler. Use the returned `member.playerId` and `member.name` as the authoritative identity — never trust client-supplied `playerId` / `name` / `isHost`.
2. **Create a room** if none exists for the given `sessionId` (matchKey).
3. **Rejoin** if the player's `playerId` already exists in the room (reconnection) — **validate the `resumeToken`**: if the slot has a server-issued token, require the client to supply it; reject with `{ ok: false, error: 'Resume token required' }` if absent or `'Invalid resume token'` if wrong.
4. **Sync host from party state** — call `syncRoomHostAfterJoin(room, authorization.hostPlayerId, !authorization.hostConnected)` after binding the player. Treat `data.isHost` only as an optional client/UI hint.
5. **Call back** with `{ ok: true, roomCode, playerId, resumeToken }` on success or `{ ok: false, error }` on failure.
6. The server-issued `resumeToken` must never be included in any broadcast room view sent to clients.

> **Use the shared helpers** — `authorizePartyJoin`, `syncRoomHostAfterJoin`, `assignHost`, `restoreHostToFirstConnectedPlayer`, `normalizeJoinToken`, and `normalizeStablePlayerId` are all exported from `apps/platform/server/party/gameAuth.ts`. Do not re-implement them per game.

### Socket Handler Validation and Authorization

- Type Socket.IO handler input as `unknown` on the server and validate shape before reading fields.
- Normalize required strings, validate enums/booleans/integers, and respond with `{ ok: false, error: 'Invalid request' }` for malformed payloads.
- For host-only actions, re-sync host state from the active party first, then verify the socket index, room code, player id, `player.connected === true`, and `player.socketId === socket.id`.
- Do not trust client-provided `isHost` for authorization.

### `cleanupMatch` Contract

- Remove the room/session mapped to the given matchKey.
- Remove socket indexes/session mappings associated with that room so stale sockets cannot pass later authorization checks.
- Clean up any active timers, intervals, or scheduled tasks for that room.

### Server Logging

Reuse the platform logger helpers from `apps/platform/server/logging/` instead of adding a game-local logging dependency.

- Use `createComponentLogger('game-server', { gameId: definition.id })` for the namespace or module logger.
- Use `createSocketLogger(gameLogger, socket)` per connection so `socketId`, `sessionId`, and `playerId` are attached when available.
- Call `attachSocketEventDebugLogging(socket, socketLogger)` once per connection. It only emits catch-all event summaries when `LOG_SOCKET_EVENTS=true`.
- The platform logging behavior is controlled with `LOG_LEVEL`, `LOG_PRETTY`, and `LOG_SOCKET_EVENTS`.
- Log lifecycle events such as room creation, join/resume, host transfer, start/end, cleanup, and unexpected failures.
- Do not log secrets or hidden game data. Never include `resumeToken`, `joinToken`, `inviteCode`, auth headers, private hands/cards/words, or raw payload dumps in normal logs.

### Server Observability

Reuse the platform observability helpers from `apps/platform/server/observability/` for consistent metrics across all namespaces.

**Per-handler instrumentation** — wrap every callback-based event with `startSocketHandlerInstrumentation`. Socket acknowledgements are optional, so normalize missing callbacks to a no-op before wrapping:

```ts
import { startSocketHandlerInstrumentation } from '../../../../apps/platform/server/observability/socketHandlerMetrics';

socket.on('someEvent', (data: unknown, cb: unknown) => {
  const instrumentation = startSocketHandlerInstrumentation(namespace, 'someEvent', definition.id);
  const callback =
    typeof cb === 'function' ? (cb as (res: { ok: boolean; error?: string }) => void) : () => {};
  const respond = instrumentation.wrapCallback(callback);

  try {
    if (!isValidPayload(data)) return respond({ ok: false, error: 'Invalid request' });
    // ... handler logic ...
    return respond({ ok: true });
  } catch (err) {
    instrumentation.finishError();
    socketLogger.error({ err }, 'someEvent failed');
    return respond({ ok: false, error: 'Invalid action' });
  }
});
```

Outcome values: `ok` (success), `rejected` (expected validation failure), `failed` (unexpected server error). Do not `throw` for expected request failures; finish instrumentation and respond with a sanitized error.

**Namespace connection metrics** — call the connection and disconnect helpers once per connection:

```ts
import {
  recordNamespaceConnection,
  recordNamespaceDisconnect,
} from '../../../../apps/platform/server/observability/socketNamespaceMetrics';

nsp.on('connection', (socket) => {
  recordNamespaceConnection({ namespace, gameId }, nsp);

  socket.on('disconnect', () => {
    recordNamespaceDisconnect({ namespace, gameId }, nsp);
  });
});
```

This keeps the `platform_socket_connections_open` gauge and the `platform_socket_events_total` connection/disconnect counters consistent across all namespaces.

---

### `ui-vue/src/App.vue`

The game's root component. It is always launched by `PlatformAdapter.vue` and connects to the game's Socket.IO namespace:

```vue
<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import { io, type Socket } from 'socket.io-client';

const props = withDefaults(
  defineProps<{
    wsNamespace?: string;
    sessionId?: string;
    playerName?: string;
    playerId?: string;
    joinToken?: string;
    isHost?: boolean;
  }>(),
  {
    wsNamespace: '/g/quiz-rush',
    sessionId: '',
    playerName: '',
    playerId: '',
    joinToken: '',
    isHost: false,
  }
);

const emit = defineEmits<{
  'phase-change': [phase: string];
}>();

let socket: Socket | undefined;

function emitAutoJoinRoom() {
  if (!socket?.connected || !props.sessionId) return;
  socket.emit(
    'autoJoinRoom',
    {
      sessionId: props.sessionId,
      name: props.playerName,
      playerId: props.playerId,
      joinToken: props.joinToken,
      isHost: props.isHost,
    },
    (res) => {
      if (!res.ok) console.error(res.error);
      // Initialize game state from response, including resumeToken.
    }
  );
}

onMounted(() => {
  socket = io(props.wsNamespace, {
    auth: {
      sessionId: props.sessionId,
      playerId: props.playerId,
      joinToken: props.joinToken,
    },
    autoConnect: false,
    transports: ['websocket', 'polling'],
  });
  socket.on('connect', emitAutoJoinRoom);
  socket.connect();
  // Listen for room updates, emit phase-change when relevant.
});

onBeforeUnmount(() => {
  socket?.off('connect', emitAutoJoinRoom);
  socket?.disconnect();
});
</script>
```

> **Key:** Emit `phase-change` with the value `'ended'` when the game is over. The `PlatformAdapter` watches for this to show the replay/return overlay.
>
> If you extract socket creation into a `useSocket()` composable, keep ownership explicit: return the socket (and/or a cleanup function) and disconnect in the owning `App.vue` `onBeforeUnmount()`. Do not hide parent-owned socket teardown inside a composable lifecycle hook.
>
> **Required:** The `useSocket` composable must accept and forward `joinToken` in the socket `auth` object. Without it, `authorizePartyJoin` will reject the join. Every game's `useSocket` must also call `socket.disconnect()` in `onUnmounted()` to prevent socket leaks.

### `ui-vue/src/PlatformAdapter.vue`

Wraps `App.vue` and adds the platform overlay (replay / return to lobby). Also accepts `actionError` to display errors from platform actions:

```vue
<script setup lang="ts">
import { ref, computed } from 'vue';
import GameApp from './App.vue';

defineProps<{
  matchKey: string;
  playerId: string;
  playerName: string;
  namespace: string;
  joinToken?: string;
  isHost?: boolean;
  onReplayGame?: () => void;
  onReturnToLobby?: () => void;
  actionError?: string; // Optional: error from platform replay/lobby actions
}>();

const gamePhase = ref('');
const gameEnded = computed(() => gamePhase.value === 'ended');

function onPhaseChange(phase: string) {
  gamePhase.value = phase;
}
</script>

<template>
  <div class="platform-game-wrapper">
    <GameApp
      :ws-namespace="namespace"
      :session-id="matchKey"
      :player-name="playerName"
      :player-id="playerId"
      :join-token="joinToken"
      :is-host="isHost"
      @phase-change="onPhaseChange"
    />
    <div v-if="gameEnded && isHost" class="platform-overlay">
      <button class="btn-replay" @click="onReplayGame?.()">Play Again</button>
      <button class="btn-lobby" @click="onReturnToLobby?.()">Back to Party</button>
      <p v-if="actionError" class="mt-3 text-center text-sm text-danger">{{ actionError }}</p>
    </div>
    <div v-else-if="gameEnded" class="platform-overlay">
      <p class="text-sm text-muted-foreground">Waiting for host to decide...</p>
    </div>
  </div>
</template>
```

> **Important:** The platform passes `namespace` and `matchKey`; the game `App.vue` expects `wsNamespace` and `sessionId`. The adapter is responsible for mapping these correctly and forwarding `joinToken` for socket auth / `autoJoinRoom`.

---

## Step 5 — Register with the Platform

### 5a. Server Registry

Edit `apps/platform/server/registry/index.ts`:

```ts
import * as quizRush from '../../../../games/quiz-rush/server/src/index';

// Add to the module wrapper section:
const quizRushModule: GameServerModule = {
  definition: quizRush.definition,
  registerServer: (io, namespacePath) => quizRush.register(io, namespacePath),
  cleanupMatch: (matchKey) => quizRush.cleanupMatch(matchKey),
};

// Add to the registry map:
export const gameRegistry = new Map<string, GameServerModule>([
  ['blackout', blackoutModule],
  ['imposter', imposterModule],
  ['secret-signals', secretSignalsModule],
  ['flip7', flip7Module],
  ['scout', scoutModule],
  ['quiz-rush', quizRushModule], // ← add this
]);
```

### 5b. Client Registry

Edit `apps/platform/src/games/index.ts`:

```ts
// clientGameRegistry is a PlatformGameModule[] — add an entry to the array:
export const clientGameRegistry: PlatformGameModule[] = [
  // ... existing entries ...
  {
    definition: { id: 'quiz-rush', name: 'Quiz Rush', minPlayers: 3, maxPlayers: 10 },
    platformMeta: {
      icon: '⚡',
      gradFrom: '#3b0764',
      gradTo: '#111827',
      description: 'Fast trivia for party chaos',
    },
    loadClient: () => import('@quiz-rush-ui/PlatformAdapter.vue'),
  },
];
```

### 5c. Vite Alias

Edit `apps/platform/vite.config.ts` — two changes:

**Add the UI alias:**

```ts
resolve: {
  alias: [
    // ... existing aliases ...
    { find: '@quiz-rush-ui', replacement: resolve(GAMES_ROOT, 'quiz-rush/ui-vue/src') },
  ],
},
```

**Wire `@shared/*` resolution into `sharedAliasPlugin()`:**

```ts
function sharedAliasPlugin(): Plugin {
  return {
    name: 'shared-alias',
    async resolveId(source, importer) {
      if (!source.startsWith('@shared')) return null;
      if (!importer) return null;
      const normalized = importer.replace(/\\\\/g, '/');
      const subpath = source.replace(/^@shared\/?/, '');
      let baseDir: string | undefined;
      if (normalized.includes('/games/blackout/')) {
        baseDir = resolve(GAMES_ROOT, 'blackout/core/src');
      } else if (normalized.includes('/games/imposter/')) {
        baseDir = resolve(GAMES_ROOT, 'imposter/core/src');
      } else if (normalized.includes('/games/secret-signals/')) {
        baseDir = resolve(GAMES_ROOT, 'secret-signals/core/src');
      } else if (normalized.includes('/games/flip7/')) {
        baseDir = resolve(GAMES_ROOT, 'flip7/core/src');
      } else if (normalized.includes('/games/scout/')) {
        baseDir = resolve(GAMES_ROOT, 'scout/core/src');
      } else if (normalized.includes('/games/quiz-rush/')) {
        baseDir = resolve(GAMES_ROOT, 'quiz-rush/core/src'); // ← add this branch
      }
      if (!baseDir) return null;
      const resolved = await this.resolve('./' + subpath, resolve(baseDir, '_placeholder.ts'), {
        skipSelf: true,
      });
      return resolved;
    },
  };
}
```

> **Note:** `sharedAliasPlugin()` is **hardcoded** — every new game must add its own `else if` branch.

### 5d. Platform Vue Module Declaration

Edit `apps/platform/env.d.ts` so TypeScript recognizes the new adapter alias:

```ts
declare module '@quiz-rush-ui/PlatformAdapter.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent;
  export default component;
}
```

### 5e. Tailwind Source Scan and Accent Token

The platform's `main.css` already scans all game UI source with these global directives:

```css
@source "../../../../games/*/ui-vue/src/**/*.vue";
@source "../../../../games/*/ui-vue/src/**/*.ts";
```

No per-game `@source` directive is required while those globs remain in place.

Add your game's accent color token inside `@theme`:

```css
--color-quiz-rush: #7c3aed;
--color-quiz-rush-hover: #6d28d9;
--color-quiz-rush-muted: rgba(124, 58, 237, 0.12);
```

This makes `bg-quiz-rush`, `text-quiz-rush`, `border-quiz-rush`, etc. available. Avoid Tailwind `!important` utility overrides such as `!bg-quiz-rush`; prefer scoped `<style>` classes in the Vue component when a shared component needs game-specific styling.

### 5f. pnpm Workspace

The workspace is already configured via the glob `'games/*'` in `pnpm-workspace.yaml`, so no changes are needed.

### 5g. Dockerfile

Edit the root `Dockerfile` and add your game's `package.json` to the manifest-copy layer **before** `RUN pnpm install`. This is required so `pnpm install --frozen-lockfile` can resolve the workspace package (the lockfile always references every workspace member):

```dockerfile
COPY games/blackout/package.json games/blackout/
COPY games/imposter/package.json games/imposter/
COPY games/secret-signals/package.json games/secret-signals/
COPY games/flip7/package.json games/flip7/
COPY games/scout/package.json games/scout/
COPY games/quiz-rush/package.json games/quiz-rush/  # ← add this
```

> **Why:** Docker builds the manifest layer before copying source. If the directory is missing at `pnpm install` time, pnpm will abort with `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR` or a workspace resolution error even though the lockfile was generated with the package present.

---

## Step 6 — Design System

Use the platform's design tokens and shared component classes. Do not define custom CSS variables outside your game's Vue components. Everything in `apps/platform/src/styles/main.css` is available globally.

### Design Tokens

| Category     | Token names                                                                                  |
| ------------ | -------------------------------------------------------------------------------------------- |
| Surfaces     | `canvas`, `shell`, `panel`, `card`, `elevated`                                               |
| Text         | `foreground`, `muted`, `muted-foreground`                                                    |
| Borders      | `border`, `border-strong`, `ring`                                                            |
| Platform     | `accent` (orange `#f97316`)                                                                  |
| Game accents | `blackout` (violet), `imposter` (crimson), `signals` (cyan), `flip7` (amber), `scout` (teal) |
| Semantic     | `danger`, `success`, `warning` (+ `-muted` variants)                                         |

Use `bg-canvas`, `text-foreground`, `border-border`, etc. directly in your templates.

### Shared Component Classes

| Class                                       | Purpose                      |
| ------------------------------------------- | ---------------------------- |
| `ui-shell-header`                           | Top navigation bar           |
| `ui-panel`                                  | Content panel                |
| `ui-overlay`                                | Full-screen overlay backdrop |
| `ui-dialog`                                 | Centered dialog box          |
| `ui-btn-primary`                            | Primary action button        |
| `ui-btn-secondary`                          | Secondary action button      |
| `ui-btn-ghost`                              | Ghost / tertiary button      |
| `ui-btn-danger`                             | Destructive action button    |
| `ui-input`                                  | Text input field             |
| `ui-badge`                                  | Status badge                 |
| `ui-stepper-btn`                            | Numeric stepper button       |
| `ui-section-label`                          | Section heading label        |
| `ui-game-card` / `ui-game-card-selected`    | Lobby game cards             |
| `ui-game-card-banner` / `ui-game-card-body` | Lobby card sections          |
| `ui-player-item` / `ui-avatar`              | Party player rows            |
| `ui-tab-group` / `ui-tab`                   | Tab controls                 |
| `ui-progress-track` / `ui-progress-fill`    | Progress bar                 |

These classes are defined in `@layer components` and are available in all game Vue files without any import.

---

## Step 7 — Add Documentation

Create `games/quiz-rush/docs/` with:

- **`api.md`** — Socket.IO events, payloads, and server responses.
- **`architecture.md`** — Game phases, state machine, and design decisions.
- Include a short operational note in one of those docs that lists the important lifecycle logs and the private fields that must never appear in logs.

---

## Step 8 — Add Tests

### Unit Tests

Create `games/quiz-rush/__tests__/` with Vitest test files. Register the project in `vitest.projects.ts`:

```ts
export const quizRushProject = {
  resolve: {
    alias: [{ find: '@shared', replacement: resolve(GAMES_ROOT, 'quiz-rush/core/src') }],
  },
  test: {
    name: 'quiz-rush',
    include: ['games/quiz-rush/__tests__/**/*.test.ts'],
    environment: 'node',
    globals: true,
    clearMocks: true,
  },
};

// Add to allProjects:
export const allProjects = [
  platformProject,
  blackoutProject,
  imposterProject,
  secretSignalsProject,
  flip7Project,
  scoutProject,
  quizRushProject, // ← add this
];
```

Add a root script in `package.json` for targeted runs:

```json
"test:quiz-rush": "vitest run --project quiz-rush"
```

### E2E Tests

Create `games/quiz-rush/e2e/game.spec.ts`. E2E tests run via the platform flow:

```ts
import { test, expect, type Page } from '@playwright/test';

async function createParty(page: Page, name: string): Promise<string> {
  await page.goto('/');
  await page.fill('#name', name);
  await page.click('button[type="submit"]');
  await page.waitForSelector('.code');
  return (await page.locator('.code').textContent())?.trim() ?? '';
}

async function joinParty(page: Page, name: string, code: string): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Join Party' }).click();
  await page.fill('#name', name);
  await page.fill('#code', code);
  await page.click('button[type="submit"]');
  await page.waitForSelector('.code');
}

async function launchGame(host: Page, gameName: string): Promise<void> {
  await host.getByRole('button', { name: gameName }).click();
  await host.getByRole('button', { name: 'Launch Game' }).click();
  await host.waitForURL(/\/game\//);
}

test.describe('Quiz Rush via Platform', () => {
  test('host can start a game', async ({ browser }) => {
    // Create contexts, create party, join, launch, assert game loaded
  });
});
```

The Playwright config at `playwright.config.ts` automatically picks up `games/*/e2e/**/*.spec.ts`.

### E2E Timing Shortcut

If your game has timers that would make E2E tests slow, add an `IS_E2E` flag:

```ts
// server/src/config/constants.ts
export const IS_E2E = process.env.E2E_TESTS === '1';
export const TIMER_MS = IS_E2E ? 2_000 : 60_000;
```

The Playwright config passes `E2E_TESTS=1` to the server automatically.

---

## Checklist

- [ ] `games/quiz-rush/` directory structure created
- [ ] `core/src/` — types, constants, events defined
- [ ] `server/src/index.ts` — exports `definition`, `register()`, `cleanupMatch()`
- [ ] `server/src/` — `autoJoinRoom` handler validates unknown payloads, authorizes `joinToken`, handles `sessionId`/`playerId`, and derives host from party state (not client `isHost`)
- [ ] `server/src/` — shared logger helpers from `apps/platform/server/logging/` are used
- [ ] `server/src/` — lifecycle logs exist for join/resume/start/end/cleanup without secrets or raw payload dumps (`resumeToken`, `joinToken`, `inviteCode` must not appear)
- [ ] `server/src/` — `startSocketHandlerInstrumentation` used for all callback-bearing events, including no-callback events via a no-op ack
- [ ] `server/src/` — `recordNamespaceConnection` / `recordNamespaceDisconnect` called on connect/disconnect
- [ ] `ui-vue/src/App.vue` — connects to namespace, emits `phase-change`
- [ ] `ui-vue/src/PlatformAdapter.vue` — wraps App.vue with platform overlay
- [ ] `ui-vue/tsconfig.json` — paths include `@shared/*`
- [ ] `apps/platform/server/registry/index.ts` — game registered
- [ ] `apps/platform/src/games/index.ts` — client module registered
- [ ] `apps/platform/vite.config.ts` — UI alias + `@shared` plugin entry added
- [ ] `apps/platform/env.d.ts` — adapter alias module declaration added
- [ ] `apps/platform/src/styles/main.css` — global game `@source` globs still cover the new UI and accent color tokens are added
- [ ] `Dockerfile` — `COPY games/{id}/package.json games/{id}/` added to manifest layer
- [ ] `vitest.projects.ts` — test project added
- [ ] `package.json` — `test:{game-id}` script added
- [ ] `pnpm install` — no errors
- [ ] `pnpm lint` — passes
- [ ] `pnpm typecheck` — passes
- [ ] `pnpm test` — unit tests pass
- [ ] `pnpm test:e2e` — E2E tests pass
