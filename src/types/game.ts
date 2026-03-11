import type { Card, GameMode } from './cards';

export type Street = 'preflop' | 'flop' | 'turn' | 'river';
export type HandStage = Street | 'showdown' | 'settlement' | 'complete';

export type PlayerStyle = 'tight' | 'loose' | 'aggressive' | 'balanced';

export type PlayerActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all-in';
export type SessionMode = 'cash' | 'tournament';
export type AIDifficulty = 'conservative' | 'standard' | 'aggressive';

export interface PlayerAction {
  type: PlayerActionType;
  amount?: number;
}

export interface GameConfig {
  mode: GameMode;
  sessionMode: SessionMode;
  aiCount: number;
  startingChips: number;
  smallBlind: number;
  bigBlind: number;
  blindLevel: number;
  blindUpEveryHands: number;
  fastMode: boolean;
  aiDifficulty: AIDifficulty;
}

export interface PlayerState {
  id: string;
  name: string;
  seat: number;
  isHuman: boolean;
  style: PlayerStyle;
  stack: number;
  holeCards: Card[];
  folded: boolean;
  allIn: boolean;
  eliminated: boolean;
  currentBet: number;
  committed: number;
  actedThisStreet: boolean;
  lastAction: string;
  revealed: boolean;
}

export interface BettingRoundState {
  currentBet: number;
  minRaise: number;
  actionQueue: string[];
  lastAggressorId?: string;
}

export interface AggressionTracker {
  streetAggressors: Partial<Record<Street, string>>;
  lastAggressorId?: string;
  raiseCountByPlayer: Record<string, number>;
  voluntaryActionsByPlayer: Record<string, number>;
  foldedToAggressionByPlayer: Record<string, number>;
}

export interface PotSegment {
  id: string;
  amount: number;
  eligiblePlayerIds: string[];
}

export interface PayoutItem {
  playerId: string;
  amount: number;
  potId: string;
}

export interface EvaluatedHandInfo {
  playerId: string;
  category: string;
  description: string;
  rankValue: number;
  tiebreaker: number[];
  bestFive: Card[];
}

export interface TableState {
  handId: number;
  mode: GameMode;
  stage: HandStage;
  config: GameConfig;
  players: PlayerState[];
  deck: Card[];
  board: Card[];
  boardRevealOrder: Card[];
  dealerSeat: number;
  smallBlindSeat: number;
  bigBlindSeat: number;
  betting: BettingRoundState;
  aggression: AggressionTracker;
  activePlayerId?: string;
  pots: PotSegment[];
  totalPot: number;
  payouts: PayoutItem[];
  showdownHands: EvaluatedHandInfo[];
  winners: string[];
  statusText: string;
  handStartedAt: number;
}

export interface ActionOption {
  type: PlayerActionType;
  enabled: boolean;
  label: string;
  reason?: string;
  minAmount?: number;
  maxAmount?: number;
  suggestedAmount?: number;
  callAmount?: number;
}

export interface BlindInfo {
  smallBlind: number;
  bigBlind: number;
}

export interface SessionStats {
  totalHands: number;
  wins: number;
  winRate: number;
  totalProfit: number;
  maxSinglePotWin: number;
}
