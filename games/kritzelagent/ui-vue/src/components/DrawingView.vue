<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { PrivateAssignment, RoomView } from '@shared/types';
import DrawingCanvas from './DrawingCanvas.vue';

const props = defineProps<{
  room: RoomView;
  assignment: PrivateAssignment | null;
  canDraw: boolean;
  pending: boolean;
}>();
const { t } = useI18n();
const emit = defineEmits<{ stroke: [points: { x: number; y: number }[]] }>();

function submitStroke(points: { x: number; y: number }[]) {
  if (!props.canDraw || props.pending) return;
  emit('stroke', points);
}
</script>

<template>
  <section
    class="ui-panel kritzelagent-round"
    data-testid="kritzelagent-drawing"
    aria-labelledby="drawing-title"
  >
    <div class="kritzelagent-round__header">
      <div>
        <p class="text-sm text-muted-foreground">
          {{
            t('kritzelagent.drawing.round', { round: room.currentRound, total: room.totalRounds })
          }}
        </p>
        <h2 id="drawing-title" data-phase-focus tabindex="-1">
          {{ t('kritzelagent.drawing.title') }}
        </h2>
      </div>
      <p class="kritzelagent-badge" aria-live="polite">
        {{
          t('kritzelagent.drawing.strokes', {
            turn: room.drawingTurn,
            total: room.totalDrawingTurns,
          })
        }}
      </p>
    </div>
    <div class="kritzelagent-assignment" role="status">
      <strong>{{
        t('kritzelagent.drawing.category', {
          category: assignment?.category ?? room.category ?? t('kritzelagent.drawing.loading'),
        })
      }}</strong>
      <span v-if="assignment?.isAgent">{{ t('kritzelagent.drawing.youAreAgent') }}</span>
      <span v-else-if="assignment?.topic"
        >{{ t('kritzelagent.drawing.motif') }} <strong>{{ assignment.topic }}</strong></span
      >
    </div>
    <DrawingCanvas :strokes="room.strokes" :disabled="!canDraw || pending" @stroke="submitStroke" />
    <p class="mt-3 text-sm text-muted-foreground" aria-live="polite">
      <template v-if="canDraw">{{ t('kritzelagent.drawing.yourTurn') }}</template>
      <template v-else>{{
        t('kritzelagent.drawing.activeTurn', {
          name:
            room.players.find((player) => player.id === room.activePlayerId)?.name ??
            t('kritzelagent.drawing.nobody'),
        })
      }}</template>
    </p>
  </section>
</template>

<style scoped>
.kritzelagent-round {
  display: grid;
  gap: 1rem;
}
.kritzelagent-round__header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: start;
}
.kritzelagent-round h2 {
  margin-top: 0.25rem;
  font-size: 1.35rem;
  font-weight: 700;
}
.kritzelagent-badge {
  border-radius: 999px;
  background: var(--color-kritzelagent-muted);
  padding: 0.4rem 0.75rem;
  font-size: 0.875rem;
}
.kritzelagent-assignment {
  display: grid;
  gap: 0.2rem;
  border: 1px solid var(--color-kritzelagent);
  border-radius: var(--radius-md);
  background: var(--color-kritzelagent-muted);
  padding: 0.75rem;
}
</style>
