<script setup lang="ts">
import { computed } from 'vue';
import { useGameStore } from '../stores/game';

const store = useGameStore();

defineEmits<{
  reveal: [];
  reroll: [];
  selectWinner: [winnerId: string];
  skip: [];
}>();

const round = computed(() => store.currentRound);
const isReader = computed(() => store.isReader);
const canSkip = computed(() => store.isHost || store.isOwner);

const taskText = computed(() => {
  if (!round.value?.task) return '';
  const letter = round.value.letter ?? '';
  return round.value.task.text.replace('{letter}', letter);
});

const isCategoryReused = computed(() => {
  const id = round.value?.category?.id;
  if (!id) return false;
  return store.room?.usedCategoryIds.includes(id) ?? false;
});

const selectablePlayers = computed(() => {
  const currentRound = round.value;
  const players = store.room?.players ?? [];
  if (!currentRound) return [];
  return players.filter((player) => player.id !== currentRound.readerId && player.connected);
});
</script>

<template>
  <div class="game-round">
    <!-- Pre-reveal: Host sees category, others wait -->
    <template v-if="!round?.revealed">
      <div
        v-if="isReader"
        class="reader-view"
      >
        <p class="label">
          You are the Host!
        </p>
        <div class="category-card">
          <span
            v-if="isCategoryReused"
            class="reused-badge"
          >Already played</span>
          <p class="category-name">
            {{ round?.category?.name }}
          </p>
          <p class="task-text">
            {{ taskText }}
          </p>
          <p
            v-if="round?.letter"
            class="letter"
          >
            {{ round?.letter }}
          </p>
        </div>
        <button
          class="btn btn-reveal"
          @click="$emit('reveal')"
        >
          Reveal!
        </button>
        <button
          class="btn btn-reroll"
          @click="$emit('reroll')"
        >
          New Task + Category
        </button>
        <button
          v-if="canSkip"
          class="btn btn-skip"
          @click="$emit('skip')"
        >
          Skip Round
        </button>
        <p class="hint">
          Click to reveal the prompt to all players
        </p>
      </div>
      <div
        v-else
        class="waiting-view"
      >
        <p class="label">
          Waiting for the host to reveal...
        </p>
        <p class="reader-name">
          Host: {{ store.room?.players.find((p) => p.id === round?.readerId)?.name }}
        </p>
        <button
          v-if="canSkip"
          class="btn btn-skip"
          @click="$emit('skip')"
        >
          Skip Round
        </button>
      </div>
    </template>

    <!-- Post-reveal: Host picks the winner -->
    <template v-else>
      <div class="revealed-view">
        <div class="category-display">
          <span
            v-if="isCategoryReused"
            class="reused-badge"
          >Already played</span>
          <p class="category-name">
            {{ round?.category?.name }}
          </p>
          <p class="task-text">
            {{ taskText }}
          </p>
          <p
            v-if="round?.letter"
            class="letter-big"
          >
            {{ round?.letter }}
          </p>
        </div>

        <div
          v-if="isReader"
          class="answers-list"
        >
          <h3>Who was correct?</h3>
          <div
            v-for="player in selectablePlayers"
            :key="player.id"
            class="answer-entry"
          >
            <span class="answer-name">{{ player.name }}</span>
            <button
              class="btn btn-correct"
              @click="$emit('selectWinner', player.id)"
            >
              Correct!
            </button>
          </div>
        </div>
        <p
          v-else
          class="hint"
        >
          Speak your answer out loud. Host will select the correct player.
        </p>

        <!-- Host controls -->
        <div
          v-if="isReader || canSkip"
          class="reader-controls"
        >
          <button
            v-if="isReader"
            class="btn btn-reroll"
            @click="$emit('reroll')"
          >
            New Task + Category
          </button>
          <button
            v-if="canSkip"
            class="btn btn-skip"
            @click="$emit('skip')"
          >
            Skip Round
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.game-round {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  padding: 2rem 1rem;
}

.reader-view,
.waiting-view,
.revealed-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}

.label {
  color: #a1a1aa;
  font-size: 1rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.category-card {
  background: #27272a;
  border: 2px solid #8b5cf6;
  border-radius: 12px;
  padding: 2rem 3rem;
  text-align: center;
}

.category-display {
  text-align: center;
}

.reused-badge {
  display: inline-block;
  background: #7f1d1d;
  color: #fca5a5;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 0.2rem 0.6rem;
  border-radius: 99px;
  margin-bottom: 0.5rem;
}

.category-name {
  font-size: 1.5rem;
  color: #d4d4d8;
  margin-bottom: 0.5rem;
}

.task-text {
  color: #a78bfa;
  font-size: 1rem;
  margin-bottom: 0.35rem;
}

.letter,
.letter-big {
  font-size: 4rem;
  font-weight: 900;
  color: #8b5cf6;
}

.letter-big {
  font-size: 5rem;
  text-shadow: 0 0 30px rgba(139, 92, 246, 0.5);
}

.btn {
  padding: 0.75rem 2rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-reveal {
  background: #8b5cf6;
  color: #fff;
  font-size: 1.5rem;
  padding: 1rem 3rem;
}

.btn-reveal:hover {
  background: #7c3aed;
  transform: scale(1.05);
}

.btn-reroll {
  background: #1f2937;
  color: #d1d5db;
  border: 1px solid #374151;
}

.btn-reroll:hover {
  background: #273244;
  color: #fff;
}

.answers-list {
  width: 100%;
  max-width: min(92vw, 560px);
}

.answers-list h3 {
  color: #a1a1aa;
  margin-bottom: 0.5rem;
  text-align: center;
}

.answer-entry {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  background: #27272a;
  border-radius: 10px;
  margin-bottom: 0.5rem;
}

.answer-name {
  flex: 1;
  color: #fff;
  min-width: 0;
  font-size: 1.65rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.btn-correct {
  background: #22c55e;
  color: #fff;
  padding: 0.6rem 0.95rem;
  font-size: 1rem;
  border-radius: 12px;
  min-width: 116px;
}

.btn-correct:hover {
  background: #16a34a;
}

.btn-skip {
  background: #3f3f46;
  color: #a1a1aa;
  margin-top: 1rem;
}

.btn-skip:hover {
  background: #52525b;
  color: #fff;
}

.reader-controls {
  margin-top: 1rem;
}

.reader-name {
  color: #8b5cf6;
  font-size: 1.25rem;
  font-weight: 600;
}

.hint {
  color: #71717a;
  font-size: 0.875rem;
}

@media (max-width: 640px) {
  .answers-list {
    max-width: 100%;
  }

  .answer-entry {
    padding: 0.7rem 0.8rem;
  }

  .answer-name {
    font-size: 1.2rem;
  }

  .btn-correct {
    min-width: 96px;
    padding: 0.5rem 0.8rem;
    font-size: 0.95rem;
  }
}
</style>
