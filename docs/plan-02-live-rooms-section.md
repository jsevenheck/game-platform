# Plan 02 — Live Rooms / Public Lobby Discovery

**Status:** revised planning document (critical review applied)  
**Baseline:** current party flow is Socket.IO-first; parties are private invite-code rooms.  
**Scope:** backend + frontend feature. Hosts can opt in to listing their lobby publicly on the home page.

---

## 1. Critical assessment / verdict

**Verdict: valuable feature, but it must be opt-in, push-based, and conservative about exposed data.**

Issues found in the previous draft and fixed here:

1. **Party view type gap:** the server must include public-listing state in `partyToView()`, and the client `PartyView` type must include it, otherwise the host checkbox cannot be source-of-truth driven.
2. **Over-modeling:** `publicVersion` and `hasPassword: false` add complexity without a v1 consumer. This plan keeps only `isPublic` and `publicListedAt`.
3. **Missing broadcast paths:** `resumeParty`, return-to-lobby timeout, and admin/kick cleanup paths can affect the public snapshot and need explicit consideration.
4. **Lifecycle duplication:** subscribing and immediately listing causes duplicate first-paint snapshots. This plan uses `subscribeJoinableParties` for first paint and keeps `listJoinableParties` for the manual Refresh button / reconnect recovery.
5. **Awkward rate-limit ownership:** admin HTTP rate limiting should not own party socket maps. This plan introduces a shared helper but keeps the joinable-list limiter local to party handlers.
6. **Unclear join UX:** clicking a public room should not silently join without a name. V1 pre-fills the existing Join form and focuses it.

---

## 2. Goal

Add a **Live Rooms** section to `/` that shows public, joinable lobbies in real time:

- parties are private by default;
- only the host can toggle **List this room publicly** in `PartyView`;
- public lobbies appear/disappear through Socket.IO push updates, not polling;
- visitors can click a room card to pre-fill the existing Join form with the invite code;
- no member names, host names, player IDs, socket IDs, tokens, or hidden game state are exposed.

---

## 3. Architecture decision

Use the existing `/party` Socket.IO namespace and a server-side room for watchers:

```ts
const PUBLIC_LOBBIES_ROOM = 'public-lobbies-watchers';
```

Events:

| Direction       | Event                        | Purpose                                                   |
| --------------- | ---------------------------- | --------------------------------------------------------- |
| client → server | `subscribeJoinableParties`   | Join watcher room; server immediately pushes a snapshot.  |
| client → server | `unsubscribeJoinableParties` | Leave watcher room.                                       |
| client → server | `listJoinableParties`        | Manual Refresh / recovery snapshot via ack, rate-limited. |
| client → server | `setPartyPublic`             | Host toggles public listing for their current party.      |
| server → client | `joinablePartiesUpdate`      | Full snapshot of currently public, joinable lobbies.      |

Why push instead of polling:

- lower latency for lobby visibility;
- less redundant HTTP traffic;
- fits the existing party-state model (`partyUpdate` already uses Socket.IO);
- no new HTTP endpoint or CORS/auth surface;
- Refresh remains available for recovery.

---

## 4. Server data model

### `apps/platform/server/party/types.ts`

Add fields to `PartySession`:

```ts
export interface PartySession {
  // existing fields …
  /** Host opt-in to list this lobby publicly. Defaults false. */
  isPublic: boolean;
  /** Epoch ms when the party most recently became public. */
  publicListedAt: number | null;
}
```

### `partyToView()` and client `PartyView`

Expose the public toggle state to party members:

```ts
export interface PartyView {
  // existing fields …
  isPublic: boolean;
  publicListedAt: number | null;
}
```

Update both:

- `apps/platform/server/party/partyStore.ts` → `partyToView()`;
- `apps/platform/src/stores/party.ts` → `PartyView` interface.

No resume tokens or hidden fields are exposed.

### Public lobby wire view

Define the snapshot type on server and client (duplicated for now; no shared package exists):

```ts
export interface JoinablePartyView {
  inviteCode: string;
  gameId: string | null;
  gameName: string | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  connectedPlayers: number;
  status: 'lobby';
  listedAt: number;
}
```

Notes:

- `inviteCode` is intentionally exposed only for host-opted-in public lobbies.
- No `hostName`, `hostPlayerId`, member names, socket IDs, or party IDs.
- `listedAt` is `publicListedAt`; use it for newest-first sorting.
- `status` is always `'lobby'` in v1 because non-lobby parties are filtered out.

---

## 5. Server store helpers

Add to `apps/platform/server/party/partyStore.ts`:

```ts
export function setPartyPublic(party: PartySession, isPublic: boolean): void {
  if (party.isPublic === isPublic) return;
  party.isPublic = isPublic;
  party.publicListedAt = isPublic ? Date.now() : null;
}

export function connectedMemberCount(party: PartySession): number {
  return Array.from(party.members.values()).filter((m) => m.connected).length;
}

export function isJoinablePublicParty(party: PartySession): boolean {
  return party.isPublic && party.status === 'lobby' && connectedMemberCount(party) > 0;
}

export function getJoinablePublicPartiesSnapshot(): JoinablePartyView[] {
  return Array.from(parties.values())
    .filter(isJoinablePublicParty)
    .map(toJoinablePartyView)
    .sort((a, b) => b.listedAt - a.listedAt);
}
```

Implementation details:

- initialize new parties with `isPublic: false`, `publicListedAt: null`;
- `deleteParty()` and `clearAllParties()` need no special public reset because entries are removed, but tests should assert no deleted party remains in the snapshot;
- move the current module-local `connectedMemberCount` from `partyHandlers.ts` into `partyStore.ts` to avoid duplication.

`toJoinablePartyView()` should use `getGame(party.selectedGameId)` to fill game metadata. If no game is selected, use `gameName: null`, `minPlayers: null`, `maxPlayers: null`.

---

## 6. Server handlers

### Event map additions

Add to both server `partyHandlers.ts` and client `usePartySocket.ts` event maps.

```ts
type JoinableListResponse =
  | { ok: true; parties: JoinablePartyView[] }
  | { ok: false; error: string };

type SetPartyPublicResponse = { ok: true; isPublic: boolean } | { ok: false; error: string };
```

Client-to-server:

```ts
listJoinableParties: (
  data: Record<string, never> | undefined,
  cb: (res: JoinableListResponse) => void
) => void;
subscribeJoinableParties: (data?: Record<string, never>) => void;
unsubscribeJoinableParties: (data?: Record<string, never>) => void;
setPartyPublic: (
  data: { playerId: string; isPublic: boolean },
  cb: (res: SetPartyPublicResponse) => void
) => void;
```

Server-to-client:

```ts
joinablePartiesUpdate: (parties: JoinablePartyView[]) => void;
```

### Runtime validation

For the new handlers, validate payload shape before reading fields:

- `setPartyPublic`: `data` object, non-empty `playerId`, boolean `isPublic`;
- `listJoinableParties`: ignore data, validate callback via `wrapCallback`;
- subscribe/unsubscribe are idempotent and need no payload fields.

Expected failures return `{ ok: false, error: 'Invalid request' }` or a specific stable error. Do not throw for expected user mistakes.

### Broadcast helper

```ts
function broadcastJoinableParties(io: Server): void {
  const parties = getJoinablePublicPartiesSnapshot();
  io.of('/party').to(PUBLIC_LOBBIES_ROOM).emit('joinablePartiesUpdate', parties);
}
```

Full snapshots are simpler and safer than diffs for this scale. If traffic grows, batch one broadcast per event-loop tick.

### Mutation paths that need a broadcast

Call `broadcastJoinableParties(io)` after mutations that can change the snapshot:

| Path                                        | Why                                                                   |
| ------------------------------------------- | --------------------------------------------------------------------- |
| `setPartyPublic`                            | room enters/leaves public list                                        |
| `joinParty`                                 | connected player count changes                                        |
| `resumeParty`                               | connected player count changes; disconnected public room may reappear |
| `leaveParty`                                | player count, host transfer, or deletion                              |
| `disconnect`                                | player count may drop to 0                                            |
| `selectGame`                                | game name/capacity changes                                            |
| `launchGame`                                | party leaves lobby, disappears                                        |
| `returnToLobby` / `ackReturnedToLobby`      | party may become lobby again                                          |
| `scheduleReturnCleanup` timeout             | status changes from `returning` to `lobby`                            |
| admin kick / cleanup (if `io` is available) | membership or deletion can change snapshot                            |

`createParty` does not broadcast because new parties are private by default.

### Host authorization for `setPartyPublic`

Mirror existing host-only handlers:

1. get party by `socket.id`;
2. find actor by `socket.id`;
3. require `actor.connected === true`;
4. require `actor.playerId === party.hostPlayerId`;
5. optionally require `actor.playerId === data.playerId` for stale-client rejection;
6. mutate via `setPartyPublic()`;
7. `broadcastParty(io, party)` then `broadcastJoinableParties(io)`.

---

## 7. Rate limiting

Only `listJoinableParties` is rate-limited; `subscribeJoinableParties` is idempotent and should not break reconnects.

Add a small shared helper:

`apps/platform/server/observability/rateLimit.ts`

```ts
export interface RateLimitRecord {
  count: number;
  resetAt: number;
}

export function checkFixedWindowRateLimit(
  map: Map<string, RateLimitRecord>,
  key: string,
  options: { windowMs: number; max: number },
  now = Date.now()
): boolean {
  /* ... */
}

export function pruneExpiredRateLimitEntries(
  map: Map<string, RateLimitRecord>,
  now = Date.now()
): void {
  /* ... */
}
```

Use it in:

- `partyHandlers.ts` for `joinableListRateLimit` (key: socket id, `max=1`, `windowMs=3000`);
- optionally refactor `admin.ts` to use the same helper for existing HTTP maps.

Keep the party limiter and its prune interval local to `partyHandlers.ts`:

```ts
const joinableListRateLimit = new Map<string, RateLimitRecord>();
const pruneInterval = setInterval(
  () => pruneExpiredRateLimitEntries(joinableListRateLimit),
  60_000
);
pruneInterval.unref?.();
```

On rejection:

```ts
respond({ ok: false, error: 'rate_limited' });
```

The client should keep the last good list and show a small non-destructive error.

---

## 8. Metrics and logging

### Metric

Add a no-label gauge in `apps/platform/server/metrics/collectors.ts` (consistent with existing active-party gauges):

```ts
const publicLobbiesGauge = new Gauge({
  name: 'platform_public_lobbies',
  help: 'Current number of publicly listed joinable lobbies in this server process.',
  registers: [metricsRegistry],
  collect() {
    this.set(getJoinablePublicPartiesSnapshot().length);
  },
});
```

Update `initializeMetrics()` to retain the gauge reference.

Document the metric in `docs/observability-metrics.md` under Party lifecycle / Public lobby discovery.

### Counters

Use `incrementPartyLifecycle()` for stable event names:

- `setPartyPublic` with `ok`, `rejected`, `failed`;
- `listJoinableParties` with `ok`, `rejected` (`rate_limited`).

Do not add `inviteCode`, `partyId`, `playerId`, or socket id as metric labels.

### Logs

Use existing structured log helpers.

Allowed log fields: `partyId`, `playerId`, `isPublic`, `connectedPlayers`, `snapshotSize`.  
Avoid logging: `resumeToken`, raw payloads, member lists, hidden game data. `inviteCode` is redacted by config but should still be avoided unless needed.

---

## 9. Frontend store and composable

### Store: `apps/platform/src/stores/publicLobbies.ts`

```ts
export interface JoinablePartyView {
  inviteCode: string;
  gameId: string | null;
  gameName: string | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  connectedPlayers: number;
  status: 'lobby';
  listedAt: number;
}

export type PublicLobbiesLoadState = 'idle' | 'loading' | 'ready' | 'error';
```

Setup store state:

- `parties = ref<JoinablePartyView[]>([])`;
- `state = ref<PublicLobbiesLoadState>('idle')`;
- `error = ref<string | null>(null)`;
- `lastUpdated = ref<number | null>(null)`;
- `isEmpty = computed(() => state.value === 'ready' && parties.value.length === 0)`;
- actions: `applyUpdate`, `setLoading`, `setError`, `reset`.

Sort newest-first in `applyUpdate()` as a defensive client-side guarantee.

### Composable: `apps/platform/src/composables/usePublicLobbies.ts`

The composable owns the public-lobby feed subscription. It must not disconnect the shared party socket.

Lifecycle:

```ts
onMounted(() => {
  socket.on('joinablePartiesUpdate', handleUpdate);
  socket.on('connect', subscribe);

  store.setLoading();
  if (!socket.connected) socket.connect();
  else subscribe();
});

onBeforeUnmount(() => {
  socket.off('joinablePartiesUpdate', handleUpdate);
  socket.off('connect', subscribe);
  if (socket.connected) socket.emit('unsubscribeJoinableParties');
});
```

`subscribe()` emits `subscribeJoinableParties`; the server sends the initial snapshot via `joinablePartiesUpdate`.

`refresh()` emits `listJoinableParties` and handles `{ ok: false, error: 'rate_limited' }` without clearing existing rooms.

---

## 10. Frontend components

Use `apps/platform/src/components/home/` for consistency with Plan 01 and Plan 03.

### `PublicLobbiesList.vue`

Pure presentational list:

- props: `parties: readonly JoinablePartyView[]`, `currentInviteCode?: string | null`;
- emits: `join-room` with `{ inviteCode: string }`;
- renders button cards with `data-testid="public-lobby-card"`;
- labels current party card as `Resume` if `currentInviteCode` matches.

### `PublicLobbiesSection.vue`

Container section:

- calls `usePublicLobbies()`;
- consumes `usePublicLobbiesStore()`;
- shows loading skeleton, error, empty, ready states;
- header includes Refresh button;
- re-emits `join-room` to `HomeView`.

No direct silent `joinParty` emit from this component. Joining remains the existing Home form flow.

---

## 11. HomeView integration

Add below the Create/Join card, after Plan 01's Game Library if that plan has landed:

```vue
<PublicLobbiesSection @join-room="handlePublicLobbyClick" />
```

Handler in current `HomeView.vue`:

```ts
import { nextTick } from 'vue';

async function handlePublicLobbyClick(payload: { inviteCode: string }) {
  mode.value = 'join';
  inviteCode.value = payload.inviteCode;
  error.value = '';
  await nextTick();
  document.querySelector<HTMLInputElement>(playerName.value.trim() ? '#code' : '#name')?.focus();
}
```

This keeps v1 simple: users still type a name and submit the existing Join form.

---

## 12. PartyView integration

Add a host-only checkbox near the existing host controls when the party is not in-match:

```vue
<label v-if="store.isHost && !gameInProgress" class="party-public-toggle">
  <input
    type="checkbox"
    :checked="!!store.party?.isPublic"
    :disabled="publicTogglePending"
    @change="handlePublicToggle"
  />
  <span>List this room publicly</span>
</label>
```

Handler rules:

- no optimistic local mutation;
- disable while request is pending;
- on success, wait for `partyUpdate` to update `store.party.isPublic`;
- on failure, show existing `error` message.

---

## 13. Verification

### Required commands

Run from workspace root:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e --grep "live rooms|public lobby"
```

### Vitest additions

`apps/platform/__tests__/partyStore.test.ts`

- new party defaults `isPublic=false`, `publicListedAt=null`;
- `setPartyPublic(true)` sets timestamp;
- `setPartyPublic(false)` clears timestamp;
- snapshot excludes private parties;
- snapshot excludes public parties with no connected members;
- snapshot excludes public parties not in `lobby`;
- snapshot includes game metadata when selected;
- deleted parties no longer appear.

`apps/platform/__tests__/partyHandlers.test.ts`

- non-host cannot toggle public listing;
- host toggle broadcasts `partyUpdate` and `joinablePartiesUpdate`;
- subscribe sends an initial snapshot;
- list returns the current snapshot via callback;
- list is rate-limited after repeated calls within 3s;
- join/resume/leave/disconnect/select/launch update the snapshot.

`apps/platform/__tests__/publicLobbiesStore.test.ts` (optional, no DOM needed)

- `applyUpdate()` sorts newest-first and sets state ready;
- `setError()` preserves existing parties.

### Playwright E2E outline

`apps/platform/e2e/live-rooms.spec.ts`

1. Host creates a party.
2. Observer opens `/` and sees empty Live Rooms.
3. Host toggles **List this room publicly**.
4. Observer sees a card with the invite code within 5s.
5. Observer clicks card; Join form opens with code pre-filled.
6. A second player joins.
7. Host launches a game; observer sees the public card disappear.
8. Host returns to lobby; observer sees the card reappear.

Use `data-testid` selectors for lobby cards and empty states.

---

## 14. Risks and mitigations

| Risk                                    | Mitigation                                                                                    |
| --------------------------------------- | --------------------------------------------------------------------------------------------- |
| Public invite-code exposure             | Opt-in only, no member/host identity, clear UI copy that listing makes the code discoverable. |
| Snapshot fan-out cost                   | Full snapshots are acceptable at current scale; batch per tick later if needed.               |
| Stale client after background tab       | Re-subscribe on socket `connect`; manual Refresh remains available.                           |
| Rate-limit false positives on reconnect | Do not rate-limit subscribe; only rate-limit manual list.                                     |
| UI implies password support             | Do not show lock/password UI until password support exists.                                   |

---

## 15. Open questions

1. Should the public toggle copy explicitly warn: **"Anyone on the home page can see and join this code"**?
2. Should public lobbies require a selected game, or is "Game not selected yet" acceptable? Recommendation: allow unselected rooms so hosts can gather players first.
3. Should passwords be added in v1? Recommendation: no; add a separate password-protected lobby plan when the threat model is clearer.
4. Should clicking a public lobby eventually open a name modal and auto-submit? Recommendation: defer; v1 pre-fills the existing Join form.

---

## 16. Estimated effort

| Area                                      | Estimate    |
| ----------------------------------------- | ----------- |
| Server types/store/helpers                | 2–3h        |
| Socket handlers + broadcasts + rate limit | 4–5h        |
| Metrics/docs/logging                      | 1h          |
| Client store/composable/types             | 1.5–2h      |
| Components + HomeView integration         | 2–3h        |
| PartyView toggle                          | 1h          |
| Unit + E2E tests                          | 3–4h        |
| Verification/fixes                        | 1–2h        |
| **Total**                                 | **~15–20h** |

---

## 17. Out of scope

- HTTP polling endpoint (`/api/rooms` or similar).
- Password-protected lobbies.
- Authentication/accounts.
- Matchmaking, filters, pagination, or region/latency selection.
- Cross-process public-lobby federation. Current party store is in-memory process-local.
- Changes to game-level Socket.IO namespaces.
- Auto-join without entering a player name.
