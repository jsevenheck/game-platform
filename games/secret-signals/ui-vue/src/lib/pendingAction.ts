import { ref } from 'vue';
import type { RoomView } from '@shared/types';

export type ActionIntent =
  | { kind: 'start' | 'restart' | 'end' | 'skip' }
  | { kind: 'team'; value: RoomView['players'][number]['team'] }
  | { kind: 'role'; value: RoomView['players'][number]['role'] }
  | { kind: 'teamCount'; value: number }
  | { kind: 'penalty'; value: RoomView['assassinPenaltyMode'] }
  | { kind: 'mark'; value: number | null }
  | { kind: 'signal'; word: string; number: number }
  | { kind: 'reveal'; value: number };

/** Only action-specific public evidence may replace an ACK. Never infer from any broadcast. */
export function actionConfirmed(
  intent: ActionIntent,
  before: RoomView,
  room: RoomView,
  id: string
) {
  if (before.code !== room.code) return false;
  const player = room.players.find((candidate) => candidate.id === id);
  switch (intent.kind) {
    case 'team':
      return player?.team === intent.value;
    case 'role':
      return player?.role === intent.value;
    case 'teamCount':
      return room.teamCount === intent.value;
    case 'penalty':
      return room.assassinPenaltyMode === intent.value;
    case 'start':
      return before.phase === 'lobby' && room.phase !== 'lobby';
    case 'restart':
      return before.phase === 'ended' && room.phase === 'lobby';
    case 'mark':
      return (
        room.phase === 'playing' &&
        room.currentTurnTeam === before.currentTurnTeam &&
        room.turnPhase === before.turnPhase &&
        (intent.value === null
          ? !room.focusedCards.some((marker) => marker.playerId === id)
          : room.focusedCards.some(
              (marker) => marker.playerId === id && marker.cardIndex === intent.value
            ))
      );
    case 'signal':
      return (
        room.currentTurnTeam === before.currentTurnTeam &&
        room.turnPhase === 'guessing' &&
        room.currentSignal?.word === intent.word.trim().toUpperCase() &&
        room.currentSignal.number === intent.number
      );
    case 'reveal':
      return !before.board[intent.value]?.revealed && room.board[intent.value]?.revealed === true;
    case 'end':
    case 'skip':
      return (
        room.phase === 'ended' ||
        room.currentTurnTeam !== before.currentTurnTeam ||
        room.log.length > before.log.length
      );
  }
}

export function createPendingAction(timeoutMessage: () => string) {
  const pending = ref(false);
  const error = ref('');
  let generation = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let owned: { intent: ActionIntent; before: RoomView; id: string } | undefined;
  function invalidate() {
    generation += 1;
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    pending.value = false;
    owned = undefined;
  }
  function begin(intent: ActionIntent, before: RoomView, id: string) {
    if (pending.value) return null;
    invalidate();
    const current = generation;
    owned = { intent, before, id };
    pending.value = true;
    error.value = '';
    timer = setTimeout(() => {
      if (current !== generation) return;
      invalidate();
      error.value = timeoutMessage();
    }, 8000);
    return (response: { ok: boolean; error?: string }) => {
      if (current !== generation) return;
      invalidate();
      error.value = response.ok ? '' : (response.error ?? timeoutMessage());
    };
  }
  function reconcile(room: RoomView) {
    if (owned && actionConfirmed(owned.intent, owned.before, room, owned.id)) {
      invalidate();
      error.value = '';
    }
  }
  return { pending, error, begin, reconcile, invalidate };
}
