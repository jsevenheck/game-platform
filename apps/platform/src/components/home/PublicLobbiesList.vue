<script setup lang="ts">
import type { JoinablePartyView } from '../../stores/publicLobbies';

/**
 * Pure presentational list of public, joinable lobbies.
 *
 * Each lobby is a button card that emits `join-room` with the invite code — it
 * does NOT silently join. The parent (HomeView) pre-fills the existing Join
 * form. A lobby matching `currentInviteCode` is labelled "Resume".
 */
const props = defineProps<{
  parties: readonly JoinablePartyView[];
  currentInviteCode?: string | null;
}>();

const emit = defineEmits<{
  'join-room': [{ inviteCode: string }];
}>();

function playerLabel(p: JoinablePartyView): string {
  const cap =
    p.minPlayers && p.maxPlayers
      ? ` / ${p.minPlayers}\u2013${p.maxPlayers}`
      : p.maxPlayers
        ? ` / up to ${p.maxPlayers}`
        : '';
  return `${p.connectedPlayers}${cap} online`;
}

function isCurrent(p: JoinablePartyView): boolean {
  return !!props.currentInviteCode && p.inviteCode === props.currentInviteCode;
}

function handleJoin(p: JoinablePartyView): void {
  emit('join-room', { inviteCode: p.inviteCode });
}
</script>

<template>
  <ul class="public-lobbies-list">
    <li v-for="party in parties" :key="party.inviteCode" class="public-lobbies-list__item">
      <button
        type="button"
        class="public-lobby-card"
        :class="{ 'public-lobby-card--current': isCurrent(party) }"
        data-testid="public-lobby-card"
        :aria-label="`Join room ${party.inviteCode}`"
        @click="handleJoin(party)"
      >
        <div class="public-lobby-card__head">
          <span class="public-lobby-card__code">{{ party.inviteCode }}</span>
          <span v-if="isCurrent(party)" class="ui-badge public-lobby-card__resume">Resume</span>
        </div>
        <p class="public-lobby-card__game">
          {{ party.gameName ?? 'Game not selected yet' }}
        </p>
        <p class="public-lobby-card__meta">{{ playerLabel(party) }}</p>
      </button>
    </li>
  </ul>
</template>

<style scoped>
.public-lobbies-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.625rem;
}

@media (min-width: 700px) {
  .public-lobbies-list {
    grid-template-columns: repeat(2, 1fr);
  }
}

.public-lobby-card {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  text-align: left;
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 0.75rem 0.875rem;
  cursor: pointer;
  font: inherit;
  color: var(--color-foreground);
  transition:
    border-color 180ms ease,
    transform 180ms ease,
    box-shadow 180ms ease;
}

.public-lobby-card:hover {
  border-color: var(--color-border-strong);
  transform: translateY(-2px);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.55);
}

.public-lobby-card:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.public-lobby-card--current {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 1px rgba(249, 115, 22, 0.2);
}

.public-lobby-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.public-lobby-card__code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  color: var(--color-foreground);
}

.public-lobby-card__resume {
  color: var(--color-accent);
  background: rgba(249, 115, 22, 0.12);
  border: 1px solid rgba(249, 115, 22, 0.25);
}

.public-lobby-card__game {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-foreground);
  line-height: 1.3;
}

.public-lobby-card__meta {
  font-size: 0.72rem;
  font-family: 'JetBrains Mono', monospace;
  color: var(--color-muted);
  letter-spacing: 0.02em;
}
</style>
