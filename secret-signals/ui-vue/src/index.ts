import { MAX_PLAYERS, MIN_PLAYERS } from '@shared/constants';
import GameComponent from './App.vue';

export const manifest = {
  id: 'secret-signals',
  title: 'Secret Signals',
  minPlayers: MIN_PLAYERS,
  maxPlayers: MAX_PLAYERS,
};

export { GameComponent };

export type { RoomView, PlayerView } from '@shared/types';
export type { ClientToServerEvents, ServerToClientEvents } from '@shared/events';
