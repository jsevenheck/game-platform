# Plan 02 — Live Rooms / Public Lobby Discovery (HomeView)

> **Scope:** Plan 2 of 3 for the HomeView redesign. Independent of Plan 1 (game-grid) and Plan 3 (browse/host split). Backend + frontend feature. **No code changes — planning only.**
>
> **Branch baseline:** `pi/create-scout-game` (working tree clean at plan creation time).
>
> **Reference:** games.frostify.fr exposes `GET /api/rooms` polled every 5s and renders a grid of joinable rooms. We will **not** poll; we will mirror that UX over an event-driven socket channel.

---

## 1. Goal

Add a **"Live Rooms"** section to `HomeView.vue` that lets visitors discover and join open, public lobbies in real time. Hosts opt in by toggling a new **"List this room publicly"** checkbox on `PartyView`; once opted in, the party appears in every connected client's Live Rooms list within ~1 second of any membership / status change. The list is **event-driven** (push, not poll), respects opt-in (default off), and degrades gracefully with a manual **Refresh** button as a safety net.

The section sits between the existing create/join form and the page footer (the footer itself is currently inside the form card; the new section is a sibling card below it).

---

## 2. Why event-driven, not polling

The user explicitly rejected the 5-second polling pattern from `games.frostify.fr`. The platform already uses Socket.IO for real-time party updates (`partyUpdate`) and has a working pub/sub model around `io.of('/party').to(partyId)`. We extend that model with a dedicated **lobby-watchers** channel that broadcasts `joinablePartiesUpdate` whenever any party's public-listing-eligibility changes. Reasons:

1. **Latency** — sub-second visibility vs. up to 5 s lag.
2. **Server load** — eliminates `N_clients × 12 reqs/min` of redundant work.
3. **Consistency with the rest of the platform** — party state already flows via push; mixing poll + push would create two sources of truth on the client.
4. **Metering is already done** — Socket.IO handler instrumentation (`startSocketHandlerInstrumentation`) gives us per-event latency / counters for free.
5. **No new HTTP surface** — the codebase exposes `/api` only for static / health; adding a polling endpoint would require a new CORS / auth story and would diverge from the existing socket-first design.

The Refresh button still exists so a stale client (e.g. after a long background tab resume) can recover without waiting for the next event.

---

## 3. Backend changes

### 3.1 New `isPublic` flag on a party (opt-in)

`apps/platform/server/party/types.ts` — extend `PartySession`:

```ts
export interface PartySession {
  partyId: string;
  inviteCode: string;
  hostPlayerId: string;
  members: Map<string, PartyMember>;
  selectedGameId: string | null;
  activeMatch: PartyMatch | null;
  status: PartyStatus;
  returnAcks: Set<string>;
  pendingCleanupMatchKey: string | null;
  /** New: host opt-in to listing in the public Live Rooms feed. Defaults false. */
  isPublic: boolean;
  /** New: monotonic counter used as a snapshot version (cheap ETag-ish). */
  publicVersion: number;
  /** New: epoch ms when the host marked the room public. */
  publicListedAt: number | null;
}
```

`apps/platform/server/party/partyStore.ts`:

- Default `isPublic: false`, `publicVersion: 0`, `publicListedAt: null` in `createParty` (line ~42-52).
- Add helpers:
  - `setPartyPublic(party, isPublic)` — bumps `publicVersion`, sets/clears `publicListedAt`, returns the new value.
  - `isJoinablePublic(party, game)` — predicate used by both the snapshot function and the broadcast helper:
    ```ts
    function isJoinablePublic(party: PartySession): boolean {
      return (
        party.isPublic &&
        party.status === 'lobby' &&
        party.members.size >= 1 &&
        Array.from(party.members.values()).some((m) => m.connected)
      );
    }
    ```
  - `getJoinablePublicPartiesSnapshot()` — returns `JoinablePartyView[]` for the initial fetch (see §3.2 payload).
  - `toJoinablePartyView(party, getGame)` — projector that:
    - Uses `party.inviteCode`, `party.hostPlayerId` (NOT exposed — see §9 risks).
    - Looks up `gameLabel` from `getGame(party.selectedGameId)?.definition.name` if a game is selected; otherwise `null`.
    - `playerCount = connectedMemberCount(party)` (existing helper at `partyHandlers.ts:91-93`).
    - `state = party.status` (only `'lobby'` will be returned by the predicate, but we project the raw value).
    - `hasPassword = false` for now (see §9 for the open question).
    - `createdAt = party.publicListedAt` (set when host opts in, NOT `createParty`'s time — avoids stale "1h ago" cards when a host toggles public late).
- Reset `isPublic = false` in `deleteParty` and `clearAllParties` (defensive; the map is cleared but the explicit reset avoids accidental leakage if delete ever becomes lazy).

### 3.2 New socket event: `listJoinableParties`

In `apps/platform/server/party/partyHandlers.ts`, extend `PartyServerToClientEvents` and `PartyClientToServerEvents`:

```ts
interface PartyClientToServerEvents {
  // …existing…
  listJoinableParties: (
    data: Record<string, never> | undefined,
    cb: (res: { ok: true; parties: JoinablePartyView[] } | { ok: false; error: string }) => void
  ) => void;
  /** Subscribe to live updates of the public lobby list. */
  subscribeJoinableParties: (data: Record<string, never> | undefined) => void;
  unsubscribeJoinableParties: (data: Record<string, never> | undefined) => void;
}

interface PartyServerToClientEvents {
  partyUpdate: (partyView: PartyView) => void;
  /** Pushed to subscribers whenever the joinable-parties set changes. */
  joinablePartiesUpdate: (parties: JoinablePartyView[]) => void;
}
```

Wire-up on the `/party` namespace connection:

- `socket.on('listJoinableParties', …)` — runs `checkJoinableListRateLimit(socket.id)`, returns `getJoinablePublicPartiesSnapshot()` via callback. **No auto-subscribe** — caller explicitly subscribes for live updates.
- `socket.on('subscribeJoinableParties', …)` — joins the socket to a `lobby-watchers` room, sends one immediate `joinablePartiesUpdate` snapshot for first-paint.
- `socket.on('unsubscribeJoinableParties', …)` — `socket.leave('lobby-watchers')`.
- All three handlers are wrapped with `startSocketHandlerInstrumentation('/party', '<event>')` and increment a new `partyLifecycleTotal` event value (see §3.4).

### 3.3 Broadcast helper

Add a module-local helper in `partyHandlers.ts`:

```ts
const LOBBY_WATCHERS_ROOM = 'lobby-watchers';

function broadcastJoinableParties(io: Server): void {
  const parties = getJoinablePublicPartiesSnapshot();
  io.of('/party').to(LOBBY_WATCHERS_ROOM).emit('joinablePartiesUpdate', parties);
}
```

Call it from **every code path that can change whether a party is joinable + public**:

| Event handler                         | When to broadcast                                                    |
| ------------------------------------- | -------------------------------------------------------------------- |
| `createParty` (new party, isPublic=false → don't broadcast yet) | Only if/when host later toggles public.                            |
| `joinParty` (new member joined)       | After `broadcastParty(io, party)`, call `broadcastJoinableParties(io)` — may add the party to the list now that membership is stable. |
| `leaveParty` (member left, host moved, party deleted) | After `broadcastParty(io, party)`, then `broadcastJoinableParties(io)`. |
| `selectGame` (selectedGameId changed) | After `broadcastParty(io, party)`, then `broadcastJoinableParties(io)` — `gameLabel` changes. |
| `launchGame` (status → `in-match`)    | After `broadcastParty(io, party)`, then `broadcastJoinableParties(io)` — party no longer joinable. |
| `replayGame` (status stays in-match) | Skip — already in-match.                                            |
| `returnToLobby` / `ackReturnedToLobby` | After `broadcastParty(io, party)`, then `broadcastJoinableParties(io)` — party becomes joinable again. |
| `disconnect` (last member, party scheduled for cleanup) | After `broadcastParty(io, party)`, then `broadcastJoinableParties(io)`. |
| New `setPartyPublic` handler (see §3.5) | Always. |

> **Why broadcast on every mutation rather than diffing?** Snapshot is cheap (iterate `parties.values()`, ~hundreds of entries at most). Pushes are bounded to the `lobby-watchers` room. Diffing would invite race conditions and require a version vector per socket. The "full snapshot per push" pattern is what frostify's polling already implies and what the existing `partyUpdate` event does for the per-party room.

### 3.4 New metric: `lobbies_public_total`

In `apps/platform/server/metrics/metrics.ts` add:

```ts
export const lobbiesPublicGauge = new Gauge({
  name: 'platform_lobbies_public',
  help: 'Current number of publicly listed, joinable lobbies in this server process.',
  registers: [metricsRegistry],
});
```

Wire it into `apps/platform/server/metrics/collectors.ts` alongside `partiesActiveGauge`. Use the same `getXxxSnapshot()` style — add a `collect()` that calls `getJoinablePublicPartiesSnapshot().length`. **No labels** — per `docs/observability-metrics.md` §"Label cardinality rules", `inviteCode` and friends are forbidden.

Document the new metric in `docs/observability-metrics.md` under a new "Public lobby discovery" subsection (table row + one example line).

### 3.5 New socket event: `setPartyPublic`

In `PartyClientToServerEvents`:

```ts
setPartyPublic: (
  data: { playerId: string; isPublic: boolean },
  cb: (res: { ok: true; isPublic: boolean; publicVersion: number } | { ok: false; error: string }) => void
) => void;
```

Handler rules:

- Actor must be `party.hostPlayerId` (mirror `selectGame` / `launchGame` host check at `partyHandlers.ts:421-433`).
- Mutate via `setPartyPublic(party, data.isPublic)`.
- `incrementPartyLifecycle({ event: 'setPartyPublic', result: 'ok' | 'rejected', reason?: 'not_host' | 'not_in_party' })`.
- `broadcastParty(io, party)` (so PartyView updates the checkbox) then `broadcastJoinableParties(io)`.
- Structured log (no `inviteCode` in production — it's redacted by `apps/platform/server/logging/logger.ts:36`):

  ```ts
  socketLogger.info(
    { partyId: party.partyId, playerId: actor.playerId, isPublic: data.isPublic, publicVersion: party.publicVersion },
    'host toggled public listing'
  );
  ```

### 3.6 Rate-limit (mirror f618df4)

In `apps/platform/server/party/partyHandlers.ts`, add a per-socket token-bucket for read-side events (same pattern as `apps/platform/server/admin.ts:18-69`):

```ts
interface RateLimitRecord { count: number; resetAt: number; }
const joinableListRateLimit = new Map<string, RateLimitRecord>(); // key = socket.id
const JOINABLE_LIST_RATE_WINDOW_MS = 3_000;
const JOINABLE_LIST_RATE_MAX = 1;

function checkJoinableListRateLimit(socketId: string): boolean {
  const now = Date.now();
  const record = joinableListRateLimit.get(socketId);
  if (!record || now > record.resetAt) {
    joinableListRateLimit.set(socketId, { count: 1, resetAt: now + JOINABLE_LIST_RATE_WINDOW_MS });
    return true;
  }
  if (record.count >= JOINABLE_LIST_RATE_MAX) return false;
  record.count++;
  return true;
}
```

Reuse the admin-side prune loop by exporting `pruneExpiredRateLimitEntries` from a small new helper file `apps/platform/server/observability/rateLimit.ts` (preferred) — admin.ts will then call it for its own maps. **Refactor `apps/platform/server/admin.ts:28-41` to import the shared helper** (3-line move, low risk). The prune interval lives in `admin.ts` for now (it already exists; we just expand its scope). See §9.

On rate-limit rejection:

- `listJoinableParties` returns `{ ok: false, error: 'rate_limited' }` (still inside the callback — no exception).
- `subscribeJoinableParties` / `unsubscribeJoinableParties` are **not** rate-limited (subscribe is cheap and idempotent; gating it would hurt reconnecting clients).
- Log a `warn` with the existing structured pattern, never log the socket id under a non-redacted label.

### 3.7 Logging (lifecycle focus, no secrets)

All log calls go through `createComponentLogger('party', { namespace: '/party' })` (existing at `partyHandlers.ts:97`) and `createSocketLogger(...)` (existing helper). New structured events:

- `'subscribed to joinable parties feed'` — on `subscribeJoinableParties` ok.
- `'unsubscribed from joinable parties feed'` — on `unsubscribeJoinableParties` ok.
- `'host toggled public listing'` — on `setPartyPublic` ok.
- `'joinable parties rate limited'` (warn) — on rate-limit rejection.
- `'joinable parties broadcast'` (debug, only when `LOG_SOCKET_EVENTS=true`) — confirms the snapshot size.

Never log `inviteCode` in production (it's redacted, but also don't bother including it in dev — `partyId` is sufficient for cross-referencing with `partyUpdate`).

---

## 4. Frontend changes

### 4.1 New Pinia store: `usePublicLobbiesStore`

Path: `apps/platform/src/stores/publicLobbies.ts` (separate file — keeps the existing `usePartyStore` focused on the single-party session).

```ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export interface JoinablePartyView {
  inviteCode: string;
  gameId: string | null;
  gameLabel: string | null;
  playerCount: number;
  state: 'lobby' | 'launching' | 'in-match' | 'returning'; // expect 'lobby' in practice
  hasPassword: boolean;
  createdAt: number; // epoch ms; = publicListedAt
}

export type PublicLobbiesLoadState = 'idle' | 'loading' | 'ready' | 'error';

export const usePublicLobbiesStore = defineStore('platform-public-lobbies', () => {
  const parties = ref<JoinablePartyView[]>([]);
  const state = ref<PublicLobbiesLoadState>('idle');
  const error = ref<string | null>(null);
  const lastUpdated = ref<number | null>(null);

  const isEmpty = computed(() => state.value === 'ready' && parties.value.length === 0);

  function applyUpdate(next: JoinablePartyView[]): void {
    // Defensive copy + sort: newest first (publicListedAt desc), stable.
    parties.value = [...next].sort((a, b) => b.createdAt - a.createdAt);
    state.value = 'ready';
    error.value = null;
    lastUpdated.value = Date.now();
  }

  function setLoading(): void {
    state.value = 'loading';
    error.value = null;
  }

  function setError(message: string): void {
    state.value = 'error';
    error.value = message;
  }

  function reset(): void {
    parties.value = [];
    state.value = 'idle';
    error.value = null;
    lastUpdated.value = null;
  }

  return { parties, state, error, lastUpdated, isEmpty, applyUpdate, setLoading, setError, reset };
});
```

Rationale for a **separate** store:
- The existing `usePartyStore` represents the local party the user is in. Mixing "list of public rooms" into it would tangle two lifecycles (the user is only ever in one party, but may be browsing many).
- Pinia supports multiple stores cleanly; this matches the scout fix that removed `onUnmounted` from `useSocket` because lifecycle is owned by the consuming component.

### 4.2 Extend `usePartySocket` types

`apps/platform/src/composables/usePartySocket.ts` — extend the event maps (mirrors §3.2):

```ts
interface PartyClientToServerEvents {
  // …existing…
  listJoinableParties: (
    data?: Record<string, never>,
    cb?: (res: { ok: true; parties: JoinablePartyView[] } | { ok: false; error: string }) => void
  ) => void;
  subscribeJoinableParties: (data?: Record<string, never>) => void;
  unsubscribeJoinableParties: (data?: Record<string, never>) => void;
  setPartyPublic: (
    data: { playerId: string; isPublic: boolean },
    cb?: (res: { ok: true; isPublic: boolean; publicVersion: number } | { ok: false; error: string }) => void
  ) => void;
}

interface PartyServerToClientEvents {
  partyUpdate: (partyView: PartyView) => void;
  joinablePartiesUpdate: (parties: JoinablePartyView[]) => void;
}
```

Import `JoinablePartyView` from the new store file. The socket is **not** created here — it's the same singleton that `HomeView` and `PartyView` already share via `usePartySocket()`.

### 4.3 New composable: `usePublicLobbies`

Path: `apps/platform/src/composables/usePublicLobbies.ts`. Owns the lifecycle, mounts on HomeView, unsubscribes on unmount:

```ts
import { onMounted, onBeforeUnmount } from 'vue';
import { usePublicLobbiesStore } from '../stores/publicLobbies';
import { usePartySocket } from './usePartySocket';

export function usePublicLobbies(): { refresh: () => void } {
  const socket = usePartySocket();
  const store = usePublicLobbiesStore();

  function handleUpdate(parties: JoinablePartyView[]) {
    store.applyUpdate(parties);
  }

  function refresh() {
    if (!socket.connected) return; // silent no-op; HomeView shows "Connecting…"
    store.setLoading();
    socket.emit('listJoinableParties', undefined, (res) => {
      if (!res.ok) {
        store.setError(res.error);
        return;
      }
      store.applyUpdate(res.parties);
    });
  }

  onMounted(() => {
    socket.on('joinablePartiesUpdate', handleUpdate);
    socket.on('connect', refresh); // re-snapshot on every reconnect (long background tab)
    if (socket.connected) refresh();
    socket.emit('subscribeJoinableParties');
  });

  onBeforeUnmount(() => {
    socket.off('joinablePartiesUpdate', handleUpdate);
    socket.off('connect', refresh);
    socket.emit('unsubscribeJoinableParties');
  });

  return { refresh };
}
```

Mirrors the lifecycle pattern in `HomeView.vue:94-108` and `PartyView.vue:129-148` — `onMounted` registers handlers, `onBeforeUnmount` removes them. (Per the f618df4 scout fix: do **not** put `onUnmounted` inside `useSocket` — composables must not register Vue lifecycle hooks themselves; the consuming view owns them. This plan respects that.)

### 4.4 New component: `PublicLobbiesSection.vue`

Path: `apps/platform/src/views/HomeView/components/PublicLobbiesSection.vue` (new folder under `HomeView/` to keep view-local subcomponents together — matches the precedent set by `games/scout/ui-vue/src/composables/`).

**Props:** none (consumes the store directly).

**Layout:**

```html
<section class="public-lobbies-section" aria-labelledby="public-lobbies-heading">
  <header class="public-lobbies-header">
    <h2 id="public-lobbies-heading" class="public-lobbies-title">Live Rooms</h2>
    <button type="button" class="ui-btn-ghost public-lobbies-refresh" @click="refresh">
      Refresh
    </button>
  </header>

  <!-- Loading: skeleton cards (3 placeholder rows) -->
  <div v-if="state === 'loading'" class="public-lobbies-grid" aria-busy="true">
    <div v-for="i in 3" :key="i" class="ui-game-card public-lobbies-skeleton" />
  </div>

  <!-- Error -->
  <div v-else-if="state === 'error'" class="public-lobbies-empty" role="alert">
    <p>Couldn't load live rooms: {{ error }}</p>
    <button type="button" class="ui-btn-secondary" @click="refresh">Retry</button>
  </div>

  <!-- Empty state -->
  <div v-else-if="isEmpty" class="public-lobbies-empty">
    <p>No open rooms right now. Create one to get started.</p>
  </div>

  <!-- Ready: grid of cards -->
  <div v-else class="public-lobbies-grid">
    <button
      v-for="room in parties"
      :key="room.inviteCode"
      type="button"
      class="ui-game-card public-lobbies-card"
      :class="{ 'public-lobbies-card-joined': isJoined(room) }"
      @click="open(room)"
    >
      <div class="ui-game-card-banner public-lobbies-banner">
        <span class="public-lobbies-icon">{{ iconFor(room) }}</span>
        <span class="ui-badge public-lobbies-state">{{ room.state }}</span>
      </div>
      <div class="ui-game-card-body">
        <h3 class="public-lobbies-name">{{ room.gameLabel ?? 'Any game' }}</h3>
        <div class="public-lobbies-meta">
          <span class="public-lobbies-code">{{ room.inviteCode }}</span>
          <span class="public-lobbies-players">
            <span aria-hidden="true">👤</span> {{ room.playerCount }}
          </span>
          <span v-if="room.hasPassword" class="ui-badge" aria-label="Password required">🔒</span>
        </div>
        <span class="public-lobbies-cta">
          {{ isJoined(room) ? 'Resume' : 'Join' }}
        </span>
      </div>
    </button>
  </div>
</section>
```

**Logic** (`<script setup lang="ts">`):

- `const store = usePublicLobbiesStore()`; `const { refresh } = usePublicLobbies();`
- `const partyStore = usePartyStore()` for the "already joined / Resume" check.
- `function isJoined(room) { return partyStore.party?.inviteCode === room.inviteCode; }`
- `function iconFor(room) { return getClientGame(room.gameId ?? '')?.platformMeta?.icon ?? '🎲'; }` (graceful fallback when no game is selected yet).
- `function open(room)`: if `isJoined(room)`, `router.push(`/party/${room.inviteCode}`)`; otherwise store the target invite code, switch HomeView's tab to `'join'` (or open a join dialog), pre-fill the invite code input, and let the user submit. **We do NOT silently emit `joinParty`** — the existing HomeView flow requires the user to enter their name. The cleanest UX is to flip `mode = 'join'` on HomeView and surface the invite code via a `router` query or a shared ref. (See §9 for the open question on this UX.)

**Styling:** scoped `<style>` using existing design tokens (`var(--color-panel)`, `var(--color-card)`, `var(--color-accent)`, etc.) and shared classes (`ui-game-card`, `ui-badge`, `ui-btn-ghost`). Width adapts via `repeat(auto-fill, minmax(220px, 1fr))` on `.public-lobbies-grid`. **No Tailwind `!important` arbitrary classes** (CLAUDE.md §"Styling").

### 4.5 HomeView integration

`apps/platform/src/views/HomeView.vue`:

- Import the new component and call the composable:
  ```ts
  import PublicLobbiesSection from './components/PublicLobbiesSection.vue';
  import { usePublicLobbies } from '../composables/usePublicLobbies';
  // …
  usePublicLobbies(); // mounts the composable's lifecycle hooks at HomeView level
  ```
- Render `<PublicLobbiesSection />` as a **sibling card** to the existing `.home-card`, **below** it. Both sit inside `.home-root` so they share the centered layout. New wrapper:
  ```html
  <div class="home-root">
    <div class="home-stack">
      <div class="home-card">…existing form…</div>
      <PublicLobbiesSection />
    </div>
  </div>
  ```
- `.home-stack` (new, ~5 lines): `display: flex; flex-direction: column; gap: 1.5rem; align-items: center; width: 100%; max-width: 720px;` — keeps both cards visually balanced on wide screens.
- The Live Rooms card itself uses `max-width: 100%` so it can be wider than the form.

### 4.6 PartyView integration

`apps/platform/src/views/PartyView.vue`:

- Add a checkbox in the host-only controls (currently near the Launch button area, around line 256-276). Host-only visibility (`v-if="store.isHost"`).
- Two-way binding through a local `ref` seeded from `store.party?.isPublic` (default false). On change, `socket.emit('setPartyPublic', { playerId: store.playerId, isPublic: value }, …)`.
- After successful response, do **not** mutate the store directly — wait for the `partyUpdate` push from the server (single source of truth).
- Optimistic UI is **discouraged** here because the server re-broadcasts within milliseconds; the round trip is invisible to the user.

---

## 5. Wire-up summary

| Layer                | File                                                              | Change                                                                                              |
| -------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Types                | `apps/platform/server/party/types.ts`                             | Add `isPublic`, `publicVersion`, `publicListedAt` to `PartySession`.                                |
| Store                | `apps/platform/server/party/partyStore.ts`                        | Default new fields; add `setPartyPublic`, `isJoinablePublic`, `getJoinablePublicPartiesSnapshot`, `toJoinablePartyView`. |
| Handlers             | `apps/platform/server/party/partyHandlers.ts`                     | New events: `listJoinableParties`, `subscribeJoinableParties`, `unsubscribeJoinableParties`, `setPartyPublic`. New `broadcastJoinableParties` helper. Hook into all mutation paths. Add rate-limit map + check. |
| Metrics              | `apps/platform/server/metrics/metrics.ts`                         | New `lobbiesPublicGauge` (no labels).                                                               |
| Metrics              | `apps/platform/server/metrics/collectors.ts`                      | Register collector wired to `getJoinablePublicPartiesSnapshot().length`.                            |
| Observability        | `apps/platform/server/observability/rateLimit.ts` (new)           | Shared `pruneExpiredRateLimitEntries` helper (move from admin.ts:28-34).                            |
| Admin                | `apps/platform/server/admin.ts`                                   | Import shared prune helper; expand existing prune interval to cover the new map.                     |
| Logging              | `apps/platform/server/logging/socketLogger.ts` (no change)        | Reused.                                                                                              |
| Docs                 | `docs/observability-metrics.md`                                   | Add `platform_lobbies_public` row + example line + note in §"Label cardinality rules".               |
| Client types         | `apps/platform/src/composables/usePartySocket.ts`                 | Extend event maps.                                                                                   |
| Client store         | `apps/platform/src/stores/publicLobbies.ts` (new)                 | `usePublicLobbiesStore`.                                                                             |
| Client composable    | `apps/platform/src/composables/usePublicLobbies.ts` (new)         | Lifecycle owner for subscribe / unsubscribe / refresh.                                              |
| Client component     | `apps/platform/src/views/HomeView/components/PublicLobbiesSection.vue` (new) | The grid, states, refresh button, click-to-join.                                          |
| View — Home          | `apps/platform/src/views/HomeView.vue`                            | Mount `usePublicLobbies()`, render `<PublicLobbiesSection />` below the form card.                  |
| View — Party         | `apps/platform/src/views/PartyView.vue`                           | Add host-only "List publicly" checkbox, wire `setPartyPublic`.                                       |
| Unit tests           | `apps/platform/__tests__/partyHandlers.test.ts` (extend)          | New tests (see §8).                                                                                  |
| Unit tests           | `apps/platform/__tests__/partyStore.test.ts` (extend)             | New tests for `isPublic` defaults, `setPartyPublic`, `getJoinablePublicPartiesSnapshot`.            |
| Unit tests (new)     | `apps/platform/__tests__/publicLobbiesRateLimit.test.ts` (new)   | Pruning + per-socket cap.                                                                            |
| E2E                  | `apps/platform/e2e/live-rooms.spec.ts` (new)                      | Two-context public-list visibility test.                                                             |

---

## 6. Type changes (full reference)

```ts
// apps/platform/server/party/types.ts (additive)
export interface PartySession {
  // …existing…
  isPublic: boolean;
  publicVersion: number;
  publicListedAt: number | null;
}

// apps/platform/src/stores/publicLobbies.ts
export interface JoinablePartyView {
  inviteCode: string;
  gameId: string | null;
  gameLabel: string | null;
  playerCount: number;
  state: 'lobby' | 'launching' | 'in-match' | 'returning';
  hasPassword: boolean;
  createdAt: number;
}

export type PublicLobbiesLoadState = 'idle' | 'loading' | 'ready' | 'error';

// apps/platform/src/views/HomeView/components/PublicLobbiesSection.vue — internal
interface RoomCard extends JoinablePartyView {
  _alreadyJoined: boolean;
}
```

Store mutation contract (no Redux-style actions — Vue refs):

- `applyUpdate(parties: JoinablePartyView[]): void` — replaces the list, sets `state='ready'`.
- `setLoading(): void` — sets `state='loading'`.
- `setError(msg: string): void` — sets `state='error'`, `error=msg`.
- `reset(): void` — back to `idle`.

Wire contract is **push-first**: server emits `joinablePartiesUpdate(partyList)` to the `lobby-watchers` room; client always overwrites its local array (idempotent). No client-side diffing needed.

---

## 7. Step-by-step execution plan

Numbered, file paths, and rough line-count deltas. Total estimated net: **~600 LOC** of new code + ~250 LOC of tests.

1. **Server types** — `apps/platform/server/party/types.ts` (+3 lines).
2. **Server store** — `apps/platform/server/party/partyStore.ts` (+~60 lines: 3 new fields in `createParty`, `setPartyPublic`, `isJoinablePublic`, `getJoinablePublicPartiesSnapshot`, `toJoinablePartyView`, reset on delete).
3. **Server rate-limit helper extraction** — `apps/platform/server/observability/rateLimit.ts` (new, ~25 lines), edit `apps/platform/server/admin.ts` to import it (~5 line delta).
4. **Server handlers** — `apps/platform/server/party/partyHandlers.ts`:
   - Add types to `PartyClientToServerEvents` and `PartyServerToClientEvents` (+15 lines).
   - Add rate-limit map + check at module scope (+15 lines).
   - Add `broadcastJoinableParties` helper (+8 lines).
   - Register `listJoinableParties`, `subscribeJoinableParties`, `unsubscribeJoinableParties`, `setPartyPublic` handlers (+~110 lines).
   - Inject `broadcastJoinableParties(io)` calls into existing mutation handlers (~9 sites, 1 line each).
5. **Server metrics** — `apps/platform/server/metrics/metrics.ts` (+9 lines for the gauge); `apps/platform/server/metrics/collectors.ts` (+~10 lines for the collector + reference).
6. **Server observability docs** — `docs/observability-metrics.md` (+~15 lines: metric row, example, label note).
7. **Client types** — `apps/platform/src/composables/usePartySocket.ts` (+~20 lines of event map entries).
8. **Client store** — `apps/platform/src/stores/publicLobbies.ts` (new, ~55 lines).
9. **Client composable** — `apps/platform/src/composables/usePublicLobbies.ts` (new, ~50 lines).
10. **Client component** — `apps/platform/src/views/HomeView/components/PublicLobbiesSection.vue` (new, ~220 lines including scoped styles).
11. **HomeView integration** — `apps/platform/src/views/HomeView.vue` (+~10 lines: imports, composable call, template, `.home-stack` style).
12. **PartyView integration** — `apps/platform/src/views/PartyView.vue` (+~35 lines: checkbox + handler).
13. **Unit tests** — see §8.2.
14. **E2E test** — see §8.3.
15. **Run all gates** — §8.1.

> **Order matters**: do 1-3 before 4 (the handler depends on the helpers); 5 before 6 (doc references the metric); 7 before 8-10 (client types feed the store / composable / component).

---

## 8. Verification

### 8.1 Required command gates (all must pass)

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e --grep "live rooms|public lobby"
```

### 8.2 Vitest additions

- **`apps/platform/__tests__/partyStore.test.ts`** (extend):
  - `isPublic defaults to false on new parties`.
  - `setPartyPublic(party, true) bumps publicVersion and sets publicListedAt`.
  - `getJoinablePublicPartiesSnapshot excludes parties that are not public`.
  - `getJoinablePublicPartiesSnapshot excludes parties that are in-match, returning, or launching`.
  - `getJoinablePublicPartiesSnapshot excludes parties with zero connected members`.
  - `deleteParty resets isPublic / publicVersion / publicListedAt` (regression guard).

- **`apps/platform/__tests__/partyHandlers.test.ts`** (extend using the existing `setup()` factory at line 57):
  - `setPartyPublic rejected when caller is not host`.
  - `setPartyPublic flips isPublic and broadcasts partyUpdate + joinablePartiesUpdate`.
  - `listJoinableParties returns current snapshot via callback`.
  - `listJoinableParties rate-limits after 1 call in 3s` (use `vi.useFakeTimers`, pattern at line 131-148).
  - `subscribeJoinableParties sends initial snapshot then receives subsequent broadcasts`.
  - `joinParty broadcast joinablePartiesUpdate even when party was already public`.
  - `launchGame removes party from snapshot`.
  - `setPartyPublic carries the structured log` (assert with `vi.spyOn(partyLogger, 'info')` if practical, otherwise assert behavior).

- **`apps/platform/__tests__/publicLobbiesRateLimit.test.ts`** (new):
  - `first request within window passes; second within window is rejected`.
  - `window expires and a new request passes`.
  - `pruneExpiredRateLimitEntries removes only expired entries`.

### 8.3 Playwright E2E addition

`apps/platform/e2e/live-rooms.spec.ts` (new), mirrors the helper style of `apps/platform/e2e/party-resume.spec.ts`:

```ts
import { expect, test, type Page } from '@playwright/test';

async function createParty(page: Page, name: string) {
  await page.goto('/');
  await page.fill('#name', name);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/party\/[A-Z0-9]+/);
  return page.url().split('/party/')[1]?.split('/')[0] ?? '';
}

async function togglePublic(page: Page) {
  // Host checkbox in PartyView
  const checkbox = page.getByLabel(/list.*publicly|publicly.*list/i);
  await checkbox.check();
}

test('live rooms shows public parties and updates in real time', async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const ctxC = await browser.newContext();
  const host = await ctxA.newPage();
  const observer = await ctxB.newPage();
  const lateObserver = await ctxC.newPage();

  // 1. Host creates a public party.
  const code = await createParty(host, 'Alice');
  await togglePublic(host);

  // 2. Observer navigates to Home — should see the party in the Live Rooms list.
  await observer.goto('/');
  await expect(observer.getByTestId('public-lobbies-card').first()).toBeVisible({ timeout: 5_000 });
  await expect(observer.getByTestId('public-lobbies-card').first()).toContainText(code);

  // 3. Launch the game in the host tab; observer should see the card disappear within ~1s.
  //    (Host selects Scout — using the Scout registry's min players = 2, so we need a joiner.)
  const joiner = await ctxA.newPage(); // shares the host's invite via UI
  await joiner.goto('/');
  await joiner.getByRole('button', { name: 'Join Party' }).click();
  await joiner.fill('#name', 'Bob');
  await joiner.fill('#code', code);
  await joiner.getByRole('button', { name: 'Join Party', exact: true }).click();
  await joiner.waitForURL(/\/party\/[A-Z0-9]+/);

  // Launch game (Scout, min 2 players, max 5)
  await host.getByRole('button', { name: /Scout/ }).click();
  await host.getByRole('button', { name: 'Launch Game' }).click();
  await host.waitForURL(/\/game\/scout/);

  // Observer should see the card disappear (status is no longer lobby).
  await expect(observer.getByText('No open rooms right now.')).toBeVisible({ timeout: 5_000 });

  // 4. Late observer (separate context, never seen the party) — should still get the snapshot on subscribe.
  await lateObserver.goto('/');
  // No public rooms again at this point, so assert empty state, then create another party and confirm it appears.
  await host.getByRole('button', { name: /Return to Lobby/ }).click().catch(() => {});
  // …assertion for second round-trip…

  await ctxA.close();
  await ctxB.close();
  await ctxC.close();
});
```

The exact selector names (`public-lobbies-card`, `public-lobbies-empty`) must be added as `data-testid` attributes in `PublicLobbiesSection.vue`. The spec is intentionally end-to-end and exercises the socket round-trip; no client mocking.

### 8.4 Manual smoke test

1. Start `pnpm dev`.
2. Open `http://localhost:5173` in two browser tabs.
3. In tab A: enter a name, click "Create Party", toggle "List publicly", copy the invite code from the URL.
4. In tab B: stay on `/`. Within 1 second, a card with the invite code and "Scout / Any game" should appear.
5. In tab A: select Scout, launch. Tab B's card should disappear (status moves out of `lobby`).
6. In tab A: click "Return to Lobby". Tab B's card should re-appear.
7. Reload tab B (page refresh). On HomeView re-mount, the snapshot should be re-fetched via `listJoinableParties` and the card should appear within ~200ms.
8. Click the Refresh button in tab B — verify it re-issues `listJoinableParties` (visible in DevTools Network tab) and rate-limit kicks in if spammed (no crash, last data preserved).

---

## 9. Risks & open questions

### Top 3 risks

1. **Privacy / invite-code leakage** — `JoinablePartyView.inviteCode` is broadcast in plaintext to every socket in the `lobby-watchers` room. Anyone who subscribes gets the full code. Today this is only mildly worse than someone scraping `/api/rooms` would be, but it means **bots** can auto-join by enumerating codes from the snapshot. Mitigations (in this plan): `hasPassword: false` is a placeholder — see open question 1 below. Worst-case today, the only protection is that the code is 6 chars of `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (~30 bits of entropy) and guessable at ~1k tries/sec.
2. **Snapshot broadcast cost on hot paths** — `joinParty` / `leaveParty` / `selectGame` now each call `broadcastJoinableParties(io)` which iterates every party in memory. With ~1000 parties and 100-watcher clients, that's 100k emits per host toggle. Cheaper than the alternative (diff + targeted emit) only because Socket.IO batches to a single room. Risk is bounded by current traffic (parties << 1k). Mitigation if it ever bites: gate broadcasts on a `dirty` flag set by mutation handlers and emit once per tick.
3. **Stale state on disconnect** — if a tab backgrounds for 30 minutes, the socket reconnects but `subscribeJoinableParties` may be re-emitted before `connect` fires on the server. The composable handles this via the `socket.on('connect', refresh)` pattern, but if the tab never reconnects (backgrounded forever), the server holds the watcher in its room until the engine times out. Risk: low impact, but a per-socket leak.

### Top 2 open questions for the user

1. **Do we want password-protected lobbies now, or is `hasPassword: false` acceptable for v1?** If yes, the type already has the field — we just need to (a) add a `password?: string` field to `PartySession`, (b) hash it server-side (bcrypt is already a dependency), (c) extend `joinParty` to accept a password and reject mismatch, and (d) include a `requiresPassword` flag (no hash) in the snapshot. **Recommend deferring** — `hasPassword: false` ships with v1, and we add it in a follow-up plan once we know the threat model.
2. **Should clicking a room card in the Live Rooms section auto-join the party, or drop the user into the existing Join form pre-filled?** Frostify's behavior is auto-join. Our existing HomeView form needs a name, which the user may not have entered yet on the Home screen. Options:
   - **(A) Auto-join** — prompt for a name via a small modal first (adds new component). Smooth UX, more code.
   - **(B) Pre-fill** — flip `mode = 'join'`, paste the invite code into the input, let the user type a name and submit. Zero new components; matches the existing two-tab UX.
   - **(C) Hard-require name first** — disable the Live Rooms section until the user types a name in the form above.
   - **Recommendation:** (B) for v1, migrate to (A) later if telemetry shows the drop-off is significant. Needs a user call.

### Smaller notes (not blockers)

- "Coming soon" games (per Plan 1) should not appear in the snapshot even if a party selected them — guard at `toJoinablePartyView` by checking `getGame(...).releaseStatus !== 'soon'`. This is mentioned but not implemented here because Plan 1 hasn't landed yet. When Plan 1 ships, add the guard; if Plan 1 lands before this plan, reference `definition.releaseStatus`.
- State staleness when a party goes `lobby → playing`: the snapshot excludes any non-lobby party (§3.1 `isJoinablePublic`), so the card disappears on `launchGame`. Good UX, no card shows "in progress, can't join". Confirm in E2E.
- Solo-mode games don't exist today; `playerCount` is always ≥ 1 (the host). When Plan 1 adds solo support, decide whether solo public lobbies are allowed (recommend: no — public = looking for players, solo = personal). For v1, no-op.
- Frostify shows `canJoin: true` only. We already do stricter filtering (§3.1) — good.
- Don't include `hostPlayerId` in `JoinablePartyView`. The card UI shows game name, code, and player count only — no host identity, no member names. Privacy-preserving by default.
- The `lobby-watchers` Socket.IO room has **no** access control beyond "you're connected to `/party`", which is anyone who loaded the client. That's intentional — public discovery is the whole point.

---

## 10. Estimated effort

Rough, sequential hours for one engineer familiar with the codebase:

| Area                                            | Hours  |
| ----------------------------------------------- | ------ |
| Server types + store + handlers + rate-limit    | 4.0    |
| Server metrics + observability refactor         | 1.0    |
| Server unit tests                               | 2.0    |
| Client types + store + composable               | 1.5    |
| Client component (PublicLobbiesSection.vue)     | 3.0    |
| HomeView + PartyView wiring                     | 1.5    |
| Styling (responsive grid, empty/error states)   | 1.0    |
| E2E test (with debugging)                       | 2.0    |
| Docs (this file + observability-metrics.md)     | 0.5    |
| Verification (typecheck/lint/test/e2e + fixes)  | 1.5    |
| **Total**                                       | **~18h** |

If password-protected lobbies are pulled into this scope (open question 1), add ~4h.

---

## 11. Out of scope (explicit non-goals)

- **No auth changes** — no login, no JWT, no admin role. Public listing is open to any socket on `/party`.
- **No password-protected rooms in v1** — `hasPassword` field exists but is always `false`; password UI is a follow-up plan (see open question 1).
- **No region pinning / latency matchmaking** — the snapshot is global; clients pick a room manually.
- **No skill-based or ELO matchmaking** — manual join only, mirroring frostify.
- **No filtering UI** — no game filter, no player-count filter, no text search. Sort is newest-first only.
- **No favorites / "rooms I joined recently"** — not in scope; the user can re-join via `Join Party` + code.
- **No pagination** — snapshot is bounded by joinable-public parties (typically << 50 in practice). If we ever cross 100, revisit (v2).
- **No cross-process federation** — `/metrics` and the snapshot are process-local; horizontally scaled deployments each report their own slice. Documented in `docs/observability-metrics.md`.
- **No changes to game-level socket protocols** — `/g/{game}` namespaces are untouched.
- **No migration of existing parties** — `isPublic` defaults to `false`, so all existing parties stay private until the host opts in.
- **No "first public room" highlight or featured list** — flat list only.
- **No browser-tab visibility / polling fallback** — event-driven is the contract; Refresh is the only fallback.
- **Plan 1 (game-grid) and Plan 3 (browse/host split) are independent** — do not couple to this plan; do not introduce shared components prematurely.
