import { describe, expect, it } from 'vitest';
import { analyzeTournamentPressure } from '../src/engine/tournamentPressure';
import type { GameConfig, PlayerState } from '../src/types/game';

function makeConfig(overrides: Partial<GameConfig> = {}): GameConfig {
  return {
    mode: 'standard',
    sessionMode: 'tournament',
    aiCount: 5,
    startingChips: 5000,
    smallBlind: 80,
    bigBlind: 160,
    blindLevel: 7,
    blindUpEveryHands: 5,
    fastMode: false,
    aiDifficulty: 'standard',
    straddleMode: 'off',
    tournamentStructureId: 'turbo',
    ...overrides,
  };
}

function makePlayer(overrides: Partial<PlayerState>): PlayerState {
  return {
    id: overrides.id ?? 'P0',
    name: overrides.name ?? '玩家',
    seat: overrides.seat ?? 0,
    isHuman: overrides.isHuman ?? false,
    style: overrides.style ?? 'balanced',
    stack: overrides.stack ?? 1000,
    holeCards: overrides.holeCards ?? [],
    folded: overrides.folded ?? false,
    allIn: overrides.allIn ?? false,
    eliminated: overrides.eliminated ?? false,
    currentBet: overrides.currentBet ?? 0,
    committed: overrides.committed ?? 0,
    actedThisStreet: overrides.actedThisStreet ?? false,
    lastAction: overrides.lastAction ?? '',
    revealed: overrides.revealed ?? false,
  };
}

describe('tournament pressure analysis', () => {
  it('flags short stacks near the bubble as high pressure', () => {
    const report = analyzeTournamentPressure(makeConfig(), [
      makePlayer({ id: 'P0', isHuman: true, stack: 620 }),
      makePlayer({ id: 'P1', stack: 2200 }),
      makePlayer({ id: 'P2', stack: 1800 }),
      makePlayer({ id: 'P3', stack: 1100 }),
      makePlayer({ id: 'P4', stack: 900 }),
      makePlayer({ id: 'P5', stack: 500, eliminated: true }),
    ]);

    expect(report.heroRank).toBe(5);
    expect(report.paidPlaces).toBe(3);
    expect(report.zone).toBe('critical');
    expect(report.bubbleState).toBe('nearBubble');
    expect(report.recommendation).toContain('短');
  });

  it('marks big stacks in the money as comfortable', () => {
    const report = analyzeTournamentPressure(makeConfig({ blindLevel: 3, smallBlind: 30, bigBlind: 60 }), [
      makePlayer({ id: 'P0', isHuman: true, stack: 4200 }),
      makePlayer({ id: 'P1', stack: 1900 }),
      makePlayer({ id: 'P2', stack: 1300 }),
      makePlayer({ id: 'P3', stack: 0, eliminated: true }),
    ]);

    expect(report.heroRank).toBe(1);
    expect(report.bubbleState).toBe('inMoney');
    expect(report.zone).toBe('comfortable');
    expect(report.heroBigBlinds).toBeGreaterThan(60);
  });
});
