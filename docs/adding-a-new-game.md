# Adding a New Game

This guide walks through every step required to integrate a new game into the platform. The example assumes a game called **"quiz-rush"** — replace with your actual game id (kebab-case).

## Overview

A game consists of three parts:

| Layer      | Location                      | Purpose                                             |
| ---------- | ----------------------------- | --------------------------------------------------- |
| **Core**   | `games/quiz-rush/core/src/`   | Shared types, constants, event definitions          |
| **Server** | `games/quiz-rush/server/src/` | Socket.IO game logic (runs on the platform server)  |
| **UI**     | `games/quiz-rush/ui-vue/src/` | Vue 3 components for the platform runtime only      |

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
      isHost?: boolean;
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

> **Important:** The `autoJoinRoom` event is required. The platform calls it with `sessionId` (the matchKey), `name`, `playerId`, and `isHost` for every player entering the game.

---

## Step 3 — Implement the Server

### `server/src/index.ts`

Every game server module must export three things:

```ts
import type { Server } from 'socket.io';
import { MIN_PLAYERS, MAX_PLAYERS } from '../../core/src/constants';

export const definition = {
  id: 'quiz-rush',
  name: 'Quiz Rush',
  minPlayers: MIN_PLAYERS,
  maxPlayers: MAX_PLAYERS,
};

export function register(io: Server, namespace = `/g/${definition.id}`): void {
  const nsp = io.of(namespace);

  nsp.on('connection', (socket) => {
    socket.on('autoJoinRoom', (data, cb) => {
      // Create or rejoin a room using data.sessionId as the room key.
      // Handle data.isHost to transfer host status from the platform.
      // Call cb({ ok: true, roomCode, playerId }) on success.
    });

    // ... other game event handlers
  });
}

export function cleanupMatch(matchKey: string): void {
  // Tear down the room identified by matchKey.
  // Called by the platform when a match ends or the party returns to lobby.
}
```

### `autoJoinRoom` Contract

This is the critical integration point. The handler must:

1. **Create a room** if none exists for the given `sessionId` (matchKey).
2. **Rejoin** if the player's `playerId` already exists in the room (reconnection) — **validate the `resumeToken`**: if the slot has a server-issued token, require the client to supply it; reject with `{ ok: false, error: 'Resume token required' }` if absent or `'Invalid resume token'` if wrong.
3. **Respect `isHost`** — when `data.isHost === true`, make that player the game host regardless of join order.
4. **Call back** with `{ ok: true, roomCode, playerId, resumeToken }` on success or `{ ok: false, error }` on failure.
5. The server-issued `resumeToken` must never be included in any broadcast room view sent to clients.

### `cleanupMatch` Contract

- Remove the room/session mapped to the given matchKey.
- Clean up any active timers, intervals, or scheduled tasks for that room.

---

## Step 4 — Implement the Client UI

### `ui-vue/src/App.vue`

The game's root component. It is always launched by `PlatformAdapter.vue` and connects to the game's Socket.IO namespace:

```vue
<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { io, type Socket } from 'socket.io-client';

const props = withDefaults(
  defineProps<{
    namespace?: string;
    sessionId?: string;
    playerName?: string;
    playerId?: string;
    isHost?: boolean;
  }>(),
  {
    namespace: '/g/quiz-rush',
    sessionId: '',
    playerName: '',
    playerId: '',
    isHost: false,
  }
);

const emit = defineEmits<{
  'phase-change': [phase: string];
}>();

let socket: Socket;

onMounted(() => {
  socket = io(props.namespace, { transports: ['websocket'] });
  socket.on('connect', () => {
    socket.emit(
      'autoJoinRoom',
      {
        sessionId: props.sessionId,
        name: props.playerName,
        playerId: props.playerId,
        isHost: props.isHost,
      },
      (res) => {
        if (!res.ok) console.error(res.error);
        // Initialize game state from response
      }
    );
  });
  // Listen for room updates, emit phase-change when relevant
});

onUnmounted(() => {
  socket?.disconnect();
});
</script>
```

> **Key:** Emit `phase-change` with the value `'ended'` when the game is over. The `PlatformAdapter` watches for this to show the replay/return overlay.

### `ui-vue/src/PlatformAdapter.vue`

Wraps `App.vue` and adds the platform overlay (replay / return to lobby):

```vue
<script setup lang="ts">
import { ref, computed } from 'vue';
import GameApp from './App.vue';

const props = defineProps<{
  matchKey: string;
  playerId: string;
  playerName: string;
  namespace: string;
  isHost?: boolean;
  onReplayGame?: () => void;
  onReturnToLobby?: () => void;
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
      :namespace="props.namespace"
      :session-id="props.matchKey"
      :player-name="props.playerName"
      :player-id="props.playerId"
      :is-host="props.isHost"
      @phase-change="onPhaseChange"
    />
    <div v-if="gameEnded && isHost" class="platform-overlay">
      <button class="btn-replay" @click="onReplayGame?.()">Play Again</button>
      <button class="btn-lobby" @click="onReturnToLobby?.()">Back to Party</button>
    </div>
  </div>
</template>
```

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

### 5d. Tailwind Source Scan

Edit `apps/platform/src/styles/main.css` — add a `@source` directive so Tailwind generates all utility classes used in your game's Vue files:

```css
@source "../../../../games/quiz-rush/ui-vue/src/**/*.{vue,ts}";
```

> The platform's `main.css` already has a global scan covering all games (`@source "../../../../games/*/ui-vue/src/**/*.{vue,ts}";`), so a per-game source is optional. Still recommended to keep the generated CSS more focused.

Also add your game's accent color token inside `@theme`:

```css
--color-quiz-rush: #your-color;
```

This makes `bg-quiz-rush`, `text-quiz-rush`, `border-quiz-rush`, etc. available. Use `!bg-quiz-rush` for important overrides.

### 5e. pnpm Workspace

The workspace is already configured via the glob `'games/*'` in `pnpm-workspace.yaml`, so no changes are needed.

---

## Step 6 — Design System

Use the platform's design tokens and shared component classes. Do not define custom CSS variables outside your game's Vue components. Everything in `apps/platform/src/styles/main.css` is available globally.

### Design Tokens

| Category     | Token names                                                          |
|--------------|----------------------------------------------------------------------|
| Surfaces     | `canvas`, `shell`, `panel`, `elevated`                              |
| Text         | `foreground`, `muted`, `muted-foreground`                           |
| Borders      | `border`, `border-strong`, `ring`                                   |
| Platform     | `accent` (orange `#f97316`)                                         |
| Game accents | `blackout` (violet), `imposter` (crimson), `signals` (cyan)         |
| Semantic     | `danger`, `success`, `warning` (+ `-muted` variants)               |

Use `bg-canvas`, `text-foreground`, `border-border`, etc. directly in your templates.

### Shared Component Classes

| Class | Purpose |
|---|---|
| `ui-shell-header` | Top navigation bar |
| `ui-panel` | Content panel |
| `ui-overlay` | Full-screen overlay backdrop |
| `ui-dialog` | Centered dialog box |
| `ui-btn-primary` | Primary action button |
| `ui-btn-secondary` | Secondary action button |
| `ui-btn-ghost` | Ghost / tertiary button |
| `ui-btn-danger` | Destructive action button |
| `ui-input` | Text input field |
| `ui-badge` | Status badge |
| `ui-stepper-btn` | Numeric stepper button |
| `ui-section-label` | Section heading label |
| `ui-progress-track` / `ui-progress-fill` | Progress bar |

These classes are defined in `@layer components` and are available in all game Vue files without any import.

---

## Step 7 — Add Documentation

Create `games/quiz-rush/docs/` with:

- **`api.md`** — Socket.IO events, payloads, and server responses.
- **`architecture.md`** — Game phases, state machine, and design decisions.

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
  quizRushProject, // ← add this
];
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
- [ ] `server/src/` — `autoJoinRoom` handler respects `sessionId`, `playerId`, `isHost`
- [ ] `ui-vue/src/App.vue` — connects to namespace, emits `phase-change`
- [ ] `ui-vue/src/PlatformAdapter.vue` — wraps App.vue with platform overlay
- [ ] `ui-vue/tsconfig.json` — paths include `@shared/*`
- [ ] `apps/platform/server/registry/index.ts` — game registered
- [ ] `apps/platform/src/games/index.ts` — client module registered
- [ ] `apps/platform/vite.config.ts` — UI alias + `@shared` plugin entry added
- [ ] `apps/platform/src/styles/main.css` — `@source` directive + accent color token added
- [ ] `vitest.projects.ts` — test project added
- [ ] `pnpm install` — no errors
- [ ] `pnpm lint` — passes
- [ ] `pnpm typecheck` — passes
- [ ] `pnpm test` — unit tests pass
- [ ] `pnpm test:e2e` — E2E tests pass
