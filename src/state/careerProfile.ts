import { getTournamentPaidPlaces } from '../engine/tournamentPrize';
import type { HandRuntime } from '../engine/handEngine';
import type { AIDifficulty, SessionMode, SessionStats } from '../types/game';
import type { CareerModeAggregate, CareerModeBreakdown, CareerProfile, CareerSessionEndReason, CareerSessionRecord } from '../types/profile';
import type { HandHistoryRecord } from '../types/replay';

export const CAREER_PROFILE_STORAGE_KEY = 'neon.holdem.career.v1';
const MAX_RECENT_SESSIONS = 20;
const MAX_RECORDED_SESSION_IDS = 120;
const CAREER_MODES = ['standard', 'shortDeck', 'omaha', 'plo', 'stud'] as const;
const SESSION_MODES = ['cash', 'tournament'] as const satisfies readonly SessionMode[];
const AI_DIFFICULTIES = ['conservative', 'standard', 'aggressive'] as const satisfies readonly AIDifficulty[];

interface CareerImportPayload {
  exportedAt?: string;
  profile?: unknown;
}

export interface CareerProfileImportResult {
  profile: CareerProfile;
  warning?: string;
}

function createModeAggregate(mode: CareerModeAggregate['mode']): CareerModeAggregate {
  return {
    mode,
    sessions: 0,
    hands: 0,
    profit: 0,
    titles: 0,
    itmFinishes: 0,
  };
}

export function createEmptyCareerModeBreakdown(): CareerModeBreakdown {
  return {
    standard: createModeAggregate('standard'),
    shortDeck: createModeAggregate('shortDeck'),
    omaha: createModeAggregate('omaha'),
    plo: createModeAggregate('plo'),
    stud: createModeAggregate('stud'),
  };
}

export function createEmptyCareerProfile(): CareerProfile {
  return {
    version: 1,
    totalSessions: 0,
    totalHands: 0,
    totalProfit: 0,
    tournamentPointsEarned: 0,
    biggestSessionWin: 0,
    biggestSessionLoss: 0,
    cashSessions: 0,
    tournamentSessions: 0,
    tournamentTitles: 0,
    itmFinishes: 0,
    bestFinish: null,
    averageFinish: null,
    lastUpdatedAt: 0,
    modeBreakdown: createEmptyCareerModeBreakdown(),
    recentSessions: [],
    recordedSessionIds: [],
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isValidMode(value: unknown): value is CareerSessionRecord['mode'] {
  return typeof value === 'string' && CAREER_MODES.includes(value as CareerSessionRecord['mode']);
}

function isValidSessionMode(value: unknown): value is SessionMode {
  return typeof value === 'string' && SESSION_MODES.includes(value as SessionMode);
}

function isValidDifficulty(value: unknown): value is AIDifficulty {
  return typeof value === 'string' && AI_DIFFICULTIES.includes(value as AIDifficulty);
}

function normalizePositiveInteger(value: unknown, fallback = 0): number {
  return isFiniteNumber(value) ? Math.max(0, Math.round(value)) : fallback;
}

function parseCareerSessionRecord(value: unknown): CareerSessionRecord | null {
  if (!isObject(value)) {
    return null;
  }

  const finalRank = value.finalRank === null ? null : normalizePositiveInteger(value.finalRank, 0);
  if (!isValidMode(value.mode) || !isValidSessionMode(value.sessionMode) || !isValidDifficulty(value.aiDifficulty)) {
    return null;
  }
  if (typeof value.sessionId !== 'string' || value.sessionId.trim().length === 0) {
    return null;
  }
  if (typeof value.endReason !== 'string' || (value.endReason !== 'completed' && value.endReason !== 'replaced')) {
    return null;
  }
  if (
    !isFiniteNumber(value.completedAt) ||
    !isFiniteNumber(value.totalProfit) ||
    !isFiniteNumber(value.tournamentPointsEarned) ||
    !isFiniteNumber(value.heroFinalStack) ||
    typeof value.inMoney !== 'boolean' ||
    typeof value.champion !== 'boolean'
  ) {
    return null;
  }

  return {
    sessionId: value.sessionId,
    completedAt: value.completedAt,
    mode: value.mode,
    sessionMode: value.sessionMode,
    aiDifficulty: value.aiDifficulty,
    handsPlayed: normalizePositiveInteger(value.handsPlayed),
    totalProfit: value.totalProfit,
    tournamentPointsEarned: normalizePositiveInteger(value.tournamentPointsEarned),
    heroFinalStack: value.heroFinalStack,
    fieldSize: Math.max(2, normalizePositiveInteger(value.fieldSize, 2)),
    finalRank,
    inMoney: value.inMoney,
    champion: value.champion,
    endReason: value.endReason,
  };
}

function normalizeModeBreakdown(value: unknown): { breakdown: CareerModeBreakdown; complete: boolean } {
  const fallback = createEmptyCareerModeBreakdown();
  if (!isObject(value)) {
    return {
      breakdown: fallback,
      complete: false,
    };
  }

  let complete = true;
  const entries = CAREER_MODES.map((mode) => {
    const candidate = value[mode];
    if (!isObject(candidate)) {
      complete = false;
      return [mode, fallback[mode]] as const;
    }

    return [
      mode,
      {
        mode,
        sessions: normalizePositiveInteger(candidate.sessions),
        hands: normalizePositiveInteger(candidate.hands),
        profit: isFiniteNumber(candidate.profit) ? candidate.profit : 0,
        titles: normalizePositiveInteger(candidate.titles),
        itmFinishes: normalizePositiveInteger(candidate.itmFinishes),
      },
    ] as const;
  });

  return {
    breakdown: Object.fromEntries(entries) as CareerModeBreakdown,
    complete,
  };
}

function normalizeCareerProfile(input: unknown): CareerProfileImportResult | null {
  if (!isObject(input) || input.version !== 1) {
    return null;
  }

  const recentSessions = Array.isArray(input.recentSessions)
    ? input.recentSessions.map((entry) => parseCareerSessionRecord(entry)).filter((entry): entry is CareerSessionRecord => Boolean(entry))
    : [];
  const recordedSessionIds = Array.isArray(input.recordedSessionIds)
    ? [...new Set(input.recordedSessionIds.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0))].slice(
        0,
        MAX_RECORDED_SESSION_IDS,
      )
    : [];
  const modeBreakdown = normalizeModeBreakdown(input.modeBreakdown);

  return {
    profile: {
      version: 1,
      totalSessions: normalizePositiveInteger(input.totalSessions),
      totalHands: normalizePositiveInteger(input.totalHands),
      totalProfit: isFiniteNumber(input.totalProfit) ? input.totalProfit : 0,
      tournamentPointsEarned: normalizePositiveInteger(input.tournamentPointsEarned),
      biggestSessionWin: isFiniteNumber(input.biggestSessionWin) ? input.biggestSessionWin : 0,
      biggestSessionLoss: isFiniteNumber(input.biggestSessionLoss) ? input.biggestSessionLoss : 0,
      cashSessions: normalizePositiveInteger(input.cashSessions),
      tournamentSessions: normalizePositiveInteger(input.tournamentSessions),
      tournamentTitles: normalizePositiveInteger(input.tournamentTitles),
      itmFinishes: normalizePositiveInteger(input.itmFinishes),
      bestFinish: input.bestFinish === null ? null : normalizePositiveInteger(input.bestFinish, 0) || null,
      averageFinish: isFiniteNumber(input.averageFinish) ? input.averageFinish : null,
      lastUpdatedAt: isFiniteNumber(input.lastUpdatedAt) ? input.lastUpdatedAt : Date.now(),
      modeBreakdown: modeBreakdown.breakdown,
      recentSessions: recentSessions.slice(0, MAX_RECENT_SESSIONS),
      recordedSessionIds,
    },
    warning: modeBreakdown.complete ? undefined : '导入的旧档案缺少部分玩法拆分统计，已按兼容模式载入。',
  };
}

function buildStandings(players: HandRuntime['table']['players']) {
  return [...players]
    .sort((a, b) => {
      if (a.eliminated !== b.eliminated) {
        return a.eliminated ? 1 : -1;
      }
      if (b.stack !== a.stack) {
        return b.stack - a.stack;
      }
      return a.seat - b.seat;
    })
    .map((player, index) => ({
      id: player.id,
      rank: index + 1,
    }));
}

export function getTournamentPointReward(input: {
  sessionMode: SessionMode;
  aiDifficulty: AIDifficulty;
  fieldSize: number;
  handsPlayed: number;
  finalRank: number | null;
  inMoney: boolean;
  champion: boolean;
}): number {
  if (input.sessionMode !== 'tournament') {
    return 0;
  }

  const basePoints = 50;
  const fieldBonus = Math.max(0, input.fieldSize - 2) * 6;
  const handsBonus = Math.min(36, Math.max(0, input.handsPlayed) * 2);
  const difficultyBonus = input.aiDifficulty === 'aggressive' ? 30 : input.aiDifficulty === 'standard' ? 15 : 5;
  const finishBonus = input.champion
    ? 180
    : input.finalRank === 2
      ? 120
      : input.finalRank === 3
        ? 90
        : input.inMoney
          ? 60
          : input.finalRank !== null && input.finalRank <= Math.max(2, Math.ceil(input.fieldSize / 2))
            ? 25
            : 0;

  return basePoints + fieldBonus + handsBonus + difficultyBonus + finishBonus;
}

export function buildCareerSessionRecord(input: {
  sessionId: string;
  runtime: HandRuntime;
  history: HandHistoryRecord[];
  stats: SessionStats;
  endReason: CareerSessionEndReason;
}): CareerSessionRecord | null {
  const { sessionId, runtime, history, stats, endReason } = input;
  if (!sessionId || history.length === 0) {
    return null;
  }

  const hero = runtime.table.players.find((player) => player.isHuman);
  if (!hero) {
    return null;
  }

  const standings = buildStandings(runtime.table.players);
  const heroRank = standings.find((entry) => entry.id === hero.id)?.rank ?? null;
  const fieldSize = runtime.table.players.length;
  const paidPlaces = runtime.table.config.sessionMode === 'tournament' ? getTournamentPaidPlaces(fieldSize) : 0;
  const inMoney = runtime.table.config.sessionMode === 'tournament' ? heroRank !== null && heroRank <= paidPlaces : stats.totalProfit > 0;
  const champion = runtime.table.config.sessionMode === 'tournament' ? heroRank === 1 : stats.totalProfit > 0;

  return {
    sessionId,
    completedAt: Date.now(),
    mode: runtime.table.config.mode,
    sessionMode: runtime.table.config.sessionMode,
    aiDifficulty: runtime.table.config.aiDifficulty,
    handsPlayed: stats.totalHands,
    totalProfit: stats.totalProfit,
    heroFinalStack: hero.stack,
    fieldSize,
    finalRank: runtime.table.config.sessionMode === 'tournament' ? heroRank : null,
    inMoney,
    champion,
    tournamentPointsEarned: getTournamentPointReward({
      sessionMode: runtime.table.config.sessionMode,
      aiDifficulty: runtime.table.config.aiDifficulty,
      fieldSize,
      handsPlayed: stats.totalHands,
      finalRank: runtime.table.config.sessionMode === 'tournament' ? heroRank : null,
      inMoney,
      champion,
    }),
    endReason,
  };
}

export function recordCareerSession(profile: CareerProfile, session: CareerSessionRecord): CareerProfile {
  if (profile.recordedSessionIds.includes(session.sessionId)) {
    return profile;
  }

  const tournamentSessions = session.sessionMode === 'tournament' ? profile.tournamentSessions + 1 : profile.tournamentSessions;
  const cashSessions = session.sessionMode === 'cash' ? profile.cashSessions + 1 : profile.cashSessions;
  const tournamentTitles = session.champion && session.sessionMode === 'tournament' ? profile.tournamentTitles + 1 : profile.tournamentTitles;
  const itmFinishes = session.inMoney && session.sessionMode === 'tournament' ? profile.itmFinishes + 1 : profile.itmFinishes;

  const tournamentFinishRecords = [
    ...profile.recentSessions.filter((entry) => entry.sessionMode === 'tournament'),
    ...(session.sessionMode === 'tournament' ? [session] : []),
  ]
    .map((entry) => entry.finalRank)
    .filter((rank): rank is number => typeof rank === 'number' && Number.isFinite(rank));

  const bestFinish =
    tournamentFinishRecords.length > 0
      ? Math.min(...tournamentFinishRecords)
      : profile.bestFinish;
  const averageFinish =
    tournamentFinishRecords.length > 0
      ? Number((tournamentFinishRecords.reduce((sum, rank) => sum + rank, 0) / tournamentFinishRecords.length).toFixed(2))
      : profile.averageFinish;
  const currentMode = profile.modeBreakdown[session.mode] ?? createModeAggregate(session.mode);
  const modeBreakdown: CareerModeBreakdown = {
    ...profile.modeBreakdown,
    [session.mode]: {
      ...currentMode,
      sessions: currentMode.sessions + 1,
      hands: currentMode.hands + session.handsPlayed,
      profit: currentMode.profit + session.totalProfit,
      titles: currentMode.titles + (session.champion && session.sessionMode === 'tournament' ? 1 : 0),
      itmFinishes: currentMode.itmFinishes + (session.inMoney && session.sessionMode === 'tournament' ? 1 : 0),
    },
  };

  return {
    ...profile,
    totalSessions: profile.totalSessions + 1,
    totalHands: profile.totalHands + session.handsPlayed,
    totalProfit: profile.totalProfit + session.totalProfit,
    tournamentPointsEarned: profile.tournamentPointsEarned + session.tournamentPointsEarned,
    biggestSessionWin: Math.max(profile.biggestSessionWin, session.totalProfit),
    biggestSessionLoss: Math.min(profile.biggestSessionLoss, session.totalProfit),
    cashSessions,
    tournamentSessions,
    tournamentTitles,
    itmFinishes,
    bestFinish,
    averageFinish,
    lastUpdatedAt: session.completedAt,
    modeBreakdown,
    recentSessions: [session, ...profile.recentSessions].slice(0, MAX_RECENT_SESSIONS),
    recordedSessionIds: [session.sessionId, ...profile.recordedSessionIds].slice(0, MAX_RECORDED_SESSION_IDS),
  };
}

export function writeCareerProfile(profile: CareerProfile): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(CAREER_PROFILE_STORAGE_KEY, JSON.stringify(profile));
}

export function readCareerProfile(): CareerProfile {
  if (typeof window === 'undefined') {
    return createEmptyCareerProfile();
  }

  const raw = window.localStorage.getItem(CAREER_PROFILE_STORAGE_KEY);
  if (!raw) {
    return createEmptyCareerProfile();
  }

  try {
    const parsed = JSON.parse(raw) as CareerProfile;
    if (parsed.version !== 1 || !Array.isArray(parsed.recentSessions) || !Array.isArray(parsed.recordedSessionIds)) {
      return createEmptyCareerProfile();
    }
    return {
      ...createEmptyCareerProfile(),
      ...parsed,
      modeBreakdown: {
        ...createEmptyCareerModeBreakdown(),
        ...(parsed.modeBreakdown ?? {}),
      },
    };
  } catch {
    return createEmptyCareerProfile();
  }
}

export function parseCareerProfileImport(raw: string): { result?: CareerProfileImportResult; error?: string } {
  try {
    const parsed = JSON.parse(raw) as CareerImportPayload | CareerProfile;
    const candidate = isObject(parsed) && 'profile' in parsed ? parsed.profile : parsed;
    const normalized = normalizeCareerProfile(candidate);
    if (!normalized) {
      return {
        error: '导入失败：文件不是有效的生涯战绩档案。',
      };
    }

    return {
      result: normalized,
    };
  } catch {
    return {
      error: '导入失败：JSON 文件格式不正确。',
    };
  }
}

export function getCareerModeBreakdown(profile: CareerProfile): CareerModeAggregate[] {
  return CAREER_MODES.map((mode) => profile.modeBreakdown[mode] ?? createModeAggregate(mode));
}

export function exportCareerProfile(profile: CareerProfile): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    profile,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `holdem-career-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function clearCareerProfile(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.removeItem(CAREER_PROFILE_STORAGE_KEY);
}
