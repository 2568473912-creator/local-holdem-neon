import type { DdzCard, DdzSuit } from './types';

const SUITS: Array<{ suit: Exclude<DdzSuit, 'joker'>; glyph: string }> = [
  { suit: 'spade', glyph: '♠' },
  { suit: 'heart', glyph: '♥' },
  { suit: 'club', glyph: '♣' },
  { suit: 'diamond', glyph: '♦' },
];

const RANKS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] as const;

export function rankLabel(rank: number): string {
  if (rank <= 10) return String(rank);
  if (rank === 11) return 'J';
  if (rank === 12) return 'Q';
  if (rank === 13) return 'K';
  if (rank === 14) return 'A';
  if (rank === 15) return '2';
  if (rank === 16) return '小王';
  return '大王';
}

export function shortRankLabel(rank: number): string {
  if (rank === 16) return '小王';
  if (rank === 17) return '大王';
  return rankLabel(rank);
}

export function suitGlyph(suit: DdzSuit): string {
  if (suit === 'joker') return '★';
  return SUITS.find((entry) => entry.suit === suit)?.glyph ?? '?';
}

export function sortHand(cards: DdzCard[]): DdzCard[] {
  return [...cards].sort((left, right) => {
    if (right.rank !== left.rank) {
      return right.rank - left.rank;
    }
    return left.code.localeCompare(right.code);
  });
}

export function createDeck(): DdzCard[] {
  const cards: DdzCard[] = [];
  for (const rank of RANKS) {
    for (const { suit, glyph } of SUITS) {
      const label = `${glyph}${rankLabel(rank)}`;
      cards.push({
        id: `${suit}-${rank}`,
        suit,
        rank,
        code: `${suit[0].toUpperCase()}${rank}`,
        label,
        shortLabel: rankLabel(rank),
      });
    }
  }

  cards.push({
    id: 'joker-small',
    suit: 'joker',
    rank: 16,
    code: 'SJ',
    label: '小王',
    shortLabel: '小王',
  });
  cards.push({
    id: 'joker-big',
    suit: 'joker',
    rank: 17,
    code: 'BJ',
    label: '大王',
    shortLabel: '大王',
  });

  return cards;
}

export function shuffleDeck(cards: DdzCard[], seed = Date.now()): DdzCard[] {
  const deck = [...cards];
  let state = seed >>> 0;
  const next = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };

  for (let idx = deck.length - 1; idx > 0; idx -= 1) {
    const swap = Math.floor(next() * (idx + 1));
    [deck[idx], deck[swap]] = [deck[swap], deck[idx]];
  }

  return deck;
}
