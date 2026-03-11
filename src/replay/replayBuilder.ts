import type { Card } from '../types/cards';
import type { AIDifficulty, EvaluatedHandInfo, PayoutItem, PlayerState, PotSegment, SessionMode } from '../types/game';
import type {
  ActionEvent,
  HandHistoryRecord,
  ReplayEvent,
  ReplayEventInput,
  ReplayParticipant,
  ReplaySnapshot,
} from '../types/replay';
import { reconstructSnapshots } from './replayReconstructor';

export interface HandReplayBuilderState {
  handId: number;
  timestamp: number;
  gameMode: 'standard' | 'shortDeck';
  sessionMode: SessionMode;
  aiDifficulty: AIDifficulty;
  blindInfo: { smallBlind: number; bigBlind: number };
  participants: ReplayParticipant[];
  dealerSeat: number;
  smallBlindSeat: number;
  bigBlindSeat: number;
  startingChips: Record<string, number>;
  events: ReplayEvent[];
  actions: ActionEvent[];
  initialSnapshot: ReplaySnapshot;
  nextStep: number;
}

export interface ReplayBuilderInit {
  handId: number;
  timestamp: number;
  gameMode: 'standard' | 'shortDeck';
  sessionMode: SessionMode;
  aiDifficulty: AIDifficulty;
  blindInfo: { smallBlind: number; bigBlind: number };
  participants: ReplayParticipant[];
  dealerSeat: number;
  smallBlindSeat: number;
  bigBlindSeat: number;
  startingChips: Record<string, number>;
  players: PlayerState[];
}

export function createHandReplayBuilder(init: ReplayBuilderInit): HandReplayBuilderState {
  const initialSnapshot: ReplaySnapshot = {
    step: 0,
    stage: 'preflop',
    board: [],
    totalPot: 0,
    sidePots: [],
    activePlayerId: undefined,
    note: '手牌开始',
    players: init.players.map((p) => ({
      id: p.id,
      name: p.name,
      seat: p.seat,
      style: p.style,
      stack: init.startingChips[p.id] ?? p.stack,
      currentBet: 0,
      folded: false,
      allIn: false,
      eliminated: p.eliminated,
      holeCards: [],
      revealed: false,
      lastAction: '等待',
    })),
  };

  return {
    ...init,
    events: [],
    actions: [],
    initialSnapshot,
    nextStep: 1,
  };
}

export function addReplayEvent(builder: HandReplayBuilderState, input: ReplayEventInput): ReplayEvent {
  const event: ReplayEvent = {
    ...(input as ReplayEvent),
    id: `h${builder.handId}-e${builder.nextStep}`,
    step: builder.nextStep,
    ts: Date.now(),
  };

  builder.events.push(event);
  if (event.type === 'action') {
    builder.actions.push(event);
  }
  builder.nextStep += 1;
  return event;
}

export interface ReplayFinalizeInput {
  players: PlayerState[];
  holeCards: Record<string, Card[]>;
  communityCardsRevealOrder: Card[];
  showdownHands: EvaluatedHandInfo[];
  winners: string[];
  payoutBreakdown: PayoutItem[];
  potBreakdown: PotSegment[];
}

export function finalizeHandReplay(
  builder: HandReplayBuilderState,
  input: ReplayFinalizeInput,
): HandHistoryRecord {
  const endingChips: Record<string, number> = {};
  for (const player of input.players) {
    endingChips[player.id] = player.stack;
  }

  const snapshots = reconstructSnapshots(builder.initialSnapshot, builder.events);

  return {
    handId: builder.handId,
    timestamp: builder.timestamp,
    gameMode: builder.gameMode,
    sessionMode: builder.sessionMode,
    aiDifficulty: builder.aiDifficulty,
    blindInfo: builder.blindInfo,
    participants: builder.participants,
    dealerSeat: builder.dealerSeat,
    smallBlindSeat: builder.smallBlindSeat,
    bigBlindSeat: builder.bigBlindSeat,
    startingChips: builder.startingChips,
    endingChips,
    holeCards: input.holeCards,
    communityCardsRevealOrder: input.communityCardsRevealOrder,
    actions: [...builder.actions],
    events: [...builder.events],
    snapshots,
    showdown: {
      evaluatedHands: input.showdownHands,
      winners: input.winners,
    },
    winners: input.winners,
    payoutBreakdown: input.payoutBreakdown,
    potBreakdown: input.potBreakdown,
  };
}
