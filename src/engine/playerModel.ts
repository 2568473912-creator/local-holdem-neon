import type { PlayerState } from '../types/game';

export function isPlayerAlive(player: PlayerState): boolean {
  return !player.eliminated;
}

export function isPlayerContesting(player: PlayerState): boolean {
  return !player.eliminated && !player.folded;
}

export function isPlayerActionable(player: PlayerState): boolean {
  return !player.eliminated && !player.folded && !player.allIn;
}

export function applyElimination(players: PlayerState[]): PlayerState[] {
  return players.map((p) => ({
    ...p,
    eliminated: p.stack <= 0,
    lastAction: p.stack <= 0 ? '淘汰' : p.lastAction,
  }));
}
