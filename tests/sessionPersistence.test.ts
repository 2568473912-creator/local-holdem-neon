import { describe, expect, it, vi } from 'vitest';
import type { HandRuntime } from '../src/engine/handEngine';
import type { Card } from '../src/types/cards';
import type { GameConfig, PlayerState, SessionStats, TableState } from '../src/types/game';
import type { HandHistoryRecord } from '../src/types/replay';
import { buildPersistedSession, summarizePersistedSession } from '../src/state/sessionPersistence';

function makeCard(rank: number, suit: Card['suit']): Card {
  return { rank, suit, code: `${rank}-${suit[0]}` };
}

function makePlayer(overrides: Partial<PlayerState>): PlayerState {
  return {
    id: overrides.id ?? 'P0',
    name: overrides.name ?? '玩家',
    seat: overrides.seat ?? 0,
    isHuman: overrides.isHuman ?? false,
    style: overrides.style ?? 'balanced',
    stack: overrides.stack ?? 5000,
    holeCards: overrides.holeCards ?? [makeCard(14, 'spades'), makeCard(13, 'hearts')],
    folded: overrides.folded ?? false,
    allIn: overrides.allIn ?? false,
    eliminated: overrides.eliminated ?? false,
    currentBet: overrides.currentBet ?? 0,
    committed: overrides.committed ?? 0,
    actedThisStreet: overrides.actedThisStreet ?? false,
    lastAction: overrides.lastAction ?? '等待',
    revealed: overrides.revealed ?? false,
  };
}

function makeConfig(): GameConfig {
  return {
    mode: 'standard',
    sessionMode: 'cash',
    aiCount: 1,
    startingChips: 5000,
    smallBlind: 20,
    bigBlind: 40,
    blindLevel: 2,
    blindUpEveryHands: 5,
    fastMode: false,
    aiDifficulty: 'standard',
    straddleMode: 'off',
  };
}

function makeRuntime(): HandRuntime {
  const config = makeConfig();
  const players = [
    makePlayer({ id: 'P0', isHuman: true, name: '你', stack: 4920 }),
    makePlayer({ id: 'P1', seat: 1, name: 'AI 一号', stack: 5080 }),
  ];
  const table: TableState = {
    handId: 7,
    mode: 'standard',
    stage: 'turn',
    config,
    players,
    deck: [],
    board: [makeCard(10, 'clubs'), makeCard(9, 'clubs'), makeCard(4, 'hearts'), makeCard(2, 'spades')],
    boardRevealOrder: [],
    dealerSeat: 0,
    smallBlindSeat: 0,
    bigBlindSeat: 1,
    straddleSeat: undefined,
    straddleAmount: 0,
    betting: {
      currentBet: 80,
      minRaise: 40,
      actionQueue: ['P0'],
      lastAggressorId: 'P1',
    },
    aggression: {
      streetAggressors: { flop: 'P1' },
      lastAggressorId: 'P1',
      raiseCountByPlayer: { P0: 0, P1: 1 },
      voluntaryActionsByPlayer: { P0: 1, P1: 2 },
      foldedToAggressionByPlayer: { P0: 0, P1: 0 },
    },
    activePlayerId: 'P0',
    pots: [],
    totalPot: 160,
    payouts: [],
    showdownHands: [],
    winners: [],
    statusText: '轮到你行动',
    handStartedAt: 1700000000000,
  };

  return {
    table,
    replayBuilder: {
      handId: 7,
      timestamp: 1700000000000,
      gameMode: 'standard',
      sessionMode: 'cash',
      aiDifficulty: 'standard',
      blindInfo: { smallBlind: 20, bigBlind: 40 },
      participants: players.map((player) => ({ id: player.id, name: player.name, seat: player.seat, style: player.style })),
      dealerSeat: 0,
      smallBlindSeat: 0,
      bigBlindSeat: 1,
      startingChips: { P0: 5000, P1: 5000 },
      events: [],
      actions: [],
      initialSnapshot: {
        step: 0,
        stage: 'preflop',
        board: [],
        totalPot: 0,
        sidePots: [],
        activePlayerId: 'P0',
        note: '手牌开始',
        players: players.map((player) => ({
          id: player.id,
          name: player.name,
          seat: player.seat,
          style: player.style,
          stack: 5000,
          currentBet: 0,
          folded: false,
          allIn: false,
          eliminated: false,
          holeCards: [],
          revealed: player.isHuman,
          lastAction: '等待',
        })),
      },
      nextStep: 1,
    },
  };
}

function makeHistoryRecord(handId: number): HandHistoryRecord {
  return {
    handId,
    timestamp: 1700000000000 + handId,
    gameMode: 'standard',
    sessionMode: 'cash',
    aiDifficulty: 'standard',
    blindInfo: { smallBlind: 20, bigBlind: 40 },
    participants: [
      { id: 'P0', name: '你', seat: 0, style: 'balanced' },
      { id: 'P1', name: 'AI 一号', seat: 1, style: 'tight' },
    ],
    dealerSeat: 0,
    smallBlindSeat: 0,
    bigBlindSeat: 1,
    startingChips: { P0: 5000, P1: 5000 },
    endingChips: { P0: 4920, P1: 5080 },
    holeCards: { P0: [], P1: [] },
    communityCardsRevealOrder: [],
    actions: [],
    events: [],
    snapshots: [],
    showdown: { evaluatedHands: [], winners: [] },
    winners: [],
    payoutBreakdown: [],
    potBreakdown: [],
  };
}

describe('session persistence', () => {
  it('summarizes a persisted session for the menu resume card', () => {
    const stats: SessionStats = { totalHands: 6, wins: 2, winRate: 33.3, totalProfit: -80, maxSinglePotWin: 120 };
    const saved = buildPersistedSession({
      sessionId: 'session-test-1',
      careerRecorded: false,
      baseConfig: makeConfig(),
      config: makeConfig(),
      runtime: makeRuntime(),
      history: [makeHistoryRecord(6)],
      stats,
      banner: '轮到你行动',
      paused: false,
      autoAction: { mode: 'callLimit', callLimitBb: 2 },
    });

    const summary = summarizePersistedSession(saved);
    expect(summary.handId).toBe(7);
    expect(summary.heroStack).toBe(4920);
    expect(summary.totalHands).toBe(6);
    expect(summary.aliveCount).toBe(2);
  });

  it('caps persisted history to avoid oversized local storage payloads', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-12T08:00:00Z'));

    const saved = buildPersistedSession({
      sessionId: 'session-test-2',
      careerRecorded: true,
      baseConfig: makeConfig(),
      config: makeConfig(),
      runtime: makeRuntime(),
      history: Array.from({ length: 80 }, (_, index) => makeHistoryRecord(index + 1)),
      stats: { totalHands: 80, wins: 30, winRate: 37.5, totalProfit: 640, maxSinglePotWin: 320 },
      banner: '自动保存',
      paused: true,
      autoAction: null,
    });

    expect(saved.history).toHaveLength(60);
    expect(saved.savedAt).toBe(new Date('2026-03-12T08:00:00Z').getTime());
    vi.useRealTimers();
  });
});
