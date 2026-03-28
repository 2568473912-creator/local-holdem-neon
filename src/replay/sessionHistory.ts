import type { Card } from '../types/cards';
import type { AIDifficulty, HandStage, SessionMode } from '../types/game';
import type { GameMode } from '../types/cards';
import type { ActionTeachingTag, HandHistoryRecord } from '../types/replay';
import { buildReplayKeyMoments, detectSuspiciousBluffLines, type ReplayKeyMomentKind } from './replayAnalysis';

export interface ReplaySessionSummary {
  key: string;
  sessionId?: string;
  handCount: number;
  startedAt: number;
  endedAt: number;
  firstHandId: number;
  lastHandId: number;
  mode: GameMode;
  sessionMode: SessionMode;
  aiDifficulty: AIDifficulty;
  totalProfit: number;
  wins: number;
  winRate: number;
  biggestPot: number;
}

export interface ReplaySessionGroup {
  summary: ReplaySessionSummary;
  hands: HandHistoryRecord[];
}

export type ReplaySessionHandFilter = 'all' | 'bigPot' | 'allIn' | 'teaching' | 'heroWin' | 'bigLoss' | 'elimination' | 'sidePot';

export interface ReplaySessionHandInsight {
  record: HandHistoryRecord;
  profit: number;
  totalPot: number;
  heroWon: boolean;
  hasAllIn: boolean;
  hasTeachingTag: boolean;
  teachingTags: ActionTeachingTag[];
  teachingLabels: string[];
  isBigPot: boolean;
  isBigLoss: boolean;
  causedElimination: boolean;
  eliminationPlayerIds: string[];
  hasSidePot: boolean;
  reachedShowdown: boolean;
  quickJumps: ReplaySessionHandJump[];
}

export interface ReplaySessionHandAnalysis {
  bigPotThreshold: number;
  bigLossThreshold: number;
  items: ReplaySessionHandInsight[];
  counts: Record<ReplaySessionHandFilter, number>;
}

export type ReplaySessionHandJumpKind = ReplayKeyMomentKind | 'street';

export interface ReplaySessionHandJump {
  step: number;
  targetStep: number;
  label: string;
  note: string;
  kind: ReplaySessionHandJumpKind;
  stage: HandStage;
  stageLabel: string;
  totalPot: number;
  boardCount: number;
  boardCards: Card[];
  sidePotCount: number;
  snapshotNote: string;
}

function stageJumpLabel(stage: 'flop' | 'turn' | 'river' | 'showdown'): string {
  if (stage === 'flop') return '翻牌';
  if (stage === 'turn') return '转牌';
  if (stage === 'river') return '河牌';
  return '摊牌';
}

function replayStageLabel(stage: HandStage): string {
  if (stage === 'preflop') return '翻前';
  if (stage === 'flop') return '翻牌';
  if (stage === 'turn') return '转牌';
  if (stage === 'river') return '河牌';
  if (stage === 'showdown') return '摊牌';
  if (stage === 'settlement') return '结算';
  return '完成';
}

function expectedBoardCountForStage(stage: HandStage): number {
  if (stage === 'flop') return 3;
  if (stage === 'turn') return 4;
  if (stage === 'river' || stage === 'showdown' || stage === 'settlement' || stage === 'complete') return 5;
  return 0;
}

function normalizeMomentLabel(label: string): string {
  if (label === '可疑诈唬线') return '诈唬线';
  if (label === '全下节点') return '全下';
  if (label === '边池创建') return '边池';
  if (label === '玩家淘汰') return '淘汰';
  if (label === '进入摊牌') return '摊牌';
  if (label === '手牌结束') return '结算';
  if (label.startsWith('大额施压')) return '施压';
  return label;
}

function resolveReplayJumpTargetStep(hand: HandHistoryRecord, eventStep: number): number {
  const targetIndex = hand.snapshots.findIndex((snapshot) => snapshot.step >= eventStep);
  if (targetIndex >= 0) {
    return targetIndex;
  }
  return Math.max(0, hand.snapshots.length - 1);
}

function buildReplaySessionHandJumps(hand: HandHistoryRecord): ReplaySessionHandJump[] {
  const jumps: ReplaySessionHandJump[] = [];
  const seenSteps = new Set<number>();
  const buildPreviewFields = (targetStep: number) => {
    const snapshot = hand.snapshots[targetStep] ?? hand.snapshots[Math.max(0, hand.snapshots.length - 1)];
    if (!snapshot) {
      return {
        stage: 'complete' as HandStage,
        stageLabel: replayStageLabel('complete'),
        totalPot: handPot(hand),
        boardCount: hand.communityCardsRevealOrder.length,
        boardCards: hand.communityCardsRevealOrder.slice(0, 5),
        sidePotCount: Math.max(0, hand.potBreakdown.length - 1),
        snapshotNote: '回放快照缺失',
      };
    }
    const expectedBoardCount = expectedBoardCountForStage(snapshot.stage);
    const boardCards = snapshot.board.length > 0 ? snapshot.board : hand.communityCardsRevealOrder.slice(0, expectedBoardCount);
    return {
      stage: snapshot.stage,
      stageLabel: replayStageLabel(snapshot.stage),
      totalPot: snapshot.totalPot,
      boardCount: boardCards.length,
      boardCards,
      sidePotCount: snapshot.sidePots.length,
      snapshotNote: snapshot.note,
    };
  };
  const addJump = (jump: ReplaySessionHandJump) => {
    if (seenSteps.has(jump.step)) {
      return;
    }
    seenSteps.add(jump.step);
    jumps.push(jump);
  };

  const suspiciousBluffLines = detectSuspiciousBluffLines(hand);
  const keyMoments = buildReplayKeyMoments(hand, suspiciousBluffLines, 4, 8).filter((moment) => moment.label !== '手牌结束');
  const stagePriority: Array<'flop' | 'turn' | 'river' | 'showdown'> = ['flop', 'turn', 'river', 'showdown'];

  for (const stage of stagePriority) {
    const snapshotIndex = hand.snapshots.findIndex((item) => item.stage === stage);
    const snapshot = snapshotIndex >= 0 ? hand.snapshots[snapshotIndex] : undefined;
    if (!snapshot) {
      continue;
    }
    addJump({
      step: snapshot.step,
      targetStep: snapshotIndex,
      label: stageJumpLabel(stage),
      note: `直达${stageJumpLabel(stage)}阶段`,
      kind: 'street',
      ...buildPreviewFields(snapshotIndex),
    });
  }

  for (const moment of keyMoments) {
    const targetStep = resolveReplayJumpTargetStep(hand, moment.step);
    addJump({
      step: moment.step,
      targetStep,
      label: normalizeMomentLabel(moment.label),
      note: moment.note,
      kind: moment.kind,
      ...buildPreviewFields(targetStep),
    });
  }

  return jumps
    .sort((a, b) => {
      if (a.step !== b.step) {
        return a.step - b.step;
      }
      return a.label.localeCompare(b.label, 'zh-CN');
    })
    .slice(0, 6);
}

export function getReplaySessionKey(hand: HandHistoryRecord): string {
  return hand.sessionId ?? `legacy-${hand.timestamp}`;
}

function handProfit(hand: HandHistoryRecord, humanId: string): number {
  const start = hand.startingChips[humanId] ?? 0;
  const end = hand.endingChips[humanId] ?? start;
  return end - start;
}

function handPot(hand: HandHistoryRecord): number {
  return hand.payoutBreakdown.reduce((sum, item) => sum + item.amount, 0);
}

function bigPotThresholdForHands(hands: HandHistoryRecord[]): number {
  if (hands.length === 0) {
    return 0;
  }

  const pots = hands.map((hand) => handPot(hand)).sort((a, b) => a - b);
  const percentileIndex = Math.max(0, Math.floor((pots.length - 1) * 0.75));
  const percentilePot = pots[percentileIndex] ?? 0;
  const blindBaseline = Math.max(...hands.map((hand) => hand.blindInfo.bigBlind * 8));
  return Math.max(percentilePot, blindBaseline);
}

function bigLossThresholdForHands(hands: HandHistoryRecord[], humanId: string): number {
  const losses = hands
    .map((hand) => Math.max(0, -handProfit(hand, humanId)))
    .filter((loss) => loss > 0)
    .sort((a, b) => a - b);

  if (losses.length === 0) {
    return 0;
  }

  const percentileIndex = Math.max(0, Math.floor((losses.length - 1) * 0.75));
  const percentileLoss = losses[percentileIndex] ?? 0;
  const blindBaseline = Math.max(...hands.map((hand) => hand.blindInfo.bigBlind * 6));
  return Math.max(percentileLoss, blindBaseline);
}

export function summarizeReplaySessions(history: HandHistoryRecord[], humanId = 'P0'): ReplaySessionSummary[] {
  const grouped = new Map<string, HandHistoryRecord[]>();

  for (const hand of history) {
    const key = getReplaySessionKey(hand);
    const bucket = grouped.get(key);
    if (bucket) {
      bucket.push(hand);
    } else {
      grouped.set(key, [hand]);
    }
  }

  return [...grouped.entries()]
    .map(([key, hands]) => {
      const ordered = [...hands].sort((a, b) => {
        if (a.handId !== b.handId) {
          return a.handId - b.handId;
        }
        return a.timestamp - b.timestamp;
      });
      const first = ordered[0];
      const last = ordered[ordered.length - 1];
      const wins = ordered.filter((hand) => hand.winners.includes(humanId)).length;
      const totalProfit = ordered.reduce((sum, hand) => sum + handProfit(hand, humanId), 0);
      const biggestPot = ordered.reduce((max, hand) => Math.max(max, handPot(hand)), 0);

      return {
        key,
        sessionId: first.sessionId,
        handCount: ordered.length,
        startedAt: first.timestamp,
        endedAt: last.timestamp,
        firstHandId: first.handId,
        lastHandId: last.handId,
        mode: first.gameMode,
        sessionMode: first.sessionMode,
        aiDifficulty: first.aiDifficulty,
        totalProfit,
        wins,
        winRate: ordered.length > 0 ? Number(((wins / ordered.length) * 100).toFixed(1)) : 0,
        biggestPot,
      };
    })
    .sort((a, b) => b.endedAt - a.endedAt);
}

export function buildReplaySessionGroups(history: HandHistoryRecord[], humanId = 'P0'): ReplaySessionGroup[] {
  const summaryByKey = new Map(summarizeReplaySessions(history, humanId).map((summary) => [summary.key, summary]));
  const grouped = new Map<string, HandHistoryRecord[]>();

  for (const hand of history) {
    const key = getReplaySessionKey(hand);
    const bucket = grouped.get(key);
    if (bucket) {
      bucket.push(hand);
    } else {
      grouped.set(key, [hand]);
    }
  }

  return [...grouped.entries()]
    .map(([key, hands]) => ({
      summary: summaryByKey.get(key)!,
      hands: [...hands].sort((a, b) => {
        if (a.handId !== b.handId) {
          return a.handId - b.handId;
        }
        return a.timestamp - b.timestamp;
      }),
    }))
    .sort((a, b) => b.summary.endedAt - a.summary.endedAt);
}

export function analyzeReplaySessionHands(hands: HandHistoryRecord[], humanId = 'P0'): ReplaySessionHandAnalysis {
  const bigPotThreshold = bigPotThresholdForHands(hands);
  const bigLossThreshold = bigLossThresholdForHands(hands, humanId);
  const items = hands.map((hand) => {
    const profit = handProfit(hand, humanId);
    const totalPot = handPot(hand);
    const heroWon = hand.winners.includes(humanId);
    const teachingTags = [...new Set(hand.actions.map((action) => action.teachingTag).filter((tag): tag is ActionTeachingTag => Boolean(tag)))];
    const teachingLabels = [...new Set(hand.actions.map((action) => action.teachingLabel).filter((label): label is string => Boolean(label)))];
    const hasAllIn = hand.actions.some((action) => action.isAllIn || action.actionType === 'all-in');
    const eliminationPlayerIds = [...new Set(hand.events.filter((event) => event.type === 'elimination').map((event) => event.actorId).filter((id): id is string => Boolean(id)))];
    const reachedShowdown = hand.showdown.evaluatedHands.length > 0;

    return {
      record: hand,
      profit,
      totalPot,
      heroWon,
      hasAllIn,
      hasTeachingTag: teachingTags.length > 0,
      teachingTags,
      teachingLabels,
      isBigPot: totalPot >= bigPotThreshold && totalPot > 0,
      isBigLoss: profit < 0 && Math.abs(profit) >= bigLossThreshold && bigLossThreshold > 0,
      causedElimination: eliminationPlayerIds.length > 0,
      eliminationPlayerIds,
      hasSidePot: hand.potBreakdown.length > 1 || hand.events.some((event) => event.type === 'side_pot'),
      reachedShowdown,
      quickJumps: buildReplaySessionHandJumps(hand),
    };
  });

  const counts: Record<ReplaySessionHandFilter, number> = {
    all: items.length,
    bigPot: items.filter((item) => item.isBigPot).length,
    allIn: items.filter((item) => item.hasAllIn).length,
    teaching: items.filter((item) => item.hasTeachingTag).length,
    heroWin: items.filter((item) => item.heroWon).length,
    bigLoss: items.filter((item) => item.isBigLoss).length,
    elimination: items.filter((item) => item.causedElimination).length,
    sidePot: items.filter((item) => item.hasSidePot).length,
  };

  return {
    bigPotThreshold,
    bigLossThreshold,
    items,
    counts,
  };
}

export function filterReplaySessionHandInsights(
  items: ReplaySessionHandInsight[],
  filter: ReplaySessionHandFilter,
): ReplaySessionHandInsight[] {
  switch (filter) {
    case 'bigPot':
      return items.filter((item) => item.isBigPot);
    case 'allIn':
      return items.filter((item) => item.hasAllIn);
    case 'teaching':
      return items.filter((item) => item.hasTeachingTag);
    case 'heroWin':
      return items.filter((item) => item.heroWon);
    case 'bigLoss':
      return items.filter((item) => item.isBigLoss);
    case 'elimination':
      return items.filter((item) => item.causedElimination);
    case 'sidePot':
      return items.filter((item) => item.hasSidePot);
    case 'all':
    default:
      return items;
  }
}
