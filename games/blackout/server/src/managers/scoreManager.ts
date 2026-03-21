import type { Room } from '../../../core/src/types';

export function addPoint(room: Room, playerId: string): void {
  const player = room.players[playerId];
  if (player) {
    player.score += 1;
  }
}

export function getLeaderboard(room: Room): { id: string; name: string; score: number }[] {
  return Object.values(room.players)
    .map((p) => ({ id: p.id, name: p.name, score: p.score }))
    .sort((a, b) => b.score - a.score);
}

export function getWinners(room: Room): string[] {
  const leaderboard = getLeaderboard(room);
  if (leaderboard.length === 0) return [];
  const topScore = leaderboard[0]!.score;
  return leaderboard.filter((p) => p.score === topScore).map((p) => p.id);
}

export function resetScores(room: Room): void {
  for (const player of Object.values(room.players)) {
    player.score = 0;
  }
}
