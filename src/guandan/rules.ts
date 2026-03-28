import { guandanRankLabel, rankPower, sortHand } from './cards';
import type { GdCard, GdPattern, GdPatternType } from './types';

interface RankGroup {
  rank: number;
  cards: GdCard[];
}

function groupByRank(cards: GdCard[], levelRank: number): RankGroup[] {
  const map = new Map<number, GdCard[]>();
  for (const card of cards) {
    const entry = map.get(card.rank) ?? [];
    entry.push(card);
    map.set(card.rank, entry);
  }
  return [...map.entries()]
    .sort((left, right) => rankPower(left[0], levelRank) - rankPower(right[0], levelRank))
    .map(([rank, groupedCards]) => ({ rank, cards: sortHand(groupedCards, levelRank) }));
}

function describePattern(type: GdPatternType, mainRank: number, cardCount: number, sequenceLength: number): string {
  const rank = guandanRankLabel(mainRank);
  if (type === 'single') return `单牌 ${rank}`;
  if (type === 'pair') return `对子 ${rank}`;
  if (type === 'triple') return `三张 ${rank}`;
  if (type === 'fullHouse') return `三带二 ${rank}`;
  if (type === 'straight') return `${sequenceLength} 连顺到 ${rank}`;
  if (type === 'pairStraight') return `${sequenceLength} 连对到 ${rank}`;
  if (type === 'tripleStraight') return `${sequenceLength} 节钢板到 ${rank}`;
  if (type === 'straightFlush') return `${sequenceLength} 张同花顺到 ${rank}`;
  if (type === 'bomb') return `${cardCount} 张炸弹 ${rank}`;
  return '天王炸弹';
}

function makePattern(type: GdPatternType, mainRank: number, cards: GdCard[], levelRank: number, sequenceLength = 1): GdPattern {
  return {
    type,
    mainRank,
    power: rankPower(mainRank, levelRank),
    cardCount: cards.length,
    sequenceLength,
    cards: sortHand(cards, levelRank),
    description: describePattern(type, mainRank, cards.length, sequenceLength),
  };
}

function isStraightRanks(ranks: number[]): boolean {
  for (let index = 1; index < ranks.length; index += 1) {
    if (ranks[index] !== ranks[index - 1] + 1) {
      return false;
    }
  }
  return true;
}

function collectRun(groups: RankGroup[], minimumCount: number, minimumLength: number, type: 'straight' | 'pairStraight' | 'tripleStraight', levelRank: number): GdPattern[] {
  const ranks = groups
    .filter((group) => group.rank >= 3 && group.rank <= 14 && group.cards.length >= minimumCount)
    .map((group) => group.rank)
    .sort((left, right) => left - right);
  const patterns: GdPattern[] = [];
  let cursor = 0;
  while (cursor < ranks.length) {
    const run = [ranks[cursor]];
    while (cursor + 1 < ranks.length && ranks[cursor + 1] === ranks[cursor] + 1) {
      cursor += 1;
      run.push(ranks[cursor]);
    }
    for (let length = minimumLength; length <= run.length; length += 1) {
      for (let start = 0; start + length <= run.length; start += 1) {
        const slice = run.slice(start, start + length);
        const cards = slice.flatMap((rank) => groups.find((group) => group.rank === rank)?.cards.slice(0, minimumCount) ?? []);
        if (type === 'straight' && cards.length === slice.length) {
          const suits = new Set(cards.map((card) => card.suit));
          if (suits.size === 1 && !suits.has('joker')) {
            continue;
          }
        }
        patterns.push(makePattern(type, slice[slice.length - 1], cards, levelRank, slice.length));
      }
    }
    cursor += 1;
  }
  return patterns;
}

function collectStraightFlushes(cards: GdCard[], levelRank: number): GdPattern[] {
  const bySuit = new Map<Exclude<GdCard['suit'], 'joker'>, Map<number, GdCard[]>>();
  for (const card of cards) {
    if (card.suit === 'joker' || card.rank < 3 || card.rank > 14) continue;
    const suitMap = bySuit.get(card.suit) ?? new Map<number, GdCard[]>();
    const group = suitMap.get(card.rank) ?? [];
    group.push(card);
    suitMap.set(card.rank, group);
    bySuit.set(card.suit, suitMap);
  }

  const patterns: GdPattern[] = [];
  for (const suitMap of bySuit.values()) {
    const ranks = [...suitMap.keys()].sort((left, right) => left - right);
    let cursor = 0;
    while (cursor < ranks.length) {
      const run = [ranks[cursor]];
      while (cursor + 1 < ranks.length && ranks[cursor + 1] === ranks[cursor] + 1) {
        cursor += 1;
        run.push(ranks[cursor]);
      }
      for (let length = 5; length <= run.length; length += 1) {
        for (let start = 0; start + length <= run.length; start += 1) {
          const slice = run.slice(start, start + length);
          const suitedCards = slice.map((rank) => suitMap.get(rank)?.[0]).filter(Boolean) as GdCard[];
          if (suitedCards.length === slice.length) {
            patterns.push(makePattern('straightFlush', slice[slice.length - 1], suitedCards, levelRank, slice.length));
          }
        }
      }
      cursor += 1;
    }
  }
  return patterns;
}

function isBombFamily(type: GdPatternType): boolean {
  return type === 'bomb' || type === 'straightFlush' || type === 'jokerBomb';
}

function dedupe(patterns: GdPattern[]): GdPattern[] {
  const seen = new Set<string>();
  return patterns.filter((pattern) => {
    const key = `${pattern.type}:${pattern.mainRank}:${pattern.cardCount}:${pattern.cards.map((card) => card.id).join(',')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function analyzePattern(cards: GdCard[], levelRank: number): GdPattern | null {
  if (cards.length === 0) return null;
  const sorted = sortHand(cards, levelRank);
  const groups = groupByRank(sorted, levelRank);
  const groupCounts = groups.map((group) => group.cards.length);
  const ranks = groups.map((group) => group.rank);
  const orderedRanks = [...ranks].sort((left, right) => left - right);

  if (sorted.length === 1) return makePattern('single', sorted[0].rank, sorted, levelRank);
  if (sorted.length === 2 && groups.length === 1) return makePattern('pair', groups[0].rank, sorted, levelRank);
  if (sorted.length === 3 && groups.length === 1) return makePattern('triple', groups[0].rank, sorted, levelRank);

  if (sorted.length === 4) {
    if (groups.length === 1) return makePattern('bomb', groups[0].rank, sorted, levelRank);
    const jokerCount = sorted.filter((card) => card.suit === 'joker').length;
    if (jokerCount === 4) return makePattern('jokerBomb', 17, sorted, levelRank);
  }

  if (
    sorted.length >= 5 &&
    new Set(sorted.map((card) => card.suit)).size === 1 &&
    !sorted.some((card) => card.suit === 'joker') &&
    groups.length === sorted.length &&
    orderedRanks.every((rank) => rank >= 3 && rank <= 14) &&
    isStraightRanks(orderedRanks)
  ) {
    return makePattern('straightFlush', orderedRanks[orderedRanks.length - 1], sorted, levelRank, orderedRanks.length);
  }

  if (sorted.length >= 5 && groups.length === sorted.length && orderedRanks.every((rank) => rank >= 3 && rank <= 14) && isStraightRanks(orderedRanks)) {
    return makePattern('straight', orderedRanks[orderedRanks.length - 1], sorted, levelRank, orderedRanks.length);
  }

  if (sorted.length >= 6 && sorted.length % 2 === 0 && groupCounts.every((count) => count === 2) && orderedRanks.every((rank) => rank >= 3 && rank <= 14) && isStraightRanks(orderedRanks)) {
    return makePattern('pairStraight', orderedRanks[orderedRanks.length - 1], sorted, levelRank, orderedRanks.length);
  }

  if (sorted.length >= 6 && sorted.length % 3 === 0 && groupCounts.every((count) => count === 3) && orderedRanks.every((rank) => rank >= 3 && rank <= 14) && isStraightRanks(orderedRanks)) {
    return makePattern('tripleStraight', orderedRanks[orderedRanks.length - 1], sorted, levelRank, orderedRanks.length);
  }

  if (sorted.length === 5 && groups.length === 2 && groupCounts.includes(3) && groupCounts.includes(2)) {
    const triple = groups.find((group) => group.cards.length === 3);
    if (triple) return makePattern('fullHouse', triple.rank, sorted, levelRank);
  }

  if (groups.length === 1 && sorted.length >= 4) {
    return makePattern('bomb', groups[0].rank, sorted, levelRank);
  }

  return null;
}

export function canBeat(candidate: GdPattern, lead: GdPattern | null): boolean {
  if (!lead) return true;
  if (candidate.type === 'jokerBomb') return true;
  if (lead.type === 'jokerBomb') return false;

  if (candidate.type === 'straightFlush') {
    if (lead.type === 'straightFlush') {
      if (candidate.sequenceLength !== lead.sequenceLength) return candidate.sequenceLength > lead.sequenceLength;
      return candidate.power > lead.power;
    }
    if (lead.type === 'bomb') {
      return lead.cardCount < 6;
    }
    return true;
  }

  if (lead.type === 'straightFlush') {
    if (candidate.type === 'bomb') return candidate.cardCount >= 6;
    return false;
  }

  if (candidate.type === 'bomb' && !isBombFamily(lead.type)) return true;
  if (lead.type === 'bomb' && !isBombFamily(candidate.type)) return false;
  if (candidate.type !== lead.type) return false;
  if (candidate.sequenceLength !== lead.sequenceLength) return false;
  if (candidate.type === 'bomb') {
    if (candidate.cardCount !== lead.cardCount) return candidate.cardCount > lead.cardCount;
    return candidate.power > lead.power;
  }
  if (candidate.cardCount !== lead.cardCount) return false;
  return candidate.power > lead.power;
}

export function enumeratePatterns(cards: GdCard[], levelRank: number): GdPattern[] {
  const hand = sortHand(cards, levelRank);
  const groups = groupByRank(hand, levelRank);
  const patterns: GdPattern[] = [];

  for (const group of groups) {
    patterns.push(makePattern('single', group.rank, [group.cards[0]], levelRank));
    if (group.cards.length >= 2) patterns.push(makePattern('pair', group.rank, group.cards.slice(0, 2), levelRank));
    if (group.cards.length >= 3) patterns.push(makePattern('triple', group.rank, group.cards.slice(0, 3), levelRank));
    if (group.cards.length >= 4) {
      for (let length = 4; length <= group.cards.length; length += 1) {
        patterns.push(makePattern('bomb', group.rank, group.cards.slice(0, length), levelRank));
      }
    }
  }

  const jokers = hand.filter((card) => card.suit === 'joker');
  if (jokers.length === 4) {
    patterns.push(makePattern('jokerBomb', 17, jokers, levelRank));
  }

  patterns.push(...collectRun(groups, 1, 5, 'straight', levelRank));
  patterns.push(...collectRun(groups, 2, 3, 'pairStraight', levelRank));
  patterns.push(...collectRun(groups, 3, 2, 'tripleStraight', levelRank));
  patterns.push(...collectStraightFlushes(hand, levelRank));

  const triples = groups.filter((group) => group.cards.length >= 3);
  const pairs = groups.filter((group) => group.cards.length >= 2);
  for (const triple of triples) {
    for (const pair of pairs) {
      if (pair.rank === triple.rank) continue;
      patterns.push(makePattern('fullHouse', triple.rank, [...triple.cards.slice(0, 3), ...pair.cards.slice(0, 2)], levelRank));
    }
  }

  return dedupe(patterns).sort((left, right) => {
    const typeOrder = ['single', 'pair', 'triple', 'straight', 'pairStraight', 'tripleStraight', 'fullHouse', 'straightFlush', 'bomb', 'jokerBomb'];
    const typeDiff = typeOrder.indexOf(left.type) - typeOrder.indexOf(right.type);
    if (typeDiff !== 0) return typeDiff;
    if (left.sequenceLength !== right.sequenceLength) return left.sequenceLength - right.sequenceLength;
    if (left.cardCount !== right.cardCount) return left.cardCount - right.cardCount;
    return left.power - right.power;
  });
}

export function legalPatternsForHand(cards: GdCard[], levelRank: number, lead: GdPattern | null): GdPattern[] {
  return enumeratePatterns(cards, levelRank).filter((pattern) => canBeat(pattern, lead));
}
