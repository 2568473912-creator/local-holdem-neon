import { describe, expect, it } from 'vitest';
import { buildReplayKeyMoments, detectSuspiciousBluffLines, filterReplayEvents } from '../src/replay/replayAnalysis';
import type { ActionEvent, HandHistoryRecord, ReplayEvent } from '../src/types/replay';

function buildRecord(events: ReplayEvent[]): HandHistoryRecord {
  const participants = [
    { id: 'P0', name: '你', seat: 0, style: 'balanced' as const },
    { id: 'P1', name: '对手A', seat: 1, style: 'aggressive' as const },
  ];

  return {
    handId: 1,
    timestamp: Date.now(),
    gameMode: 'standard',
    sessionMode: 'cash',
    aiDifficulty: 'standard',
    blindInfo: {
      smallBlind: 10,
      bigBlind: 20,
    },
    participants,
    dealerSeat: 0,
    smallBlindSeat: 0,
    bigBlindSeat: 1,
    startingChips: {
      P0: 1000,
      P1: 1000,
    },
    endingChips: {
      P0: 900,
      P1: 1100,
    },
    holeCards: {
      P0: [],
      P1: [],
    },
    communityCardsRevealOrder: [],
    actions: events.filter((event): event is ActionEvent => event.type === 'action'),
    events,
    snapshots: [
      {
        step: 0,
        stage: 'preflop',
        board: [],
        totalPot: 0,
        sidePots: [],
        players: participants.map((participant) => ({
          id: participant.id,
          name: participant.name,
          seat: participant.seat,
          style: participant.style,
          stack: 1000,
          currentBet: 0,
          folded: false,
          allIn: false,
          eliminated: false,
          holeCards: [],
          revealed: participant.id === 'P0',
          lastAction: '等待',
        })),
        note: '开始',
      },
    ],
    showdown: {
      evaluatedHands: [],
      winners: [],
    },
    winners: [],
    payoutBreakdown: [],
    potBreakdown: [],
  };
}

describe('replay analysis', () => {
  it('marks suspicious bluff line when no-showdown pot is won by aggressor', () => {
    const record = buildRecord([
      {
        id: 'e1',
        step: 1,
        type: 'action',
        stage: 'flop',
        ts: 1,
        actorId: 'P1',
        note: 'P1 加注',
        actionType: 'raise',
        amount: 120,
        toCall: 40,
        stackAfter: 880,
        betAfter: 120,
        potAfter: 180,
        isAllIn: false,
        isFold: false,
        isFullRaise: true,
        teachingTag: 'bluff_pressure',
      },
      {
        id: 'e2',
        step: 2,
        type: 'action',
        stage: 'flop',
        ts: 2,
        actorId: 'P0',
        note: 'P0 弃牌',
        actionType: 'fold',
        amount: 0,
        toCall: 120,
        stackAfter: 900,
        betAfter: 0,
        potAfter: 180,
        isAllIn: false,
        isFold: true,
        isFullRaise: false,
      },
      {
        id: 'e3',
        step: 3,
        type: 'hand_end',
        stage: 'complete',
        ts: 3,
        note: '结束',
        winners: ['P1'],
        totalPot: 180,
      },
    ]);

    const suspicious = detectSuspiciousBluffLines(record);
    expect(suspicious.has(1)).toBe(true);
  });

  it('does not mark suspicious line if showdown occurred', () => {
    const record = buildRecord([
      {
        id: 'e1',
        step: 1,
        type: 'action',
        stage: 'turn',
        ts: 1,
        actorId: 'P1',
        note: 'P1 压力下注',
        actionType: 'bet',
        amount: 200,
        toCall: 0,
        stackAfter: 800,
        betAfter: 200,
        potAfter: 260,
        isAllIn: false,
        isFold: false,
        isFullRaise: true,
        teachingTag: 'pressure_all_in',
      },
      {
        id: 'e2',
        step: 2,
        type: 'showdown',
        stage: 'showdown',
        ts: 2,
        note: '进入摊牌',
        evaluatedHands: [],
      },
      {
        id: 'e3',
        step: 3,
        type: 'hand_end',
        stage: 'complete',
        ts: 3,
        note: '结束',
        winners: ['P1'],
        totalPot: 260,
      },
    ]);

    const suspicious = detectSuspiciousBluffLines(record);
    expect(suspicious.has(1)).toBe(false);
  });

  it('applies pressure threshold in key moments', () => {
    const record = buildRecord([
      {
        id: 'e1',
        step: 1,
        type: 'action',
        stage: 'flop',
        ts: 1,
        actorId: 'P1',
        note: 'P1 小额施压',
        actionType: 'raise',
        amount: 60,
        toCall: 20,
        stackAfter: 940,
        betAfter: 60,
        potAfter: 120,
        isAllIn: false,
        isFold: false,
        isFullRaise: true,
      },
      {
        id: 'e2',
        step: 2,
        type: 'action',
        stage: 'flop',
        ts: 2,
        actorId: 'P1',
        note: 'P1 大额施压',
        actionType: 'raise',
        amount: 140,
        toCall: 40,
        stackAfter: 800,
        betAfter: 140,
        potAfter: 280,
        isAllIn: false,
        isFold: false,
        isFullRaise: true,
      },
      {
        id: 'e3',
        step: 3,
        type: 'elimination',
        stage: 'settlement',
        ts: 3,
        actorId: 'P0',
        note: 'P0 淘汰',
      },
    ]);

    const strict = buildReplayKeyMoments(record, new Map(), 4);
    const loose = buildReplayKeyMoments(record, new Map(), 2);

    expect(strict.some((moment) => moment.step === 1)).toBe(false);
    expect(strict.some((moment) => moment.step === 2)).toBe(true);
    expect(loose.some((moment) => moment.step === 1)).toBe(true);
  });

  it('supports combined timeline filters', () => {
    const record = buildRecord([
      {
        id: 'e1',
        step: 1,
        type: 'action',
        stage: 'flop',
        ts: 1,
        actorId: 'P1',
        note: 'P1 诈唬施压',
        actionType: 'bet',
        amount: 120,
        toCall: 0,
        stackAfter: 880,
        betAfter: 120,
        potAfter: 180,
        isAllIn: false,
        isFold: false,
        isFullRaise: true,
        teachingTag: 'bluff_pressure',
      },
      {
        id: 'e2',
        step: 2,
        type: 'elimination',
        stage: 'settlement',
        ts: 2,
        actorId: 'P0',
        note: 'P0 淘汰',
      },
      {
        id: 'e3',
        step: 3,
        type: 'hand_end',
        stage: 'complete',
        ts: 3,
        note: '结束',
        winners: ['P1'],
        totalPot: 180,
      },
    ]);

    const suspicious = detectSuspiciousBluffLines(record);
    const filtered = filterReplayEvents(record.events, new Set(['bluff', 'elimination']), suspicious, 20, 4);
    const steps = filtered.map((event) => event.step);

    expect(steps).toContain(1);
    expect(steps).toContain(2);
    expect(steps).not.toContain(3);
  });
});
