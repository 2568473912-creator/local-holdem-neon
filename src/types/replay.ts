import type { Card, GameMode } from './cards';
import type {
  AIDifficulty,
  BlindInfo,
  HandStage,
  EvaluatedHandInfo,
  PlayerActionType,
  PayoutItem,
  PlayerStyle,
  PotSegment,
  SessionMode,
} from './game';
import type { HumanPortraitKey } from './portrait';

export type ReplayEventType =
  | 'hand_start'
  | 'deal_hole'
  | 'post_blind'
  | 'action'
  | 'street_transition'
  | 'reveal_board'
  | 'side_pot'
  | 'showdown'
  | 'payout'
  | 'elimination'
  | 'hand_end';

export type ActionTeachingTag =
  | 'value_bet'
  | 'semi_bluff'
  | 'bluff_pressure'
  | 'pot_control'
  | 'pressure_fold'
  | 'odds_call'
  | 'defensive_call'
  | 'value_all_in'
  | 'pressure_all_in';

export interface ReplayEventBase {
  id: string;
  step: number;
  type: ReplayEventType;
  stage: HandStage;
  ts: number;
  actorId?: string;
  note: string;
}

export interface HandStartEvent extends ReplayEventBase {
  type: 'hand_start';
  dealerSeat: number;
  sbSeat: number;
  bbSeat: number;
}

export interface DealHoleEvent extends ReplayEventBase {
  type: 'deal_hole';
  actorId: string;
  cards: Card[];
}

export interface PostBlindEvent extends ReplayEventBase {
  type: 'post_blind';
  actorId: string;
  blindType: 'sb' | 'bb' | 'ante' | 'straddle';
  amount: number;
  stackAfter: number;
  potAfter: number;
}

export interface ActionEvent extends ReplayEventBase {
  type: 'action';
  actorId: string;
  actionType: PlayerActionType;
  amount: number;
  toCall: number;
  stackAfter: number;
  betAfter: number;
  potAfter: number;
  isAllIn: boolean;
  isFold: boolean;
  isFullRaise: boolean;
  activePlayerAfter?: string;
  teachingTag?: ActionTeachingTag;
  teachingLabel?: string;
  teachingNote?: string;
}

export interface StreetTransitionEvent extends ReplayEventBase {
  type: 'street_transition';
  from: HandStage;
  to: HandStage;
  resetBets: boolean;
  activePlayerId?: string;
}

export interface RevealBoardEvent extends ReplayEventBase {
  type: 'reveal_board';
  cards: Card[];
  boardAfter: Card[];
}

export interface SidePotEvent extends ReplayEventBase {
  type: 'side_pot';
  pot: PotSegment;
}

export interface ShowdownEvent extends ReplayEventBase {
  type: 'showdown';
  evaluatedHands: EvaluatedHandInfo[];
}

export interface PayoutEvent extends ReplayEventBase {
  type: 'payout';
  payout: PayoutItem;
}

export interface EliminationEvent extends ReplayEventBase {
  type: 'elimination';
  actorId: string;
}

export interface HandEndEvent extends ReplayEventBase {
  type: 'hand_end';
  winners: string[];
  totalPot: number;
}

export type ReplayEvent =
  | HandStartEvent
  | DealHoleEvent
  | PostBlindEvent
  | ActionEvent
  | StreetTransitionEvent
  | RevealBoardEvent
  | SidePotEvent
  | ShowdownEvent
  | PayoutEvent
  | EliminationEvent
  | HandEndEvent;

export interface ReplayPlayerState {
  id: string;
  name: string;
  seat: number;
  style: PlayerStyle;
  portraitKey?: HumanPortraitKey;
  stack: number;
  currentBet: number;
  folded: boolean;
  allIn: boolean;
  eliminated: boolean;
  holeCards: Card[];
  revealed: boolean;
  lastAction: string;
}

export interface ReplaySnapshot {
  step: number;
  stage: HandStage;
  board: Card[];
  totalPot: number;
  sidePots: PotSegment[];
  players: ReplayPlayerState[];
  activePlayerId?: string;
  eventId?: string;
  note: string;
}

export interface ReplayParticipant {
  id: string;
  name: string;
  seat: number;
  style: PlayerStyle;
  portraitKey?: HumanPortraitKey;
}

export interface HandHistoryRecord {
  sessionId?: string;
  handId: number;
  timestamp: number;
  gameMode: GameMode;
  sessionMode: SessionMode;
  aiDifficulty: AIDifficulty;
  blindInfo: BlindInfo;
  participants: ReplayParticipant[];
  dealerSeat: number;
  smallBlindSeat: number;
  bigBlindSeat: number;
  startingChips: Record<string, number>;
  endingChips: Record<string, number>;
  holeCards: Record<string, Card[]>;
  communityCardsRevealOrder: Card[];
  actions: ActionEvent[];
  events: ReplayEvent[];
  snapshots: ReplaySnapshot[];
  showdown: {
    evaluatedHands: EvaluatedHandInfo[];
    winners: string[];
  };
  winners: string[];
  payoutBreakdown: PayoutItem[];
  potBreakdown: PotSegment[];
}

export interface ReplayViewerState {
  handKey: string;
  handId: number;
  sessionId?: string;
  step: number;
  autoplay: boolean;
}

export interface ReplayOpenOptions {
  record?: HandHistoryRecord;
  initialStep?: number;
}

export type ReplayEventInput =
  | Omit<HandStartEvent, 'id' | 'step' | 'ts'>
  | Omit<DealHoleEvent, 'id' | 'step' | 'ts'>
  | Omit<PostBlindEvent, 'id' | 'step' | 'ts'>
  | Omit<ActionEvent, 'id' | 'step' | 'ts'>
  | Omit<StreetTransitionEvent, 'id' | 'step' | 'ts'>
  | Omit<RevealBoardEvent, 'id' | 'step' | 'ts'>
  | Omit<SidePotEvent, 'id' | 'step' | 'ts'>
  | Omit<ShowdownEvent, 'id' | 'step' | 'ts'>
  | Omit<PayoutEvent, 'id' | 'step' | 'ts'>
  | Omit<EliminationEvent, 'id' | 'step' | 'ts'>
  | Omit<HandEndEvent, 'id' | 'step' | 'ts'>;
