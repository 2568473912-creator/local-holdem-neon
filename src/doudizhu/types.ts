import type { AIDifficulty } from '../types/game';
import type { AppLanguage } from '../i18n';
import type { HumanPortraitKey } from '../types/portrait';

export type DdzSuit = 'spade' | 'heart' | 'club' | 'diamond' | 'joker';
export type DdzPhase = 'bidding' | 'playing' | 'settlement';
export type DdzRole = 'undecided' | 'landlord' | 'farmer';
export type DdzPatternType =
  | 'single'
  | 'pair'
  | 'triple'
  | 'tripleSingle'
  | 'triplePair'
  | 'straight'
  | 'pairStraight'
  | 'airplane'
  | 'airplaneSingles'
  | 'airplanePairs'
  | 'fourWithTwoSingles'
  | 'fourWithTwoPairs'
  | 'bomb'
  | 'rocket';

export interface DdzConfig {
  aiDifficulty: AIDifficulty;
  humanPortraitKey?: HumanPortraitKey;
  autoNextRound: boolean;
  language?: AppLanguage;
}

export interface DdzCard {
  id: string;
  suit: DdzSuit;
  rank: number;
  code: string;
  label: string;
  shortLabel: string;
}

export interface DdzPattern {
  type: DdzPatternType;
  mainRank: number;
  cardCount: number;
  sequenceLength: number;
  cards: DdzCard[];
  description: string;
}

export interface DdzLogEntry {
  id: string;
  text: string;
  tone?: 'neutral' | 'alert' | 'success';
}

export interface DdzPlayerState {
  id: string;
  name: string;
  seat: number;
  isHuman: boolean;
  portraitKey?: HumanPortraitKey;
  style: 'tight' | 'loose' | 'aggressive' | 'balanced';
  role: DdzRole;
  hand: DdzCard[];
  score: number;
  wins: number;
  bid: number | null;
  lastAction: string;
  lastPlayedCards: DdzCard[];
  passed: boolean;
}

export interface DdzBiddingState {
  highestBid: number;
  highestBidderId: string | null;
  turnOrder: string[];
  currentIndex: number;
  bids: Record<string, number | null>;
}

export interface DdzLeadState {
  pattern: DdzPattern | null;
  playerId: string | null;
  passCount: number;
}

export interface DdzTableDisplay {
  playerId: string | null;
  pattern: DdzPattern | null;
  cards: DdzCard[];
}

export type DdzMultiplierEventKind = 'bid' | 'bomb' | 'rocket' | 'spring';

export interface DdzMultiplierEvent {
  kind: DdzMultiplierEventKind;
  label: string;
  factor: number;
  byPlayerId?: string;
  byPlayerName?: string;
  totalMultiplier: number;
}

export interface DdzMultiplierBreakdown {
  bid: number;
  bombCount: number;
  rocketCount: number;
  springApplied: boolean;
  finalMultiplier: number;
  events: DdzMultiplierEvent[];
}

export interface DdzRoundRuntime {
  phase: DdzPhase;
  round: number;
  dealSeed: number;
  config: DdzConfig;
  players: DdzPlayerState[];
  bottomCards: DdzCard[];
  landlordId: string | null;
  currentPlayerId: string;
  bidding: DdzBiddingState;
  lead: DdzLeadState;
  tableDisplay: DdzTableDisplay;
  selectedCardIds: string[];
  pendingHintIndex: number;
  baseBid: number;
  multiplier: number;
  multiplierBreakdown: DdzMultiplierBreakdown;
  springTriggered: boolean;
  landlordPlayCount: number;
  farmerPlayCount: number;
  winnerId: string | null;
  winningTeam: DdzRole | null;
  banner: string;
  log: DdzLogEntry[];
}

export interface DdzRoundPlayerSummary {
  id: string;
  name: string;
  role: DdzRole;
  score: number;
  delta: number;
  isHuman: boolean;
  winner: boolean;
}

export interface DdzRoundSummary {
  round: number;
  dealSeed: number;
  landlordId: string;
  landlordName: string;
  winnerId: string;
  winnerName: string;
  winningTeam: DdzRole;
  baseBid: number;
  multiplier: number;
  multiplierBreakdown: DdzMultiplierBreakdown;
  springTriggered: boolean;
  scoreSwing: number;
  heroDelta: number;
  players: DdzRoundPlayerSummary[];
  timestamp: number;
}

export interface DdzActionResult {
  runtime: DdzRoundRuntime;
  error?: string;
  roundCompleted?: DdzRoundSummary;
}

export interface DdzSessionStats {
  rounds: number;
  humanWins: number;
  landlordWins: number;
  farmerWins: number;
  bestSwing: number;
}
