import { describe, expect, it } from 'vitest';
import {
  buildComparedSessionSummary,
  sortComparedSessionHands,
  type ComparedSessionHandState,
} from '../src/ui/components/replayCenterShared';

function buildComparedHand(overrides: Partial<ComparedSessionHandState>): ComparedSessionHandState {
  return {
    handKey: 'session-a:1:1000',
    sessionKey: 'session-a',
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
    totalPot: 120,
    profit: 40,
    heroWon: true,
    markerLabels: ['大底池'],
    teachingLabels: ['价值下注'],
    quickJumps: [
      {
        step: 2,
        targetStep: 1,
        label: '翻牌',
        note: '直达翻牌',
        kind: 'street',
        stage: 'flop',
        stageLabel: '翻牌',
        totalPot: 120,
        boardCount: 3,
        boardCards: [],
        sidePotCount: 0,
        snapshotNote: '翻牌面已发出',
      },
    ],
    ...overrides,
  };
}

describe('replay center compare helpers', () => {
  it('builds a readable diff summary for compared hands', () => {
    const summary = buildComparedSessionSummary([
      buildComparedHand(),
      buildComparedHand({
        handKey: 'session-b:7:2000',
        sessionKey: 'session-b',
        sessionId: 'session-b',
        handId: 7,
        timestamp: 2000,
        aiDifficulty: 'aggressive',
        profit: -160,
        totalPot: 340,
        heroWon: false,
        markerLabels: ['全下', '边池'],
        teachingLabels: ['施压全下'],
        quickJumps: [
          {
            step: 6,
            targetStep: 3,
            label: '全下',
            note: '直达全下',
            kind: 'pressure',
            stage: 'turn',
            stageLabel: '转牌',
            totalPot: 340,
            boardCount: 4,
            boardCards: [],
            sidePotCount: 1,
            snapshotNote: '全下后建立边池',
          },
        ],
      }),
    ]);

    expect(summary.hasMultiple).toBe(true);
    expect(summary.differing.map((field) => field.label)).toEqual(
      expect.arrayContaining(['AI 难度', '会话', '盈亏', '底池', '结果', '标记', '教学', '关键节点']),
    );
    expect(summary.commonLabels).toEqual(expect.arrayContaining(['玩法', '局制', '盲注']));
  });

  it('sorts compared hands by requested emphasis', () => {
    const items = [
      buildComparedHand({
        handKey: 'A',
        timestamp: 1000,
        handId: 3,
        totalPot: 200,
        profit: 30,
      }),
      buildComparedHand({
        handKey: 'B',
        timestamp: 3000,
        handId: 4,
        totalPot: 160,
        profit: -220,
      }),
      buildComparedHand({
        handKey: 'C',
        timestamp: 2000,
        handId: 5,
        totalPot: 480,
        profit: 90,
      }),
    ];

    expect(sortComparedSessionHands(items, 'pinned').map((item) => item.handKey)).toEqual(['A', 'B', 'C']);
    expect(sortComparedSessionHands(items, 'latest').map((item) => item.handKey)).toEqual(['B', 'C', 'A']);
    expect(sortComparedSessionHands(items, 'swing').map((item) => item.handKey)).toEqual(['B', 'C', 'A']);
    expect(sortComparedSessionHands(items, 'pot').map((item) => item.handKey)).toEqual(['C', 'A', 'B']);
  });
});
