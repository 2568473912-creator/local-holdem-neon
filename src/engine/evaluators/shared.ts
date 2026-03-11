import type { Card } from '../../types/cards';

export type HandCategory =
  | 'straight_flush'
  | 'four_kind'
  | 'full_house'
  | 'flush'
  | 'straight'
  | 'three_kind'
  | 'two_pair'
  | 'pair'
  | 'high_card';

export interface EvaluatorConfig {
  categoryOrder: readonly HandCategory[];
  allowA2345Straight: boolean;
  allowA6789Straight: boolean;
  categoryLabel: Record<HandCategory, string>;
}

export interface EvaluatedHand {
  category: HandCategory;
  categoryStrength: number;
  rankValue: number;
  tiebreaker: number[];
  bestFive: Card[];
  description: string;
}

interface StraightResult {
  isStraight: boolean;
  high: number;
}

function getCategoryStrength(category: HandCategory, config: EvaluatorConfig): number {
  const idx = config.categoryOrder.indexOf(category);
  return config.categoryOrder.length - idx;
}

function findStraight(ranks: number[], config: EvaluatorConfig): StraightResult {
  const unique = [...new Set(ranks)].sort((a, b) => b - a);
  if (unique.length !== 5) {
    return { isStraight: false, high: 0 };
  }

  const isNormalStraight = unique.every((rank, idx) => idx === 0 || unique[idx - 1] - rank === 1);
  if (isNormalStraight) {
    return { isStraight: true, high: unique[0] };
  }

  if (config.allowA2345Straight) {
    const wheel = [14, 5, 4, 3, 2];
    if (wheel.every((v, i) => unique[i] === v)) {
      return { isStraight: true, high: 5 };
    }
  }

  if (config.allowA6789Straight) {
    const shortWheel = [14, 9, 8, 7, 6];
    if (shortWheel.every((v, i) => unique[i] === v)) {
      return { isStraight: true, high: 9 };
    }
  }

  return { isStraight: false, high: 0 };
}

function lexCompare(a: number[], b: number[]): number {
  const size = Math.max(a.length, b.length);
  for (let i = 0; i < size; i += 1) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av !== bv) {
      return av > bv ? 1 : -1;
    }
  }
  return 0;
}

export function compareEvaluatedHands(a: EvaluatedHand, b: EvaluatedHand): number {
  if (a.categoryStrength !== b.categoryStrength) {
    return a.categoryStrength > b.categoryStrength ? 1 : -1;
  }
  return lexCompare(a.tiebreaker, b.tiebreaker);
}

export function evaluateFiveCardHand(cards: Card[], config: EvaluatorConfig): EvaluatedHand {
  if (cards.length !== 5) {
    throw new Error('evaluateFiveCardHand requires exactly 5 cards');
  }

  const ranks = cards.map((c) => c.rank).sort((a, b) => b - a);
  const suits = cards.map((c) => c.suit);
  const flush = suits.every((s) => s === suits[0]);
  const straight = findStraight(ranks, config);

  const rankCountMap = new Map<number, number>();
  for (const rank of ranks) {
    rankCountMap.set(rank, (rankCountMap.get(rank) ?? 0) + 1);
  }

  const entries = [...rankCountMap.entries()].sort((a, b) => {
    if (a[1] !== b[1]) {
      return b[1] - a[1];
    }
    return b[0] - a[0];
  });

  const counts = entries.map((entry) => entry[1]);
  const orderedRanksByCount = entries.map((entry) => entry[0]);

  let category: HandCategory = 'high_card';
  let tiebreaker: number[] = [];

  if (straight.isStraight && flush) {
    category = 'straight_flush';
    tiebreaker = [straight.high];
  } else if (counts[0] === 4) {
    category = 'four_kind';
    tiebreaker = [orderedRanksByCount[0], orderedRanksByCount[1]];
  } else if (counts[0] === 3 && counts[1] === 2) {
    category = 'full_house';
    tiebreaker = [orderedRanksByCount[0], orderedRanksByCount[1]];
  } else if (flush) {
    category = 'flush';
    tiebreaker = [...ranks];
  } else if (straight.isStraight) {
    category = 'straight';
    tiebreaker = [straight.high];
  } else if (counts[0] === 3) {
    category = 'three_kind';
    const kickers = orderedRanksByCount.slice(1).sort((a, b) => b - a);
    tiebreaker = [orderedRanksByCount[0], ...kickers];
  } else if (counts[0] === 2 && counts[1] === 2) {
    category = 'two_pair';
    const pairRanks = orderedRanksByCount.slice(0, 2).sort((a, b) => b - a);
    const kicker = orderedRanksByCount[2];
    tiebreaker = [pairRanks[0], pairRanks[1], kicker];
  } else if (counts[0] === 2) {
    category = 'pair';
    const kickers = orderedRanksByCount.slice(1).sort((a, b) => b - a);
    tiebreaker = [orderedRanksByCount[0], ...kickers];
  } else {
    category = 'high_card';
    tiebreaker = [...ranks];
  }

  const categoryStrength = getCategoryStrength(category, config);
  const rankValue = categoryStrength * 1_000_000 + tiebreaker.reduce((acc, n, idx) => acc + n * 10 ** (8 - idx * 2), 0);

  return {
    category,
    categoryStrength,
    rankValue,
    tiebreaker,
    bestFive: [...cards],
    description: config.categoryLabel[category],
  };
}

function combinationsOfFive(cards: Card[]): Card[][] {
  const combos: Card[][] = [];
  const n = cards.length;
  for (let a = 0; a < n - 4; a += 1) {
    for (let b = a + 1; b < n - 3; b += 1) {
      for (let c = b + 1; c < n - 2; c += 1) {
        for (let d = c + 1; d < n - 1; d += 1) {
          for (let e = d + 1; e < n; e += 1) {
            combos.push([cards[a], cards[b], cards[c], cards[d], cards[e]]);
          }
        }
      }
    }
  }
  return combos;
}

export function evaluateBestOfSeven(cards: Card[], config: EvaluatorConfig): EvaluatedHand {
  if (cards.length < 5 || cards.length > 7) {
    throw new Error('evaluateBestOfSeven expects 5 to 7 cards');
  }

  const combos = cards.length === 5 ? [cards] : combinationsOfFive(cards);
  let best = evaluateFiveCardHand(combos[0], config);

  for (let i = 1; i < combos.length; i += 1) {
    const candidate = evaluateFiveCardHand(combos[i], config);
    if (compareEvaluatedHands(candidate, best) > 0) {
      best = candidate;
    }
  }

  return best;
}
