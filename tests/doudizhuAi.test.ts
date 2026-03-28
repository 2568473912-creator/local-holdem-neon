import { describe, expect, it } from 'vitest';
import { createDeck } from '../src/doudizhu/cards';
import { chooseBid } from '../src/doudizhu/ai';
import { createDouDizhuSession, runAutoPlayerAction } from '../src/doudizhu/engine';
import type { DdzPlayerState } from '../src/doudizhu/types';

const deck = createDeck();
const cardByCode = new Map(deck.map((card) => [card.code, card]));

function hand(...codes: string[]) {
  return codes.map((code) => cardByCode.get(code)!).filter(Boolean);
}

function makePlayer(cards: ReturnType<typeof hand>): DdzPlayerState {
  return {
    id: 'P1',
    name: '测试 AI',
    seat: 1,
    isHuman: false,
    style: 'aggressive',
    role: 'undecided',
    hand: cards,
    score: 0,
    wins: 0,
    bid: null,
    lastAction: '等待',
    lastPlayedCards: [],
    passed: false,
  };
}

describe('doudizhu ai', () => {
  it('calls high on a strong landlord candidate hand', () => {
    const player = makePlayer(hand('SJ', 'BJ', 'S15', 'H15', 'C15', 'D15', 'S14', 'H14', 'S13', 'H13', 'S12', 'H12', 'S11', 'H11', 'S10', 'H10', 'C10'));
    expect(chooseBid(player, 'standard')).toBe(3);
  });

  it('passes weak hands more often in conservative mode', () => {
    const player = makePlayer(hand('S3', 'H4', 'C5', 'D6', 'S7', 'H8', 'C9', 'D10', 'S11', 'H12', 'C13', 'D14', 'S4', 'H6', 'C7', 'D8', 'S9'));
    expect(chooseBid(player, 'conservative')).toBe(0);
  });

  it('auto plays the human seat into settlement when a finishing move exists', () => {
    let runtime = createDouDizhuSession({ aiDifficulty: 'standard', autoNextRound: false });
    runtime = {
      ...runtime,
      phase: 'playing',
      landlordId: 'P0',
      currentPlayerId: 'P0',
      baseBid: 2,
      multiplier: 2,
      multiplierBreakdown: {
        bid: 2,
        bombCount: 0,
        rocketCount: 0,
        springApplied: false,
        finalMultiplier: 2,
        events: [
          {
            kind: 'bid',
            label: '叫分 2',
            factor: 2,
            byPlayerId: 'P0',
            byPlayerName: '你',
            totalMultiplier: 2,
          },
        ],
      },
      players: runtime.players.map((player) => {
        if (player.id === 'P0') {
          return {
            ...player,
            role: 'landlord',
            hand: hand('S10'),
          };
        }
        return {
          ...player,
          role: 'farmer',
          hand: hand('S3', 'H3', 'C4'),
        };
      }),
      lead: {
        pattern: null,
        playerId: null,
        passCount: 0,
      },
      tableDisplay: {
        playerId: null,
        pattern: null,
        cards: [],
      },
      winnerId: null,
      winningTeam: null,
      springTriggered: false,
      landlordPlayCount: 0,
      farmerPlayCount: 0,
      selectedCardIds: [],
    };

    const result = runAutoPlayerAction(runtime, 'P0');
    expect(result.runtime.phase).toBe('settlement');
    expect(result.runtime.winnerId).toBe('P0');
    expect(result.runtime.multiplierBreakdown.events.map((event) => event.kind)).toEqual(['bid', 'spring']);
  });
});
