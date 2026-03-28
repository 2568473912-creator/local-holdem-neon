import { describe, expect, it } from 'vitest';
import type { SessionStats } from '../src/types/game';
import type { CareerProfile } from '../src/types/profile';
import { buildCareerSessionRecord, createEmptyCareerProfile, getTournamentPointReward, parseCareerProfileImport, recordCareerSession } from '../src/state/careerProfile';

function makeStats(overrides: Partial<SessionStats> = {}): SessionStats {
  return {
    totalHands: 12,
    wins: 4,
    winRate: 33.3,
    totalProfit: 680,
    maxSinglePotWin: 240,
    ...overrides,
  };
}

function makeRuntime() {
  return {
    table: {
      config: {
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
      },
      players: [
        { id: 'P0', isHuman: true, stack: 4200, eliminated: false, seat: 0 },
        { id: 'P1', isHuman: false, stack: 0, eliminated: true, seat: 1 },
        { id: 'P2', isHuman: false, stack: 0, eliminated: true, seat: 2 },
        { id: 'P3', isHuman: false, stack: 0, eliminated: true, seat: 3 },
      ],
    },
  } as never;
}

describe('career profile aggregation', () => {
  it('builds a tournament record with finish metadata', () => {
    const record = buildCareerSessionRecord({
      sessionId: 'session-1',
      runtime: makeRuntime(),
      history: [{ handId: 1 }] as never,
      stats: makeStats(),
      endReason: 'completed',
    });

    expect(record?.finalRank).toBe(1);
    expect(record?.champion).toBe(true);
    expect(record?.inMoney).toBe(true);
    expect(record?.tournamentPointsEarned).toBeGreaterThan(0);
  });

  it('records a session only once and updates aggregates', () => {
    const profile: CareerProfile = createEmptyCareerProfile();
    const record = buildCareerSessionRecord({
      sessionId: 'session-2',
      runtime: makeRuntime(),
      history: [{ handId: 1 }] as never,
      stats: makeStats({ totalProfit: 900 }),
      endReason: 'completed',
    });

    expect(record).not.toBeNull();
    const next = recordCareerSession(profile, record!);
    const duplicate = recordCareerSession(next, record!);

    expect(next.totalSessions).toBe(1);
    expect(next.tournamentTitles).toBe(1);
    expect(next.bestFinish).toBe(1);
    expect(next.totalProfit).toBe(900);
    expect(next.tournamentPointsEarned).toBe(record?.tournamentPointsEarned);
    expect(next.modeBreakdown.standard.sessions).toBe(1);
    expect(next.modeBreakdown.standard.hands).toBe(12);
    expect(next.modeBreakdown.standard.profit).toBe(900);
    expect(next.modeBreakdown.standard.titles).toBe(1);
    expect(next.modeBreakdown.standard.itmFinishes).toBe(1);
    expect(duplicate.totalSessions).toBe(1);
  });

  it('parses exported career profile payloads', () => {
    const profile = createEmptyCareerProfile();
    profile.totalSessions = 3;
    profile.totalHands = 44;
    profile.totalProfit = 520;
    profile.tournamentPointsEarned = 330;
    profile.cashSessions = 2;
    profile.tournamentSessions = 1;
    profile.modeBreakdown.standard.sessions = 2;

    const parsed = parseCareerProfileImport(
      JSON.stringify({
        exportedAt: new Date().toISOString(),
        profile,
      }),
    );

    expect(parsed.error).toBeUndefined();
    expect(parsed.result?.profile.totalSessions).toBe(3);
    expect(parsed.result?.profile.totalHands).toBe(44);
    expect(parsed.result?.profile.tournamentPointsEarned).toBe(330);
    expect(parsed.result?.profile.modeBreakdown.standard.sessions).toBe(2);
  });

  it('rejects invalid import payloads', () => {
    const parsed = parseCareerProfileImport('{"bad":true}');
    expect(parsed.result).toBeUndefined();
    expect(parsed.error).toContain('导入失败');
  });

  it('awards more tournament points for deeper runs and harder fields', () => {
    const bustReward = getTournamentPointReward({
      sessionMode: 'tournament',
      aiDifficulty: 'conservative',
      fieldSize: 6,
      handsPlayed: 8,
      finalRank: 6,
      inMoney: false,
      champion: false,
    });
    const championReward = getTournamentPointReward({
      sessionMode: 'tournament',
      aiDifficulty: 'aggressive',
      fieldSize: 6,
      handsPlayed: 12,
      finalRank: 1,
      inMoney: true,
      champion: true,
    });

    expect(championReward).toBeGreaterThan(bustReward);
    expect(getTournamentPointReward({
      sessionMode: 'cash',
      aiDifficulty: 'standard',
      fieldSize: 6,
      handsPlayed: 10,
      finalRank: null,
      inMoney: false,
      champion: false,
    })).toBe(0);
  });
});
