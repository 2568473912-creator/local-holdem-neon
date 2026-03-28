import { describe, expect, it } from 'vitest';
import { createDoubleDeck } from '../src/guandan/cards';
import { createGuandanSession, cycleHint, playSelectedCards } from '../src/guandan/engine';
import { analyzePattern } from '../src/guandan/rules';

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

describe('guandan engine', () => {
  it('deals a 27-card hand to each player', () => {
    const runtime = createGuandanSession({ aiDifficulty: 'standard', autoNextRound: false });
    expect(runtime.players).toHaveLength(4);
    expect(runtime.players.every((player) => player.hand.length === 27)).toBe(true);
  });

  it('replays the same guandan deal deterministically when a round seed is provided', () => {
    const left = createGuandanSession({ aiDifficulty: 'standard', autoNextRound: false }, { dealSeed: 97531 });
    const right = createGuandanSession({ aiDifficulty: 'standard', autoNextRound: false }, { dealSeed: 97531 });

    expect(left.dealSeed).toBe(97531);
    expect(right.dealSeed).toBe(97531);
    expect(left.players.map((player) => player.hand.map((card) => card.code))).toEqual(right.players.map((player) => player.hand.map((card) => card.code)));
  });

  it('hint selects a legal response for the human seat', () => {
    let runtime = createGuandanSession({ aiDifficulty: 'standard', autoNextRound: false });
    runtime = {
      ...runtime,
      currentPlayerId: 'P0',
      trick: {
        pattern: analyzePattern(cards('S6-1'), runtime.teamLevels.alpha),
        playerId: 'P1',
        passCount: 0,
      },
      tableDisplay: {
        playerId: 'P1',
        pattern: analyzePattern(cards('S6-1'), runtime.teamLevels.alpha),
        cards: cards('S6-1'),
      },
      players: runtime.players.map((player) => {
        if (player.id === 'P0') {
          return {
            ...player,
            hand: cards('S7-0', 'H7-0', 'S8-0', 'S9-0'),
          };
        }
        return player;
      }),
      selectedCardIds: [],
    };

    const result = cycleHint(runtime);
    expect(result.runtime.selectedCardIds.length).toBeGreaterThan(0);
    expect(result.runtime.banner).toContain('提示');
  });

  it('settles the round and upgrades the winning team level when the final card is played', () => {
    let runtime = createGuandanSession({ aiDifficulty: 'standard', autoNextRound: false });
    runtime = {
      ...runtime,
      currentPlayerId: 'P0',
      startingPlayerId: 'P0',
      teamLevels: {
        alpha: 3,
        beta: 2,
      },
      trick: {
        pattern: null,
        playerId: null,
        passCount: 0,
      },
      tableDisplay: {
        playerId: null,
        pattern: null,
        cards: [],
      },
      finishOrder: [],
      selectedCardIds: cards('S3-0').map((card) => card.id),
      players: runtime.players.map((player) => {
        if (player.id === 'P0') {
          return {
            ...player,
            hand: cards('S3-0'),
          };
        }
        return {
          ...player,
          hand: [],
        };
      }),
    };

    const result = playSelectedCards(runtime, 'P0');
    expect(result.runtime.phase).toBe('settlement');
    expect(result.runtime.winnerTeam).toBe('alpha');
    expect(result.runtime.victoryType).toBe('singleDown');
    expect(result.runtime.victoryLabel).toBe('我方单下');
    expect(result.runtime.teamLevels.alpha).toBe(5);
    expect(result.roundCompleted?.dealSeed).toBe(runtime.dealSeed);
    expect(result.roundCompleted?.levelDelta).toBe(2);
    expect(result.roundCompleted?.victoryType).toBe('singleDown');
    expect(result.roundCompleted?.specials.some((entry) => entry.kind === 'singleDown')).toBe(true);
  });
});
