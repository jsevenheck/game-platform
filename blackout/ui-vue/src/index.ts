import GameComponent from './App.vue';

export const manifest = {
  id: 'blackout',
  title: 'Blackout',
  minPlayers: 3,
  maxPlayers: 20,
};

export { GameComponent };
export default GameComponent;
export type { RoomView, PlayerView } from '@shared/types';
export type { ClientToServerEvents, ServerToClientEvents } from '@shared/events';
