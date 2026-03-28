export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';

export type GameMode = 'standard' | 'shortDeck' | 'omaha' | 'plo' | 'stud';

export interface Card {
  suit: Suit;
  rank: number;
  code: string;
}

export interface DeckRule {
  mode: GameMode;
  allowedRanks: number[];
}

export const SUIT_SYMBOL: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

export const SUIT_COLOR: Record<Suit, 'red' | 'black'> = {
  spades: 'black',
  hearts: 'red',
  diamonds: 'red',
  clubs: 'black',
};

export const RANK_LABEL: Record<number, string> = {
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'A',
};

export function formatCard(card: Card): string {
  return `${RANK_LABEL[card.rank]}${SUIT_SYMBOL[card.suit]}`;
}
