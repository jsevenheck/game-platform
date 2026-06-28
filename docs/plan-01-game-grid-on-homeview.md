# Plan 01 — Game Grid on HomeView (with fade-up animations)

**Branch:** `pi/create-scout-game` (working tree clean at planning time)
**Scope:** Additive UI only. The existing Create/Join form, party flow, game launcher, and `apps/platform/src/games/index.ts` registry contract stay intact. Only `platformMeta` is extended with new optional fields and `HomeView.vue` is augmented.

---

## 1. Goal

Give the unauthenticated landing page (`/`) the polish of a static game hub: below the current Create/Join card, render a responsive grid that surfaces every game registered in `clientGameRegistry`, with a per-card fade-up entrance animation that staggers across the cards. The grid is **display-only** — it is not a clickable game-launcher; players still go through Create → Party → Host selects → Launch, exactly as today. The intent is purely to communicate at first glance *which games exist, how many players they need, and what category they are*, matching the competitor reference (games.frostify.fr) without copying its code.

---

## 2. Reference competitor structure (games.frostify.fr)

The competitor's `/` page is a static HTML hub with **6 game cards** laid out in a responsive grid (≈ 3 cols desktop / 2 cols tablet / 1 col mobile). Each card has:

1. A **banner gradient strip** at the top (≈ 80–96 px tall) with the emoji icon centered over the gradient. A subtle bottom-to-top darkening overlay sits over the gradient so the icon reads on bright backgrounds.
2. A **body block** (white-on-dark) with three vertical text rows:
   - **Title** — game name in semibold (≈ 1rem).
   - **Tag row** — two small inline chips: `👥 2–20 Spieler` (player count) and `🎉 Partyspiel` (category).
   - **Description** — 1–2 line muted summary.
3. A **hover state** — card lifts (`translateY(-4px)` + shadow) and a "Spielen →" CTA slides in from the right of the body block.
4. **Entrance animation** — `opacity: 0 → 1` + `translateY(24px) → 0`, 600 ms `cubic-bezier(0.22, 1, 0.36, 1)`, with a per-card delay of `index × 80 ms` (so card #5 starts 400 ms after card #0).

The competitor's German copy ("Spieler", "Partyspiel") will be **translated to English** to match this project's existing English copy in `HomeView.vue`, `PartyView.vue`, and the registry. We will note this in §10 (out-of-scope questions) so the user can flip it back if they want German.

---

## 3. Touch points

| # | File | Why it changes | Approx size |
|---|------|----------------|-------------|
| 1 | `apps/platform/src/games/index.ts` | Extend `PlatformGameMeta` interface + add 4 new optional fields to each of the 5 entries. | ~30 lines added |
| 2 | `apps/platform/src/views/HomeView.vue` | Import `clientGameRegistry` + a new section block under the form; new scoped style block for grid + fade-up keyframe. | ~70 lines added |
| 3 | `apps/platform/src/styles/main.css` | *(optional)* add a `@keyframes fade-up` and `.fade-up` helper inside `@layer base` if we want to share the keyframe with future surfaces. Otherwise keep it scoped inside `HomeView.vue`. **Default decision: keep scoped to HomeView** to avoid touching the design-system entry point for a single feature. | 0–15 lines |
| 4 | `apps/platform/e2e/party-resume.spec.ts` | Add one new test that asserts the grid renders 5 cards on `/`. | ~25 lines added |

**NOT touched** (explicit non-goals):
- `apps/platform/src/views/PartyView.vue` — its existing `ui-game-card` block continues to use the registry for host game-selection. The new optional fields are read by both views; old fields stay backwards-compatible.
- `apps/platform/server/**` — no backend changes.
- `games/*/core/src/**`, `games/*/ui-vue/src/**` — no per-game changes.
- `apps/platform/src/router/**`, `apps/platform/src/stores/**` — no navigation/state changes.

---

## 4. Type changes — extended `PlatformGameMeta`

### Current shape (`apps/platform/src/games/index.ts` lines 3–8)

```ts
export interface PlatformGameMeta {
  icon: string;
  gradFrom: string;
  gradTo: string;
  description: string;
}
```

### Proposed shape

```ts
export interface PlatformGameMeta {
  icon: string;
  gradFrom: string;
  gradTo: string;
  description: string;

  // ── New optional fields for the HomeView library grid ──
  /** Short player-range chip text, e.g. "2–5 players". Defaults to "{min}–{max} players". */
  playerTag?: string;
  /** Category chip text, e.g. "Strategy" or "Partyspiel". */
  typeTag?: string;
  /** Emoji-only icon override for the library grid (defaults to `icon`). */
  emoji?: string;
  /** When true, card renders with disabled state and a "Coming soon" badge. */
  comingSoon?: boolean;
}
```

### Justification per field

| Field | Why optional | Why needed |
|-------|--------------|------------|
| `playerTag?` | `definition.minPlayers` / `maxPlayers` already exist on `PlatformGameModule` — we *could* derive it, but the registry is the right place to localize or round numbers (e.g. "2–5 Spieler" vs "2–5 players") without the view layer doing string formatting. Optional so existing call sites in `PartyView.vue` (lines 246–248) stay unchanged. | Drives the "👥 X–Y players" chip on the home card. |
| `typeTag?` | Pure metadata; no equivalent in `definition`. Optional so we can ship the grid with a minimal first pass (chip hidden until populated) and add categories later without a type change. | Drives the "🎉 Category" chip. |
| `emoji?` | We already have `icon`. This is intentional redundancy so the registry can later switch to a real Lucide icon (`icon: 'lucide:moon'`) while keeping the emoji for display-only surfaces. | Forward-compat — the home grid prefers emoji, the lobby card keeps whatever `icon` is. |
| `comingSoon?` | Most games today are playable; the field exists for the *next* game that ships display-only. Without it we'd need a sentinel value (null `description`, `gradFrom === gradTo`, etc.) — explicit is better. | Renders disabled card + "Coming soon" badge. |

### Backwards compatibility

All four new fields are `?`. The two existing consumers of `PlatformGameMeta` keep working unchanged:

- `PartyView.vue` line 32–34 (`getGameConfig`) — only reads `gradFrom`, `gradTo`, `icon`, `description`. New fields are ignored.
- `defaultGameConfig` in `PartyView.vue` lines 25–30 — already missing several keys; TypeScript widening on optional fields stays legal.

`pnpm typecheck` (run via `pnpm -C apps/platform typecheck`) will catch any downstream regressions because the interface is re-exported through the same `apps/platform/src/games/index.ts` module.

---

## 5. Step-by-step implementation plan

Numbered for an executing agent. Each step ends with a *Verification* note.

### Step 1 — Extend `PlatformGameMeta` and populate per-game entries

1. Edit `apps/platform/src/games/index.ts`:
   - Add the four optional fields from §4.
   - For each of the 5 entries (`blackout`, `imposter`, `secret-signals`, `flip7`, `scout`) add `playerTag` and `typeTag`. Keep `emoji` and `comingSoon` unset for now.
2. Proposed per-game values (English copy, matching existing UI strings):

   | id | name | playerTag | typeTag |
   |----|------|-----------|---------|
   | `blackout` | Blackout | `3–20 players` | `Word · Deception` |
   | `imposter` | Imposter | `3–16 players` | `Social deduction` |
   | `secret-signals` | Secret Signals | `4–24 players` | `Team · Strategy` |
   | `flip7` | Flip 7 | `3–18 players` | `Push-your-luck` |
   | `scout` | Scout | `2–5 players` | `Card trick` |

3. **Verification:** `pnpm -C apps/platform typecheck` — must remain green.

### Step 2 — Add the grid section + fade-up animation to `HomeView.vue`

1. Edit `apps/platform/src/views/HomeView.vue`:
   - In `<script setup>`, import `clientGameRegistry` from `../games/index` (no `PlatformGameMeta` import needed unless we add a helper).
   - Below the existing `</div>` that closes `.home-card` (line 180) and still inside `.home-root`, add a new `<section class="home-library">` with:
     - `<h2 class="ui-section-label">Game Library</h2>`
     - A `<ul class="home-grid">` of `<li>` items, each rendering one card.
   - Each `<li>` uses the existing `ui-game-card` shared class plus an inline `:style` for the banner gradient — identical pattern to `PartyView.vue` lines 227–253 (we re-use that proven markup; we just wrap it in a list item for the animation).
   - Bind a per-index `:style="{ '--fade-up-delay': '${i * 80}ms' }"` and add `class="home-grid-item"` so the scoped style can use the CSS variable for stagger.
2. Inside the existing `<style scoped>` block at the bottom of `HomeView.vue`, append:
   - `.home-library`, `.home-grid`, `.home-grid-item` selectors
   - `.home-grid-item` base state: `opacity: 0; transform: translateY(24px); animation: fade-up 600ms cubic-bezier(0.22, 1, 0.36, 1) forwards; animation-delay: var(--fade-up-delay, 0ms);`
   - `@keyframes fade-up { to { opacity: 1; transform: translateY(0); } }`
   - A `@media (prefers-reduced-motion: reduce)` block that sets `animation: none; opacity: 1; transform: none;` (the codebase currently has zero reduced-motion handling — this is a small but valuable addition).
3. **Verification:** `pnpm -C apps/platform typecheck`, then start `pnpm dev` and open `http://localhost:5173/` — confirm 5 cards appear and animate in with a stagger.

### Step 3 — Empty / coming-soon states (defensive)

1. In the template, wrap the `<ul>` in `<template v-if="clientGameRegistry.length > 0">` and render a `.home-grid-empty` paragraph ("No games available yet.") below when the registry is empty. Important because the platform's design allows zero-game deploys.
2. Inside each `<li>`, if `platformMeta?.comingSoon` is true, render `ui-badge` "Coming soon" and disable the card (`:disabled`, `aria-disabled="true"`). For now no game sets this, but the markup is ready.
3. **Verification:** temporarily comment out `clientGameRegistry` in `apps/platform/src/games/index.ts` locally, reload, confirm the empty-state copy renders. Revert before commit.

### Step 4 — Visual polish pass

1. Responsive grid breakpoints via scoped style:
   - `<700px`: `grid-template-columns: 1fr`
   - `≥700px`: `repeat(2, minmax(0, 1fr))`
   - `≥1024px`: `repeat(3, minmax(0, 1fr))`
   - Gap: `1rem` (matches the host grid in `PartyView.vue` line 226).
2. Card hover: the existing `ui-game-card:hover` rule in `main.css` (lines 406–410) already lifts the card and adds a shadow. We do **not** add a slide-in CTA arrow (out of scope per §10); the click target on the home card will be inert for this plan (`type="button"` disabled, `cursor: default`).
3. **Verification:** visually resize from 360 → 1440 px and confirm the grid reflows correctly. Inspect that the card body uses the existing `game-card-name`, `game-card-meta`, `game-card-desc` styles already defined in `PartyView.vue` lines 403–422 — we will **copy** those three selectors into `HomeView.vue`'s scoped block (they are scoped, so they don't leak).

### Step 5 — E2E coverage

1. Add a new test file `apps/platform/e2e/home-library.spec.ts` (separate from `party-resume.spec.ts` to keep concerns clean) with a single test:
   - Navigate to `/`.
   - Assert `expect(page.locator('.home-grid-item')).toHaveCount(5);`
   - Assert each card has a visible `game-card-name` text matching one of the registry names.
   - Wait for the fade-up animation to settle (use `await page.waitForFunction(() => document.querySelectorAll('.home-grid-item').length === 5 && Array.from(document.querySelectorAll('.home-grid-item')).every(el => parseFloat(getComputedStyle(el).opacity) >= 0.99))` with a 2-second timeout).
   - Take a screenshot under `test-results/` for visual regression in the HTML report.
2. **Verification:** `pnpm test:e2e -- home-library` (Playwright's `--grep`-equivalent).

### Step 6 — Lint, format, full verification

1. `pnpm format` to run Prettier across new files.
2. `pnpm lint` — must report `--max-warnings 0`.
3. `pnpm typecheck` — must pass.
4. `pnpm test` — Vitest unit tests across all 5 games. The new fields are additive; no unit test should break, but verify nothing references the old 4-field shape destructuring-wise that would now be `undefined`.
5. `pnpm test:e2e` — full Playwright suite, ensure `party-resume.spec.ts` still passes (the home page now shows a grid *above* the form area; `createParty()` navigates to `/` first and the grid must not block the `#name` input).

---

## 6. Code sketch

### 6.1 `apps/platform/src/games/index.ts` — extended interface + entries

```ts
import type { Component } from 'vue';

export interface PlatformGameMeta {
  icon: string;
  gradFrom: string;
  gradTo: string;
  description: string;

  // NEW — HomeView library grid (all optional, backwards compatible)
  /** Short player-range chip text, e.g. "2–5 players". */
  playerTag?: string;
  /** Category chip text, e.g. "Strategy". */
  typeTag?: string;
  /** Emoji-only icon override for the library grid (defaults to `icon`). */
  emoji?: string;
  /** When true, renders disabled with a "Coming soon" badge. */
  comingSoon?: boolean;
}

export interface PlatformGameModule {
  definition: { id: string; name: string; minPlayers: number; maxPlayers: number };
  platformMeta?: PlatformGameMeta;
  loadClient: () => Promise<{ default: Component }>;
}

// ...one entry per game, each gaining `playerTag` + `typeTag`.
// Example for blackout:
{
  definition: { id: 'blackout', name: 'Blackout', minPlayers: 3, maxPlayers: 20 },
  platformMeta: {
    icon: '🌑',
    gradFrom: '#2d1b69',
    gradTo: '#120b2e',
    description: 'A word game of deception and darkness',
    playerTag: '3–20 players',
    typeTag: 'Word · Deception',
  },
  loadClient: () => import('@blackout-ui/PlatformAdapter.vue'),
},
```

(Real values for all five games are in §5 Step 1.)

### 6.2 `apps/platform/src/views/HomeView.vue` — new section (additions only)

Insert at the top of `<script setup>`:

```ts
import { clientGameRegistry } from '../games/index';
```

Insert immediately before `</div>` that closes `.home-root` (after line 180):

```vue
<section class="home-library" aria-labelledby="home-library-heading">
  <h2 id="home-library-heading" class="ui-section-label">Game Library</h2>
  <ul v-if="clientGameRegistry.length > 0" class="home-grid">
    <li
      v-for="(game, i) in clientGameRegistry"
      :key="game.definition.id"
      class="home-grid-item ui-game-card"
      :style="{
        '--fade-up-delay': `${i * 80}ms`,
        animationDelay: 'var(--fade-up-delay)',
      }"
    >
      <div
        class="ui-game-card-banner"
        :style="{
          background: `linear-gradient(135deg, ${game.platformMeta?.gradFrom ?? '#1c1c28'} 0%, ${game.platformMeta?.gradTo ?? '#111118'} 100%)`,
        }"
      >
        <span class="relative z-10">{{ game.platformMeta?.emoji ?? game.platformMeta?.icon ?? '🎮' }}</span>
      </div>
      <div class="ui-game-card-body">
        <p class="game-card-name">{{ game.definition.name }}</p>
        <div class="home-card-tags">
          <span class="home-card-tag">
            👥 {{ game.platformMeta?.playerTag ?? `${game.definition.minPlayers}–${game.definition.maxPlayers} players` }}
          </span>
          <span v-if="game.platformMeta?.typeTag" class="home-card-tag">
            🎉 {{ game.platformMeta.typeTag }}
          </span>
        </div>
        <p v-if="game.platformMeta?.description" class="game-card-desc">
          {{ game.platformMeta.description }}
        </p>
        <span v-if="game.platformMeta?.comingSoon" class="ui-badge home-card-coming-soon">Coming soon</span>
      </div>
    </li>
  </ul>
  <p v-else class="home-grid-empty">No games available yet.</p>
</section>
```

Append to the existing `<style scoped>` block:

```css
/* ── Game Library grid ── */
.home-library {
  width: 100%;
  max-width: 960px;
  margin: 2.5rem auto 0;
  padding: 0 1.5rem;
}

.home-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: 1fr;
  list-style: none;
  padding: 0;
  margin: 0;
}

@media (min-width: 700px) {
  .home-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (min-width: 1024px) {
  .home-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

.home-grid-item {
  opacity: 0;
  transform: translateY(24px);
  animation: fade-up 600ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
  animation-delay: var(--fade-up-delay, 0ms);
  cursor: default;
}

/* The shared `ui-game-card:hover` lift comes from main.css;
   we intentionally suppress it here because the home card is inert. */
.home-grid-item:hover {
  transform: translateY(0);
}

@keyframes fade-up {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.home-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin-bottom: 0.5rem;
}

.home-card-tag {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.62rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-muted-foreground);
  padding: 0.15rem 0.5rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.02);
}

.home-card-coming-soon {
  display: inline-block;
  margin-top: 0.5rem;
  background: var(--color-warning-muted);
  color: var(--color-warning);
}

.home-grid-empty {
  text-align: center;
  padding: 2rem 1rem;
  color: var(--color-muted-foreground);
  font-size: 0.875rem;
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--radius-lg);
}

@media (prefers-reduced-motion: reduce) {
  .home-grid-item {
    animation: none;
    opacity: 1;
    transform: none;
  }
}
```

> **Note on the `game-card-name`, `game-card-meta`, `game-card-desc` selectors** — those live in `PartyView.vue` lines 403–422 and are **scoped**, so they don't reach `HomeView.vue`. Copy the three selectors verbatim into `HomeView.vue`'s scoped block (alongside the new `.home-card-*` rules above). They're 20 lines total and trivial.

### 6.3 Token names actually used

Every CSS value above maps to a real token in `apps/platform/src/styles/main.css` (lines 11–78):

| Token | Used for |
|-------|----------|
| `--color-card` (via `.ui-game-card` already in main.css) | card background |
| `--color-border`, `--color-border-strong` | card border + tag chip border |
| `--color-muted-foreground`, `--color-muted` | tag chip text |
| `--color-warning`, `--color-warning-muted` | "Coming soon" badge |
| `--radius-sm`, `--radius-lg` | tag chip + empty state radius |
| `'JetBrains Mono'`, `'Syne'` (font stacks) | tag chip + title (existing) |

No new tokens are introduced. If we decide later to add a `--shadow-grid-hover` token we can, but the existing `--shadow-elevated` plus `ui-game-card:hover` shadow already deliver the lift.

---

## 7. Verification plan

### Automated

| Command | Expected | Notes |
|---------|----------|-------|
| `pnpm -C apps/platform typecheck` | exits 0 | The 4 new optional fields on `PlatformGameMeta` widen the type; nothing else in the codebase destructures it. |
| `pnpm lint` | exits 0, no warnings | `--max-warnings 0` per `apps/platform/package.json` line 14. |
| `pnpm format:check` | exits 0 | Run after `pnpm format` to settle Prettier. |
| `pnpm test` | all green across 5 game projects | Additive change, no unit-test impact expected. |
| `pnpm test:e2e --grep "home library"` | new spec passes | See §5 Step 5. |
| `pnpm test:e2e` (full suite) | all pre-existing specs still pass | In particular `party-resume.spec.ts`, which navigates to `/` and fills `#name` — the new grid must not intercept focus or layout-shift the input. |

### Manual visual checks (against `pnpm dev` at `http://localhost:5173/`)

1. **Card render** — 5 cards visible below the Create/Join form. Each shows emoji on gradient banner, title, two tag chips, one-line description.
2. **Stagger** — cards animate in sequentially over ~1 s total (5 × 80 ms + 600 ms).
3. **Responsive** — at 360 px width, single column. At 768 px, 2 columns. At 1280 px, 3 columns.
4. **Reduced motion** — toggle macOS / Win10 "Reduce motion" → cards appear instantly with no animation.
5. **Form still works** — fill `#name`, click "Create Party", confirm `/party/<CODE>` loads. No regressions.
6. **Empty state** — temporarily comment out all 5 entries in `clientGameRegistry`, reload, confirm "No games available yet." message renders inside a dashed box. Revert.
7. **Console clean** — no Vue warnings, no Tailwind class-purge warnings (the scoped styles don't use any new arbitrary Tailwind classes — confirmed safe per CLAUDE.md rule).
8. **Lighthouse** — should remain ≥ 95 on Performance because the animation is `transform`/`opacity`-only (compositor-friendly) and uses `forwards` fill mode to avoid layout thrash.

---

## 8. Risks & open questions

### Top risks

1. **Animation re-trigger on session restore.** When `tryResume()` runs on socket connect, `HomeView.vue` doesn't unmount, but if the user reloads the page the cards re-animate. That's fine on `/`. **However**, if we ever move the grid to `PartyView.vue` the re-mount would feel jittery — keep the animation scoped to a CSS animation (one-shot on mount) and don't trigger it on prop changes.
2. **Tailwind purge + `@apply` in scoped styles.** Tailwind v4 with `@tailwindcss/vite` only scans files matched by `@source` in `main.css`. Lines 4–5 already scan `games/*/ui-vue/src/**/*.{vue,ts}`. `apps/platform/src/views/HomeView.vue` is *not* explicitly in the source list, but the file is part of the platform client and gets picked up by the default Tailwind v4 content detection (the `@import 'tailwindcss';` at line 2 of main.css enables automatic content discovery for the entrypoint graph). **Mitigation:** verify with `pnpm dev`, then `pnpm build:client`, that no Tailwind classes used in `HomeView.vue` (e.g. `flex`, `gap-3`) appear purged. The new code sketch uses *zero* Tailwind utility classes — everything is scoped CSS — so this risk is effectively zero for this plan.
3. **Scoping edge case with shared classes.** The new `<li>` uses `ui-game-card` (defined in `@layer components` of `main.css`). `ui-game-card:hover` applies `translateY(-3px)` which would visually conflict with the fade-up `translateY(24px)`. The sketch above already handles this with `.home-grid-item:hover { transform: translateY(0); }`. **The implementer must add this override** — easy to forget.
4. **`bg-flip7!` precedent.** Two existing files (`games/flip7/ui-vue/src/components/Lobby.vue`, `HitStayControls.vue`) already violate the "no `!important` Tailwind arbitrary" rule. This plan does not introduce more, but if a future "per-game gradient button" on the home card is requested, the implementer may be tempted to follow the existing bad pattern. The plan deliberately uses inline `:style` + scoped CSS instead.

### Open questions for the user

1. **Copy language.** The competitor is German; this project is English. The plan defaults to English (`"3–20 players"`, `"Word · Deception"`, …). Confirm or provide German copy.
2. **Categories taxonomy.** Tags like `"Word · Deception"`, `"Social deduction"`, `"Push-your-luck"` are invented. Does the user have a fixed taxonomy (e.g. `"Party"`, `"Strategy"`, `"Word"`, `"Card"`)? Worth aligning before launch.
3. **Empty state copy.** `"No games available yet."` is a guess. Alternatives: `"Library is empty — check back soon."` or a CTA `"Suggest a game"`.
4. **Hover CTA.** The competitor shows a "Spielen →" arrow on hover. We deliberately skipped it (cards are inert on `/`). Confirm — if the user wants clickable cards that jump to `/party/new?game=<id>` (creating a new party with that game pre-selected by the host), that's a Plan 4.
5. **Lucide migration.** Should we replace emoji with Lucide icons on the home grid specifically, or keep emoji to match `PartyView.vue`'s host-selection grid? The new `emoji?` field on `PlatformGameMeta` was added exactly so this question can be deferred.
6. **Logo / branding consistency.** The home page title is currently `"Game Platform"`. Should the new section sit *under* the form (current plan) or *above* it, with the form pushed down to the bottom of the fold?

---

## 9. Estimated effort

| Step | Description | Optimistic | Pessimistic |
|------|-------------|------------|-------------|
| 1 | Extend `PlatformGameMeta` + populate 5 entries | 0.25 h | 0.5 h |
| 2 | Build grid section + fade-up keyframe in `HomeView.vue` | 1.0 h | 1.5 h |
| 3 | Empty / coming-soon defensive states | 0.25 h | 0.5 h |
| 4 | Responsive breakpoints + visual polish | 0.5 h | 1.0 h |
| 5 | E2E spec + screenshot | 0.5 h | 1.0 h |
| 6 | Lint / format / typecheck / full E2E sweep | 0.25 h | 0.5 h |
| **Total** | | **2.75 h** | **5.0 h** |

For one developer familiar with the repo: **~3 hours**. For someone new: **~5 hours**.

---

## 10. Out of scope (explicit)

This plan **does not cover** any of the following — they belong to subsequent plans:

- **Plan 2 — Live Rooms section.** Polling `/api/rooms` every 5 s, rendering joinable rooms with game name, code, player count, and state (`lobby` / `playing` / `finished`). Sits *below* the game library once it lands.
- **Plan 3 — Browse / Host split view.** Toggle between "Browse games" and "Host a game" with the host path pre-selecting a game on the new party.
- **Plan 4 — Clickable home cards.** Letting unauthenticated users click a card to start a party with that game pre-selected. Today cards are inert (no `loadClient()` call on click).
- **Authentication, login, accounts.** The platform remains anonymous; no auth flow is added.
- **Server-side endpoints.** No new HTTP or Socket.IO events. `clientGameRegistry` is a static client-side module.
- **Per-game metadata rewrites.** The 5 existing entries gain *only* `playerTag` + `typeTag`. No description rewrites, no gradient tweaks, no icon swaps.
- **Internationalization.** No i18n setup. Copy is hard-coded English.
- **Tailwind v3→v4 migration.** Already complete per CLAUDE.md line 41.
- **Removing the existing `bg-flip7!` violations.** Two `games/flip7/ui-vue/src/components/*.vue` files use forbidden arbitrary `!important` Tailwind classes. Out of scope; tracked as a separate cleanup if desired.
- **`prefers-reduced-motion` audit for the rest of the app.** The plan adds reduced-motion handling *only* for the new animation. The rest of the codebase (transitions, slide-up, etc.) is unchanged.
- **`/api/rooms` polling strategy.** Plan 2 territory.
- **Mobile / iOS Safari testing.** Manual smoke test only on Chromium (matches `playwright.config.ts` line 30). True mobile verification is left to the user.

---

## Appendix A — File diff summary (planning only, no code emitted)

```text
apps/platform/src/games/index.ts
  +  6 lines (4 optional fields on interface)
  + 10 lines (2 new fields × 5 entries)

apps/platform/src/views/HomeView.vue
  +  1 line  (import)
  + 30 lines (template section)
  + 60 lines (scoped style + keyframes + reduced-motion)

apps/platform/e2e/home-library.spec.ts
  + 35 lines (new file)

Total: ~140 lines added across 4 files.
Zero lines removed.
```

## Appendix B — Real-token reference (cross-checked against `main.css` lines 11–78)

- Surfaces: `--color-canvas` (page bg), `--color-panel` (form), `--color-card` (game card), `--color-elevated`, `--color-shell`.
- Text: `--color-foreground`, `--color-muted`, `--color-muted-foreground`.
- Borders: `--color-border`, `--color-border-strong`, `--color-ring`.
- Radius: `--radius-sm` (6 px) for chips, `--radius-lg` (14 px) for cards/empty state, `--radius-xl` (20 px) for empty container if ever needed.
- Semantic: `--color-warning`, `--color-warning-muted` for "Coming soon".
- Game accents (`--color-blackout`, `--color-imposter`, `--color-signals`, `--color-flip7`, `--color-scout` + `-muted` / `-hover` variants) — *not* used in this plan because the registry already provides `gradFrom` / `gradTo`; we keep the banner gradient exactly as `PartyView.vue` does today.
- Fonts: `'Syne'` for display, `'JetBrains Mono'` for chip / monospace meta (matches the home `home-code-input`).
