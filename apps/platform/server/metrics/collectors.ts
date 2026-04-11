import { Gauge } from 'prom-client';
import { metricsRegistry } from './registry';
import { getPartySnapshot } from '../party/partyStore';
import { getRoomSnapshot as getBlackoutRoomSnapshot } from '../../../../games/blackout/server/src/models/room';
import { getRoomSnapshot as getImposterRoomSnapshot } from '../../../../games/imposter/server/src/models/room';
import { getRoomSnapshot as getSecretSignalsRoomSnapshot } from '../../../../games/secret-signals/server/src/models/room';
import { getRoomSnapshot as getFlip7RoomSnapshot } from '../../../../games/flip7/server/src/models/room';

/**
 * Metrics in this file are process-local in-memory gauges.
 * In horizontally scaled environments, each process reports its own local values.
 * Gauges are registered on the shared metricsRegistry from registry.ts.
 */

const partiesActiveGauge = new Gauge({
  name: 'platform_parties_active',
  help: 'Current number of active parties in this server process.',
  registers: [metricsRegistry],
  collect() {
    this.set(getPartySnapshot().totalParties);
  },
});

const partyMembersConnectedGauge = new Gauge({
  name: 'platform_party_members_connected',
  help: 'Current number of connected party members in this server process.',
  registers: [metricsRegistry],
  collect() {
    this.set(getPartySnapshot().connectedMembers);
  },
});

const roomsActiveGauge = new Gauge({
  name: 'platform_match_active',
  help: 'Current number of active rooms by game in this server process.',
  labelNames: ['game_id'],
  registers: [metricsRegistry],
  collect() {
    this.labels('blackout').set(getBlackoutRoomSnapshot().roomCount);
    this.labels('imposter').set(getImposterRoomSnapshot().roomCount);
    this.labels('secret-signals').set(getSecretSignalsRoomSnapshot().roomCount);
    this.labels('flip7').set(getFlip7RoomSnapshot().roomCount);
  },
});

const roomPlayersConnectedGauge = new Gauge({
  name: 'platform_room_players_connected',
  help: 'Current number of connected room players by game in this server process.',
  labelNames: ['game_id'],
  registers: [metricsRegistry],
  collect() {
    this.labels('blackout').set(getBlackoutRoomSnapshot().connectedPlayers);
    this.labels('imposter').set(getImposterRoomSnapshot().connectedPlayers);
    this.labels('secret-signals').set(getSecretSignalsRoomSnapshot().connectedPlayers);
    this.labels('flip7').set(getFlip7RoomSnapshot().connectedPlayers);
  },
});

const activeConnectionsGauge = new Gauge({
  name: 'platform_engine_connections',
  help: 'Current number of active Socket.IO engine connections in this server process.',
  registers: [metricsRegistry],
});

export function setActiveConnections(count: number): void {
  activeConnectionsGauge.set(count);
}

export function initializeMetrics(): void {
  // Instantiation performs registration. Keep references so gauges are retained.
  void partiesActiveGauge;
  void partyMembersConnectedGauge;
  void roomsActiveGauge;
  void roomPlayersConnectedGauge;
  setActiveConnections(0);
}
