import { rankLabel, sortHand } from './cards';
import type { DdzCard, DdzPattern, DdzPatternType } from './types';

interface RankGroup {
  rank: number;
  cards: DdzCard[];
}

function groupByRank(cards: DdzCard[]): RankGroup[] {
  const map = new Map<number, DdzCard[]>();
  for (const card of cards) {
    const entry = map.get(card.rank) ?? [];
    entry.push(card);
    map.set(card.rank, entry);
  }
  return [...map.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([rank, groupedCards]) => ({ rank, cards: sortHand(groupedCards) }));
}

function makePattern(type: DdzPatternType, mainRank: number, cards: DdzCard[], sequenceLength = 1): DdzPattern {
  return {
    type,
    mainRank,
    cardCount: cards.length,
    sequenceLength,
    cards: sortHand(cards),
    description: describePattern(type, mainRank, cards.length, sequenceLength),
  };
}

function describePattern(type: DdzPatternType, mainRank: number, cardCount: number, sequenceLength: number): string {
  const rank = rankLabel(mainRank);
  if (type === 'single') return `单牌 ${rank}`;
  if (type === 'pair') return `对子 ${rank}`;
  if (type === 'triple') return `三张 ${rank}`;
  if (type === 'tripleSingle') return `三带一 ${rank}`;
  if (type === 'triplePair') return `三带对 ${rank}`;
  if (type === 'straight') return `顺子 ${rank} 起`;
  if (type === 'pairStraight') return `连对 ${rank} 起`;
  if (type === 'airplane') return `飞机 ${rank} 起`;
  if (type === 'airplaneSingles') return `飞机带翅膀 ${rank} 起`;
  if (type === 'airplanePairs') return `飞机带对 ${rank} 起`;
  if (type === 'fourWithTwoSingles') return `四带二 ${rank}`;
  if (type === 'fourWithTwoPairs') return `四带两对 ${rank}`;
  if (type === 'bomb') return `炸弹 ${rank}`;
  if (type === 'rocket') return '王炸';
  return `${type} ${rank} ${cardCount}/${sequenceLength}`;
}

function isConsecutive(ranks: number[]): boolean {
  for (let idx = 1; idx < ranks.length; idx += 1) {
    if (ranks[idx] !== ranks[idx - 1] + 1) {
      return false;
    }
  }
  return true;
}

function findTripleSequences(groups: RankGroup[]): number[][] {
  const ranks = groups.filter((group) => group.cards.length >= 3 && group.rank <= 14).map((group) => group.rank);
  const sequences: number[][] = [];
  let cursor = 0;
  while (cursor < ranks.length) {
    const run = [ranks[cursor]];
    while (cursor + 1 < ranks.length && ranks[cursor + 1] === ranks[cursor] + 1) {
      cursor += 1;
      run.push(ranks[cursor]);
    }
    for (let length = 2; length <= run.length; length += 1) {
      for (let start = 0; start + length <= run.length; start += 1) {
        sequences.push(run.slice(start, start + length));
      }
    }
    cursor += 1;
  }
  sequences.sort((left, right) => right.length - left.length || left[0] - right[0]);
  return sequences;
}

function cardsForRanks(groups: RankGroup[], ranks: number[], count: number): DdzCard[] {
  return ranks.flatMap((rank) => groups.find((group) => group.rank === rank)?.cards.slice(0, count) ?? []);
}

function remainingCards(groups: RankGroup[], excludedRanks: number[]): DdzCard[] {
  return groups
    .filter((group) => !excludedRanks.includes(group.rank))
    .flatMap((group) => group.cards)
    .sort((left, right) => left.rank - right.rank || left.code.localeCompare(right.code));
}

function remainingPairs(groups: RankGroup[], excludedRanks: number[]): DdzCard[][] {
  return groups
    .filter((group) => !excludedRanks.includes(group.rank) && group.cards.length >= 2)
    .map((group) => group.cards.slice(0, 2))
    .sort((left, right) => left[0].rank - right[0].rank);
}

function dedupePatterns(patterns: DdzPattern[]): DdzPattern[] {
  const seen = new Set<string>();
  return patterns.filter((pattern) => {
    const key = `${pattern.type}:${pattern.mainRank}:${pattern.cardCount}:${pattern.cards.map((card) => card.id).join(',')}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function enumerateStraightLike(groups: RankGroup[], countPerRank: 1 | 2, minLength: number, type: 'straight' | 'pairStraight'): DdzPattern[] {
  const ranks = groups
    .filter((group) => group.cards.length >= countPerRank && group.rank <= 14)
    .map((group) => group.rank);

  const patterns: DdzPattern[] = [];
  let cursor = 0;
  while (cursor < ranks.length) {
    const run = [ranks[cursor]];
    while (cursor + 1 < ranks.length && ranks[cursor + 1] === ranks[cursor] + 1) {
      cursor += 1;
      run.push(ranks[cursor]);
    }
    for (let length = minLength; length <= run.length; length += 1) {
      for (let start = 0; start + length <= run.length; start += 1) {
        const slice = run.slice(start, start + length);
        patterns.push(makePattern(type, slice[0], cardsForRanks(groups, slice, countPerRank), slice.length));
      }
    }
    cursor += 1;
  }
  return patterns;
}

export function analyzePattern(cards: DdzCard[]): DdzPattern | null {
  if (cards.length === 0) {
    return null;
  }

  const sorted = [...cards].sort((left, right) => left.rank - right.rank || left.code.localeCompare(right.code));
  const groups = groupByRank(sorted);
  const groupCounts = groups.map((group) => group.cards.length);
  const uniqueRanks = groups.map((group) => group.rank);

  if (sorted.length === 1) {
    return makePattern('single', sorted[0].rank, sorted);
  }

  if (sorted.length === 2) {
    if (sorted[0].rank === 16 && sorted[1].rank === 17) {
      return makePattern('rocket', 17, sorted);
    }
    if (groups.length === 1) {
      return makePattern('pair', sorted[0].rank, sorted);
    }
    return null;
  }

  if (sorted.length === 3 && groups.length === 1) {
    return makePattern('triple', sorted[0].rank, sorted);
  }

  if (sorted.length === 4) {
    if (groups.length === 1) {
      return makePattern('bomb', sorted[0].rank, sorted);
    }
    const triple = groups.find((group) => group.cards.length === 3);
    if (triple) {
      return makePattern('tripleSingle', triple.rank, sorted);
    }
    return null;
  }

  if (groups.length === sorted.length && sorted[sorted.length - 1].rank <= 14 && sorted.length >= 5 && isConsecutive(uniqueRanks)) {
    return makePattern('straight', uniqueRanks[0], sorted, uniqueRanks.length);
  }

  if (sorted.length % 2 === 0 && sorted.length >= 6 && groupCounts.every((count) => count === 2) && uniqueRanks[uniqueRanks.length - 1] <= 14 && isConsecutive(uniqueRanks)) {
    return makePattern('pairStraight', uniqueRanks[0], sorted, uniqueRanks.length);
  }

  const tripleSequences = findTripleSequences(groups);
  for (const sequence of tripleSequences) {
    const sequenceCards = cardsForRanks(groups, sequence, 3);
    if (sequenceCards.length !== sequence.length * 3) {
      continue;
    }

    if (sorted.length === sequence.length * 3) {
      return makePattern('airplane', sequence[0], sorted, sequence.length);
    }

    if (sorted.length === sequence.length * 4) {
      const remainder = remainingCards(groups, sequence);
      if (remainder.length === sequence.length) {
        return makePattern('airplaneSingles', sequence[0], sorted, sequence.length);
      }
    }

    if (sorted.length === sequence.length * 5) {
      const remainderGroups = groups.filter((group) => !sequence.includes(group.rank));
      if (remainderGroups.length === sequence.length && remainderGroups.every((group) => group.cards.length === 2)) {
        return makePattern('airplanePairs', sequence[0], sorted, sequence.length);
      }
    }
  }

  if (sorted.length === 5) {
    const triple = groups.find((group) => group.cards.length === 3);
    const pair = groups.find((group) => group.cards.length === 2);
    if (triple && pair) {
      return makePattern('triplePair', triple.rank, sorted);
    }
  }

  if (sorted.length === 6) {
    const four = groups.find((group) => group.cards.length === 4);
    if (four) {
      return makePattern('fourWithTwoSingles', four.rank, sorted);
    }
  }

  if (sorted.length === 8) {
    const four = groups.find((group) => group.cards.length === 4);
    const pairs = groups.filter((group) => group.cards.length === 2);
    if (four && pairs.length === 2) {
      return makePattern('fourWithTwoPairs', four.rank, sorted);
    }
  }

  return null;
}

export function canBeat(candidate: DdzPattern, lead: DdzPattern | null): boolean {
  if (!lead) {
    return true;
  }
  if (candidate.type === 'rocket') {
    return true;
  }
  if (lead.type === 'rocket') {
    return false;
  }
  if (candidate.type === 'bomb' && lead.type !== 'bomb') {
    return true;
  }
  if (lead.type === 'bomb' && candidate.type !== 'bomb') {
    return false;
  }
  if (candidate.type !== lead.type) {
    return false;
  }
  if (candidate.cardCount !== lead.cardCount) {
    return false;
  }
  if (candidate.sequenceLength !== lead.sequenceLength) {
    return false;
  }
  return candidate.mainRank > lead.mainRank;
}

export function enumeratePatterns(cards: DdzCard[]): DdzPattern[] {
  const hand = sortHand(cards);
  const groups = groupByRank(hand);
  const patterns: DdzPattern[] = [];

  for (const group of groups) {
    patterns.push(makePattern('single', group.rank, [group.cards[0]]));
    if (group.cards.length >= 2) {
      patterns.push(makePattern('pair', group.rank, group.cards.slice(0, 2)));
    }
    if (group.cards.length >= 3) {
      patterns.push(makePattern('triple', group.rank, group.cards.slice(0, 3)));
    }
    if (group.cards.length === 4) {
      patterns.push(makePattern('bomb', group.rank, group.cards.slice(0, 4)));
    }
  }

  const smallJoker = groups.find((group) => group.rank === 16)?.cards[0];
  const bigJoker = groups.find((group) => group.rank === 17)?.cards[0];
  if (smallJoker && bigJoker) {
    patterns.push(makePattern('rocket', 17, [smallJoker, bigJoker]));
  }

  patterns.push(...enumerateStraightLike(groups, 1, 5, 'straight'));
  patterns.push(...enumerateStraightLike(groups, 2, 3, 'pairStraight'));

  const tripleGroups = groups.filter((group) => group.cards.length >= 3);
  for (const triple of tripleGroups) {
    const smallestSingle = remainingCards(groups, [triple.rank])[0];
    if (smallestSingle) {
      patterns.push(makePattern('tripleSingle', triple.rank, [...triple.cards.slice(0, 3), smallestSingle]));
    }
    const smallestPair = remainingPairs(groups, [triple.rank])[0];
    if (smallestPair) {
      patterns.push(makePattern('triplePair', triple.rank, [...triple.cards.slice(0, 3), ...smallestPair]));
    }
  }

  const tripleSequences = findTripleSequences(groups);
  for (const sequence of tripleSequences) {
    const airplaneCards = cardsForRanks(groups, sequence, 3);
    patterns.push(makePattern('airplane', sequence[0], airplaneCards, sequence.length));

    const singleAttachments = remainingCards(groups, sequence).slice(0, sequence.length);
    if (singleAttachments.length === sequence.length) {
      patterns.push(makePattern('airplaneSingles', sequence[0], [...airplaneCards, ...singleAttachments], sequence.length));
    }

    const pairAttachments = remainingPairs(groups, sequence).slice(0, sequence.length).flatMap((pair) => pair);
    if (pairAttachments.length === sequence.length * 2) {
      patterns.push(makePattern('airplanePairs', sequence[0], [...airplaneCards, ...pairAttachments], sequence.length));
    }
  }

  for (const group of groups.filter((entry) => entry.cards.length === 4)) {
    const singles = remainingCards(groups, [group.rank]).slice(0, 2);
    if (singles.length === 2) {
      patterns.push(makePattern('fourWithTwoSingles', group.rank, [...group.cards.slice(0, 4), ...singles]));
    }

    const pairs = remainingPairs(groups, [group.rank]).slice(0, 2).flatMap((pair) => pair);
    if (pairs.length === 4) {
      patterns.push(makePattern('fourWithTwoPairs', group.rank, [...group.cards.slice(0, 4), ...pairs]));
    }
  }

  return dedupePatterns(patterns);
}

export function enumerateLegalPatterns(cards: DdzCard[], lead: DdzPattern | null): DdzPattern[] {
  return enumeratePatterns(cards)
    .filter((pattern) => canBeat(pattern, lead))
    .sort((left, right) => {
      const typePriority = (pattern: DdzPattern) => {
        if (pattern.type === 'rocket') return 100;
        if (pattern.type === 'bomb') return 90;
        return pattern.mainRank;
      };
      return typePriority(left) - typePriority(right) || left.cardCount - right.cardCount || left.mainRank - right.mainRank;
    });
}

export function isSameTeam(roleA: 'landlord' | 'farmer' | 'undecided', roleB: 'landlord' | 'farmer' | 'undecided'): boolean {
  if (roleA === 'undecided' || roleB === 'undecided') {
    return false;
  }
  return roleA === roleB;
}
