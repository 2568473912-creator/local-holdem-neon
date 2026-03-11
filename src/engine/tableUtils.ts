import type { PlayerState } from '../types/game';

export function sortBySeat(players: PlayerState[]): PlayerState[] {
  return [...players].sort((a, b) => a.seat - b.seat);
}

export function getAlivePlayers(players: PlayerState[]): PlayerState[] {
  return players.filter((p) => !p.eliminated);
}

export function getInHandPlayers(players: PlayerState[]): PlayerState[] {
  return players.filter((p) => !p.eliminated && !p.folded);
}

export function getActionablePlayers(players: PlayerState[]): PlayerState[] {
  return players.filter((p) => !p.eliminated && !p.folded && !p.allIn);
}

export function seatOrderFrom(players: PlayerState[], startSeatExclusive: number): PlayerState[] {
  const sorted = sortBySeat(players);
  const higher = sorted.filter((p) => p.seat > startSeatExclusive);
  const lowerOrEqual = sorted.filter((p) => p.seat <= startSeatExclusive);
  return [...higher, ...lowerOrEqual];
}

export function nextAliveSeat(players: PlayerState[], startSeat: number): number {
  const alive = getAlivePlayers(players);
  if (alive.length === 0) {
    return startSeat;
  }

  const ordered = seatOrderFrom(alive, startSeat);
  return ordered[0].seat;
}

export function getPlayerById(players: PlayerState[], playerId: string): PlayerState | undefined {
  return players.find((p) => p.id === playerId);
}

export function clonePlayers(players: PlayerState[]): PlayerState[] {
  return players.map((p) => ({
    ...p,
    holeCards: [...p.holeCards],
  }));
}

export function countRemainingContestants(players: PlayerState[]): number {
  return players.filter((p) => !p.eliminated && !p.folded).length;
}

export function countActionableContestants(players: PlayerState[]): number {
  return players.filter((p) => !p.eliminated && !p.folded && !p.allIn).length;
}

export function nextPlayerIdInOrder(
  players: PlayerState[],
  startSeatExclusive: number,
  predicate: (p: PlayerState) => boolean,
): string | undefined {
  return seatOrderFrom(players, startSeatExclusive).find(predicate)?.id;
}
