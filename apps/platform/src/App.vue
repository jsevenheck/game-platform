<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { partyConnectionLost } from './composables/usePartySocket';

const { t } = useI18n();
</script>

<template>
  <RouterView />
  <Teleport to="body">
    <div class="connection-banner-region" role="status" aria-live="polite">
      <p v-if="partyConnectionLost" class="connection-banner" data-testid="connection-banner">
        <span class="connection-banner-dot" aria-hidden="true" />
        {{ t('connection.lost') }}
      </p>
    </div>
  </Teleport>
</template>

<style scoped>
.connection-banner-region {
  position: fixed;
  left: 50%;
  bottom: max(1rem, env(safe-area-inset-bottom));
  transform: translateX(-50%);
  z-index: 10002;
  width: max-content;
  max-width: calc(100vw - 2rem);
  pointer-events: none;
}

.connection-banner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: 1px solid var(--color-warning);
  border-radius: var(--radius-pill);
  background: var(--color-elevated);
  color: var(--color-foreground);
  font-size: 0.875rem;
  font-weight: 600;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
}

.connection-banner-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: var(--color-warning);
}
</style>
