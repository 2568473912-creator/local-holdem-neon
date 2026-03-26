import type { Card, DeckRule, GameMode, Suit } from '../types/cards';

const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];

export function getDeckRule(mode: GameMode): DeckRule {
  if (mode === 'shortDeck') {
    return {
      mode,
      allowedRanks: [6, 7, 8, 9, 10, 11, 12, 13, 14],
    };
  }

  return {
    mode,
    allowedRanks: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
  };
}

export function createDeck(mode: GameMode): Card[] {
  const rule = getDeckRule(mode);
  const deck: Card[] = [];

  for (const rank of rule.allowedRanks) {
    for (const suit of SUITS) {
      const code = `${rank}-${suit[0]}`;
      deck.push({ rank, suit, code });
    }
  }

  return deck;
}

export function shuffleDeck(cards: Card[]): Card[] {
  const deck = [...cards];
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function drawCards(deck: Card[], count: number): { cards: Card[]; deck: Card[] } {
  if (deck.length < count) {
    throw new Error(`drawCards: requested ${count} cards but only ${deck.length} remain in deck`);
  }
  const drawn = deck.slice(0, count);
  const rest = deck.slice(count);
  return { cards: drawn, deck: rest };
}

export function sortRanksDesc(cards: Card[]): number[] {
  return [...cards].map((c) => c.rank).sort((a, b) => b - a);
}
