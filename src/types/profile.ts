import type { GameMode } from './cards';
import type { AIDifficulty, SessionMode } from './game';

export type CareerSessionEndReason = 'completed' | 'replaced';

export interface CareerSessionRecord {
  sessionId: string;
  completedAt: number;
  mode: GameMode;
  sessionMode: SessionMode;
  aiDifficulty: AIDifficulty;
  handsPlayed: number;
  totalProfit: number;
  heroFinalStack: number;
  fieldSize: number;
  finalRank: number | null;
  inMoney: boolean;
  champion: boolean;
  tournamentPointsEarned: number;
  endReason: CareerSessionEndReason;
}

export interface CareerModeAggregate {
  mode: GameMode;
  sessions: number;
  hands: number;
  profit: number;
  titles: number;
  itmFinishes: number;
}

export type CareerModeBreakdown = Record<GameMode, CareerModeAggregate>;

export interface CareerProfile {
  version: 1;
  totalSessions: number;
  totalHands: number;
  totalProfit: number;
  tournamentPointsEarned: number;
  biggestSessionWin: number;
  biggestSessionLoss: number;
  cashSessions: number;
  tournamentSessions: number;
  tournamentTitles: number;
  itmFinishes: number;
  bestFinish: number | null;
  averageFinish: number | null;
  lastUpdatedAt: number;
  modeBreakdown: CareerModeBreakdown;
  recentSessions: CareerSessionRecord[];
  recordedSessionIds: string[];
}
