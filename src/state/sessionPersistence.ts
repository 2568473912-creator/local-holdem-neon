import type { HandRuntime } from '../engine/handEngine';
import type { AutoActionPreset, GameConfig, SessionStats } from '../types/game';
import type { GameMode } from '../types/cards';
import type { HandStage } from '../types/game';
import type { AIDifficulty, SessionMode } from '../types/game';
import type { HandHistoryRecord } from '../types/replay';

export interface PersistedSession {
  version: 1;
  savedAt: number;
  sessionId?: string;
  careerRecorded?: boolean;
  baseConfig: GameConfig;
  config: GameConfig;
  runtime: HandRuntime;
  history: HandHistoryRecord[];
  stats: SessionStats;
  banner: string;
  paused: boolean;
  autoAction: AutoActionPreset | null;
}

export interface PersistedSessionSummary {
  savedAt: number;
  handId: number;
  stage: HandStage;
  mode: GameMode;
  sessionMode: SessionMode;
  aiDifficulty: AIDifficulty;
  playerCount: number;
  aliveCount: number;
  heroStack: number;
  blindLevel: number;
  smallBlind: number;
  bigBlind: number;
  totalHands: number;
  sessionOver: boolean;
}

export interface PersistableSessionInput {
  sessionId: string;
  careerRecorded: boolean;
  baseConfig: GameConfig;
  config: GameConfig;
  runtime: HandRuntime;
  history: HandHistoryRecord[];
  stats: SessionStats;
  banner: string;
  paused: boolean;
  autoAction: AutoActionPreset | null;
}

export const SESSION_STORAGE_KEY = 'neon.holdem.session.v1';
const MAX_PERSISTED_HISTORY_HANDS = 60;

export function buildPersistedSession(input: PersistableSessionInput): PersistedSession {
  return {
    version: 1,
    savedAt: Date.now(),
    sessionId: input.sessionId,
    careerRecorded: input.careerRecorded,
    baseConfig: input.baseConfig,
    config: input.config,
    runtime: input.runtime,
    history: input.history.slice(0, MAX_PERSISTED_HISTORY_HANDS),
    stats: input.stats,
    banner: input.banner,
    paused: input.paused,
    autoAction: input.autoAction,
  };
}

export function summarizePersistedSession(session: PersistedSession): PersistedSessionSummary {
  const aliveCount = session.runtime.table.players.filter((player) => !player.eliminated).length;
  const hero = session.runtime.table.players.find((player) => player.isHuman);
  return {
    savedAt: session.savedAt,
    handId: session.runtime.table.handId,
    stage: session.runtime.table.stage,
    mode: session.config.mode,
    sessionMode: session.config.sessionMode,
    aiDifficulty: session.config.aiDifficulty,
    playerCount: session.runtime.table.players.length,
    aliveCount,
    heroStack: hero?.stack ?? 0,
    blindLevel: session.config.blindLevel,
    smallBlind: session.config.smallBlind,
    bigBlind: session.config.bigBlind,
    totalHands: session.stats.totalHands,
    sessionOver: aliveCount <= 1,
  };
}

export function writePersistedSession(session: PersistedSession): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function readPersistedSession(): PersistedSession | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as PersistedSession;
    if (parsed.version !== 1 || !parsed.runtime?.table || !parsed.config || !parsed.baseConfig) {
      return null;
    }
    const sessionId = parsed.sessionId ?? `legacy-${parsed.savedAt}`;
    return {
      ...parsed,
      sessionId,
      careerRecorded: parsed.careerRecorded ?? false,
      history: Array.isArray(parsed.history)
        ? parsed.history.map((hand) => ({
            ...hand,
            sessionId: hand.sessionId ?? sessionId,
          }))
        : [],
    };
  } catch {
    return null;
  }
}

export function clearPersistedSession(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
}
