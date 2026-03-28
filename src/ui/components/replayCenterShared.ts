import { t, type AppLanguage } from '../../i18n';
import { translateHoldemText } from '../holdemText';
import type { GameMode } from '../../types/cards';
import type { CareerProfile } from '../../types/profile';
import type { HandHistoryRecord } from '../../types/replay';
import type { ReplayArchiveImportMode, ReplayArchiveImportSessionDiff } from '../../state/replayArchive';
import type { ReplaySessionHandFilter, ReplaySessionHandInsight, ReplaySessionHandJumpKind } from '../../replay/sessionHistory';
import type { HandStage } from '../../types/game';
import { getHandHistoryRecordKey } from '../../replay/replayRecordKey';

export type PendingReplayImportState = {
  fileName: string;
  archive: import('../../state/replayArchive').ReplayArchive;
  mode: ReplayArchiveImportMode;
  warning?: string;
  selectedSessionIds: string[];
};

export type ReplayCenterViewCache = {
  viewMode: 'hands' | 'sessions';
  selectedSessionKey: string | null;
  selectedSessionHandFilter: ReplaySessionHandFilter;
  compareHighlightDiffs: boolean;
  modeFilter: 'all' | GameMode;
  sessionFilter: 'all' | 'cash' | 'tournament';
  sourceFilter: 'all' | 'current' | 'archive';
  resultFilter: 'all' | 'humanWin' | 'humanLose';
  difficultyFilter: 'all' | 'conservative' | 'standard' | 'aggressive';
  minPot: number;
};

export type LastViewedImportHandState = {
  handKey: string;
  sessionId: string;
  handId: number;
};

export type RecentViewedImportHandState = LastViewedImportHandState & {
  gameMode: GameMode;
  sessionMode: 'cash' | 'tournament';
  aiDifficulty: 'conservative' | 'standard' | 'aggressive';
  timestamp: number;
};

export type PinnedImportHandState = RecentViewedImportHandState;

export type ComparedSessionHandState = {
  handKey: string;
  sessionKey: string;
  sessionId?: string;
  handId: number;
  timestamp: number;
  gameMode: GameMode;
  sessionMode: 'cash' | 'tournament';
  aiDifficulty: 'conservative' | 'standard' | 'aggressive';
  blindInfo: {
    smallBlind: number;
    bigBlind: number;
  };
  totalPot: number;
  profit: number;
  heroWon: boolean;
  markerLabels: string[];
  teachingLabels: string[];
  quickJumps: ReplaySessionHandInsight['quickJumps'];
};

export type ComparedSessionDiffState = {
  hasMultiple: boolean;
  gameMode: boolean;
  sessionMode: boolean;
  aiDifficulty: boolean;
  sessionId: boolean;
  blindInfo: boolean;
  profit: boolean;
  totalPot: boolean;
  heroWon: boolean;
  markerLabels: boolean;
  teachingLabels: boolean;
  quickJumps: boolean;
};

export type ComparedSessionSummaryField = {
  key: keyof ComparedSessionDiffState;
  label: string;
  values: string[];
  tone: 'neutral' | 'cyan' | 'gold' | 'danger' | 'steel';
};

export type ComparedSessionSummary = {
  hasMultiple: boolean;
  differing: ComparedSessionSummaryField[];
  commonLabels: string[];
};

export type ComparedSessionSortMode = 'pinned' | 'latest' | 'swing' | 'pot';

export function formatTime(ts: number, language: AppLanguage = 'zh-CN'): string {
  return new Date(ts).toLocaleString(language === 'zh-CN' ? 'zh-CN' : language, {
    hour12: false,
  });
}

export function handTotalPot(hand: HandHistoryRecord): number {
  return hand.payoutBreakdown.reduce((sum, item) => sum + item.amount, 0);
}

export function modeLabel(mode: GameMode, language: AppLanguage = 'zh-CN'): string {
  if (mode === 'standard') return t(language, 'mode.standard');
  if (mode === 'shortDeck') return t(language, 'mode.shortDeck');
  if (mode === 'omaha') return t(language, 'mode.omaha');
  if (mode === 'plo') return t(language, 'mode.plo');
  return t(language, 'mode.stud');
}

export function sessionModeLabel(mode: 'cash' | 'tournament', language: AppLanguage = 'zh-CN'): string {
  return mode === 'tournament' ? t(language, 'common.tournament') : t(language, 'common.cash');
}

export function difficultyLabel(level: 'conservative' | 'standard' | 'aggressive', language: AppLanguage = 'zh-CN'): string {
  if (level === 'conservative') return t(language, 'common.conservative');
  if (level === 'aggressive') return t(language, 'common.aggressive');
  return t(language, 'common.standard');
}

export function formatProfit(value: number): string {
  return `${value >= 0 ? '+' : ''}${value}`;
}

export function formatCareerEntry(entry: CareerProfile['recentSessions'][number], language: AppLanguage = 'zh-CN'): string {
  if (entry.sessionMode === 'tournament') {
    return entry.finalRank
      ? `${t(language, 'replay.rank')} ${entry.finalRank}/${entry.fieldSize} · +${entry.tournamentPointsEarned} ${t(language, 'replay.points')}`
      : `+${entry.tournamentPointsEarned} ${t(language, 'replay.points')}`;
  }
  return `${entry.totalProfit >= 0 ? '+' : ''}${entry.totalProfit}`;
}

export function formatSessionToken(sessionId: string): string {
  if (sessionId.length <= 20) {
    return sessionId;
  }
  return `${sessionId.slice(0, 8)}...${sessionId.slice(-8)}`;
}

export function replayImportStatusLabel(
  diff: ReplayArchiveImportSessionDiff,
  mode: ReplayArchiveImportMode,
  language: AppLanguage = 'zh-CN',
): string {
  if (!diff.keptInResult) {
    return t(language, 'replay.importOverflowDropped');
  }
  if (diff.currentHandCount > 0) {
    return mode === 'merge' ? t(language, 'replay.importMergeExisting') : t(language, 'replay.importReplaceExisting');
  }
  return t(language, 'replay.importNewSession');
}

export function replayImportStatusTone(diff: ReplayArchiveImportSessionDiff): 'cyan' | 'gold' | 'steel' {
  if (!diff.keptInResult) {
    return 'steel';
  }
  if (diff.currentHandCount > 0) {
    return 'gold';
  }
  return 'cyan';
}

export const SESSION_HAND_FILTERS: Array<{ key: ReplaySessionHandFilter; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'bigPot', label: '大底池' },
  { key: 'allIn', label: '全下' },
  { key: 'teaching', label: '教学命中' },
  { key: 'heroWin', label: '你赢' },
  { key: 'bigLoss', label: '大亏损' },
  { key: 'elimination', label: '淘汰手' },
  { key: 'sidePot', label: '边池手' },
];

export function getSessionHandFilters(language: AppLanguage): Array<{ key: ReplaySessionHandFilter; label: string }> {
  return [
    { key: 'all', label: t(language, 'common.all') },
    { key: 'bigPot', label: t(language, 'replay.bigPot') },
    { key: 'allIn', label: t(language, 'replay.allInHands') },
    { key: 'teaching', label: t(language, 'replay.teachingHit') },
    { key: 'heroWin', label: t(language, 'replay.heroWins') },
    { key: 'bigLoss', label: t(language, 'replay.bigLosses') },
    { key: 'elimination', label: t(language, 'replay.eliminationHands') },
    { key: 'sidePot', label: t(language, 'replay.sidePotHands') },
  ];
}

export function sessionMarkerTone(label: string): 'gold' | 'danger' | 'orange' | 'steel' | 'neutral' {
  if (label === '大底池') return 'gold';
  if (label === '大额亏损' || label === '全下') return 'danger';
  if (label === '淘汰') return 'orange';
  if (label === '边池') return 'steel';
  return 'neutral';
}

export function sessionJumpTone(kind: ReplaySessionHandJumpKind): 'cyan' | 'gold' | 'danger' | 'orange' | 'steel' {
  if (kind === 'bluff') return 'orange';
  if (kind === 'pressure') return 'danger';
  if (kind === 'elimination') return 'gold';
  if (kind === 'settlement') return 'steel';
  return 'cyan';
}

export function translateSessionJumpLabel(label: string, language: AppLanguage): string {
  if (label === '翻牌') return t(language, 'stage.flop');
  if (label === '转牌') return t(language, 'stage.turn');
  if (label === '河牌') return t(language, 'stage.river');
  if (label === '摊牌') return t(language, 'stage.showdown');
  if (label === '诈唬线') {
    if (language === 'ja') return 'ブラフ線';
    if (language === 'fr') return 'Ligne bluff';
    if (language === 'de') return 'Bluff-Linie';
    return 'Bluff line';
  }
  if (label === '全下') {
    if (language === 'ja') return 'オールイン';
    if (language === 'fr') return 'All-in';
    if (language === 'de') return 'All-in';
    return 'All-in';
  }
  if (label === '边池') {
    if (language === 'ja') return 'サイドポット';
    if (language === 'fr') return 'Side pot';
    if (language === 'de') return 'Side Pot';
    return 'Side pot';
  }
  if (label === '淘汰') {
    if (language === 'ja') return '脱落';
    if (language === 'fr') return 'Élimination';
    if (language === 'de') return 'Eliminierung';
    return 'Elimination';
  }
  if (label === '结算') return t(language, 'stage.settlement');
  if (label === '施压') {
    if (language === 'ja') return '圧力';
    if (language === 'fr') return 'Pression';
    if (language === 'de') return 'Druck';
    return 'Pressure';
  }
  if (label.startsWith('大额施压 ')) {
    const amount = label.replace('大额施压 ', '');
    if (language === 'ja') return `高圧 ${amount}`;
    if (language === 'fr') return `Pression ${amount}`;
    if (language === 'de') return `Druck ${amount}`;
    return `Pressure ${amount}`;
  }
  return translateHoldemText(label, language);
}

export function translateSessionJumpNote(note: string, stage: HandStage, language: AppLanguage): string {
  if (note.startsWith('直达') && note.endsWith('阶段')) {
    const stageLabel = t(language, `stage.${stage}`);
    if (language === 'ja') return `${stageLabel} へ移動`;
    if (language === 'fr') return `Aller à ${stageLabel}`;
    if (language === 'de') return `Direkt zu ${stageLabel}`;
    return `Jump to ${stageLabel}`;
  }
  return translateHoldemText(note, language);
}

export function buildSessionJumpPreviewKey(hand: HandHistoryRecord, step: number, label: string): string {
  return `${getHandHistoryRecordKey(hand)}:${step}:${label}`;
}

export function buildSessionCompareEntry(sessionKey: string, item: ReplaySessionHandInsight): ComparedSessionHandState {
  const hand = item.record;
  const markerLabels = [
    item.isBigPot ? '大底池' : null,
    item.isBigLoss ? '大额亏损' : null,
    item.hasAllIn ? '全下' : null,
    item.causedElimination ? '淘汰' : null,
    item.hasSidePot ? '边池' : null,
    item.reachedShowdown ? '摊牌' : null,
    item.heroWon ? '你赢' : null,
  ].filter((value): value is string => Boolean(value));

  return {
    handKey: getHandHistoryRecordKey(hand),
    sessionKey,
    sessionId: hand.sessionId,
    handId: hand.handId,
    timestamp: hand.timestamp,
    gameMode: hand.gameMode,
    sessionMode: hand.sessionMode,
    aiDifficulty: hand.aiDifficulty,
    blindInfo: hand.blindInfo,
    totalPot: item.totalPot,
    profit: item.profit,
    heroWon: item.heroWon,
    markerLabels,
    teachingLabels: item.teachingLabels.slice(0, 3),
    quickJumps: item.quickJumps,
  };
}

function compareLabelSet(values: string[]): string {
  return [...values].sort((left, right) => left.localeCompare(right, 'zh-CN')).join('|');
}

function uniqueValues(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    result.push(value);
  }

  return result;
}

export function buildComparedSessionDiffState(items: ComparedSessionHandState[]): ComparedSessionDiffState {
  const hasMultiple = items.length > 1;
  const differs = <T,>(values: T[]): boolean => hasMultiple && new Set(values).size > 1;

  return {
    hasMultiple,
    gameMode: differs(items.map((item) => item.gameMode)),
    sessionMode: differs(items.map((item) => item.sessionMode)),
    aiDifficulty: differs(items.map((item) => item.aiDifficulty)),
    sessionId: differs(items.map((item) => item.sessionId ?? item.sessionKey)),
    blindInfo: differs(items.map((item) => `${item.blindInfo.smallBlind}/${item.blindInfo.bigBlind}`)),
    profit: differs(items.map((item) => item.profit)),
    totalPot: differs(items.map((item) => item.totalPot)),
    heroWon: differs(items.map((item) => item.heroWon)),
    markerLabels: differs(items.map((item) => compareLabelSet(item.markerLabels))),
    teachingLabels: differs(items.map((item) => compareLabelSet(item.teachingLabels))),
    quickJumps: differs(items.map((item) => compareLabelSet(item.quickJumps.map((jump) => `${jump.kind}:${jump.label}`)))),
  };
}

export function buildComparedSessionSummary(items: ComparedSessionHandState[], language: AppLanguage = 'zh-CN'): ComparedSessionSummary {
  const diffState = buildComparedSessionDiffState(items);
  const fields: ComparedSessionSummaryField[] = [
    {
      key: 'gameMode',
      label: t(language, 'common.mode'),
      values: uniqueValues(items.map((item) => modeLabel(item.gameMode, language))),
      tone: 'cyan',
    },
    {
      key: 'sessionMode',
      label: t(language, 'common.session'),
      values: uniqueValues(items.map((item) => sessionModeLabel(item.sessionMode, language))),
      tone: 'steel',
    },
    {
      key: 'aiDifficulty',
      label: t(language, 'main.aiDifficulty'),
      values: uniqueValues(items.map((item) => difficultyLabel(item.aiDifficulty, language))),
      tone: 'gold',
    },
    {
      key: 'sessionId',
      label: t(language, 'replay.session'),
      values: uniqueValues(items.map((item) => (item.sessionId ? formatSessionToken(item.sessionId) : item.sessionKey))),
      tone: 'steel',
    },
    {
      key: 'blindInfo',
      label: t(language, 'common.blinds'),
      values: uniqueValues(items.map((item) => `${item.blindInfo.smallBlind}/${item.blindInfo.bigBlind}`)),
      tone: 'neutral',
    },
    {
      key: 'profit',
      label: t(language, 'replay.profit'),
      values: uniqueValues(items.map((item) => formatProfit(item.profit))),
      tone: 'danger',
    },
    {
      key: 'totalPot',
      label: t(language, 'common.pot'),
      values: uniqueValues(items.map((item) => `${item.totalPot}`)),
      tone: 'gold',
    },
    {
      key: 'heroWon',
      label: t(language, 'replay.result'),
      values: uniqueValues(items.map((item) => (item.heroWon ? t(language, 'replay.youWon') : t(language, 'replay.youLost')))),
      tone: 'danger',
    },
    {
      key: 'markerLabels',
      label: t(language, 'replay.markers'),
      values: uniqueValues(items.flatMap((item) => item.markerLabels).map((label) => translateSessionMarker(label, language))),
      tone: 'gold',
    },
    {
      key: 'teachingLabels',
      label: t(language, 'replay.teaching'),
      values: uniqueValues(items.flatMap((item) => item.teachingLabels)),
      tone: 'cyan',
    },
    {
      key: 'quickJumps',
      label: t(language, 'replay.keyMoments'),
      values: uniqueValues(items.flatMap((item) => item.quickJumps.map((jump) => translateSessionJumpLabel(jump.label, language)))),
      tone: 'steel',
    },
  ];

  return {
    hasMultiple: diffState.hasMultiple,
    differing: fields.filter((field) => diffState[field.key] && field.values.length > 0),
    commonLabels: fields.filter((field) => !diffState[field.key] && field.values.length > 0).map((field) => field.label),
  };
}

export function translateSessionMarker(label: string, language: AppLanguage): string {
  const markerKeyMap: Record<string, string> = {
    '大底池': 'replay.bigPot',
    '大额亏损': 'replay.bigLoss',
    '全下': 'replay.allIn',
    '淘汰': 'replay.elimination',
    '边池': 'replay.sidePot',
    '摊牌': 'replay.showdown',
    '你赢': 'replay.youWon',
    '你输': 'replay.youLost',
  };
  const key = markerKeyMap[label];
  return key ? t(language, key) : label;
}

export function sortComparedSessionHands(items: ComparedSessionHandState[], mode: ComparedSessionSortMode): ComparedSessionHandState[] {
  if (mode === 'pinned') {
    return items;
  }

  const sorted = [...items];

  if (mode === 'latest') {
    return sorted.sort((left, right) => right.timestamp - left.timestamp || right.handId - left.handId);
  }

  if (mode === 'swing') {
    return sorted.sort(
      (left, right) =>
        Math.abs(right.profit) - Math.abs(left.profit) ||
        right.totalPot - left.totalPot ||
        right.timestamp - left.timestamp,
    );
  }

  return sorted.sort(
    (left, right) =>
      right.totalPot - left.totalPot ||
      Math.abs(right.profit) - Math.abs(left.profit) ||
      right.timestamp - left.timestamp,
  );
}

export function compareFieldClass(enabled: boolean, diffState: ComparedSessionDiffState, isDifferent: boolean): string {
  if (!enabled || !diffState.hasMultiple) {
    return '';
  }
  return isDifferent ? ' compare-diff' : ' compare-muted';
}
