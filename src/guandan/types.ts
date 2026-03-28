import type { AIDifficulty } from '../types/game';
import type { AppLanguage } from '../i18n';
import type { HumanPortraitKey } from '../types/portrait';

export type GdSuit = 'spade' | 'heart' | 'club' | 'diamond' | 'joker';
export type GdPhase = 'playing' | 'settlement';
export type GdTeam = 'alpha' | 'beta';
export type GdPatternType = 'single' | 'pair' | 'triple' | 'fullHouse' | 'straight' | 'pairStraight' | 'tripleStraight' | 'straightFlush' | 'bomb' | 'jokerBomb';
export type GdVictoryType = 'doubleDown' | 'singleDown' | 'hardFought';
export type GdSpecialEventKind = 'bomb' | 'straightFlush' | 'jokerBomb' | 'doubleDown' | 'singleDown' | 'hardFought';

export interface GdConfig {
  aiDifficulty: AIDifficulty;
  autoNextRound: boolean;
  humanPortraitKey?: HumanPortraitKey;
  language?: AppLanguage;
}

export interface GdCard {
  id: string;
  deckIndex: number;
  suit: GdSuit;
  rank: number;
  code: string;
  label: string;
  shortLabel: string;
}

export interface GdPattern {
  type: GdPatternType;
  mainRank: number;
  power: number;
  cardCount: number;
  sequenceLength: number;
  cards: GdCard[];
  description: string;
}

export interface GdPlayerState {
  id: string;
  name: string;
  seat: number;
  isHuman: boolean;
  portraitKey?: HumanPortraitKey;
  style: 'tight' | 'loose' | 'aggressive' | 'balanced';
  team: GdTeam;
  hand: GdCard[];
  score: number;
  finishOrder: number | null;
  lastAction: string;
  lastPlayedCards: GdCard[];
  passed: boolean;
}

export interface GdTrickState {
  pattern: GdPattern | null;
  playerId: string | null;
  passCount: number;
}

export interface GdTableDisplay {
  playerId: string | null;
  pattern: GdPattern | null;
  cards: GdCard[];
}

export interface GdTeamLevels {
  alpha: number;
  beta: number;
}

export interface GdLogEntry {
  id: string;
  text: string;
  tone?: 'neutral' | 'alert' | 'success';
}

export interface GdSpecialEvent {
  id: string;
  kind: GdSpecialEventKind;
  label: string;
  detail: string;
  playerId?: string | null;
}

export interface GdRoundRuntime {
  phase: GdPhase;
  round: number;
  dealSeed: number;
  config: GdConfig;
  players: GdPlayerState[];
  currentPlayerId: string;
  startingPlayerId: string;
  selectedCardIds: string[];
  pendingHintIndex: number;
  teamLevels: GdTeamLevels;
  trick: GdTrickState;
  tableDisplay: GdTableDisplay;
  finishOrder: string[];
  winnerTeam: GdTeam | null;
  levelDelta: number;
  victoryType: GdVictoryType | null;
  victoryLabel: string | null;
  specialBurst: GdSpecialEvent | null;
  specialHistory: GdSpecialEvent[];
  banner: string;
  log: GdLogEntry[];
}

export interface GdRoundPlayerSummary {
  id: string;
  name: string;
  team: GdTeam;
  finishOrder: number;
  score: number;
  delta: number;
  isHuman: boolean;
}

export interface GdRoundSummary {
  round: number;
  dealSeed: number;
  winningTeam: GdTeam;
  levelDelta: number;
  victoryType: GdVictoryType;
  victoryLabel: string;
  teamLevelsBefore: GdTeamLevels;
  teamLevelsAfter: GdTeamLevels;
  finishOrder: string[];
  specials: GdSpecialEvent[];
  players: GdRoundPlayerSummary[];
  timestamp: number;
}

export interface GdActionResult {
  runtime: GdRoundRuntime;
  error?: string;
  roundCompleted?: GdRoundSummary;
}

export interface GdSessionStats {
  rounds: number;
  humanTeamWins: number;
  alphaWins: number;
  betaWins: number;
  bestFinish: number;
}
