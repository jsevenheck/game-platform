# Plan 3 — Split HomeView into "Host / Browse / Join" Tabbed Experience

> Status: **Planning only — no code changes in this document.**
> Repo: `game-platform` (pnpm workspace, Vue 3 + Pinia + Vue Router + Tailwind v4.3).
> Working branch assumed: `pi/create-scout-game` (working tree clean at time of writing).
> This is **Plan 3 of 3** and assumes **Plan 1** (hero/animations refactor) and **Plan 2** (public-lobbies listing) are already merged on the branch.

---

## 1. Goal

Refactor `apps/platform/src/views/HomeView.vue` — currently a single 400 px card that tab-switches between "Create Party" and "Join Party" — into a 3-tab **Host a Party · Browse Games · Join with Code** experience that preserves every existing behavior (create/join flows, `tryResume` on mount, `partyUpdate` subscription, `Transition name="slide-up"` / `name="fade"`) while exposing the platform's game catalog (5 live games + coming-soon placeholders from Plan 1) and the public-lobbies section (from Plan 2) directly on the landing page.

The deliverable is **one HomeView with three tabs**, backed by a small `useHomeTabs` composable that owns tab persistence (URL `?tab=` ↔ `sessionStorage`) and a per-tab form-state cache. The split is **architecture option C** (Hybrid) — see §3.

---

## 2. Prerequisites

Both prerequisite plans must be merged before this plan is executed.

| Plan | Path | What it delivers that this plan consumes |
| --- | --- | --- |
| **Plan 1 — Hero & Game Grid** | `docs/plan-01-hero-and-game-grid.md` | (a) Refactored `HomeView` hero (gradient title, animated background, "Coming soon" cards with `platformMeta` from `clientGameRegistry`). (b) `<GameGrid>` SFC exporting a 5-card grid + 2-3 coming-soon cards using the existing `ui-game-card` / `ui-game-card-banner` / `ui-game-card-body` classes from `apps/platform/src/styles/main.css`. (c) Visual baseline (card width, accent line, logo block) that Plan 3 keeps. |
| **Plan 2 — Public Lobbies** | `docs/plan-02-public-lobbies.md` | (a) New `usePublicLobbies` composable (Polling/Socket subscribe to a `publicLobbies:update` event or `/api/public-lobbies`). (b) `<PublicLobbiesList>` SFC rendering `[{ inviteCode, hostName, memberCount, maxPlayers, createdAt }]` as compact rows. (c) Server endpoint `GET /api/public-lobbies` emitting refresh on party join/leave. (d) Clear-text policy redaction in logs. |

If Plan 2's composable is named differently or its event names change, **update §6.3 / §8 of this plan** to match before executing.

---

## 3. Architecture decision — A vs B vs C

### A. Keep everything in `HomeView.vue` (expand the existing tab group)

- **Pros:** Smallest diff. No router or nav-guard churn. Reuses existing `mode: 'create' | 'join'` ref, renamed `mode: 'host' | 'browse' | 'join'`.
- **Cons:** `HomeView.vue` balloons past 500 lines. Template becomes hard to scan, conditional blocks overlap (`v-if="activeTab === 'host'"`, `v-if="activeTab === 'browse'"`, `v-if="activeTab === 'join'"`). Hard to reuse a "Browse" panel elsewhere (e.g. a `/browse` route, Admin lobby browser, mobile deep-link share preview).
- **Verdict:** ❌ — single-file ceiling is already close (286 lines today); 3 tabs × (template + script + state) breaks it.

### B. Extract a new `BrowseView.vue` at route `/browse`; HomeView keeps Host+Join

- **Pros:** Cleanest separation. Browse becomes a real destination shareable via URL. Allows `HomeView` to stay a focused "create-or-join" view (great for first-time users).
- **Cons:** **Breaks the requirement that `tryResume` runs regardless of active tab on `/`.** With `BrowseView` at `/browse`, a user refreshing that route would lose the resume flow unless we mount the resume effect in both views. Two routes also means two `<RouterView>` scroll-restore scenarios and double the route to test. Plan 1's hero lives in `HomeView` — duplicating it in `BrowseView` (or hoisting to `App.vue`) adds churn.
- **Verdict:** ❌ — unnecessary fragmentation for a feature that conceptually lives on one page.

### C. Hybrid — HomeView hosts the tabs; each tab panel is its own SFC ✅ **RECOMMENDED**

- **Pros:** `HomeView` becomes a thin shell (~80 lines): hero + `<TabBar :tabs="…" v-model="activeTab" />` + `<component :is="…">` for the active panel, plus the existing resume lifecycle. Each panel (`<HostTabPanel>`, `<BrowseTabPanel>`, `<JoinTabPanel>`) is independently testable, replaceable, and under 200 lines. Reuse of `<BrowseTabPanel>` becomes trivial if a future `/browse` route is added. Pattern matches existing `clientGameRegistry` lazy-loading (Plan 1).
- **Cons:** Three new SFCs to register; one extra shared composable (`useHomeTabs`); slightly higher cognitive load for first-time readers.
- **Verdict:** ✅ — **smallest blast radius** (only `HomeView.vue` is touched in-place, three siblings added under `apps/platform/src/components/home/`), preserves every existing flow, and reuses Plan 1 / Plan 2 deliverables without duplication.

**Recommendation: option C.** It contains the blast radius (one parent file edited, three new siblings, one composable), preserves the `tryResume` invariant at a single mount point, and unlocks future reuse without re-architecting again.

---

## 4. Tab UX design

### 4.1 Tab order — **Browse → Host → Join**

| Position | Tab | Rationale |
| --- | --- | --- |
| 1 (default) | **Browse Games** | First-time users land here — they don't yet have an invite code, so "Join with Code" is useless; "Host a Party" is a deliberate act. Surfacing the catalog first teaches what the platform *is*. Returning users still land on their saved tab (see §4.3). |
| 2 | **Host a Party** | The previous default — preserves existing power-user path. |
| 3 | **Join with Code** | Visually adjacent to **Host** to suggest symmetry. Placed last because typing a 6-char code is the most deliberate action. |

> If Plan 2's public-lobbies panel is empty on first visit, Browse still has value (game catalog + coming-soon). The tab does not become empty.

### 4.2 Default tab on first visit

`useHomeTabs()` resolution order (see §6.1):

1. `route.query.tab` if it validates against the union `'host' | 'browse' | 'join'`.
2. `sessionStorage.getItem('home.activeTab')` if valid.
3. **`'browse'`** — first-visit default.

> Note: this is a **deliberate change** from today's behavior (the form was always visible). See §11 Risk R3 for the new-user conversion concern and the mitigations baked into §5 (Browse tab includes prominent "Host a Party" CTA card above the grid).

### 4.3 Default tab when returning

`sessionStorage['home.activeTab']` (last-clicked tab). Survives refresh and tab-restoration. Does **not** survive new browser profile / incognito (which is desired — first-visit default reappears).

### 4.4 Mobile behavior (< 640 px viewport)

Below 640 px wide (`@media (max-width: 639.98px)`), the `.ui-tab-group` collapses into a **native `<select>`** styled with the same `ui-input` chrome:

- Replaces the pill bar to free vertical space for the panel.
- Selecting an option calls the same `setTab()` handler.
- Above 640 px the pill bar reappears (no JS branching needed — the `<select>` is `hidden` via CSS in a desktop media query, the pill bar is `hidden` on mobile).
- **Recommendation: stacked <select>** over a hamburger because (a) native pickers are accessible by default, (b) three options don't need progressive disclosure, (c) it avoids re-implementing a11y for a custom dropdown.

```css
/* In HomeView.vue scoped <style> */
@media (max-width: 639.98px) {
  .home-tab-bar-pills { display: none; }
  .home-tab-bar-select { display: block; }
}
@media (min-width: 640px) {
  .home-tab-bar-select { display: none; }
  .home-tab-bar-pills { display: flex; }
}
```

### 4.5 Keyboard navigation

| Key | Behavior |
| --- | --- |
| `Tab` (into tab bar) | Focuses the active tab button (roving tabindex pattern). |
| `ArrowLeft` / `ArrowRight` | Move focus across tab buttons. Wraps around. Selecting the next tab **does not** auto-activate it (matches WAI-ARIA tabs pattern with manual activation) — but pressing `Enter` or `Space` on the focused tab activates it. |
| `Enter` / `Space` (on focused tab) | Activates that tab (`setTab(focused)`) and moves DOM focus into the panel's first focusable element (the `#name` input by default). |
| `Home` / `End` | Jump to first / last tab button. |
| `Escape` (inside a panel) | No-op (panels are non-modal; user can still hit `Tab` to leave). |

Implementation: use the native `<button role="tab" aria-selected=…>` pattern with `tabindex="-1"` on non-active tabs and `tabindex="0"` on the active one; a `keydown` handler on each tab button performs arrow-key movement. This is the same pattern `ui-tab-group` was designed for (see `apps/platform/src/styles/main.css:357–392`).

---

## 5. Layout & visual hierarchy

### 5.1 Vertical stack on a single HomeView card

```
┌──────────────────────────── .home-card (max-width: 720px, up from 400px) ────────────────────────────┐
│ ── home-top-line (orange gradient) ──                                                                │
│                                                                                                      │
│   .home-hero                                                                                         │
│     ⚡  Game Platform                                                                                 │
│         Pick a game, host a party, or join a friend's code.                                          │
│                                                                                                      │
│   .home-tab-bar-pills  (>=640px)            .home-tab-bar-select  (<640px)                          │
│   [ Browse Games ] [ Host a Party ] [ Join with Code ]   <select>…</select>                          │
│                                                                                                      │
│   <Transition name="fade" mode="out-in">                                                             │
│     <HostTabPanel v-if="activeTab === 'host'" />                                                    │
│     <BrowseTabPanel v-else-if="activeTab === 'browse'" />                                           │
│     <JoinTabPanel v-else />                                                                          │
│   </Transition>                                                                                      │
│                                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Card width

`max-width: 720px` (up from 400 px). Rationale: the Browse tab's 2- or 3-column game grid (Plan 1) needs horizontal room; 400 px collapses every card to one column and the page feels like a stack of full-width tiles. The Host/Join tabs still center their inner form (`max-width: 360px; margin: 0 auto`) so the visual weight matches today.

### 5.3 Browse tab internal layout

```
┌─ BrowseTabPanel ─────────────────────────────────────────────────────────────────────────────────────┐
│  ┌─ browse-cta ────────────────────────────────────────────────────────────────────────────────┐   │
│  │  "Host a Party"  big button ─→ switches to Host tab.                                        │   │
│  │  (only shown when public-lobbies list is non-empty AND not yet 8+ entries; see §5.4)       │   │
│  └────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                    │
│  <h2 class="ui-section-label">Live Lobbies</h2>                                                     │
│  <PublicLobbiesList />            ← from Plan 2                                                    │
│                                                                                                    │
│  <h2 class="ui-section-label">Pick a Game</h2>                                                     │
│  <GameGrid />                     ← from Plan 1                                                    │
│                                                                                                    │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**On wide screens (≥1024 px)**, the Browse tab is rendered as a 2-column CSS grid:

```
| live-lobbies (sticky, 1fr) | game-grid (1.6fr) |
```

On `<1024 px` (tablet and below) it collapses to a single column with `live-lobbies` first, then `game-grid`. Both columns scroll independently inside the card (the card itself stays `min-height: 100dvh` centered). The grid switch is driven by a `@media` query on `<BrowseTabPanel>` — no JS.

### 5.4 Browse CTA card visibility rules

The orange "Host a Party" CTA inside Browse appears **only when** `publicLobbies.length > 0` AND the user has not yet created a party this session. Once the user clicks "Create Party" (or any Host tab action), set `sessionStorage['home.ctaDismissed'] = '1'` and never show it again in this browser profile. This keeps first-time users aware of the catalog without nagging returning hosts.

---

## 6. State management

### 6.1 `useHomeTabs` composable (new — `apps/platform/src/composables/useHomeTabs.ts`)

```ts
// pseudo-code — final shape to be agreed in execution PR
export type HomeTabId = 'host' | 'browse' | 'join';
const STORAGE_KEY = 'home.activeTab';
const VALID_TABS: ReadonlySet<HomeTabId> = new Set(['host', 'browse', 'join']);

export function useHomeTabs(): {
  activeTab: Ref<HomeTabId>;
  setTab: (next: HomeTabId) => void;
};
```

**Resolution rules (called once on HomeView mount, exposed as `activeTab` ref):**

1. Read `route.query.tab`. If valid → use it, write to `sessionStorage`, return.
2. Else read `sessionStorage[STORAGE_KEY]`. If valid → return.
3. Else default to `'browse'`, write to `sessionStorage` so subsequent refreshes stay on Browse.

**`setTab(next)`:**

1. Validate `next ∈ VALID_TABS`. Bail if not.
2. `activeTab.value = next`.
3. `sessionStorage.setItem(STORAGE_KEY, next)`.
4. **Push to URL** without page reload: `router.replace({ query: { ...route.query, tab: next } })`. Use `replace`, not `push`, so back-button doesn't trap users inside tab switches. Never push from inside the URL → state sync watcher (avoids loops — see §6.2).

### 6.2 URL ↔ sessionStorage sync (watcher in `HomeView.vue`)

A single `watch(() => route.query.tab, …)`:

- If query `tab` is **absent or invalid**: do nothing (don't clobber user's choice; only `setTab` writes URL).
- If query `tab` is **valid and differs from `activeTab.value`**: update `activeTab`, write to `sessionStorage`. This handles deep-link landings (§6.4) and back/forward navigation.

Do **not** `router.push` from inside this watcher — that would loop with `setTab`. Only `setTab` initiates URL writes.

### 6.3 `tryResume` behavior across tabs

**Invariant: `tryResume` runs on HomeView mount exactly as today, regardless of which tab is active.** It is not gated by `activeTab`.

- The resume effect (`onMounted` block of `HomeView.vue`) subscribes to `partyUpdate`, `connect`, and calls `tryResume()` if connected (else triggers `socket.connect()`). This is **unchanged**.
- If `tryResume()` succeeds and redirects to `/party/:code` or `/party/:code/game/:gameId`, the user never sees any tab — the redirect wins.
- If `tryResume()` fails (clears session, no redirect), the user remains on `/` and sees the active tab.

**The three tab panels must not subscribe to `partyUpdate` themselves.** All party state lives in the Pinia store; tabs read from it. This avoids double-subscription and double-`off` bugs during fast tab switches.

### 6.4 Form state per tab

Per-tab form state (name, invite code, error) is hoisted into `useHomeTabs` (or a sibling `useHomeForms`) so that **switching tabs preserves the user's input**:

| State | Lifetime |
| --- | --- |
| `playerName` | Persists across tab switches (single ref, shared). Survives refresh via `sessionStorage['home.playerName']`. |
| `inviteCode` | Persists across tab switches and refreshes (same `sessionStorage` key). |
| `error` | Per-tab — clears when switching away, sets fresh on next submit. |
| Browse tab's selected game (if any, from `<GameGrid>`) | Lives in `<BrowseTabPanel>` local state; lost on tab switch (intentional — catalog is "browse, don't bind"). |

Rationale: a user filling out the Join form who clicks Browse to check the catalog should not lose what they typed. Same for typing a name on Host then peeking at Browse.

### 6.5 Lifecycle invariants

- `onBeforeUnmount` of `HomeView.vue`: `socket.off('partyUpdate', store.applyPartyUpdate)`; `socket.off('connect', tryResume)`; **do not** tear down `usePartySocket` itself (it's a module-level singleton — see `apps/platform/src/composables/usePartySocket.ts:51–60`). This matches today.
- `onBeforeUnmount` of any tab panel: no `socket.off` (see §6.3).
- `useHomeTabs` owns no socket subscriptions; it only manipulates local refs and `sessionStorage`.

---

## 7. Step-by-step plan

Numbered in execution order. Each step lists the file(s) touched and approximate line count delta.

1. **Create `useHomeTabs` composable.**
   - File: `apps/platform/src/composables/useHomeTabs.ts` (~50 lines, new).
   - Exports: `useHomeTabs()`, `type HomeTabId`, `const HOME_TABS: readonly HomeTabId[]`.
   - No socket, no store, no router dependency beyond `useRoute()` / `useRouter()`.

2. **Create `<TabBar>` SFC** (shared between HomeView's pill bar and select).
   - File: `apps/platform/src/components/home/HomeTabBar.vue` (~80 lines, new).
   - Props: `modelValue: HomeTabId`, `tabs: readonly { id: HomeTabId; label: string; icon?: string }[]`.
   - Emits: `update:modelValue`.
   - Renders BOTH a `.ui-tab-group` (pill) and a `<select class="ui-input">`; CSS toggles which is visible (§4.4).
   - Implements roving tabindex + arrow-key handler (§4.5).

3. **Create `<HostTabPanel>` SFC.**
   - File: `apps/platform/src/components/home/HostTabPanel.vue` (~110 lines, new).
   - Lifts `handleCreate()` from current `HomeView.vue` lines 16–36 unchanged.
   - Props: `playerName: string`, `error: string`, `submitting: boolean`.
   - Emits: `submit` (with payload `{ playerName }`), `update:playerName`, `update:error` (or hoist form state into parent — TBD during execution; **lean toward hoisting** so it persists across tab switches per §6.4).
   - Uses `ui-tab-group`/form styling from current file lines 140–179.

4. **Create `<JoinTabPanel>` SFC.**
   - File: `apps/platform/src/components/home/JoinTabPanel.vue` (~140 lines, new).
   - Lifts `handleJoin()` from current lines 38–59 unchanged.
   - On wide viewports (≥1024 px) **also renders `<PublicLobbiesList>`** (Plan 2) below the form as a "quick join" rail. On narrow viewports hides the list (the Browse tab is where users go to discover lobbies). Section label "Quick Join" uses `ui-section-label` (already in `main.css:347`).
   - Same prop/emit contract as `<HostTabPanel>`.

5. **Create `<BrowseTabPanel>` SFC.**
   - File: `apps/platform/src/components/home/BrowseTabPanel.vue` (~120 lines, new).
   - Composes `<PublicLobbiesList>` (Plan 2) + `<GameGrid>` (Plan 1) per §5.3.
   - On `<GameGrid>` card click → emits `select-game` (parent switches to Host tab and pre-selects that game in the Host form via a new `selectedGameId: string | null` ref).
   - On `<PublicLobbiesList>` row click → emits `join-lobby` with `{ inviteCode }` (parent switches to Join tab and pre-fills `inviteCode`).
   - Shows the CTA card per §5.4.

6. **Refactor `HomeView.vue` to the thin shell.**
   - File: `apps/platform/src/views/HomeView.vue` (was 286 lines → target ~140 lines).
   - Imports: `useHomeTabs`, `HomeTabBar`, `HostTabPanel`, `JoinTabPanel`, `BrowseTabPanel`, `clientGameRegistry` (for type only).
   - Keeps `tryResume()` and the `onMounted`/`onBeforeUnmount` block verbatim (§6.3).
   - Keeps the `home-top-line`, `home-hero`, hero text, and all `<style scoped>` blocks. Hero sub-line updates to: **"Pick a game, host a party, or join a friend's code."**
   - Template body becomes:
     ```vue
     <HomeTabBar v-model="activeTab" :tabs="tabs" />
     <Transition name="fade" mode="out-in">
       <HostTabPanel v-if="activeTab === 'host'" ... />
       <BrowseTabPanel v-else-if="activeTab === 'browse'" @select-game="..." @join-lobby="..." />
       <JoinTabPanel v-else ... />
     </Transition>
     ```

7. **Update `apps/platform/e2e/party-resume.spec.ts`.**
   - Existing `joinParty` helper (lines 11–18) does `await page.getByRole('button', { name: 'Join Party' }).click()` — this still works because the Join tab button is labelled "Join with Code" but **the form's submit button keeps the existing label "Join Party"** (form buttons stay unchanged; only the *tab* label changes). Verify and update if Playwright's strict mode rejects — likely it will still match the submit button's accessible name.
   - Add a new `describe('home tabs')` block (see §10.4).

8. **Add `home-tabs.test.ts`** unit test.
   - File: `apps/platform/__tests__/homeTabs.test.ts` (~80 lines, new).
   - Covers: resolution order (URL → storage → default), invalid value fall-through, `setTab` writes both storage and URL, no `router.push` loop, `setTab('garbage')` is a no-op.

9. **Run typecheck + lint + unit + e2e** (§10).

10. **Manual checklist** (§10.5).

---

## 8. Component breakdown (option C — each new component)

### `apps/platform/src/composables/useHomeTabs.ts` (~50 lines)

```ts
export type HomeTabId = 'host' | 'browse' | 'join';
export const HOME_TABS = [
  { id: 'browse', label: 'Browse Games',  icon: '🎮' },
  { id: 'host',   label: 'Host a Party',  icon: '⚡' },
  { id: 'join',   label: 'Join with Code', icon: '🔗' },
] as const;

export function useHomeTabs(): { activeTab: Ref<HomeTabId>; setTab: (next: HomeTabId) => void };
```

No props, no emits, no slots.

### `apps/platform/src/components/home/HomeTabBar.vue` (~80 lines)

| Aspect | Detail |
| --- | --- |
| Props | `modelValue: HomeTabId` (v-model), `tabs: readonly { id: HomeTabId; label: string; icon?: string }[]` (required) |
| Emits | `update:modelValue[HomeTabId]` |
| Slots | none |
| Behavior | Renders pills (`>640px`) and `<select>` (`<640px`), wired to the same `v-model`. Arrow-key handler on pill buttons. `aria-selected`, `role="tab"`, roving `tabindex`. |
| Tests | Unit: arrow-key moves focus; Enter activates; Home/End jumps. E2E: keyboard navigation across tabs. |

### `apps/platform/src/components/home/HostTabPanel.vue` (~110 lines)

| Aspect | Detail |
| --- | --- |
| Props | `playerName: string`, `error: string`, `submitting: boolean` |
| Emits | `update:playerName[string]`, `submit[]` |
| Slots | none |
| Behavior | Form + submit. Calls `socket.emit('createParty', …)` and on success does `store.setSession`/`applyPartyUpdate`/`saveSession`/`router.push` (lifted from `HomeView.vue` lines 16–36). |
| Tests | E2E: Host tab → fill name → submit → land on `/party/:code`. |

### `apps/platform/src/components/home/JoinTabPanel.vue` (~140 lines)

| Aspect | Detail |
| --- | --- |
| Props | `playerName: string`, `inviteCode: string`, `error: string`, `submitting: boolean`, `publicLobbies: PublicLobbyView[]` |
| Emits | `update:playerName[string]`, `update:inviteCode[string]`, `submit[]` |
| Slots | none |
| Behavior | Form + submit. Above 1024 px also renders `<PublicLobbiesList :lobbies="publicLobbies">` (Plan 2) below the form. Clicking a lobby row emits `update:inviteCode` with that code (no auto-submit — user must still type name + press submit to avoid accidental joins). |
| Tests | E2E: Join tab → fill code → submit → land on `/party/:code`. E2E: Public-lobbies row click fills code field. |

### `apps/platform/src/components/home/BrowseTabPanel.vue` (~120 lines)

| Aspect | Detail |
| --- | --- |
| Props | `publicLobbies: PublicLobbyView[]`, `publicLobbiesLoading: boolean`, `ctaDismissed: boolean` |
| Emits | `select-game[string]`, `join-lobby[{ inviteCode: string }]`, `dismiss-cta[]` |
| Slots | `#empty-rooms` (rendered when `publicLobbies.length === 0` and `!publicLobbiesLoading`; defaults to a muted "No public lobbies right now" message — overridable for tests). |
| Behavior | Renders CTA (§5.4), `<PublicLobbiesList>`, `<GameGrid>`. Two-column on `≥1024px`, single-column below. |
| Tests | E2E: Browse tab renders game grid; clicking a game card fires `select-game`; clicking a lobby row fires `join-lobby`. |

---

## 9. Router changes

**None.** This plan deliberately stays on option C, not option B. The `/` route continues to render `HomeView.vue`. No `/browse` route is added; deep-linking happens via `?tab=` query (§6.1 / §6.2).

If a future plan promotes Browse to its own route, the work is purely additive: extract `BrowseTabPanel` into `BrowseView.vue`, add `{ path: '/browse', name: 'browse', component: BrowseView }`, and the `tryResume` effect needs to be duplicated (or hoisted into `App.vue`'s `<RouterView>` wrapper). That's out of scope here (§13).

**Nav-guard considerations:** none. No route is added; no guards needed. `vue-router`'s default scroll behavior is fine (the card re-centers via `min-height: 100dvh; align-items: center` already in `.home-root`).

---

## 10. Verification

### 10.1 Static checks

```bash
pnpm typecheck     # tsc across the workspace via apps/platform
pnpm lint          # eslint across all source
pnpm format:check  # prettier --check
```

All three must pass before any commit lands. Expected: zero new warnings.

### 10.2 Unit tests

```bash
pnpm test
```

Expected additions:

- `apps/platform/__tests__/homeTabs.test.ts` (~80 lines)
  - `useHomeTabs()` returns `'browse'` when storage and query are empty.
  - Returns the value of `route.query.tab` when it's valid.
  - Falls back to storage when `route.query.tab` is invalid (`'garbage'`).
  - `setTab('host')` updates the ref, writes to `sessionStorage`, and calls `router.replace({ query: { tab: 'host' } })`.
  - `setTab('garbage')` is a no-op (no ref change, no storage write, no router call).
  - Repeated `setTab` calls do not push redundant history entries (uses `replace`, not `push`).

Existing `partyStore.test.ts`, `requestLogger.test.ts`, etc. must still pass (no regressions).

### 10.3 Manual smoke checks (developer machine)

```bash
pnpm dev
```

| # | Action | Expected |
| --- | --- | --- |
| 1 | Open `http://localhost:5173/` (fresh storage) | Lands on **Browse Games** tab; `<GameGrid>` renders 5 + 2 cards; no form visible. |
| 2 | Click **Host a Party** | Pill highlights; form fades in; previous empty state cleared. |
| 3 | Type "Alice", switch to **Browse Games**, switch back to **Host a Party** | Input still shows "Alice". |
| 4 | Refresh the page | Tab restored from `sessionStorage`. |
| 5 | Visit `/?tab=join` | URL query overrides default → Join tab active. |
| 6 | Visit `/?tab=garbage` | Falls back to Browse (invalid). |
| 7 | Click browser **Back** after switching tabs | Skips past tab-history entries (because we `replace`, not `push`); lands on previous real page. |
| 8 | Create a party, land on `/party/:code`, click **Leave** | Returns to `/`; Browse tab (or last-active tab) is restored from `sessionStorage`. |
| 9 | Create a party, disconnect network mid-game, refresh `/` | `tryResume` runs regardless of tab, redirects back to game view (existing test). |
| 10 | Resize browser below 640 px | Pill bar hides; `<select>` appears; selecting an option still switches tabs. |
| 11 | Use only the keyboard: Tab into the bar, Arrow keys, Enter | Focus moves; selected tab activates; focus jumps into the panel's first input. |
| 12 | Open two tabs, both Browse; observe a lobby appear in tab 1, switch to Browse in tab 2 | Lobby appears within polling interval (Plan 2's cadence). |
| 13 | DevTools → Application → Session Storage → delete `home.activeTab` | Next reload lands on Browse (default). |

### 10.4 Playwright E2E additions

```bash
pnpm test:e2e
```

Append a `describe('home tabs', …)` block to `apps/platform/e2e/party-resume.spec.ts` (or a new sibling `apps/platform/e2e/home-tabs.spec.ts` — either is fine; prefer a sibling to keep the resume file focused):

```ts
test.describe('home tabs', () => {
  test('default tab is Browse on first visit', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('tab', { name: 'Browse Games' })).toHaveAttribute('aria-selected', 'true');
  });

  test('deep-link ?tab=join activates Join', async ({ page }) => {
    await page.goto('/?tab=join');
    await expect(page.getByRole('tab', { name: 'Join with Code' })).toHaveAttribute('aria-selected', 'true');
  });

  test('deep-link ?tab=garbage falls back to Browse', async ({ page }) => {
    await page.goto('/?tab=garbage');
    await expect(page.getByRole('tab', { name: 'Browse Games' })).toHaveAttribute('aria-selected', 'true');
  });

  test('active tab persists across refresh', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Host a Party' }).click();
    await page.reload();
    await expect(page.getByRole('tab', { name: 'Host a Party' })).toHaveAttribute('aria-selected', 'true');
  });

  test('form input survives tab switch', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Host a Party' }).click();
    await page.fill('#name', 'Alice');
    await page.getByRole('tab', { name: 'Browse Games' }).click();
    await page.getByRole('tab', { name: 'Host a Party' }).click();
    await expect(page.locator('#name')).toHaveValue('Alice');
  });

  test('tryResume runs regardless of active tab', async ({ browser }) => {
    // Create party in ctx1, leave party view, return to /, switch to Browse, refresh, expect redirect into game.
    // Mirrors the existing 'home route resumes an active match' test but adds a tab switch in the middle.
  });

  test('mobile viewport renders <select> instead of pill bar', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.locator('.home-tab-bar-pills')).toBeHidden();
    await expect(page.locator('.home-tab-bar-select')).toBeVisible();
    await page.selectOption('.home-tab-bar-select', 'host');
    await expect(page.getByRole('tab', { name: 'Host a Party' })).toHaveAttribute('aria-selected', 'true');
  });

  test('keyboard: ArrowRight moves focus + Enter activates', async ({ page }) => {
    await page.goto('/');
    await page.locator('.home-tab-bar-pills button[aria-selected="true"]').focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    // Now the next tab (Host) is active.
  });
});
```

The **existing** four tests in `party-resume.spec.ts` must continue to pass unchanged. They use the form submit buttons (labelled "Create Party" / "Join Party"), which are unchanged by this plan — only the *tab labels* change, not the *submit button labels*.

### 10.5 Performance & a11y

- DevTools → Performance: switching tabs should be < 16 ms (no layout thrash; Transition `mode="out-in"`).
- DevTools → Lighthouse a11y score: ≥ 95 (roving tabindex + ARIA roles + native `<select>` fallback).
- axe-core via `@axe-core/playwright` (if already in the project — if not, this is out of scope) would be a nice-to-have for a follow-up.

---

## 11. Risks & open questions

### Top risks

1. **R1 — `tryResume` regression on Browse default.** Today a returning user with a saved session always lands on `/` and gets redirected. With Browse as the new default, the resume happens during the brief render of `<HomeView>` before the redirect — there's a perceptible flash of the Browse tab. **Mitigation:** show a `<div aria-busy="true" class="sr-only">Resuming your party…</div>` placeholder behind the tabs during the resume attempt; the redirect still wins. Estimated extra effort: 15 min, no schema change.
2. **R2 — Tab state drift between URL and storage.** A user bookmarks `/?tab=join`, then changes their default to Browse via the UI. Browser back may land them on `/?tab=join` again, but their storage now says `'browse'`. **Mitigation:** `watch(() => route.query.tab, …)` (see §6.2) re-syncs on every navigation; document the precedence order in a code comment so future readers don't invert it.
3. **R3 — New-user conversion regression.** Today's first-time UX is one form, one button. After this plan, first-time users see a game grid and have to click "Host a Party" to begin. **Mitigation:** (a) Browse tab's CTA card (§5.4) is prominent and orange-accented; (b) Browse tab's `<GameGrid>` cards are clickable and explain each game with one-line descriptions; (c) ship with analytics events (`tab_changed`, `tab_first_paint`, `host_started_from_browse`) so we can measure the funnel and revert to a single-form layout if needed.

### Open questions for the user

1. **Q1 — Browse CTA copy:** Should the in-Browse "Host a Party" CTA read **"Host a Party →"**, **"Create Your Own Party"**, or just **"Host"** (icon-only on mobile)? Default plan: "Host a Party →" on desktop, icon-only on mobile.
2. **Q2 — Coming-soon cards:** Plan 1 places 2–3 coming-soon cards in `<GameGrid>`. Should those cards (a) do nothing on click, (b) show a tooltip "Coming soon", or (c) switch to the Host tab and toast "Coming soon — host a party with another game for now"? Default plan: (b), no tab switch.

### Other risks (not in top 3)

- **R4 — i18n:** None today (all copy is inline English). If i18n is on the roadmap, extract labels (`'Browse Games'`, `'Host a Party'`, `'Join with Code'`, `'Pick a game, host a party, or join a friend's code.'`) into a constants object during this PR rather than retrofitting later. Cost: ~10 min.
- **R5 — Analytics / share-links:** Adding `?tab=` to the URL doesn't affect analytics events (no event currently fires on `/`), but if future plans emit `page_view` events, decide whether `?tab=` should be stripped or reported. Out of scope here.
- **R6 — Public-lobbies endpoint availability:** If Plan 2's `/api/public-lobbies` is not deployed yet, `<PublicLobbiesList>` renders an empty state. `<BrowseTabPanel>` must handle `publicLobbies === undefined` (treat as empty, don't show a spinner forever). Plan 2 should already cover this; verify during execution.

---

## 12. Estimated effort

| Activity | Time |
| --- | --- |
| §7.1 `useHomeTabs` composable + tests | 1.5 h |
| §7.2 `<HomeTabBar>` (pills + select + a11y) + unit tests | 2.5 h |
| §7.3 `<HostTabPanel>` lift + parent wiring | 1 h |
| §7.4 `<JoinTabPanel>` lift + `<PublicLobbiesList>` rail | 1.5 h |
| §7.5 `<BrowseTabPanel>` compose + 2-col layout | 2 h |
| §7.6 `HomeView.vue` shell refactor + style tweaks (max-width 720, hero copy) | 1.5 h |
| §7.7 E2E updates + new test cases | 2 h |
| §7.8 `homeTabs.test.ts` | 1 h |
| §10.3 manual smoke checklist (13 steps) | 1 h |
| Code review cycles (assume 2 rounds) | 2 h |
| **Total** | **~16 h (≈ 2 working days)** |

Breakdown assumes one developer familiar with the codebase. No backend or design changes required.

---

## 13. Out of scope

- **No auth changes.** No login, no signup, no user accounts.
- **No new game types.** Browse lists the existing 5 + coming-soon from Plan 1.
- **No `/browse` route.** That would require re-architecting the resume flow and is intentionally deferred.
- **No Admin view changes.** `AdminView.vue` is unaffected; admins continue to use the existing entry point.
- **No i18n infrastructure setup.** Only label extraction (§11 R4) if trivial.
- **No analytics events** (recommend adding in a follow-up if conversion regression is observed).
- **No deep-linking to specific games** (e.g. `/browse?game=blackout` would be nice but is not required by the task).
- **No design tokens added.** Reuses `ui-tab-group`, `ui-tab`, `ui-tab-active`, `ui-section-label`, `ui-game-card*`, `ui-input`, `ui-btn-primary`, `--color-accent`. **No new `@layer components` classes.**
- **No server-side changes.** No new HTTP routes, no new Socket.IO events beyond what Plan 2 introduces.
- **No persistence of form drafts to `localStorage`.** Only `sessionStorage` (cleared on tab close), per task spec.
- **No changes to `usePartySocket`** (module-level singleton stays exactly as it is in `apps/platform/src/composables/usePartySocket.ts`).

---

## 14. Execution checklist (for the implementing agent)

- [ ] Read `docs/plan-01-hero-and-game-grid.md` and `docs/plan-02-public-lobbies.md`. Confirm Plan 1's `<GameGrid>` and Plan 2's `<PublicLobbiesList>` exist with the names and props assumed in §8. Adjust this plan if names differ.
- [ ] Confirm Plan 1's `clientGameRegistry` exposes `platformMeta` for all 5 games (currently true per `CLAUDE.md:158–174`).
- [ ] Implement steps 1–6 in §7 in order.
- [ ] Run §10.1 / §10.2 / §10.4 — all green.
- [ ] Walk §10.3 manually.
- [ ] Bump `HomeView.vue` line count target in the commit message (286 → ~140).
- [ ] PR description links Plans 1, 2, and 3; mentions §11 R1 mitigation (resume placeholder) is in place.
- [ ] After merge: monitor new-user conversion (R3) for one release cycle.