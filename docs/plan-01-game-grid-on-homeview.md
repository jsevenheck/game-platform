# Plan 01 — Home Game Library Grid

**Status:** revised planning document (critical review applied)  
**Baseline:** current `HomeView.vue` is a single Create/Join card; `clientGameRegistry` contains 5 live games.  
**Scope:** client-side UI only. No party lifecycle, routing, server, or game-module runtime changes.

---

## 1. Critical assessment / verdict

**Verdict: good feature, low technical risk, but the original draft needed tightening before implementation.**

Issues found in the previous draft and fixed here:

1. **`HomeView` layout bug:** adding a section as a sibling of `.home-card` would render side-by-side because `.home-root` is currently a centered flex row. This plan explicitly changes the root to a vertical page stack.
2. **Too much speculative metadata:** `playerTag`, `emoji`, and `comingSoon` over-model future needs. Player count can be derived from `definition`; `icon` is already the display emoji today. This plan adds only one real new field: `category`.
3. **Invalid disabled-list markup:** a `<li>` cannot be disabled. The grid now uses `<li><article>` for static cards, and can later switch to buttons only when interactivity is required.
4. **Brittle E2E assertions:** tests should not wait for computed animation opacity. Use visible cards and `prefers-reduced-motion` instead.
5. **Plan 3 dependency mismatch:** Plan 3 needs a reusable grid. This plan now creates a small `GameLibraryGrid.vue` component instead of burying all markup in `HomeView.vue`.

---

## 2. Goal

Render a polished, responsive game catalog on `/` below the existing Create/Join card:

- one card per entry in `clientGameRegistry`;
- gradient banner + emoji + game name;
- derived player range (`minPlayers–maxPlayers players`);
- optional category chip;
- short existing description;
- staggered fade-up entrance animation;
- display-only in Plan 01 (no click-to-create behavior yet).

The user still creates or joins parties through the existing form and selects a game in `PartyView`.

---

## 3. Deliverables

| File                                                    | Change                                                                                                      |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `apps/platform/src/games/index.ts`                      | Extend `PlatformGameMeta` with optional `category?: string`; populate 5 entries.                            |
| `apps/platform/src/components/home/GameLibraryGrid.vue` | New reusable grid component. Static by default; can emit `select` later when used interactively by Plan 03. |
| `apps/platform/src/views/HomeView.vue`                  | Import/render the grid below `.home-card`; change root layout from centered single card to vertical stack.  |
| `apps/platform/e2e/home-library.spec.ts`                | New Playwright smoke test for the catalog and existing Create flow.                                         |

No backend, router, Pinia store, or game UI module changes.

---

## 4. Metadata change

Current:

```ts
export interface PlatformGameMeta {
  icon: string;
  gradFrom: string;
  gradTo: string;
  description: string;
}
```

Revised:

```ts
export interface PlatformGameMeta {
  icon: string;
  gradFrom: string;
  gradTo: string;
  description: string;
  /** Short catalog/category label, e.g. "Social deduction". */
  category?: string;
}
```

Recommended category values:

| id               | Category           |
| ---------------- | ------------------ |
| `blackout`       | `Word · Deception` |
| `imposter`       | `Social deduction` |
| `secret-signals` | `Team · Strategy`  |
| `flip7`          | `Push your luck`   |
| `scout`          | `Card tactics`     |

Why not add `playerTag`? The player range is already canonical in `definition`. Formatting it in the component avoids duplicated values drifting out of sync.

Why not add `comingSoon`? There are no coming-soon games in the current registry. If needed later, add an explicit `releaseStatus: 'live' | 'coming-soon'` field in a follow-up, not a boolean placeholder.

---

## 5. Component design

### `apps/platform/src/components/home/GameLibraryGrid.vue`

Responsibility: render a responsive list of platform game cards from `PlatformGameModule[]`.

Suggested contract:

```ts
import type { PlatformGameModule } from '../../games';

const props = withDefaults(
  defineProps<{
    games: readonly PlatformGameModule[];
    interactive?: boolean;
  }>(),
  { interactive: false }
);

const emit = defineEmits<{
  select: [gameId: string];
}>();
```

Plan 01 uses `interactive=false`, so cards are rendered as static `<article>` content. Plan 03 may reuse the same component with `interactive=true` and render cards as `<button type="button">` that emit `select`.

Accessibility:

- wrap cards in `<ul class="game-library-grid">`;
- one `<li>` per game;
- static card content uses `<article aria-label="{name}">`;
- do not add fake click handlers or disabled attributes in Plan 01;
- add `data-testid="game-library-card"` for E2E.

---

## 6. HomeView integration

`HomeView.vue` should remain the owner of Create/Join behavior. Add the catalog as a sibling below the existing form card:

```vue
<div class="home-root">
  <div class="home-card">…existing form…</div>

  <section class="home-library" aria-labelledby="home-library-heading">
    <h2 id="home-library-heading" class="ui-section-label">Game Library</h2>
    <GameLibraryGrid :games="clientGameRegistry" />
  </section>
</div>
```

Required layout adjustment:

```css
.home-root {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 2rem;
  padding: clamp(1.5rem, 4vw, 3rem);
}

.home-library {
  width: 100%;
  max-width: 960px;
}
```

This prevents the new catalog from sitting next to the form card and keeps long mobile content scrollable.

---

## 7. Styling rules

Keep the grid styles scoped inside `GameLibraryGrid.vue`.

Minimum behavior:

- 1 column below `700px`;
- 2 columns from `700px`;
- 3 columns from `1024px`;
- fade-up animation: `opacity 0 → 1`, `translateY(24px) → 0`, `600ms cubic-bezier(0.22, 1, 0.36, 1)`;
- stagger delay via CSS variable: `index * 80ms`;
- `prefers-reduced-motion: reduce` disables the animation;
- static Plan 01 cards use `cursor: default` and should not visually imply clickability.

Using `ui-game-card`, `ui-game-card-banner`, and `ui-game-card-body` is fine, but override the static cursor/hover transform locally:

```css
.game-library-card {
  cursor: default;
}

.game-library-card:not(.game-library-card--interactive):hover {
  transform: none;
  box-shadow: none;
}
```

Do not introduce Tailwind `!important` arbitrary classes.

---

## 8. Implementation steps

1. **Extend game metadata**
   - Edit `apps/platform/src/games/index.ts`.
   - Add `category?: string` to `PlatformGameMeta`.
   - Populate categories for the 5 live games.

2. **Create `GameLibraryGrid.vue`**
   - File: `apps/platform/src/components/home/GameLibraryGrid.vue`.
   - Use `<script setup lang="ts">`.
   - Derive player range from `game.definition`.
   - Render category chip only when `game.platformMeta?.category` exists.
   - Add reduced-motion handling.

3. **Integrate into `HomeView.vue`**
   - Import `GameLibraryGrid` and `clientGameRegistry`.
   - Render the new section below `.home-card`.
   - Change `.home-root` to a vertical stack.

4. **Add E2E coverage**
   - New file: `apps/platform/e2e/home-library.spec.ts`.
   - Test catalog visibility under reduced motion.
   - Test that the existing Create Party flow still works.

5. **Run gates from workspace root**
   - `pnpm typecheck`
   - `pnpm lint`
   - `pnpm format:check`
   - `pnpm test:e2e --grep "home library|Create Party"`

---

## 9. E2E test outline

```ts
import { expect, test } from '@playwright/test';

const gameNames = ['Blackout', 'Imposter', 'Secret Signals', 'Flip 7', 'Scout'];

test.describe('home library', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('renders every registered game', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('game-library-card')).toHaveCount(5);

    for (const name of gameNames) {
      await expect(page.getByTestId('game-library-card').filter({ hasText: name })).toBeVisible();
    }
  });

  test('does not block creating a party', async ({ page }) => {
    await page.goto('/');
    await page.fill('#name', 'Alice');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/party\/[A-Z0-9]+/);
  });
});
```

---

## 10. Risks and mitigations

| Risk                                                                       | Mitigation                                                                              |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Catalog makes the home page too tall on mobile                             | Stack vertically, use normal page scroll, keep form first.                              |
| Static cards look clickable because `ui-game-card` has hover/cursor styles | Override cursor and static hover transform in `GameLibraryGrid.vue`.                    |
| Category labels are product copy, not domain truth                         | Keep `category` optional and easy to revise.                                            |
| Future Plan 03 wants clickable cards                                       | Component is structured so interactivity can be enabled later without rewriting markup. |

---

## 11. Open questions

1. Should copy stay English (`players`, `Game Library`) or switch to German (`Spieler`, `Spielebibliothek`)? Current project UI is English, so this plan keeps English.
2. Are the proposed category labels acceptable, or should the project use a fixed taxonomy like `Party`, `Cards`, `Words`, `Strategy`?
3. Should the catalog appear above the Create/Join card in a later redesign? Plan 01 keeps it below to avoid changing the primary flow.

---

## 12. Estimated effort

| Area                        | Estimate  |
| --------------------------- | --------- |
| Metadata update             | 0.25h     |
| `GameLibraryGrid.vue`       | 1.0–1.5h  |
| HomeView integration/layout | 0.5h      |
| E2E smoke test              | 0.5–1.0h  |
| Verification/fixes          | 0.5h      |
| **Total**                   | **~3–4h** |

---

## 13. Out of scope

- Clickable game cards that create/preselect a game.
- Public/live rooms.
- Home tab redesign.
- Coming-soon placeholders.
- New routes or server endpoints.
- Internationalization infrastructure.
