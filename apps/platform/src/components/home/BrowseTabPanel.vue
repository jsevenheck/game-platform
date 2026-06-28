<script setup lang="ts">
import { clientGameRegistry } from '../../games';
import GameLibraryGrid from './GameLibraryGrid.vue';
import PublicLobbiesSection from './PublicLobbiesSection.vue';

defineProps<{
  ctaDismissed: boolean;
}>();

const emit = defineEmits<{
  selectGame: [gameId: string];
  joinRoom: [{ inviteCode: string }];
  hostRequested: [];
  dismissCta: [];
}>();
</script>

<template>
  <div class="browse-panel">
    <!-- Host CTA: shown until dismissed. An empty Live Rooms section is exactly
         when hosting is useful, so visibility does not depend on lobby count. -->
    <Transition name="fade">
      <div v-if="!ctaDismissed" class="browse-cta" data-testid="browse-cta">
        <div class="browse-cta-text">
          <p class="browse-cta-title">Want to play with your friends?</p>
          <p class="browse-cta-sub">Host a party and share the invite code.</p>
        </div>
        <div class="browse-cta-actions">
          <button
            type="button"
            class="ui-btn-primary browse-cta-btn"
            data-testid="browse-cta-host"
            @click="emit('hostRequested')"
          >
            Host a Party →
          </button>
          <button
            type="button"
            class="ui-btn-ghost browse-cta-dismiss"
            aria-label="Dismiss"
            data-testid="browse-cta-dismiss"
            @click="emit('dismissCta')"
          >
            ✕
          </button>
        </div>
      </div>
    </Transition>

    <div class="browse-columns">
      <section class="browse-lobbies" aria-label="Live Rooms">
        <PublicLobbiesSection @join-room="(p) => emit('joinRoom', p)" />
      </section>

      <section class="browse-library" aria-labelledby="home-library-heading">
        <h2 id="home-library-heading" class="ui-section-label">Game Library</h2>
        <GameLibraryGrid
          :games="clientGameRegistry"
          interactive
          data-testid="browse-game-library"
          @select="(id) => emit('selectGame', id)"
        />
      </section>
    </div>
  </div>
</template>

<style scoped>
.browse-panel {
  width: 100%;
}

.browse-cta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.875rem 1rem;
  margin-bottom: 1.25rem;
  background: var(--color-elevated);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-lg);
}

.browse-cta-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--color-foreground);
}

.browse-cta-sub {
  font-size: 0.78rem;
  color: var(--color-muted-foreground);
  margin-top: 0.125rem;
}

.browse-cta-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 0 0 auto;
}

.browse-cta-btn {
  padding: 0.55rem 1rem;
  font-size: 0.85rem;
  white-space: nowrap;
}

.browse-cta-dismiss {
  padding: 0.3rem 0.55rem;
  font-size: 0.8rem;
  line-height: 1;
}

.browse-columns {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
}

@media (min-width: 1024px) {
  .browse-columns {
    grid-template-columns: minmax(280px, 0.9fr) 1.4fr;
    align-items: start;
  }
}

.browse-lobbies {
  min-width: 0;
}

.browse-library {
  min-width: 0;
}
</style>
