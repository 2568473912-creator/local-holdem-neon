import type { AIDifficulty } from '../types/game';
import type { DdzPattern, DdzPlayerState, DdzRoundRuntime } from './types';
import { enumerateLegalPatterns, enumeratePatterns, isSameTeam } from './rules';

function bidStrength(player: DdzPlayerState): number {
  const counts = new Map<number, number>();
  for (const card of player.hand) {
    counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1);
  }

  let score = 0;
  for (const [rank, count] of counts.entries()) {
    if (rank >= 16) score += 6;
    else if (rank === 15) score += 4;
    else if (rank >= 13) score += 2;
    if (count === 4) score += 8;
    if (count === 3) score += rank >= 12 ? 3 : 1;
  }

  if (counts.has(16) && counts.has(17)) score += 8;
  return score;
}

export function chooseBid(player: DdzPlayerState, difficulty: AIDifficulty): number {
  const difficultyShift = difficulty === 'conservative' ? -3 : difficulty === 'aggressive' ? 3 : 0;
  const score = bidStrength(player) + difficultyShift;
  if (score >= 22) return 3;
  if (score >= 15) return 2;
  if (score >= 10) return 1;
  return 0;
}

function leadScore(pattern: DdzPattern, handSize: number): number {
  if (pattern.cardCount === handSize) {
    return 10_000;
  }

  let score = pattern.cardCount * 18 - pattern.mainRank;
  if (pattern.type === 'straight' || pattern.type === 'pairStraight') score += 20 + pattern.sequenceLength * 3;
  if (pattern.type === 'airplane' || pattern.type === 'airplaneSingles' || pattern.type === 'airplanePairs') score += 24 + pattern.sequenceLength * 5;
  if (pattern.type === 'triplePair' || pattern.type === 'tripleSingle') score += 16;
  if (pattern.type === 'single' && pattern.mainRank >= 15) score -= 30;
  if (pattern.type === 'pair' && pattern.mainRank >= 14) score -= 15;
  if (pattern.type === 'bomb') score -= 80;
  if (pattern.type === 'rocket') score -= 120;
  return score;
}

function responseScore(pattern: DdzPattern, handSize: number, opponentCardCount: number): number {
  if (pattern.cardCount === handSize) {
    return -10_000;
  }

  let score = pattern.mainRank * 3 + pattern.cardCount;
  if (pattern.type === 'bomb') score += opponentCardCount <= 3 ? 20 : 120;
  if (pattern.type === 'rocket') score += opponentCardCount <= 3 ? 30 : 140;
  return score;
}

export function chooseAiPlay(runtime: DdzRoundRuntime, playerId: string): DdzPattern | null {
  const player = runtime.players.find((entry) => entry.id === playerId);
  if (!player) {
    return null;
  }

  const leadPlayer = runtime.lead.playerId ? runtime.players.find((entry) => entry.id === runtime.lead.playerId) : null;
  const leadPattern = runtime.lead.pattern;
  const handPatterns = leadPattern ? enumerateLegalPatterns(player.hand, leadPattern) : enumeratePatterns(player.hand);
  if (handPatterns.length === 0) {
    return null;
  }

  if (!leadPattern) {
    return [...handPatterns].sort((left, right) => leadScore(right, player.hand.length) - leadScore(left, player.hand.length))[0] ?? null;
  }

  if (leadPlayer && leadPlayer.id !== player.id && isSameTeam(player.role, leadPlayer.role)) {
    const finishPlay = handPatterns.find((pattern) => pattern.cardCount === player.hand.length);
    if (finishPlay) {
      return finishPlay;
    }
    // Only defer (pass) when teammate is close to finishing (≤3 cards).
    // If teammate has many cards, play actively to support the team rather than always passing.
    if (leadPlayer.hand.length <= 3) {
      return null;
    }
  }

  const opponentCardCount = leadPlayer?.hand.length ?? 20;
  const nonBombResponses = handPatterns.filter((pattern) => pattern.type !== 'bomb' && pattern.type !== 'rocket');
  const responsePool = nonBombResponses.length > 0 && opponentCardCount > 3 ? nonBombResponses : handPatterns;

  return [...responsePool].sort((left, right) => responseScore(left, player.hand.length, opponentCardCount) - responseScore(right, player.hand.length, opponentCardCount))[0] ?? null;
}
