import { describe, expect, it } from 'vitest';
import type { Card } from '../src/types/cards';
import { evaluateStandardHoldem, compareStandardHands } from '../src/engine/evaluators/standardEvaluator';
import { evaluateShortDeckHoldem, compareShortDeckHands } from '../src/engine/evaluators/shortDeckEvaluator';

function c(rank: number, suit: Card['suit']): Card {
  return { rank, suit, code: `${rank}-${suit[0]}` };
}

describe('Standard evaluator – hand categories', () => {
  it('straight flush', () => {
    const hand = evaluateStandardHoldem([c(9, 'hearts'), c(10, 'hearts'), c(11, 'hearts'), c(12, 'hearts'), c(13, 'hearts')]);
    expect(hand.category).toBe('straight_flush');
    expect(hand.tiebreaker[0]).toBe(13);
  });

  it('royal flush', () => {
    const hand = evaluateStandardHoldem([c(10, 'spades'), c(11, 'spades'), c(12, 'spades'), c(13, 'spades'), c(14, 'spades')]);
    expect(hand.category).toBe('straight_flush');
    expect(hand.tiebreaker[0]).toBe(14);
  });

  it('four of a kind', () => {
    const hand = evaluateStandardHoldem([c(8, 'spades'), c(8, 'hearts'), c(8, 'diamonds'), c(8, 'clubs'), c(14, 'spades')]);
    expect(hand.category).toBe('four_kind');
    expect(hand.tiebreaker[0]).toBe(8);
  });

  it('full house', () => {
    const hand = evaluateStandardHoldem([c(10, 'spades'), c(10, 'hearts'), c(10, 'diamonds'), c(7, 'clubs'), c(7, 'spades')]);
    expect(hand.category).toBe('full_house');
    expect(hand.tiebreaker[0]).toBe(10);
    expect(hand.tiebreaker[1]).toBe(7);
  });

  it('flush', () => {
    const hand = evaluateStandardHoldem([c(2, 'clubs'), c(5, 'clubs'), c(9, 'clubs'), c(11, 'clubs'), c(14, 'clubs')]);
    expect(hand.category).toBe('flush');
  });

  it('straight (Broadway A-K-Q-J-10)', () => {
    const hand = evaluateStandardHoldem([c(14, 'spades'), c(13, 'hearts'), c(12, 'diamonds'), c(11, 'clubs'), c(10, 'spades')]);
    expect(hand.category).toBe('straight');
    expect(hand.tiebreaker[0]).toBe(14);
  });

  it('straight (wheel A-2-3-4-5)', () => {
    const hand = evaluateStandardHoldem([c(14, 'spades'), c(2, 'hearts'), c(3, 'diamonds'), c(4, 'clubs'), c(5, 'spades')]);
    expect(hand.category).toBe('straight');
    expect(hand.tiebreaker[0]).toBe(5); // wheel ranks as 5-high
  });

  it('three of a kind', () => {
    const hand = evaluateStandardHoldem([c(6, 'spades'), c(6, 'hearts'), c(6, 'diamonds'), c(2, 'clubs'), c(9, 'spades')]);
    expect(hand.category).toBe('three_kind');
  });

  it('two pair', () => {
    const hand = evaluateStandardHoldem([c(10, 'spades'), c(10, 'hearts'), c(7, 'diamonds'), c(7, 'clubs'), c(14, 'spades')]);
    expect(hand.category).toBe('two_pair');
    expect(hand.tiebreaker[0]).toBe(10);
    expect(hand.tiebreaker[1]).toBe(7);
    expect(hand.tiebreaker[2]).toBe(14); // kicker
  });

  it('one pair', () => {
    const hand = evaluateStandardHoldem([c(9, 'spades'), c(9, 'hearts'), c(5, 'diamonds'), c(7, 'clubs'), c(14, 'spades')]);
    expect(hand.category).toBe('pair');
  });

  it('high card', () => {
    const hand = evaluateStandardHoldem([c(2, 'spades'), c(5, 'hearts'), c(7, 'diamonds'), c(9, 'clubs'), c(14, 'spades')]);
    expect(hand.category).toBe('high_card');
  });
});

describe('Standard evaluator – 7-card best hand selection', () => {
  it('picks best 5 from 7 cards (four of a kind from 4 matching cards)', () => {
    // hole: 10s 10c, board: 10h 10d 7c As Kh → four tens
    const cards = [c(10, 'spades'), c(10, 'clubs'), c(10, 'hearts'), c(10, 'diamonds'), c(7, 'clubs'), c(14, 'spades'), c(13, 'hearts')];
    const hand = evaluateStandardHoldem(cards);
    expect(hand.category).toBe('four_kind');
    expect(hand.tiebreaker[0]).toBe(10);
    expect(hand.tiebreaker[1]).toBe(14); // kicker is ace
  });

  it('wheel straight detectable in 7 cards', () => {
    // hole: As 2h, board: 3d 4c 5s Kh Qd
    const cards = [c(14, 'spades'), c(2, 'hearts'), c(3, 'diamonds'), c(4, 'clubs'), c(5, 'spades'), c(13, 'hearts'), c(12, 'diamonds')];
    const hand = evaluateStandardHoldem(cards);
    expect(hand.category).toBe('straight');
    expect(hand.tiebreaker[0]).toBe(5);
  });
});

describe('Standard evaluator – tiebreaker / kicker comparison', () => {
  it('same category, higher kicker wins', () => {
    const handA = evaluateStandardHoldem([c(9, 'spades'), c(9, 'hearts'), c(14, 'diamonds'), c(3, 'clubs'), c(2, 'spades')]);
    const handB = evaluateStandardHoldem([c(9, 'diamonds'), c(9, 'clubs'), c(13, 'hearts'), c(3, 'diamonds'), c(2, 'hearts')]);
    expect(handA.category).toBe('pair');
    expect(handB.category).toBe('pair');
    expect(compareStandardHands(handA, handB)).toBeGreaterThan(0); // A wins with ace kicker
  });

  it('identical hands are a tie (split pot)', () => {
    const handA = evaluateStandardHoldem([c(9, 'spades'), c(9, 'hearts'), c(14, 'diamonds'), c(3, 'clubs'), c(2, 'spades')]);
    const handB = evaluateStandardHoldem([c(9, 'diamonds'), c(9, 'clubs'), c(14, 'hearts'), c(3, 'diamonds'), c(2, 'hearts')]);
    expect(compareStandardHands(handA, handB)).toBe(0);
  });

  it('straight flush beats four of a kind', () => {
    const sf = evaluateStandardHoldem([c(9, 'hearts'), c(10, 'hearts'), c(11, 'hearts'), c(12, 'hearts'), c(13, 'hearts')]);
    const quads = evaluateStandardHoldem([c(14, 'spades'), c(14, 'hearts'), c(14, 'diamonds'), c(14, 'clubs'), c(2, 'spades')]);
    expect(compareStandardHands(sf, quads)).toBeGreaterThan(0);
  });
});

describe('Short deck evaluator – rule differences', () => {
  it('A-6-7-8-9 is the lowest straight (short wheel)', () => {
    const hand = evaluateShortDeckHoldem([c(14, 'spades'), c(6, 'hearts'), c(7, 'diamonds'), c(8, 'clubs'), c(9, 'spades')]);
    expect(hand.category).toBe('straight');
    expect(hand.tiebreaker[0]).toBe(9); // short wheel ranks as 9-high
  });

  it('flush beats full house in short deck', () => {
    const flush = evaluateShortDeckHoldem([c(9, 'hearts'), c(11, 'hearts'), c(12, 'hearts'), c(13, 'hearts'), c(14, 'hearts')]);
    const fh = evaluateShortDeckHoldem([c(10, 'spades'), c(10, 'hearts'), c(10, 'diamonds'), c(7, 'clubs'), c(7, 'spades')]);
    expect(flush.category).toBe('flush');
    expect(fh.category).toBe('full_house');
    expect(compareShortDeckHands(flush, fh)).toBeGreaterThan(0);
  });

  it('three of a kind beats straight in short deck', () => {
    const trips = evaluateShortDeckHoldem([c(9, 'spades'), c(9, 'hearts'), c(9, 'diamonds'), c(6, 'clubs'), c(7, 'spades')]);
    const straight = evaluateShortDeckHoldem([c(9, 'spades'), c(10, 'hearts'), c(11, 'diamonds'), c(12, 'clubs'), c(13, 'spades')]);
    expect(trips.category).toBe('three_kind');
    expect(straight.category).toBe('straight');
    expect(compareShortDeckHands(trips, straight)).toBeGreaterThan(0);
  });

  it('four of a kind beats flush in short deck', () => {
    const quads = evaluateShortDeckHoldem([c(9, 'spades'), c(9, 'hearts'), c(9, 'diamonds'), c(9, 'clubs'), c(14, 'spades')]);
    const flush = evaluateShortDeckHoldem([c(6, 'hearts'), c(8, 'hearts'), c(10, 'hearts'), c(12, 'hearts'), c(14, 'hearts')]);
    expect(compareShortDeckHands(quads, flush)).toBeGreaterThan(0);
  });
});

describe('Standard evaluator – category ranking order', () => {
  const hands: Array<[string, ReturnType<typeof evaluateStandardHoldem>]> = [
    ['straight_flush', evaluateStandardHoldem([c(9, 'clubs'), c(10, 'clubs'), c(11, 'clubs'), c(12, 'clubs'), c(13, 'clubs')])],
    ['four_kind', evaluateStandardHoldem([c(8, 'spades'), c(8, 'hearts'), c(8, 'diamonds'), c(8, 'clubs'), c(2, 'spades')])],
    ['full_house', evaluateStandardHoldem([c(7, 'spades'), c(7, 'hearts'), c(7, 'diamonds'), c(6, 'clubs'), c(6, 'spades')])],
    ['flush', evaluateStandardHoldem([c(2, 'diamonds'), c(5, 'diamonds'), c(8, 'diamonds'), c(11, 'diamonds'), c(14, 'diamonds')])],
    ['straight', evaluateStandardHoldem([c(7, 'spades'), c(8, 'hearts'), c(9, 'diamonds'), c(10, 'clubs'), c(11, 'spades')])],
    ['three_kind', evaluateStandardHoldem([c(6, 'spades'), c(6, 'hearts'), c(6, 'diamonds'), c(3, 'clubs'), c(4, 'spades')])],
    ['two_pair', evaluateStandardHoldem([c(5, 'spades'), c(5, 'hearts'), c(4, 'diamonds'), c(4, 'clubs'), c(2, 'spades')])],
    ['pair', evaluateStandardHoldem([c(3, 'spades'), c(3, 'hearts'), c(5, 'diamonds'), c(7, 'clubs'), c(9, 'spades')])],
    ['high_card', evaluateStandardHoldem([c(2, 'spades'), c(4, 'hearts'), c(6, 'diamonds'), c(8, 'clubs'), c(14, 'spades')])],
  ];

  it('all categories are ranked correctly top to bottom', () => {
    for (let i = 0; i < hands.length - 1; i++) {
      const [nameA, a] = hands[i];
      const [nameB, b] = hands[i + 1];
      expect(compareStandardHands(a, b), `${nameA} should beat ${nameB}`).toBeGreaterThan(0);
    }
  });
});
