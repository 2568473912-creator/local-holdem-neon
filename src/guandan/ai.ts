import type { AIDifficulty } from '../types/game';
import type { GdPattern, GdRoundRuntime } from './types';
import { legalPatternsForHand } from './rules';

function sortCandidatePatterns(patterns: GdPattern[], difficulty: AIDifficulty, danger: boolean): GdPattern[] {
  const bombPenalty = difficulty === 'aggressive' || danger ? 0 : 100;
  return [...patterns].sort((left, right) => {
    const leftBombWeight = left.type === 'bomb' || left.type === 'jokerBomb' || left.type === 'straightFlush' ? bombPenalty : 0;
    const rightBombWeight = right.type === 'bomb' || right.type === 'jokerBomb' || right.type === 'straightFlush' ? bombPenalty : 0;
    if (leftBombWeight !== rightBombWeight) return leftBombWeight - rightBombWeight;
    if (left.sequenceLength !== right.sequenceLength) return left.sequenceLength - right.sequenceLength;
    if (left.cardCount !== right.cardCount) return left.cardCount - right.cardCount;
    return left.power - right.power;
  });
}

export function chooseAiPattern(runtime: GdRoundRuntime, playerId: string): GdPattern | null {
  const player = runtime.players.find((entry) => entry.id === playerId);
  if (!player || player.hand.length === 0) return null;
  const danger = runtime.players.some((entry) => entry.id !== playerId && entry.hand.length > 0 && entry.hand.length <= 4);
  const levelRank = runtime.teamLevels[player.team];
  const legal = legalPatternsForHand(player.hand, levelRank, runtime.trick.pattern);
  if (legal.length === 0) return null;
  const ordered = sortCandidatePatterns(legal, runtime.config.aiDifficulty, danger || player.hand.length <= 6);
  return ordered[0] ?? null;
}
