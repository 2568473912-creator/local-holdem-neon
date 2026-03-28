import { describe, expect, it } from 'vitest';
import { createDeck } from '../src/doudizhu/cards';
import { createDouDizhuSession, applyBid, playSelectedCards } from '../src/doudizhu/engine';
import { analyzePattern, canBeat, enumerateLegalPatterns, enumeratePatterns } from '../src/doudizhu/rules';

const deck = createDeck();
const cardByCode = new Map(deck.map((card) => [card.code, card]));

function cards(...codes: string[]) {
  return codes.map((code) => {
    const card = cardByCode.get(code);
    if (!card) {
      throw new Error(`Unknown card code: ${code}`);
    }
    return card;
  });
}

describe('doudizhu rules', () => {
  it('uses readable chinese labels for jokers', () => {
    expect(deck.find((card) => card.code === 'SJ')?.shortLabel).toBe('小王');
    expect(deck.find((card) => card.code === 'BJ')?.shortLabel).toBe('大王');
  });

  it('recognizes rocket and bomb priority', () => {
    const rocket = analyzePattern(cards('SJ', 'BJ'));
    const bomb = analyzePattern(cards('S7', 'H7', 'C7', 'D7'));
    const straight = analyzePattern(cards('S3', 'H4', 'C5', 'D6', 'S7'));

    expect(rocket?.type).toBe('rocket');
    expect(bomb?.type).toBe('bomb');
    expect(straight?.type).toBe('straight');
    expect(rocket && bomb ? canBeat(rocket, bomb) : false).toBe(true);
    expect(bomb && straight ? canBeat(bomb, straight) : false).toBe(true);
  });

  it('recognizes sequence and airplane patterns', () => {
    const straight = analyzePattern(cards('S3', 'H4', 'C5', 'D6', 'S7'));
    const pairStraight = analyzePattern(cards('S4', 'H4', 'S5', 'H5', 'S6', 'H6'));
    const airplaneSingles = analyzePattern(cards('S3', 'H3', 'C3', 'S4', 'H4', 'C4', 'S5', 'S6'));

    expect(straight?.type).toBe('straight');
    expect(pairStraight?.type).toBe('pairStraight');
    expect(airplaneSingles?.type).toBe('airplaneSingles');
    expect(airplaneSingles?.sequenceLength).toBe(2);
  });

  it('enumerates legal responses against the current lead', () => {
    const hand = cards('S4', 'H4', 'S5', 'H5', 'S8', 'H8', 'C8', 'D8', 'SJ', 'BJ');
    const lead = analyzePattern(cards('S4', 'H4'));
    const legal = enumerateLegalPatterns(hand, lead);

    expect(lead?.type).toBe('pair');
    expect(legal.some((pattern) => pattern.type === 'pair' && pattern.mainRank === 5)).toBe(true);
    expect(legal.some((pattern) => pattern.type === 'bomb')).toBe(true);
    expect(legal.some((pattern) => pattern.type === 'rocket')).toBe(true);
  });

  it('dedupes attachment hints for triple-based patterns', () => {
    const hand = cards('S3', 'H3', 'C3', 'S4', 'H4', 'S5', 'H6', 'C7');
    const patterns = enumeratePatterns(hand);
    const tripleSingle = patterns.find((pattern) => pattern.type === 'tripleSingle');
    const triplePair = patterns.find((pattern) => pattern.type === 'triplePair');

    expect(patterns.filter((pattern) => pattern.type === 'tripleSingle')).toHaveLength(1);
    expect(patterns.filter((pattern) => pattern.type === 'triplePair')).toHaveLength(1);
    expect(tripleSingle?.cards.filter((card) => card.rank === 4)).toHaveLength(1);
    expect(triplePair?.cards.filter((card) => card.rank === 4)).toHaveLength(2);
  });

  it('finalizes landlord after bidding resolves', () => {
    let runtime = createDouDizhuSession({ aiDifficulty: 'standard', autoNextRound: false });
    const firstPlayer = runtime.currentPlayerId;
    runtime = applyBid(runtime, firstPlayer, 2).runtime;
    runtime = applyBid(runtime, runtime.currentPlayerId, 0).runtime;
    runtime = applyBid(runtime, runtime.currentPlayerId, 0).runtime;

    expect(runtime.phase).toBe('playing');
    expect(runtime.landlordId).toBe(firstPlayer);
    expect(runtime.players.find((player) => player.id === firstPlayer)?.hand.length).toBe(20);
    expect(runtime.baseBid).toBe(2);
    expect(runtime.multiplierBreakdown.bid).toBe(2);
    expect(runtime.multiplierBreakdown.events[0]?.kind).toBe('bid');
    expect(runtime.multiplierBreakdown.finalMultiplier).toBe(2);
  });

  it('replays the same deal deterministically when a round seed is provided', () => {
    const left = createDouDizhuSession({ aiDifficulty: 'standard', autoNextRound: false }, { dealSeed: 246813579 });
    const right = createDouDizhuSession({ aiDifficulty: 'standard', autoNextRound: false }, { dealSeed: 246813579 });

    expect(left.dealSeed).toBe(246813579);
    expect(right.dealSeed).toBe(246813579);
    expect(left.bottomCards.map((card) => card.code)).toEqual(right.bottomCards.map((card) => card.code));
    expect(left.players.map((player) => player.hand.map((card) => card.code))).toEqual(right.players.map((player) => player.hand.map((card) => card.code)));
  });

  it('tracks bomb and spring inside multiplier breakdown', () => {
    let runtime = createDouDizhuSession({ aiDifficulty: 'standard', autoNextRound: false });
    runtime = {
      ...runtime,
      phase: 'playing',
      landlordId: 'P0',
      currentPlayerId: 'P0',
      baseBid: 1,
      multiplier: 1,
      multiplierBreakdown: {
        bid: 1,
        bombCount: 0,
        rocketCount: 0,
        springApplied: false,
        finalMultiplier: 1,
        events: [
          {
            kind: 'bid',
            label: '叫分 1',
            factor: 1,
            byPlayerId: 'P0',
            byPlayerName: '你',
            totalMultiplier: 1,
          },
        ],
      },
      players: runtime.players.map((player) => {
        if (player.id === 'P0') {
          return {
            ...player,
            role: 'landlord',
            hand: cards('S7', 'H7', 'C7', 'D7'),
          };
        }
        return {
          ...player,
          role: 'farmer',
          hand: cards('S3', 'H4', 'C5'),
        };
      }),
      selectedCardIds: cards('S7', 'H7', 'C7', 'D7').map((card) => card.id),
      tableDisplay: {
        playerId: null,
        pattern: null,
        cards: [],
      },
      lead: {
        pattern: null,
        playerId: null,
        passCount: 0,
      },
      springTriggered: false,
      landlordPlayCount: 0,
      farmerPlayCount: 0,
      winnerId: null,
      winningTeam: null,
    };

    const result = playSelectedCards(runtime, 'P0');
    expect(result.runtime.phase).toBe('settlement');
    expect(result.runtime.multiplier).toBe(4);
    expect(result.runtime.multiplierBreakdown.bombCount).toBe(1);
    expect(result.runtime.multiplierBreakdown.springApplied).toBe(true);
    expect(result.runtime.multiplierBreakdown.events.map((event) => event.kind)).toEqual(['bid', 'bomb', 'spring']);
    expect(result.roundCompleted?.heroDelta).toBe(8);
    expect(result.roundCompleted?.dealSeed).toBe(runtime.dealSeed);
    expect(result.roundCompleted?.landlordName).toBe('你');
    expect(result.roundCompleted?.winnerName).toBe('你');
    expect(result.roundCompleted?.players).toHaveLength(3);
    expect(result.roundCompleted?.players.find((player) => player.id === 'P0')?.winner).toBe(true);
  });
});
