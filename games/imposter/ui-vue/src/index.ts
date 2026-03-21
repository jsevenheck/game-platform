// UI module entry point.
import GameComponent from './App.vue';

export const manifest = {
  id: 'imposter',
  title: 'Imposter',
  minPlayers: 3,
  maxPlayers: 16,
};

export { GameComponent };
export default GameComponent;

// Re-export shared types
export type { RoomView, PlayerView } from '@shared/types';
export type { ClientToServerEvents, ServerToClientEvents } from '@shared/events';
