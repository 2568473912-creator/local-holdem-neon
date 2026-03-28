import { describe, expect, it } from 'vitest';
import { getTournamentPaidPlaces, getTournamentPrizeForRank, getTournamentPrizeLines } from '../src/engine/tournamentPrize';
import type { GameConfig } from '../src/types/game';
import {
  getNextTournamentLevel,
  getTournamentLevel,
  getTournamentStructure,
  getUpcomingTournamentLevels,
  maybeAdvanceTournamentLevel,
  syncTournamentConfig,
} from '../src/engine/tournamentStructure';

function makeConfig(overrides: Partial<GameConfig> = {}): GameConfig {
  return {
    mode: 'standard',
    sessionMode: 'tournament',
    aiCount: 5,
    startingChips: 5000,
    smallBlind: 20,
    bigBlind: 40,
    blindLevel: 1,
    blindUpEveryHands: 4,
    fastMode: false,
    aiDifficulty: 'standard',
    straddleMode: 'off',
    tournamentStructureId: 'standard',
    ...overrides,
  };
}

describe('tournament blind structures', () => {
  it('syncs tournament config to the chosen structure opening level', () => {
    const synced = syncTournamentConfig(makeConfig({ tournamentStructureId: 'turbo', blindLevel: 1, smallBlind: 50, bigBlind: 100 }));
    expect(synced.smallBlind).toBe(10);
    expect(synced.bigBlind).toBe(20);
  });

  it('advances to the next blind level only at the configured interval', () => {
    const base = syncTournamentConfig(makeConfig({ tournamentStructureId: 'deep', blindLevel: 3, blindUpEveryHands: 5 }));
    const stable = maybeAdvanceTournamentLevel(base, 4);
    expect(stable.upgraded).toBe(false);

    const advanced = maybeAdvanceTournamentLevel(base, 5);
    expect(advanced.upgraded).toBe(true);
    expect(advanced.nextConfig.blindLevel).toBe(4);
    expect(advanced.nextConfig.smallBlind).toBe(20);
    expect(advanced.nextConfig.bigBlind).toBe(40);
  });

  it('exposes the next level for HUD preview', () => {
    const current = syncTournamentConfig(makeConfig({ tournamentStructureId: 'standard', blindLevel: 4 }));
    const next = getNextTournamentLevel(current);
    expect(getTournamentLevel(current).ante).toBe(10);
    expect(next?.smallBlind).toBe(40);
    expect(next?.bigBlind).toBe(80);
  });

  it('provides named presets for menu selection', () => {
    expect(getTournamentStructure('standard').label).toBe('标准结构');
    expect(getTournamentStructure('turbo').levels.length).toBeGreaterThan(0);
    expect(getTournamentStructure('deep').levels.length).toBeGreaterThan(0);
  });

  it('returns a compact upcoming blind schedule for preview panels', () => {
    const current = syncTournamentConfig(makeConfig({ tournamentStructureId: 'turbo', blindLevel: 3 }));
    const levels = getUpcomingTournamentLevels(current, 4);
    expect(levels).toHaveLength(4);
    expect(levels[0]?.level).toBe(3);
    expect(levels[0]?.smallBlind).toBe(30);
    expect(levels[3]?.level).toBe(6);
  });
});

describe('tournament prize structure', () => {
  it('uses a top-three payout ladder for six-handed fields', () => {
    const lines = getTournamentPrizeLines(6);
    expect(lines.map((line) => line.percentage)).toEqual([55, 30, 15]);
    expect(getTournamentPaidPlaces(6)).toBe(3);
  });

  it('exposes prize lookup for a specific finishing rank', () => {
    const prize = getTournamentPrizeForRank(9, 2);
    expect(prize?.label).toBe('亚军');
    expect(prize?.percentage).toBe(30);
    expect(prize?.buyInMultiplier).toBe(2.7);
  });
});
