<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { TEAM_HEX_BY_COLOR } from '@shared/constants';
import { useGameStore } from '../stores/game';
import { CARD_HEX_BY_TYPE, getCardTextHex } from '../lib/teamTheme';
const { t } = useI18n();
const store = useGameStore();
const reversedLog = computed(() => [...(store.room?.log ?? [])].reverse());
</script>

<template>
  <div class="signal-log">
    <p v-if="reversedLog.length === 0" class="empty-log">{{ t('secret-signals.log.empty') }}</p>
    <ol v-else :aria-label="t('secret-signals.log.title')">
      <li v-for="(entry, index) in reversedLog" :key="index" class="log-entry">
        <div class="log-clue">
          <span
            class="log-team-dot"
            :style="{ backgroundColor: TEAM_HEX_BY_COLOR[entry.teamColor] }"
            aria-hidden="true"
          />
          <span class="sr-only">{{ t(`secret-signals.teams.${entry.teamColor}`) }}</span>
          <strong>{{ entry.signal.word }}</strong
          ><span>{{ entry.signal.number }}</span>
        </div>
        <ul class="log-cards">
          <li
            v-for="(card, cardIndex) in entry.revealedCards"
            :key="cardIndex"
            :style="{
              backgroundColor: CARD_HEX_BY_TYPE[card.type],
              color: getCardTextHex(card.type),
            }"
          >
            {{ card.word }}
            <span class="sr-only">{{
              t(
                card.type === 'neutral' || card.type === 'assassin'
                  ? `secret-signals.cards.${card.type}`
                  : `secret-signals.teams.${card.type}`
              )
            }}</span>
          </li>
        </ul>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.signal-log {
  max-height: 22rem;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-bottom: 0.75rem;
  scrollbar-color: #658891 #102d35;
}
ol,
ul {
  list-style: none;
  padding: 0;
  margin: 0;
}
.log-entry {
  padding: 0.75rem 0;
  border-bottom: 1px solid #47717b;
}
.log-entry:first-child {
  padding-top: 0;
}
.log-clue {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: #f4f7f6;
  overflow-wrap: anywhere;
}
.log-clue strong {
  text-transform: uppercase;
  min-width: 0;
}
.log-team-dot {
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 50%;
  flex-shrink: 0;
}
.log-cards {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.5rem;
}
.log-cards li {
  padding: 0.2rem 0.4rem;
  border: 1px solid #658891;
  border-radius: 0.2rem;
  font-size: 0.75rem;
  font-weight: 600;
  overflow-wrap: anywhere;
  max-width: 100%;
}
.empty-log {
  font-size: 0.8rem;
  color: #c5d9dc;
}
</style>
