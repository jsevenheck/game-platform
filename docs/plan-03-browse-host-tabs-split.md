# Plan 03 — Split HomeView into Browse / Host / Join Tabs

**Status:** revised planning document (critical review applied)  
**Baseline:** should be implemented after Plan 01 and Plan 02.  
**Scope:** frontend refactor of `HomeView.vue` and home-page components. No new route and no new backend events beyond Plan 02.

---

## 1. Critical assessment / verdict

**Verdict: worthwhile refactor, but only after Plan 01 and Plan 02 have landed with reusable components.**

Issues found in the previous draft and fixed here:

1. **Wrong prerequisite references:** it pointed to non-existing files and mismatched Plan 02 APIs. This plan now references the actual docs and revised deliverables.
2. **Card width was too small:** a 720px card cannot comfortably host live lobbies and a game grid in a two-column Browse layout. This plan uses compact vs. wide card modes.
3. **Existing E2E helpers would break:** after defaulting to Browse, helpers that fill `#name` immediately must first switch to Host or Join. This is now explicit.
4. **Unclear game preselect behavior:** Browse card clicks can preselect a game using existing `selectGame` after `createParty`; this plan documents the sequence and failure behavior.
5. **Component unit tests were unrealistic:** the current Vitest platform project runs in Node and does not include Vue Test Utils/jsdom. Component behavior is covered with Playwright; only pure tab helpers get unit tests.
6. **Plan 02 polling language:** replaced with Socket.IO public-lobby feed terminology.

---

## 2. Prerequisites

| Plan    | File                                    | Required deliverables                                                                                                            |
| ------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Plan 01 | `docs/plan-01-game-grid-on-homeview.md` | `GameLibraryGrid.vue`, `PlatformGameMeta.category`, home catalog styles.                                                         |
| Plan 02 | `docs/plan-02-live-rooms-section.md`    | public lobby socket events, `usePublicLobbies`, `PublicLobbiesList.vue` / `PublicLobbiesSection.vue`, `PartyView` public toggle. |

Do not implement this plan against the old assumptions (`/api/public-lobbies`, polling, `PublicLobbiesList` with host names, or coming-soon cards). If Plan 01/02 names differ after implementation, update this document before coding.

---

## 3. Goal

Refactor `/` into a three-tab landing experience:

1. **Browse Games** — default first-visit tab; shows Live Rooms and Game Library.
2. **Host a Party** — existing create flow, optionally with a game preselected from Browse.
3. **Join with Code** — existing join flow, with invite code pre-fill from Live Rooms.

Must preserve:

- `tryResume()` on HomeView mount regardless of active tab;
- existing create/join socket flows;
- local session persistence (`usePartyStore.saveSession()`);
- `partyUpdate` subscription behavior;
- `/party/:code` and `/party/:code/game/:gameId` redirects;
- no new router path.

---

## 4. Architecture decision

Use the hybrid approach:

- `HomeView.vue` remains the route-level shell and resume owner;
- tabs and panels are split into focused components under `apps/platform/src/components/home/`;
- tab state lives in `useHomeTabs()`;
- create/join/preselect behavior lives in a small home actions composable or in the parent shell (implementation choice below).

Recommended files:

| File                                                   | Responsibility                                                          |
| ------------------------------------------------------ | ----------------------------------------------------------------------- |
| `apps/platform/src/composables/useHomeTabs.ts`         | Active tab, URL query sync, sessionStorage persistence.                 |
| `apps/platform/src/composables/useHomePartyActions.ts` | Existing create/join/resume actions, form refs, optional selected game. |
| `apps/platform/src/components/home/HomeTabBar.vue`     | Accessible tab pills + mobile select.                                   |
| `apps/platform/src/components/home/HostTabPanel.vue`   | Presentational create form.                                             |
| `apps/platform/src/components/home/JoinTabPanel.vue`   | Presentational join form.                                               |
| `apps/platform/src/components/home/BrowseTabPanel.vue` | Composes public lobbies + game library + Host CTA.                      |
| `apps/platform/src/views/HomeView.vue`                 | Thin composition shell; owns mount/unmount subscriptions.               |

This follows Vue Composition API best practice: the route view composes features, while substantial UI and side effects are factored out.

---

## 5. Tab behavior

### 5.1 Tab order and default

Order: **Browse Games → Host a Party → Join with Code**.

First-visit default: `browse`.

Resolution order:

1. valid `route.query.tab` (`browse`, `host`, `join`);
2. valid `sessionStorage['home.activeTab']`;
3. fallback `browse`.

Use `router.replace`, not `router.push`, when tab changes so the browser Back button does not step through tab switches.

### 5.2 URL sync

`useHomeTabs()` should expose:

```ts
export type HomeTabId = 'browse' | 'host' | 'join';

export const HOME_TABS = [
  { id: 'browse', label: 'Browse Games', icon: '🎮' },
  { id: 'host', label: 'Host a Party', icon: '⚡' },
  { id: 'join', label: 'Join with Code', icon: '🔗' },
] as const;

export function useHomeTabs(): {
  activeTab: Ref<HomeTabId>;
  setTab: (next: HomeTabId) => void;
};
```

Also export pure helpers for Node unit tests:

```ts
export function normalizeHomeTab(value: unknown): HomeTabId | null;
export function resolveInitialHomeTab(queryValue: unknown, storedValue: unknown): HomeTabId;
```

A watcher handles browser navigation:

- if query tab becomes valid and differs from `activeTab`, update state and storage;
- if query tab is absent/invalid, do not clobber the current tab;
- never write to the router from inside that watcher.

### 5.3 Mobile behavior

Below `640px`, `HomeTabBar.vue` shows a native `<select class="ui-input">` and hides tab pills. Above `640px`, pills are shown and the select is hidden.

The select is the accessible mobile control; do not test hidden tab buttons on mobile.

### 5.4 Keyboard behavior for desktop pills

Use WAI-ARIA tabs with manual activation:

| Key                        | Behavior                                                                   |
| -------------------------- | -------------------------------------------------------------------------- |
| `Tab`                      | Focuses active tab.                                                        |
| `ArrowLeft` / `ArrowRight` | Moves focus among tab buttons, wrapping. Does not activate.                |
| `Home` / `End`             | Moves focus to first/last tab.                                             |
| `Enter` / `Space`          | Activates focused tab and moves focus to the panel's first useful control. |

Use `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`, and `tabindex`.

---

## 6. Layout

The current centered 400px card is too narrow for Browse. Use width modes:

```vue
<div class="home-card" :class="activeTab === 'browse' ? 'home-card-wide' : 'home-card-compact'">
  …
</div>
```

```css
.home-root {
  min-height: 100dvh;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: clamp(1.25rem, 4vw, 3rem);
}

.home-card {
  width: min(100%, 1040px);
}

.home-card-compact {
  max-width: 440px;
}

.home-card-wide {
  max-width: 1040px;
}
```

Host and Join panels center their forms internally:

```css
.home-form-panel {
  max-width: 400px;
  margin: 0 auto;
}
```

Browse layout:

- single column below `1024px`;
- two columns at `1024px+`: Live Rooms column (`minmax(280px, 0.9fr)`) + Game Library column (`1.4fr`);
- use normal page scroll, not independently scrolling panels.

---

## 7. State management

### 7.1 Persistent form refs

Persist in `sessionStorage`, not `localStorage`:

| Key                 | Value                                            |
| ------------------- | ------------------------------------------------ |
| `home.activeTab`    | last active tab                                  |
| `home.playerName`   | draft name                                       |
| `home.inviteCode`   | draft invite code                                |
| `home.ctaDismissed` | Browse CTA dismissed in this browser tab session |

`selectedGameId` from Browse may stay in memory only. Persisting it is optional but not required.

### 7.2 `useHomePartyActions`

Recommended composable API:

```ts
export function useHomePartyActions(): {
  playerName: Ref<string>;
  inviteCode: Ref<string>;
  selectedGameId: Ref<string | null>;
  error: Ref<string>;
  submitting: Ref<boolean>;
  isResuming: Ref<boolean>;
  handleCreate: () => void;
  handleJoin: () => void;
  tryResume: () => void;
  clearError: () => void;
};
```

It may use `useRouter()`, `usePartyStore()`, and `usePartySocket()` internally. It must not disconnect the shared socket.

### 7.3 Create with selected game

When a user clicks a game in Browse:

1. `BrowseTabPanel` emits `select-game(gameId)`;
2. `HomeView` sets `selectedGameId.value = gameId`;
3. `HomeView` switches to `host` tab;
4. Host panel shows a small selected-game hint;
5. on `handleCreate()`, after `createParty` succeeds and session is saved, emit existing `selectGame` with returned `playerId` and selected `gameId`;
6. then route to `/party/:code`.

If `selectGame` fails, do not discard the newly created party. Navigate to the party and show/keep an error message where practical; the host can still select a game manually in `PartyView`.

This uses existing backend events. No server change is required.

### 7.4 Public lobby click

When a user clicks a public lobby:

1. `PublicLobbiesList` / `PublicLobbiesSection` emits `join-room({ inviteCode })`;
2. `BrowseTabPanel` re-emits it;
3. `HomeView` sets `inviteCode.value`;
4. `HomeView` switches to `join` tab;
5. focus goes to `#name` if empty, otherwise `#code`.

No silent join in Plan 03.

---

## 8. Component contracts

### `HomeTabBar.vue`

Props:

```ts
{
  modelValue: HomeTabId;
  tabs: readonly { id: HomeTabId; label: string; icon?: string }[];
}
```

Emits:

```ts
{ 'update:modelValue': [HomeTabId] }
```

### `HostTabPanel.vue`

Props:

```ts
{
  playerName: string;
  error: string;
  submitting: boolean;
  selectedGameName?: string | null;
}
```

Emits:

```ts
{
  'update:playerName': [string];
  submit: [];
  clearSelectedGame: [];
}
```

### `JoinTabPanel.vue`

Props:

```ts
{
  playerName: string;
  inviteCode: string;
  error: string;
  submitting: boolean;
}
```

Emits:

```ts
{
  'update:playerName': [string];
  'update:inviteCode': [string];
  submit: [];
}
```

### `BrowseTabPanel.vue`

Props:

```ts
{
  ctaDismissed: boolean;
}
```

Emits:

```ts
{
  selectGame: [gameId: string];
  joinRoom: [{ inviteCode: string }];
  hostRequested: [];
  dismissCta: [];
}
```

Internally composes:

- `PublicLobbiesSection.vue` from Plan 02;
- `GameLibraryGrid.vue` from Plan 01 with `interactive` enabled.

CTA rule: show a prominent **Host a Party →** CTA on Browse until `home.ctaDismissed === '1'`. Do not hide it just because there are no public lobbies; an empty Live Rooms section is exactly when hosting is useful.

---

## 9. HomeView shell outline

```vue
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, watch } from 'vue';
import { useHomeTabs } from '../composables/useHomeTabs';
import { useHomePartyActions } from '../composables/useHomePartyActions';
import { usePartySocket } from '../composables/usePartySocket';
import { usePartyStore } from '../stores/party';
import { getClientGame } from '../games';

const socket = usePartySocket();
const store = usePartyStore();
const { activeTab, setTab } = useHomeTabs();
const actions = useHomePartyActions();

const selectedGameName = computed(() =>
  actions.selectedGameId.value
    ? (getClientGame(actions.selectedGameId.value)?.definition.name ?? null)
    : null
);

function handleSelectGame(gameId: string) {
  actions.selectedGameId.value = gameId;
  setTab('host');
}

async function handleJoinRoom(payload: { inviteCode: string }) {
  actions.inviteCode.value = payload.inviteCode;
  actions.clearError();
  setTab('join');
  await nextTick();
  document
    .querySelector<HTMLInputElement>(actions.playerName.value.trim() ? '#code' : '#name')
    ?.focus();
}

onMounted(() => {
  socket.on('partyUpdate', store.applyPartyUpdate);
  socket.on('connect', actions.tryResume);
  if (socket.connected) actions.tryResume();
  else socket.connect();
});

onBeforeUnmount(() => {
  socket.off('partyUpdate', store.applyPartyUpdate);
  socket.off('connect', actions.tryResume);
});
</script>
```

`tryResume()` remains active regardless of tab.

---

## 10. Implementation steps

1. **Confirm prerequisites**
   - Plan 01 component exists and exports/accepts the expected props.
   - Plan 02 public lobby components and socket events exist.

2. **Create `useHomeTabs.ts`**
   - Include pure helper exports for tests.
   - Add URL/sessionStorage sync.

3. **Create `useHomePartyActions.ts`**
   - Move existing `handleCreate`, `handleJoin`, `tryResume` logic out of `HomeView.vue`.
   - Add `selectedGameId` support.
   - Persist `playerName` and `inviteCode` to sessionStorage.

4. **Create `HomeTabBar.vue`**
   - Desktop ARIA tabs + mobile select.
   - No dependency on party state.

5. **Create presentational panels**
   - `HostTabPanel.vue`.
   - `JoinTabPanel.vue`.
   - `BrowseTabPanel.vue`.

6. **Refactor `HomeView.vue`**
   - Keep hero/top accent.
   - Replace old two-button mode switch with `HomeTabBar`.
   - Render active panel in `<Transition name="fade" mode="out-in">`.
   - Keep socket mount/unmount subscription in the view shell.

7. **Update E2E helpers**
   - Any helper that creates a party must click **Host a Party** first.
   - Any helper that joins by code must click **Join with Code** first.
   - Search `apps/platform/e2e` and `games/*/e2e` for `#name`, `#code`, and `Join Party` assumptions.

8. **Add tests and run verification**

---

## 11. Testing plan

### Unit tests (Node-safe only)

`apps/platform/__tests__/homeTabs.test.ts`

Test pure helpers and router/storage behavior via mocks:

- default is `browse` when query/storage are empty;
- valid query wins over storage;
- invalid query falls back to valid storage;
- invalid everything returns `browse`;
- `setTab('host')` writes sessionStorage and calls `router.replace`;
- invalid tab input is ignored.

Do not add Vue component unit tests unless the project also adds Vue Test Utils and a DOM test environment. Current platform Vitest config is Node-only.

### Playwright E2E

New file: `apps/platform/e2e/home-tabs.spec.ts`.

Required tests:

1. first visit defaults to Browse;
2. `/?tab=join` opens Join;
3. invalid `?tab=garbage` falls back to Browse;
4. active tab persists across refresh;
5. Host form name survives switching away and back;
6. Join form invite code survives switching away and back;
7. Host tab can create a party;
8. Join tab can join an existing party;
9. clicking a public lobby pre-fills Join tab (requires Plan 02 setup);
10. clicking a game in Browse switches to Host and shows selected-game hint;
11. mobile viewport uses select and changes panels;
12. keyboard Arrow/Enter behavior activates tabs;
13. `tryResume` redirects from `/` even when stored tab is Browse.

Update existing `apps/platform/e2e/party-resume.spec.ts` helpers:

```ts
async function createParty(page: Page, name: string): Promise<string> {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Host a Party' }).click();
  await page.fill('#name', name);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/party\/[A-Z0-9]+/);
  return page.url().split('/party/')[1]?.split('/')[0] ?? '';
}

async function joinParty(page: Page, name: string, inviteCode: string): Promise<void> {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Join with Code' }).click();
  await page.fill('#name', name);
  await page.fill('#code', inviteCode);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/party\/[A-Z0-9]+/);
}
```

On mobile, assert select value/panel visibility instead of hidden tab button attributes.

### Command gates

Run from workspace root:

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm test:e2e
```

---

## 12. Manual smoke checklist

1. Fresh `/` load shows Browse.
2. Host tab shows the old create form behavior.
3. Join tab shows the old invite-code behavior.
4. Name and code drafts survive tab switches.
5. Refresh restores the active tab from sessionStorage.
6. `/?tab=host` and `/?tab=join` deep-link correctly.
7. Browser Back does not step through every tab click.
8. Public lobby click switches to Join and pre-fills code.
9. Game click switches to Host and shows selected-game hint.
10. Creating from that selected-game state lands in PartyView with the game selected when `selectGame` succeeds.
11. Returning user with active match goes to `/party/:code/game/:gameId` regardless of stored tab.
12. 390px viewport shows mobile select, not pill tabs.
13. Keyboard-only user can switch tabs and submit forms.

---

## 13. Risks and mitigations

| Risk                                     | Mitigation                                                                                                                   |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Browse default reduces create conversion | Prominent Host CTA in Browse; session remembers last tab for returning users.                                                |
| Resume flash before redirect             | `useHomePartyActions.isResuming` can show a small `aria-busy` status or hide panels while a stored session is being checked. |
| URL/storage drift                        | Single precedence rule and one watcher that never writes router state.                                                       |
| Selected-game preselect race             | Create party first, then best-effort `selectGame`, then navigate. Party remains usable if preselect fails.                   |
| E2E flakiness from changed default tab   | Update all helpers and prefer role labels over CSS selectors.                                                                |
| Mobile hidden tabs confuse tests/a11y    | Native select is the mobile tab control; hidden pills are not tested or announced.                                           |

---

## 14. Open questions

1. CTA copy: **Host a Party →** or **Create Your Own Party**?
2. Should game preselection after create be blocking? Recommendation: best-effort and non-blocking.
3. Should selected game persist across refresh? Recommendation: no for v1.
4. Should Browse remain default if analytics later show lower create conversion? Recommendation: revisit after one release; no analytics added in this plan.

---

## 15. Estimated effort

| Area                           | Estimate    |
| ------------------------------ | ----------- |
| `useHomeTabs` + tests          | 1.5–2h      |
| `useHomePartyActions`          | 2–3h        |
| `HomeTabBar.vue`               | 2h          |
| Host/Join/Browse panels        | 3–4h        |
| HomeView refactor/layout       | 1.5–2h      |
| E2E helper updates + new specs | 3–4h        |
| Verification/fixes             | 1–2h        |
| **Total**                      | **~14–19h** |

---

## 16. Out of scope

- New `/browse` route.
- Authentication/accounts.
- Analytics implementation.
- Password-protected public lobbies.
- New server events beyond Plan 02.
- New games or coming-soon placeholders.
- Vue component unit-test infrastructure.
- i18n infrastructure.
