<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useGameStore } from '../stores/game';
import PlayerBoard from './PlayerBoard.vue';
import HitStayControls from './HitStayControls.vue';
import ActionTargetPicker from './ActionTargetPicker.vue';
import CardDrawToast from './CardDrawToast.vue';
import ActionAnnouncement from './ActionAnnouncement.vue';

const emit = defineEmits<{
  hit: [];
  stay: [];
  'choose-target': [targetPlayerId: string];
}>();

const { t } = useI18n();
const store = useGameStore();

const round = computed(() => store.currentRound);

const playerMap = computed(() => {
  const map: Record<string, import('@shared/types').PlayerView> = {};
  for (const p of store.room?.players ?? []) {
    map[p.id] = p;
  }
  return map;
});

const showHitStay = computed(
  () =>
    round.value?.phase === 'playing' &&
    store.isMyTurn &&
    !store.hasPendingActionToResolve &&
    round.value?.pendingAction === null &&
    store.myRoundPlayer?.status === 'active' &&
    (store.myRoundPlayer?.flipThreeRemaining ?? 0) === 0
);

const canStay = computed(() => {
  const rp = store.myRoundPlayer;
  if (!rp) return false;
  // Must hit with 0 cards — a completely empty hand cannot stay
  return rp.numberCards.length > 0 || rp.modifierAdds.length > 0 || rp.hasX2;
});

const showFlipThreePrompt = computed(
  () =>
    round.value?.phase === 'playing' &&
    store.isMyTurn &&
    !store.hasPendingActionToResolve &&
    (store.myRoundPlayer?.flipThreeRemaining ?? 0) > 0
);

const currentTurnPlayerName = computed(() => {
  const id = round.value?.currentTurnPlayerId;
  if (!id) return null;
  return playerMap.value[id]?.name ?? null;
});
</script>

<template>
  <div class="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-4 p-4 sm:pt-14">
    <!-- Header bar -->
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-bold text-flip7">Flip 7</h1>
      <div class="flex items-center gap-3 text-sm text-muted-foreground">
        <span>🃏 {{ t('flip7.table.deck', { count: round?.deckSize ?? 0 }) }}</span>
        <span>🗑️ {{ t('flip7.table.discard', { count: round?.discardSize ?? 0 }) }}</span>
        <span>🎯 {{ t('flip7.table.target', { score: store.room?.targetScore }) }}</span>
      </div>
    </div>

    <!-- Turn indicator -->
    <div
      v-if="round && !round.roundEndReason"
      class="rounded-md px-3 py-2 text-center text-sm"
      :class="
        store.isMyTurn
          ? 'bg-flip7-muted text-flip7 font-semibold'
          : 'bg-elevated text-muted-foreground'
      "
    >
      <template v-if="store.isMyTurn">{{ t('flip7.table.yourTurn') }}</template>
      <template v-else>{{ t('flip7.table.turnOf', { name: currentTurnPlayerName }) }}</template>
    </div>

    <!-- Player boards grid -->
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <PlayerBoard
        v-for="rp in round?.players"
        :key="rp.playerId"
        :round-player="rp"
        :player="
          playerMap[rp.playerId] ?? {
            id: rp.playerId,
            name: rp.playerId,
            totalScore: 0,
            connected: false,
            isHost: false,
          }
        "
        :is-current-turn="round?.currentTurnPlayerId === rp.playerId"
        :is-me="rp.playerId === store.playerId"
      />
    </div>

    <!-- Running scores -->
    <div class="ui-panel">
      <p class="ui-section-label mb-2">{{ t('flip7.table.scores') }}</p>
      <div class="flex flex-wrap gap-4">
        <div
          v-for="player in store.room?.players"
          :key="player.id"
          class="flex items-center gap-2 text-sm"
        >
          <span class="text-muted-foreground">{{ player.name }}</span>
          <span class="font-bold text-foreground">{{ player.totalScore }}</span>
        </div>
      </div>
    </div>

    <!-- Hit / Stay controls (your turn, normal) -->
    <div v-if="showHitStay" class="mt-auto pt-4">
      <HitStayControls :can-stay="canStay" @hit="emit('hit')" @stay="emit('stay')" />
    </div>

    <!-- Flip Three forced-draw notice -->
    <div
      v-else-if="showFlipThreePrompt"
      class="mt-auto rounded-md bg-warning-muted p-4 text-center"
    >
      <p class="font-semibold text-warning">
        {{
          t(
            'flip7.table.flipThreePrompt',
            { count: store.myRoundPlayer?.flipThreeRemaining ?? 0 },
            store.myRoundPlayer?.flipThreeRemaining ?? 0
          )
        }}
      </p>
      <button class="ui-btn-primary btn-warning mt-3" type="button" @click="emit('hit')">
        {{ t('flip7.table.drawCard') }}
      </button>
    </div>

    <!-- Action target picker modal -->
    <ActionTargetPicker
      v-if="store.hasPendingActionToResolve && round?.pendingAction"
      :pending-action="round.pendingAction"
      :players="store.room?.players ?? []"
      :my-player-id="store.playerId"
      @choose-target="(id) => emit('choose-target', id)"
    />

    <!-- Card draw toast (personal + other players) -->
    <CardDrawToast
      v-if="store.drawnCard"
      :key="store.drawnCardKey"
      :card="store.drawnCard"
      :drawer-name="store.drawnCardDrawerName"
    />

    <!-- Action announcement (all players) -->
    <ActionAnnouncement v-if="store.actionAnnouncement" :announcement="store.actionAnnouncement" />
  </div>
</template>

<style scoped>
.btn-warning {
  background: var(--color-warning);
  color: var(--color-canvas);
}

.btn-warning:hover:not(:disabled) {
  background: var(--color-warning);
}
</style>
