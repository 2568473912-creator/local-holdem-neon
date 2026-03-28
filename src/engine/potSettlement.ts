import type { Card, GameMode } from '../types/cards';
import type { EvaluatedHandInfo, PayoutItem, PlayerState, PotSegment } from '../types/game';
import { compareByMode, evaluatePlayerByMode, type EvaluatedHand } from './evaluators';

export interface SettlementResult {
  players: PlayerState[];
  pots: PotSegment[];
  payouts: PayoutItem[];
  winners: string[];
  showdownHands: EvaluatedHandInfo[];
  statusText: string;
}

function clonePlayers(players: PlayerState[]): PlayerState[] {
  return players.map((p) => ({ ...p, holeCards: [...p.holeCards] }));
}

export function buildPotSegments(players: PlayerState[]): PotSegment[] {
  const contributors = players.filter((p) => p.committed > 0);
  if (contributors.length === 0) {
    return [];
  }

  const levels = [...new Set(contributors.map((p) => p.committed))].sort((a, b) => a - b);
  const segments: PotSegment[] = [];
  let previous = 0;

  for (let i = 0; i < levels.length; i += 1) {
    const level = levels[i];
    const involved = contributors.filter((p) => p.committed >= level);
    const amount = (level - previous) * involved.length;
    if (amount > 0) {
      segments.push({
        id: `pot-${i + 1}`,
        amount,
        eligiblePlayerIds: involved.filter((p) => !p.folded).map((p) => p.id),
      });
    }
    previous = level;
  }

  return segments;
}

function seatDistanceFromDealer(seat: number, dealerSeat: number, maxSeat: number): number {
  const raw = seat - dealerSeat;
  return raw > 0 ? raw : raw + maxSeat + 1;
}

function distributeOddChips(
  winners: PlayerState[],
  allPlayers: PlayerState[],
  dealerSeat: number,
  amount: number,
): Record<string, number> {
  const result: Record<string, number> = {};
  if (winners.length === 0 || amount <= 0) {
    return result;
  }

  const base = Math.floor(amount / winners.length);
  let rem = amount - base * winners.length;

  const maxSeat = Math.max(...allPlayers.map((p) => p.seat));
  const ordered = [...winners].sort(
    (a, b) => seatDistanceFromDealer(a.seat, dealerSeat, maxSeat) - seatDistanceFromDealer(b.seat, dealerSeat, maxSeat),
  );

  for (const winner of ordered) {
    result[winner.id] = (result[winner.id] ?? 0) + base;
  }

  let idx = 0;
  while (rem > 0) {
    const target = ordered[idx % ordered.length];
    result[target.id] = (result[target.id] ?? 0) + 1;
    idx += 1;
    rem -= 1;
  }

  return result;
}

function evaluateShowdownHands(
  mode: GameMode,
  players: PlayerState[],
  board: Card[],
): {
  info: EvaluatedHandInfo[];
  evaluatedMap: Map<string, EvaluatedHand>;
} {
  const contenders = players.filter((p) => !p.folded && !p.eliminated);
  const info: EvaluatedHandInfo[] = [];
  const evaluatedMap = new Map<string, EvaluatedHand>();

  for (const player of contenders) {
    const evaluated = evaluatePlayerByMode(mode, player.holeCards, board);
    evaluatedMap.set(player.id, evaluated);
    info.push({
      playerId: player.id,
      category: evaluated.category,
      description: evaluated.description,
      rankValue: evaluated.rankValue,
      tiebreaker: evaluated.tiebreaker,
      bestFive: evaluated.bestFive,
    });
  }

  return { info, evaluatedMap };
}

export function settlePots(
  mode: GameMode,
  players: PlayerState[],
  board: Card[],
  dealerSeat: number,
): SettlementResult {
  const nextPlayers = clonePlayers(players);
  const pots = buildPotSegments(nextPlayers);
  const totalPot = pots.reduce((sum, pot) => sum + pot.amount, 0);
  const activeNonFolded = nextPlayers.filter((p) => !p.eliminated && !p.folded);
  const payouts: PayoutItem[] = [];

  if (activeNonFolded.length === 1) {
    const winner = activeNonFolded[0];
    winner.stack += totalPot;
    payouts.push({ playerId: winner.id, amount: totalPot, potId: 'pot-all' });

    return {
      players: nextPlayers,
      pots,
      payouts,
      winners: [winner.id],
      showdownHands: [],
      statusText: `${winner.name} 收下全部底池 ${totalPot}`,
    };
  }

  const { info: showdownHands, evaluatedMap } = evaluateShowdownHands(mode, nextPlayers, board);

  for (const pot of pots) {
    const contenders = pot.eligiblePlayerIds
      .map((id) => nextPlayers.find((p) => p.id === id))
      .filter((p): p is PlayerState => Boolean(p && !p.folded && !p.eliminated));

    if (contenders.length === 0) {
      continue;
    }

    if (contenders.length === 1) {
      const single = contenders[0];
      single.stack += pot.amount;
      payouts.push({
        playerId: single.id,
        amount: pot.amount,
        potId: pot.id,
      });
      continue;
    }

    let bestPlayers: PlayerState[] = [contenders[0]];
    let bestHand = evaluatedMap.get(contenders[0].id);

    for (let i = 1; i < contenders.length; i += 1) {
      const candidate = contenders[i];
      const candidateHand = evaluatedMap.get(candidate.id);
      if (!bestHand || !candidateHand) {
        continue;
      }

      const cmp = compareByMode(mode, candidateHand, bestHand);
      if (cmp > 0) {
        bestPlayers = [candidate];
        bestHand = candidateHand;
      } else if (cmp === 0) {
        bestPlayers.push(candidate);
      }
    }

    const distribution = distributeOddChips(bestPlayers, nextPlayers, dealerSeat, pot.amount);

    for (const [playerId, amount] of Object.entries(distribution)) {
      const player = nextPlayers.find((p) => p.id === playerId);
      if (!player || amount <= 0) {
        continue;
      }
      player.stack += amount;
      payouts.push({
        playerId,
        amount,
        potId: pot.id,
      });
    }
  }

  const winners = [...new Set(payouts.map((p) => p.playerId))];
  const winnerNames = winners
    .map((id) => nextPlayers.find((p) => p.id === id)?.name)
    .filter(Boolean)
    .join(' / ');

  return {
    players: nextPlayers,
    pots,
    payouts,
    winners,
    showdownHands,
    statusText: `摊牌结束：${winnerNames} 获胜`,
  };
}
