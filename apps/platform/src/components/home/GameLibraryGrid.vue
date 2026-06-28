<script setup lang="ts">
import { computed } from 'vue';
import type { PlatformGameModule } from '../../games';

/**
 * Responsive catalog grid of platform games.
 *
 * Plan 01 renders the grid in static mode (`interactive=false`): each card is
 * presentational `<article>` content with no click behavior. Plan 03 may reuse
 * the same component with `interactive=true`, rendering cards as `<button>`s
 * that emit `select`. The markup is structured so interactivity can be enabled
 * later without rewriting the card internals.
 */
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

interface CardView {
  id: string;
  name: string;
  icon: string;
  gradFrom: string;
  gradTo: string;
  playerRange: string;
  category?: string;
  description?: string;
}

const cards = computed<CardView[]>(() =>
  props.games.map((game) => {
    const meta = game.platformMeta;
    const { minPlayers, maxPlayers } = game.definition;
    return {
      id: game.definition.id,
      name: game.definition.name,
      icon: meta?.icon ?? '🎮',
      gradFrom: meta?.gradFrom ?? '#1a1a2e',
      gradTo: meta?.gradTo ?? '#0a0a14',
      playerRange: `${minPlayers}\u2013${maxPlayers} players`,
      category: meta?.category,
      description: meta?.description,
    };
  })
);

function handleSelect(id: string) {
  if (!props.interactive) return;
  emit('select', id);
}
</script>

<template>
  <ul class="game-library-grid">
    <li
      v-for="(card, index) in cards"
      :key="card.id"
      class="game-library-grid__item"
      :style="{ '--stagger': `${index * 80}ms` }"
    >
      <!-- Static card (Plan 01): display-only article, no click affordance -->
      <article
        v-if="!interactive"
        class="ui-game-card game-library-card"
        data-testid="game-library-card"
        :aria-label="card.name"
      >
        <div
          class="ui-game-card-banner game-library-card__banner"
          :style="{
            background: `linear-gradient(135deg, ${card.gradFrom} 0%, ${card.gradTo} 100%)`,
          }"
        >
          <span class="game-library-card__icon">{{ card.icon }}</span>
        </div>
        <div class="ui-game-card-body game-library-card__body">
          <div class="game-library-card__head">
            <p class="game-library-card__name">{{ card.name }}</p>
            <span v-if="card.category" class="game-library-card__chip">{{ card.category }}</span>
          </div>
          <p class="game-library-card__range">{{ card.playerRange }}</p>
          <p v-if="card.description" class="game-library-card__desc">{{ card.description }}</p>
        </div>
      </article>

      <!-- Interactive card (Plan 03+): button emitting `select` -->
      <button
        v-else
        type="button"
        class="ui-game-card game-library-card game-library-card--interactive"
        data-testid="game-library-card"
        :aria-label="card.name"
        @click="handleSelect(card.id)"
      >
        <div
          class="ui-game-card-banner game-library-card__banner"
          :style="{
            background: `linear-gradient(135deg, ${card.gradFrom} 0%, ${card.gradTo} 100%)`,
          }"
        >
          <span class="game-library-card__icon">{{ card.icon }}</span>
        </div>
        <div class="ui-game-card-body game-library-card__body">
          <div class="game-library-card__head">
            <p class="game-library-card__name">{{ card.name }}</p>
            <span v-if="card.category" class="game-library-card__chip">{{ card.category }}</span>
          </div>
          <p class="game-library-card__range">{{ card.playerRange }}</p>
          <p v-if="card.description" class="game-library-card__desc">{{ card.description }}</p>
        </div>
      </button>
    </li>
  </ul>
</template>

<style scoped>
.game-library-grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

@media (min-width: 700px) {
  .game-library-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .game-library-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.game-library-card {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  cursor: default; /* Static Plan 01 cards must not look clickable. */
  /* Staggered fade-up entrance. `--stagger` is set per-card inline. */
  animation: game-library-fade-up 600ms cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: var(--stagger, 0ms);
}

.game-library-card:not(.game-library-card--interactive):hover {
  transform: none;
  box-shadow: none;
  border-color: var(--color-border);
}

.game-library-card--interactive {
  cursor: pointer;
}

@keyframes game-library-fade-up {
  from {
    opacity: 0;
    transform: translateY(24px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .game-library-card {
    animation: none;
  }
}

.game-library-card__banner {
  flex: 0 0 auto;
}

.game-library-card__icon {
  position: relative;
  z-index: 1;
  line-height: 1;
}

.game-library-card__body {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1 1 auto;
}

.game-library-card__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}

.game-library-card__name {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--color-foreground);
  line-height: 1.25;
}

.game-library-card__chip {
  flex: 0 0 auto;
  font-size: 0.62rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-muted-foreground);
  background: var(--color-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  padding: 0.15rem 0.5rem;
  white-space: nowrap;
}

.game-library-card__range {
  font-size: 0.72rem;
  font-family: 'JetBrains Mono', monospace;
  color: var(--color-muted);
  letter-spacing: 0.02em;
}

.game-library-card__desc {
  font-size: 0.78rem;
  line-height: 1.4;
  color: var(--color-muted-foreground);
  margin-top: 0.125rem;
}
</style>
