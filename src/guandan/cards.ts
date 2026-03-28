import type { GdCard, GdSuit, GdTeam, GdTeamLevels } from './types';

const SUITS: Array<{ suit: Exclude<GdSuit, 'joker'>; glyph: string }> = [
  { suit: 'spade', glyph: '♠' },
  { suit: 'heart', glyph: '♥' },
  { suit: 'club', glyph: '♣' },
  { suit: 'diamond', glyph: '♦' },
];

const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] as const;
export const GUANDAN_LEVEL_SEQUENCE = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] as const;

export function guandanRankLabel(rank: number): string {
  if (rank <= 10) return String(rank);
  if (rank === 11) return 'J';
  if (rank === 12) return 'Q';
  if (rank === 13) return 'K';
  if (rank === 14) return 'A';
  if (rank === 16) return '小王';
  return '大王';
}

export function guandanShortRankLabel(rank: number): string {
  if (rank === 16) return '小王';
  if (rank === 17) return '大王';
  return guandanRankLabel(rank);
}

export function suitGlyph(suit: GdSuit): string {
  if (suit === 'joker') return '★';
  return SUITS.find((entry) => entry.suit === suit)?.glyph ?? '?';
}

export function rankPower(rank: number, levelRank: number): number {
  if (rank === 17) return 17;
  if (rank === 16) return 16;
  if (rank === levelRank) return 15;
  return rank;
}

export function sortHand(cards: GdCard[], levelRank: number): GdCard[] {
  return [...cards].sort((left, right) => {
    const powerDiff = rankPower(right.rank, levelRank) - rankPower(left.rank, levelRank);
    if (powerDiff !== 0) return powerDiff;
    if (right.rank !== left.rank) return right.rank - left.rank;
    return left.code.localeCompare(right.code);
  });
}

export function nextLevelRank(rank: number, delta: number): number {
  const index = GUANDAN_LEVEL_SEQUENCE.indexOf(rank as (typeof GUANDAN_LEVEL_SEQUENCE)[number]);
  const safeIndex = index >= 0 ? index : 0;
  return GUANDAN_LEVEL_SEQUENCE[Math.min(GUANDAN_LEVEL_SEQUENCE.length - 1, safeIndex + delta)];
}

export function levelLabel(levels: GdTeamLevels, team: GdTeam): string {
  return guandanRankLabel(levels[team]);
}

export function createDoubleDeck(): GdCard[] {
  const cards: GdCard[] = [];
  for (let deckIndex = 0; deckIndex < 2; deckIndex += 1) {
    for (const rank of RANKS) {
      for (const { suit, glyph } of SUITS) {
        cards.push({
          id: `${deckIndex}-${suit}-${rank}`,
          deckIndex,
          suit,
          rank,
          code: `${suit[0].toUpperCase()}${rank}-${deckIndex}`,
          label: `${glyph}${guandanRankLabel(rank)}`,
          shortLabel: guandanRankLabel(rank),
        });
      }
    }

    cards.push({
      id: `${deckIndex}-joker-small`,
      deckIndex,
      suit: 'joker',
      rank: 16,
      code: `SJ-${deckIndex}`,
      label: '小王',
      shortLabel: '小王',
    });
    cards.push({
      id: `${deckIndex}-joker-big`,
      deckIndex,
      suit: 'joker',
      rank: 17,
      code: `BJ-${deckIndex}`,
      label: '大王',
      shortLabel: '大王',
    });
  }

  return cards;
}

export function shuffleDeck(cards: GdCard[], seed = Date.now()): GdCard[] {
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
