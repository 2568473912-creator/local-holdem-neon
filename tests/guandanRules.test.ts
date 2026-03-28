import { describe, expect, it } from 'vitest';
import { createDoubleDeck, rankPower } from '../src/guandan/cards';
import { analyzePattern, canBeat, legalPatternsForHand } from '../src/guandan/rules';

const deck = createDoubleDeck();
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

describe('guandan rules', () => {
  it('promotes the level rank above aces for comparisons', () => {
    const levelRank = 3;
    const levelSingle = analyzePattern(cards('S3-0'), levelRank);
    const aceSingle = analyzePattern(cards('S14-0'), levelRank);

    expect(rankPower(3, levelRank)).toBeGreaterThan(rankPower(14, levelRank));
    expect(levelSingle && aceSingle ? canBeat(levelSingle, aceSingle) : false).toBe(true);
  });

  it('recognizes core guandan patterns', () => {
    const pairStraight = analyzePattern(cards('S4-0', 'H4-0', 'S5-0', 'H5-0', 'S6-0', 'H6-0'), 6);
    const tripleStraight = analyzePattern(cards('S7-0', 'H7-0', 'C7-0', 'S8-0', 'H8-0', 'C8-0'), 6);
    const fullHouse = analyzePattern(cards('S9-0', 'H9-0', 'C9-0', 'S10-0', 'H10-0'), 6);
    const straightFlush = analyzePattern(cards('H6-0', 'H7-0', 'H8-0', 'H9-0', 'H10-0'), 6);
    const bomb = analyzePattern(cards('S11-0', 'H11-0', 'C11-0', 'D11-0'), 6);
    const jokerBomb = analyzePattern(cards('SJ-0', 'BJ-0', 'SJ-1', 'BJ-1'), 6);

    expect(pairStraight?.type).toBe('pairStraight');
    expect(pairStraight?.sequenceLength).toBe(3);
    expect(tripleStraight?.type).toBe('tripleStraight');
    expect(fullHouse?.type).toBe('fullHouse');
    expect(straightFlush?.type).toBe('straightFlush');
    expect(bomb?.type).toBe('bomb');
    expect(jokerBomb?.type).toBe('jokerBomb');
  });

  it('keeps bombs as legal answers over normal patterns', () => {
    const hand = cards('S3-0', 'H3-0', 'C3-0', 'D3-0', 'S5-0', 'H6-0', 'S7-0', 'H8-0', 'S9-0');
    const lead = analyzePattern(cards('H4-0', 'S5-1', 'H6-0', 'S7-1', 'H8-0'), 6);
    const legal = legalPatternsForHand(hand, 6, lead);

    expect(lead?.type).toBe('straight');
    expect(legal.some((pattern) => pattern.type === 'straight' && pattern.mainRank === 9)).toBe(true);
    expect(legal.some((pattern) => pattern.type === 'bomb')).toBe(true);
  });

  it('treats straight flush as a special bomb family pattern', () => {
    const straightFlush = analyzePattern(cards('H6-0', 'H7-0', 'H8-0', 'H9-0', 'H10-0'), 6);
    const fiveBomb = analyzePattern(cards('S11-0', 'H11-0', 'C11-0', 'D11-0', 'S11-1'), 6);
    const sixBomb = analyzePattern(cards('S12-0', 'H12-0', 'C12-0', 'D12-0', 'S12-1', 'H12-1'), 6);

    expect(straightFlush?.type).toBe('straightFlush');
    expect(fiveBomb?.type).toBe('bomb');
    expect(sixBomb?.type).toBe('bomb');
    expect(straightFlush && fiveBomb ? canBeat(straightFlush, fiveBomb) : false).toBe(true);
    expect(straightFlush && sixBomb ? canBeat(sixBomb, straightFlush) : false).toBe(true);
  });
});
