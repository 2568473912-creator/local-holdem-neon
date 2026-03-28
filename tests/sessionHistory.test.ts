import { describe, expect, it } from 'vitest';
import { analyzeReplaySessionHands, buildReplaySessionGroups, filterReplaySessionHandInsights, getReplaySessionKey, summarizeReplaySessions } from '../src/replay/sessionHistory';
import type { HandHistoryRecord } from '../src/types/replay';

function buildHand(overrides: Partial<HandHistoryRecord>): HandHistoryRecord {
  return {
    sessionId: 'session-a',
    handId: 1,
    timestamp: 1000,
    gameMode: 'standard',
    sessionMode: 'cash',
    aiDifficulty: 'standard',
    blindInfo: {
      smallBlind: 10,
      bigBlind: 20,
    },
    participants: [
      { id: 'P0', name: '你', seat: 0, style: 'balanced' },
      { id: 'P1', name: '对手', seat: 1, style: 'aggressive' },
    ],
    dealerSeat: 0,
    smallBlindSeat: 0,
    bigBlindSeat: 1,
    startingChips: {
      P0: 1000,
      P1: 1000,
    },
    endingChips: {
      P0: 1020,
      P1: 980,
    },
    holeCards: {
      P0: [],
      P1: [],
    },
    communityCardsRevealOrder: [],
    actions: [],
    events: [],
    snapshots: [],
    showdown: {
      evaluatedHands: [],
      winners: [],
    },
    winners: ['P0'],
    payoutBreakdown: [{ playerId: 'P0', amount: 40, potId: 'main' }],
    potBreakdown: [{ id: 'main', amount: 40, eligiblePlayerIds: ['P0', 'P1'] }],
    ...overrides,
  };
}

describe('session history summaries', () => {
  it('groups hands by session id and calculates summary stats', () => {
    const summaries = summarizeReplaySessions([
      buildHand({
        sessionId: 'session-a',
        handId: 1,
        timestamp: 1000,
        startingChips: { P0: 1000, P1: 1000 },
        endingChips: { P0: 1020, P1: 980 },
        winners: ['P0'],
        payoutBreakdown: [{ playerId: 'P0', amount: 40, potId: 'main' }],
      }),
      buildHand({
        sessionId: 'session-a',
        handId: 2,
        timestamp: 2000,
        startingChips: { P0: 1020, P1: 980 },
        endingChips: { P0: 990, P1: 1010 },
        winners: ['P1'],
        payoutBreakdown: [{ playerId: 'P1', amount: 60, potId: 'main' }],
      }),
      buildHand({
        sessionId: 'session-b',
        handId: 1,
        timestamp: 3000,
        gameMode: 'plo',
        aiDifficulty: 'aggressive',
        startingChips: { P0: 1000, P1: 1000 },
        endingChips: { P0: 1100, P1: 900 },
        winners: ['P0'],
        payoutBreakdown: [{ playerId: 'P0', amount: 120, potId: 'main' }],
      }),
    ]);

    expect(summaries).toHaveLength(2);
    expect(summaries[0].sessionId).toBe('session-b');
    expect(summaries[0].mode).toBe('plo');
    expect(summaries[0].totalProfit).toBe(100);
    expect(summaries[1].sessionId).toBe('session-a');
    expect(summaries[1].handCount).toBe(2);
    expect(summaries[1].wins).toBe(1);
    expect(summaries[1].winRate).toBe(50);
    expect(summaries[1].totalProfit).toBe(-10);
    expect(summaries[1].biggestPot).toBe(60);
  });

  it('falls back to legacy timestamp key when session id is missing', () => {
    const hand = buildHand({
      sessionId: undefined,
      timestamp: 4321,
    });

    expect(getReplaySessionKey(hand)).toBe('legacy-4321');
  });

  it('builds ordered session groups with hand lists', () => {
    const groups = buildReplaySessionGroups([
      buildHand({ sessionId: 'session-a', handId: 2, timestamp: 2000 }),
      buildHand({ sessionId: 'session-a', handId: 1, timestamp: 1000 }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].summary.sessionId).toBe('session-a');
    expect(groups[0].hands.map((hand) => hand.handId)).toEqual([1, 2]);
  });

  it('analyzes and filters session hands by key replay markers', () => {
    const analysis = analyzeReplaySessionHands([
      buildHand({
        handId: 1,
        payoutBreakdown: [{ playerId: 'P0', amount: 80, potId: 'main' }],
        winners: ['P0'],
      }),
      buildHand({
        handId: 2,
        endingChips: { P0: 780, P1: 1220 },
        payoutBreakdown: [{ playerId: 'P1', amount: 220, potId: 'main' }],
        winners: ['P1'],
        actions: [
          {
            type: 'action',
            id: 'a1',
            step: 1,
            stage: 'turn',
            ts: 2000,
            actorId: 'P1',
            note: '全下到 220',
            actionType: 'all-in',
            amount: 160,
            toCall: 40,
            stackAfter: 0,
            betAfter: 220,
            potAfter: 220,
            isAllIn: true,
            isFold: false,
            isFullRaise: true,
            teachingTag: 'pressure_all_in',
            teachingLabel: '施压全下',
          },
        ],
        events: [{ type: 'elimination', actorId: 'P0' }] as never,
        potBreakdown: [
          { id: 'main', amount: 120, eligiblePlayerIds: ['P0', 'P1'] },
          { id: 'side-1', amount: 100, eligiblePlayerIds: ['P1'] },
        ],
        showdown: {
          evaluatedHands: [{ playerId: 'P1' }] as never,
          winners: ['P1'],
        },
      }),
      buildHand({
        handId: 3,
        endingChips: { P0: 980, P1: 1020 },
        winners: ['P1'],
        payoutBreakdown: [{ playerId: 'P1', amount: 60, potId: 'main' }],
      }),
    ]);

    expect(analysis.bigPotThreshold).toBe(160);
    expect(analysis.bigLossThreshold).toBe(120);
    expect(analysis.counts).toEqual({
      all: 3,
      bigPot: 1,
      allIn: 1,
      teaching: 1,
      heroWin: 1,
      bigLoss: 1,
      elimination: 1,
      sidePot: 1,
    });
    expect(filterReplaySessionHandInsights(analysis.items, 'bigPot').map((item) => item.record.handId)).toEqual([2]);
    expect(filterReplaySessionHandInsights(analysis.items, 'allIn').map((item) => item.record.handId)).toEqual([2]);
    expect(filterReplaySessionHandInsights(analysis.items, 'heroWin').map((item) => item.record.handId)).toEqual([1]);
    expect(filterReplaySessionHandInsights(analysis.items, 'bigLoss').map((item) => item.record.handId)).toEqual([2]);
    expect(filterReplaySessionHandInsights(analysis.items, 'elimination').map((item) => item.record.handId)).toEqual([2]);
    expect(filterReplaySessionHandInsights(analysis.items, 'sidePot').map((item) => item.record.handId)).toEqual([2]);
  });

  it('builds quick replay jumps for session detail rows', () => {
    const analysis = analyzeReplaySessionHands([
      buildHand({
        handId: 7,
        communityCardsRevealOrder: [
          { rank: 14, suit: 'hearts', code: '14-h' },
          { rank: 13, suit: 'spades', code: '13-s' },
          { rank: 12, suit: 'clubs', code: '12-c' },
          { rank: 8, suit: 'diamonds', code: '8-d' },
          { rank: 2, suit: 'hearts', code: '2-h' },
        ],
        actions: [
          {
            type: 'action',
            id: 'a1',
            step: 3,
            stage: 'flop',
            ts: 3000,
            actorId: 'P1',
            note: '对手加注到 160',
            actionType: 'raise',
            amount: 120,
            toCall: 40,
            stackAfter: 840,
            betAfter: 160,
            potAfter: 240,
            isAllIn: false,
            isFold: false,
            isFullRaise: true,
          },
          {
            type: 'action',
            id: 'a2',
            step: 6,
            stage: 'turn',
            ts: 4000,
            actorId: 'P1',
            note: '对手全下',
            actionType: 'all-in',
            amount: 520,
            toCall: 0,
            stackAfter: 0,
            betAfter: 520,
            potAfter: 760,
            isAllIn: true,
            isFold: false,
            isFullRaise: true,
            teachingTag: 'pressure_all_in',
            teachingLabel: '施压全下',
          },
        ],
        events: [
          { type: 'street_transition', id: 'e1', step: 2, stage: 'flop', ts: 2000, from: 'preflop', to: 'flop', resetBets: true, note: '发出翻牌' },
          { type: 'action', id: 'e2', step: 3, stage: 'flop', ts: 3000, actorId: 'P1', note: '对手加注到 160', actionType: 'raise', amount: 120, toCall: 40, stackAfter: 840, betAfter: 160, potAfter: 240, isAllIn: false, isFold: false, isFullRaise: true },
          { type: 'street_transition', id: 'e3', step: 5, stage: 'turn', ts: 3500, from: 'flop', to: 'turn', resetBets: true, note: '发出转牌' },
          {
            type: 'action',
            id: 'e4',
            step: 6,
            stage: 'turn',
            ts: 4000,
            actorId: 'P1',
            note: '对手全下',
            actionType: 'all-in',
            amount: 520,
            toCall: 0,
            stackAfter: 0,
            betAfter: 520,
            potAfter: 760,
            isAllIn: true,
            isFold: false,
            isFullRaise: true,
            teachingTag: 'pressure_all_in',
            teachingLabel: '施压全下',
          },
          { type: 'side_pot', id: 'e5', step: 7, stage: 'turn', ts: 4100, note: '创建边池', pot: { id: 'side-1', amount: 120, eligiblePlayerIds: ['P1'] } },
          { type: 'showdown', id: 'e6', step: 9, stage: 'showdown', ts: 5000, note: '进入摊牌', evaluatedHands: [{ playerId: 'P1' }] as never },
        ] as never,
        snapshots: [
          { step: 0, stage: 'preflop', board: [], totalPot: 60, sidePots: [], players: [], note: '翻前' },
          { step: 2, stage: 'flop', board: [], totalPot: 120, sidePots: [], players: [], note: '翻牌' },
          { step: 5, stage: 'turn', board: [], totalPot: 240, sidePots: [], players: [], note: '转牌' },
          { step: 8, stage: 'river', board: [], totalPot: 760, sidePots: [], players: [], note: '河牌' },
          { step: 9, stage: 'showdown', board: [], totalPot: 880, sidePots: [], players: [], note: '摊牌' },
        ],
        payoutBreakdown: [{ playerId: 'P1', amount: 880, potId: 'main' }],
        winners: ['P1'],
      }),
    ]);

    expect(analysis.items[0].quickJumps).toEqual([
      expect.objectContaining({
        step: 2,
        targetStep: 1,
        label: '翻牌',
        kind: 'street',
        stageLabel: '翻牌',
        totalPot: 120,
        boardCount: 3,
        boardCards: [
          { rank: 14, suit: 'hearts', code: '14-h' },
          { rank: 13, suit: 'spades', code: '13-s' },
          { rank: 12, suit: 'clubs', code: '12-c' },
        ],
        sidePotCount: 0,
      }),
      expect.objectContaining({ step: 3, targetStep: 2, label: '施压', kind: 'pressure', stageLabel: '转牌', totalPot: 240 }),
      expect.objectContaining({
        step: 5,
        targetStep: 2,
        label: '转牌',
        kind: 'street',
        stageLabel: '转牌',
        totalPot: 240,
        boardCount: 4,
        boardCards: [
          { rank: 14, suit: 'hearts', code: '14-h' },
          { rank: 13, suit: 'spades', code: '13-s' },
          { rank: 12, suit: 'clubs', code: '12-c' },
          { rank: 8, suit: 'diamonds', code: '8-d' },
        ],
      }),
      expect.objectContaining({ step: 6, targetStep: 3, label: '全下', kind: 'pressure', stageLabel: '河牌', totalPot: 760, sidePotCount: 0 }),
      expect.objectContaining({ step: 7, targetStep: 3, label: '边池', kind: 'settlement', stageLabel: '河牌', totalPot: 760, boardCount: 5, sidePotCount: 0 }),
      expect.objectContaining({ step: 8, targetStep: 3, label: '河牌', kind: 'street', stageLabel: '河牌', totalPot: 760, boardCount: 5 }),
    ]);
  });
});
