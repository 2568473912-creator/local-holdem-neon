import { Fragment, useEffect, useMemo, useState } from 'react';
import { t } from '../../i18n';
import { useLanguage } from '../../i18n/languageContext';
import { getHandHistoryRecordKey } from '../../replay/replayRecordKey';
import { translateHoldemText } from '../holdemText';
import { StaticCardView } from './StaticCardView';
import {
  buildComparedSessionSummary,
  getSessionHandFilters,
  buildSessionJumpPreviewKey,
  compareFieldClass,
  difficultyLabel,
  formatProfit,
  formatSessionToken,
  formatTime,
  modeLabel,
  replayImportStatusLabel,
  replayImportStatusTone,
  sessionJumpTone,
  sessionMarkerTone,
  sessionModeLabel,
  sortComparedSessionHands,
  translateSessionJumpLabel,
  translateSessionJumpNote,
  translateSessionMarker,
type ComparedSessionSortMode,
} from './replayCenterShared';
import type { ReplaySessionArchivePanelProps } from './replaySessionsShared';

let importDiffTableExpandedCache = false;
let expandedDiffSessionIdsCache: string[] = [];
let compareSortModeCache: ComparedSessionSortMode = 'pinned';

type SessionDetailTab = 'overview' | 'hands' | 'compare';
type CompareDigestFocus =
  | { kind: 'core'; key: string }
  | { kind: 'marker'; value: string }
  | { kind: 'teaching'; value: string }
  | { kind: 'jump'; value: string };

function formatSummaryValues(values: string[]): string {
  if (values.length <= 3) {
    return values.join(' / ');
  }
  return `${values.slice(0, 3).join(' / ')} +${values.length - 3}`;
}

function uniqueCompareValues(values: string[]): string[] {
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

function sameCompareDigestFocus(left: CompareDigestFocus | null, right: CompareDigestFocus): boolean {
  if (!left || left.kind !== right.kind) {
    return false;
  }
  if (left.kind === 'core' && right.kind === 'core') {
    return left.key === right.key;
  }
  return 'value' in left && 'value' in right && left.value === right.value;
}

export function ReplaySessionArchivePanel({
  archiveImportRef,
  replayArchiveSummary,
  currentSessionId,
  pendingReplayImport,
  pendingReplayImportPreview,
  selectedReplayImportArchive,
  pendingReplayImportSessions,
  lastViewedImportHand,
  recentViewedImportHands,
  pinnedImportHands,
  replaySessionSummaries,
  selectedSessionGroup,
  selectedSessionAnalysis,
  selectedSessionFilteredHands,
  selectedSessionHandFilter,
  visibleComparedSessionHands,
  comparedSessionDiffs,
  compareHighlightDiffs,
  previewedSessionJumpKey,
  archiveFeedback,
  renderHandIdPills,
  onArchiveImportFileChange,
  onImportReplayArchiveClick,
  onExportReplayArchive,
  onClearReplayArchive,
  onCancelReplayImport,
  onConfirmReplayImport,
  onToggleReplayImportSession,
  onSelectAllReplayImportSessions,
  onClearReplayImportSessions,
  onOpenImportHandReplay,
  onTogglePinnedImportHand,
  onClearPinnedImportHands,
  onClearRecentImportHands,
  onSelectSessionKey,
  onSelectedSessionHandFilterChange,
  onSwitchToHands,
  onCompareHighlightDiffsChange,
  onClearComparedSessionHands,
  onRemoveComparedSessionHand,
  onPreviewSessionJumpKeyChange,
  onOpenReplay,
  onToggleComparedSessionHand,
  onReady,
}: ReplaySessionArchivePanelProps) {
  const language = useLanguage();
  const isIpadLike = typeof document !== 'undefined' && document.documentElement.dataset.ipadLike === 'true';
  const [isDiffTableExpanded, setIsDiffTableExpanded] = useState(() => importDiffTableExpandedCache);
  const [expandedDiffSessionIds, setExpandedDiffSessionIds] = useState<string[]>(() => expandedDiffSessionIdsCache);
  const [compareSortMode, setCompareSortMode] = useState<ComparedSessionSortMode>(() => compareSortModeCache);
  const [sessionDetailTab, setSessionDetailTab] = useState<SessionDetailTab>('overview');
  const [compareDigestFocus, setCompareDigestFocus] = useState<CompareDigestFocus | null>(null);

  useEffect(() => {
    onReady?.();
  }, [onReady]);

  useEffect(() => {
    importDiffTableExpandedCache = isDiffTableExpanded;
  }, [isDiffTableExpanded]);

  useEffect(() => {
    expandedDiffSessionIdsCache = expandedDiffSessionIds;
  }, [expandedDiffSessionIds]);

  useEffect(() => {
    compareSortModeCache = compareSortMode;
  }, [compareSortMode]);

  const diffSummary = pendingReplayImportPreview
    ? {
        sessionCount: pendingReplayImportPreview.sessionDiffs.length,
        newSessions: pendingReplayImportPreview.sessionDiffs.filter((diff) => diff.newHandCount > 0).length,
        duplicateSessions: pendingReplayImportPreview.sessionDiffs.filter((diff) => diff.duplicateHandCount > 0).length,
        keptSessions: pendingReplayImportPreview.sessionDiffs.filter((diff) => diff.keptInResult).length,
      }
    : null;

  const comparedSummary = useMemo(() => buildComparedSessionSummary(visibleComparedSessionHands, language), [language, visibleComparedSessionHands]);
  const sortedComparedSessionHands = useMemo(
    () => sortComparedSessionHands(visibleComparedSessionHands, compareSortMode),
    [compareSortMode, visibleComparedSessionHands],
  );
  const compareDigest = useMemo(() => {
    const coreFields = comparedSummary.differing.filter(
      (field) => field.key !== 'markerLabels' && field.key !== 'teachingLabels' && field.key !== 'quickJumps',
    );
    return {
      coreFields,
      markerItems: uniqueCompareValues(
        visibleComparedSessionHands.flatMap((item) => item.markerLabels.map((label) => translateSessionMarker(label, language))),
      ),
      teachingItems: uniqueCompareValues(visibleComparedSessionHands.flatMap((item) => item.teachingLabels)),
      jumpItems: uniqueCompareValues(
        visibleComparedSessionHands.flatMap((item) => item.quickJumps.map((jump) => translateSessionJumpLabel(jump.label, language))),
      ),
    };
  }, [comparedSummary.differing, language, visibleComparedSessionHands]);
  const sessionHandFilters = useMemo(() => getSessionHandFilters(language), [language]);
  const compareSortOptions = useMemo(
    () => [
      { key: 'pinned' as const, label: t(language, 'replay.sortPinned') },
      { key: 'latest' as const, label: t(language, 'replay.sortLatest') },
      { key: 'swing' as const, label: t(language, 'replay.sortSwing') },
      { key: 'pot' as const, label: t(language, 'replay.sortPot') },
    ],
    [language],
  );
  const compareSummaryBoardId = 'session-compare-summary-board';

  const scrollCompareTarget = (targetId: string) => {
    if (typeof document === 'undefined') {
      return;
    }
    window.requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    });
  };

  const activateCompareDigestFocus = (focus: CompareDigestFocus, targetId: string) => {
    setCompareDigestFocus((prev) => (sameCompareDigestFocus(prev, focus) ? null : focus));
    scrollCompareTarget(targetId);
  };

  const matchesCompareDigestFocus = (
    item: (typeof sortedComparedSessionHands)[number],
    focus: CompareDigestFocus | null,
  ): boolean => {
    if (!focus) {
      return false;
    }
    if (focus.kind === 'marker') {
      return item.markerLabels.map((label) => translateSessionMarker(label, language)).includes(focus.value);
    }
    if (focus.kind === 'teaching') {
      return item.teachingLabels.includes(focus.value);
    }
    if (focus.kind === 'jump') {
      return item.quickJumps.map((jump) => translateSessionJumpLabel(jump.label, language)).includes(focus.value);
    }
    return false;
  };
  const compareCoreFieldFocusClass = (key: string): string => {
    if (compareDigestFocus?.kind !== 'core') {
      return '';
    }
    return compareDigestFocus.key === key ? ' digest-focused' : ' digest-dimmed';
  };
  const activeCompareDigestLabel = useMemo(() => {
    if (!compareDigestFocus) {
      return null;
    }
    if (compareDigestFocus.kind === 'core') {
      return comparedSummary.differing.find((field) => field.key === compareDigestFocus.key)?.label ?? null;
    }
    return compareDigestFocus.value;
  }, [compareDigestFocus, comparedSummary.differing]);

  const findCompareTargetId = (focus: CompareDigestFocus): string => {
    if (focus.kind === 'core') {
      return compareSummaryBoardId;
    }
    const matched = sortedComparedSessionHands.find((item) => matchesCompareDigestFocus(item, focus));
    return matched ? `compare-card-${matched.handKey}` : 'session-compare-grid';
  };

  const toggleDiffSessionExpanded = (sessionId: string) => {
    setExpandedDiffSessionIds((prev) => {
      if (prev.includes(sessionId)) {
        return prev.filter((entry) => entry !== sessionId);
      }
      return [...prev, sessionId];
    });
  };

  const canShowCompareTab = visibleComparedSessionHands.length > 0;
  const showIpadSessionDetailTabs = isIpadLike && Boolean(selectedSessionGroup);
  const showCompareTab = showIpadSessionDetailTabs || canShowCompareTab;
  const resolvedSessionDetailTab = sessionDetailTab === 'compare' && !showCompareTab ? 'overview' : sessionDetailTab;
  const sessionDetailTabs: Array<{ key: SessionDetailTab; label: string }> = [
    { key: 'overview', label: t(language, 'replay.sessionTabOverview') },
    { key: 'hands', label: t(language, 'replay.sessionTabHands') },
    ...(showCompareTab ? [{ key: 'compare' as const, label: t(language, 'replay.sessionTabCompare') }] : []),
  ];
  const selectedSessionShowdownCount = selectedSessionAnalysis?.items.filter((item) => item.reachedShowdown).length ?? 0;
  const sessionDetailMetrics = selectedSessionGroup ? (
    <div className="session-detail-grid">
      <div>
        <span>{t(language, 'replay.handCount')}</span>
        <strong>{selectedSessionGroup.summary.handCount}</strong>
      </div>
      <div>
        <span>{t(language, 'replay.winningHands')}</span>
        <strong>
          {t(language, 'replay.winHandsValue', {
            wins: selectedSessionGroup.summary.wins,
            rate: selectedSessionGroup.summary.winRate,
          })}
        </strong>
      </div>
      <div>
        <span>{t(language, 'replay.totalProfit')}</span>
        <strong className={selectedSessionGroup.summary.totalProfit >= 0 ? 'up' : 'down'}>
          {formatProfit(selectedSessionGroup.summary.totalProfit)}
        </strong>
      </div>
      <div>
        <span>{t(language, 'replay.biggestPot')}</span>
        <strong>{selectedSessionGroup.summary.biggestPot}</strong>
      </div>
    </div>
  ) : null;
  const sessionDetailMeta = selectedSessionGroup ? (
    <div className="session-detail-meta">
      <span>{t(language, 'replay.startAt', { time: formatTime(selectedSessionGroup.summary.startedAt, language) })}</span>
      <span>{t(language, 'replay.endAt', { time: formatTime(selectedSessionGroup.summary.endedAt, language) })}</span>
      <span>{t(language, 'replay.handRange', { first: selectedSessionGroup.summary.firstHandId, last: selectedSessionGroup.summary.lastHandId })}</span>
      {selectedSessionAnalysis && <span>{t(language, 'replay.bigPotThreshold', { value: selectedSessionAnalysis.bigPotThreshold })}</span>}
      {selectedSessionAnalysis && selectedSessionAnalysis.bigLossThreshold > 0 && (
        <span>{t(language, 'replay.bigLossThreshold', { value: selectedSessionAnalysis.bigLossThreshold })}</span>
      )}
    </div>
  ) : null;
  const sessionDetailFilterRow = selectedSessionAnalysis ? (
    <div className="session-detail-filter-row">
      {sessionHandFilters.map((filter) => (
        <button
          key={filter.key}
          className={`session-filter-chip ${selectedSessionHandFilter === filter.key ? 'active' : ''}`}
          type="button"
          onClick={() => {
            onSelectedSessionHandFilterChange(filter.key);
            if (showIpadSessionDetailTabs) {
              setSessionDetailTab('hands');
            }
          }}
        >
          {filter.label}
          <span>{selectedSessionAnalysis.counts[filter.key]}</span>
        </button>
      ))}
    </div>
  ) : null;
  const sessionDetailMarkerStrip = selectedSessionAnalysis ? (
    <div className="session-detail-marker-strip">
      <span>{t(language, 'replay.markerCountAllIn', { count: selectedSessionAnalysis.counts.allIn })}</span>
      <span>{t(language, 'replay.markerCountTeaching', { count: selectedSessionAnalysis.counts.teaching })}</span>
      <span>{t(language, 'replay.markerCountHeroWin', { count: selectedSessionAnalysis.counts.heroWin })}</span>
      <span>{t(language, 'replay.markerCountBigPot', { count: selectedSessionAnalysis.counts.bigPot })}</span>
      <span>{t(language, 'replay.markerCountBigLoss', { count: selectedSessionAnalysis.counts.bigLoss })}</span>
      <span>{t(language, 'replay.markerCountElimination', { count: selectedSessionAnalysis.counts.elimination })}</span>
      <span>{t(language, 'replay.markerCountSidePot', { count: selectedSessionAnalysis.counts.sidePot })}</span>
      <span>{t(language, 'replay.markerCountShowdown', { count: selectedSessionShowdownCount })}</span>
    </div>
  ) : null;
  const sessionOverviewPanel = selectedSessionGroup ? (
    <div className="session-detail-overview-panel">
      {sessionDetailMetrics}
      {sessionDetailMeta}
      {selectedSessionAnalysis ? (
        <>
          <div className="session-detail-subhead">
            <strong>{t(language, 'replay.handsInSession')}</strong>
            <span>{t(language, 'replay.filteredHandsValue', { current: selectedSessionFilteredHands.length, total: selectedSessionGroup.hands.length })}</span>
          </div>
          {sessionDetailFilterRow}
          {sessionDetailMarkerStrip}
        </>
      ) : null}
      {showCompareTab ? (
        <div className="session-detail-overview-callout">
          <div>
            <strong>{t(language, 'replay.compareGroup')}</strong>
            <span>
              {canShowCompareTab
                ? t(language, 'replay.compareGroupNote', { count: visibleComparedSessionHands.length })
                : t(language, 'replay.compareGroupEmptyNote')}
            </span>
          </div>
          <button className="btn mini" type="button" onClick={() => setSessionDetailTab('compare')}>
            {t(language, 'replay.sessionTabCompare')}
          </button>
        </div>
      ) : null}
    </div>
  ) : null;
  const sessionComparePanel =
    canShowCompareTab ? (
      <div className="session-compare-panel">
        <div className="session-compare-head">
          <div className="session-compare-head-copy">
            <strong>{t(language, 'replay.compareGroup')}</strong>
            <span>{t(language, 'replay.compareGroupNote', { count: visibleComparedSessionHands.length })}</span>
          </div>
          <div className="session-compare-head-actions">
            <button
              className={`btn mini ${compareHighlightDiffs ? 'primary' : ''}`}
              type="button"
              disabled={visibleComparedSessionHands.length < 2}
              onClick={() => onCompareHighlightDiffsChange(!compareHighlightDiffs)}
            >
              {t(language, 'replay.highlightDiffsOnly')}
            </button>
            <div className="session-compare-sort">
              {compareSortOptions.map((option) => (
                <button
                  key={option.key}
                  className={`btn mini ${compareSortMode === option.key ? 'primary' : ''}`}
                  type="button"
                  onClick={() => setCompareSortMode(option.key)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button
              className="btn mini"
              type="button"
              onClick={() => {
                setCompareDigestFocus(null);
                onClearComparedSessionHands();
              }}
            >
              {t(language, 'replay.clearCompareGroup')}
            </button>
          </div>
        </div>
        <div className="session-compare-digest-grid">
          <section className="session-compare-digest-card">
            <div className="session-compare-digest-head">
              <strong>{t(language, 'replay.diffSummary')}</strong>
              <em>{compareDigest.coreFields.length}</em>
            </div>
            {compareDigest.coreFields.length > 0 ? (
              <div className="session-compare-digest-list">
                {compareDigest.coreFields.slice(0, 4).map((field) => (
                  <button
                    key={`compare-digest-${field.key}`}
                    className={`session-compare-digest-item session-compare-digest-button ${field.tone}${
                      compareDigestFocus?.kind === 'core' && compareDigestFocus.key === field.key ? ' active' : ''
                    }`}
                    type="button"
                    onClick={() => activateCompareDigestFocus({ kind: 'core', key: field.key }, compareSummaryBoardId)}
                  >
                    <span>{field.label}</span>
                    <strong>{formatSummaryValues(field.values)}</strong>
                  </button>
                ))}
              </div>
            ) : (
              <div className="session-compare-digest-empty">{t(language, 'replay.compareSummaryEmpty')}</div>
            )}
          </section>
          <section className="session-compare-digest-card">
            <div className="session-compare-digest-head">
              <strong>{t(language, 'replay.markers')}</strong>
              <em>{compareDigest.markerItems.length + compareDigest.teachingItems.length}</em>
            </div>
            <div className="session-compare-digest-tags">
              {compareDigest.markerItems.slice(0, 6).map((label) => (
                <button
                  key={`compare-marker-${label}`}
                  className={`session-detail-tag gold session-compare-digest-pill${
                    compareDigestFocus?.kind === 'marker' && compareDigestFocus.value === label ? ' active' : ''
                  }`}
                  type="button"
                  onClick={() => activateCompareDigestFocus({ kind: 'marker', value: label }, findCompareTargetId({ kind: 'marker', value: label }))}
                >
                  {label}
                </button>
              ))}
              {compareDigest.teachingItems.slice(0, 4).map((label) => (
                <button
                  key={`compare-teaching-${label}`}
                  className={`session-detail-tag cyan session-compare-digest-pill${
                    compareDigestFocus?.kind === 'teaching' && compareDigestFocus.value === label ? ' active' : ''
                  }`}
                  type="button"
                  onClick={() =>
                    activateCompareDigestFocus({ kind: 'teaching', value: label }, findCompareTargetId({ kind: 'teaching', value: label }))
                  }
                >
                  {label}
                </button>
              ))}
              {compareDigest.markerItems.length + compareDigest.teachingItems.length === 0 && (
                <div className="session-compare-digest-empty">{t(language, 'replay.compareGroupEmptyNote')}</div>
              )}
            </div>
          </section>
          <section className="session-compare-digest-card">
            <div className="session-compare-digest-head">
              <strong>{t(language, 'replay.keyMoments')}</strong>
              <em>{compareDigest.jumpItems.length}</em>
            </div>
            <div className="session-compare-digest-tags">
              {compareDigest.jumpItems.slice(0, 8).map((label) => (
                <button
                  key={`compare-jump-${label}`}
                  className={`session-detail-jump steel session-compare-digest-pill${
                    compareDigestFocus?.kind === 'jump' && compareDigestFocus.value === label ? ' active' : ''
                  }`}
                  type="button"
                  onClick={() => activateCompareDigestFocus({ kind: 'jump', value: label }, findCompareTargetId({ kind: 'jump', value: label }))}
                >
                  {label}
                </button>
              ))}
              {compareDigest.jumpItems.length === 0 && <div className="session-compare-digest-empty">{t(language, 'replay.compareGroupEmptyNote')}</div>}
            </div>
          </section>
        </div>
        {compareDigestFocus && activeCompareDigestLabel ? (
          <div className="session-compare-focus-bar">
            <strong>{activeCompareDigestLabel}</strong>
            <button className="btn mini ghost" type="button" onClick={() => setCompareDigestFocus(null)}>
              {t(language, 'common.clear')}
            </button>
          </div>
        ) : null}
        {comparedSummary.hasMultiple && (
          <div
            id={compareSummaryBoardId}
            className={`session-compare-summary-board${
              compareDigestFocus?.kind === 'core' ? ' focused' : ''
            }`}
          >
            <div className="session-compare-summary-head">
              <strong>{t(language, 'replay.diffSummary')}</strong>
              <span>
                {t(language, 'replay.coreDiffCount', { count: comparedSummary.differing.length })}
                {comparedSummary.commonLabels.length > 0 ? ` · ${t(language, 'replay.commonCount', { count: comparedSummary.commonLabels.length })}` : ''}
              </span>
            </div>
            {comparedSummary.differing.length > 0 ? (
              <div className="session-compare-summary-grid">
                {comparedSummary.differing.map((field) => (
                  <div
                    key={`compare-summary-${field.key}`}
                    className={`session-compare-summary-chip ${field.tone}${compareCoreFieldFocusClass(field.key)}`}
                  >
                    <strong>{field.label}:</strong>
                    <span>{formatSummaryValues(field.values)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="session-compare-summary-empty">{t(language, 'replay.compareSummaryEmpty')}</div>
            )}
            {comparedSummary.commonLabels.length > 0 && (
              <div className="session-compare-summary-common">
                {t(language, 'replay.commonItems', { value: comparedSummary.commonLabels.join(', ') })}
              </div>
            )}
          </div>
        )}
        <div className="session-compare-grid" id="session-compare-grid">
          {sortedComparedSessionHands.map((item) => (
            <article
              key={`compare-${item.handKey}`}
              id={`compare-card-${item.handKey}`}
              className={`session-compare-card${
                compareDigestFocus && compareDigestFocus.kind !== 'core'
                  ? matchesCompareDigestFocus(item, compareDigestFocus)
                    ? ' focused'
                    : ' dimmed'
                  : ''
              }`}
            >
              <div className="session-compare-card-head">
                <div>
                  <strong>{t(language, 'replay.handNumber', { handId: item.handId })}</strong>
                  <div className="session-compare-inline">
                    <span
                      className={`session-compare-field${compareFieldClass(
                        compareHighlightDiffs,
                        comparedSessionDiffs,
                        comparedSessionDiffs.gameMode,
                      )}${compareCoreFieldFocusClass('gameMode')}`}
                    >
                      {modeLabel(item.gameMode, language)}
                    </span>
                    <span
                      className={`session-compare-field${compareFieldClass(
                        compareHighlightDiffs,
                        comparedSessionDiffs,
                        comparedSessionDiffs.sessionMode,
                      )}${compareCoreFieldFocusClass('sessionMode')}`}
                    >
                      {sessionModeLabel(item.sessionMode, language)}
                    </span>
                    <span
                      className={`session-compare-field${compareFieldClass(
                        compareHighlightDiffs,
                        comparedSessionDiffs,
                        comparedSessionDiffs.aiDifficulty,
                      )}${compareCoreFieldFocusClass('aiDifficulty')}`}
                    >
                      {t(language, 'replay.difficultyValue', { value: difficultyLabel(item.aiDifficulty, language) })}
                    </span>
                  </div>
                </div>
                <button className="btn mini" type="button" onClick={() => onRemoveComparedSessionHand(item.handKey)}>
                  {t(language, 'replay.remove')}
                </button>
              </div>
              <div className="session-compare-card-meta">
                <span
                  className={`session-compare-field${compareFieldClass(
                    compareHighlightDiffs,
                    comparedSessionDiffs,
                    comparedSessionDiffs.sessionId,
                  )}${compareCoreFieldFocusClass('sessionId')}`}
                >
                  {item.sessionId ? formatSessionToken(item.sessionId) : item.sessionKey}
                </span>
                <span>{formatTime(item.timestamp, language)}</span>
                <span
                  className={`session-compare-field${compareFieldClass(
                    compareHighlightDiffs,
                    comparedSessionDiffs,
                    comparedSessionDiffs.blindInfo,
                  )}${compareCoreFieldFocusClass('blindInfo')}`}
                >
                  {t(language, 'common.blinds')} {item.blindInfo.smallBlind}/{item.blindInfo.bigBlind}
                </span>
              </div>
              <div className="session-compare-kpis">
                <div
                  className={`session-compare-field${compareFieldClass(
                    compareHighlightDiffs,
                    comparedSessionDiffs,
                    comparedSessionDiffs.profit,
                  )}${compareCoreFieldFocusClass('profit')}`}
                >
                  <span>{t(language, 'replay.profit')}</span>
                  <strong className={item.profit >= 0 ? 'up' : 'down'}>{formatProfit(item.profit)}</strong>
                </div>
                <div
                  className={`session-compare-field${compareFieldClass(
                    compareHighlightDiffs,
                    comparedSessionDiffs,
                    comparedSessionDiffs.totalPot,
                  )}${compareCoreFieldFocusClass('totalPot')}`}
                >
                  <span>{t(language, 'common.pot')}</span>
                  <strong>{item.totalPot}</strong>
                </div>
                <div
                  className={`session-compare-field${compareFieldClass(
                    compareHighlightDiffs,
                    comparedSessionDiffs,
                    comparedSessionDiffs.heroWon,
                  )}${compareCoreFieldFocusClass('heroWon')}`}
                >
                  <span>{t(language, 'replay.result')}</span>
                  <strong>{item.heroWon ? t(language, 'replay.youWon') : t(language, 'replay.youLost')}</strong>
                </div>
              </div>
              {(item.markerLabels.length > 0 || item.teachingLabels.length > 0) && (
                <div
                  className={`session-compare-tags session-compare-field${compareFieldClass(
                    compareHighlightDiffs,
                    comparedSessionDiffs,
                    comparedSessionDiffs.markerLabels || comparedSessionDiffs.teachingLabels,
                  )}`}
                >
                  {item.markerLabels.map((label) => (
                    <span key={`${item.handKey}-${label}`} className={`session-detail-tag ${sessionMarkerTone(label)}`}>
                      {translateSessionMarker(label, language)}
                    </span>
                  ))}
                  {item.teachingLabels.map((label) => (
                    <span key={`${item.handKey}-${label}`} className="session-detail-tag cyan">
                      {label}
                    </span>
                  ))}
                </div>
              )}
              {item.quickJumps.length > 0 && (
                <div
                  className={`session-compare-jumps session-compare-field${compareFieldClass(
                    compareHighlightDiffs,
                    comparedSessionDiffs,
                    comparedSessionDiffs.quickJumps,
                  )}`}
                >
                  {item.quickJumps.map((jump) => (
                    <button
                      key={`${item.handKey}-${jump.step}-${jump.label}`}
                      className={`session-detail-jump ${sessionJumpTone(jump.kind)}`}
                      type="button"
                      title={`${translateSessionJumpNote(jump.note, jump.stage, language)} · ${translateSessionJumpLabel(jump.stageLabel, language)} · ${t(language, 'common.pot')} ${jump.totalPot}`}
                      onClick={() =>
                        onOpenReplay(item.handKey, {
                          initialStep: jump.targetStep,
                        })
                      }
                    >
                      {translateSessionJumpLabel(jump.label, language)}
                    </button>
                  ))}
                </div>
              )}
              <div className="session-compare-actions">
                <button className="btn mini" type="button" onClick={() => onOpenReplay(item.handKey)}>
                  {t(language, 'replay.fullReplay')}
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    ) : showCompareTab ? (
      <div className="session-compare-panel session-compare-empty">
        <div className="session-compare-head">
          <div className="session-compare-head-copy">
            <strong>{t(language, 'replay.compareGroup')}</strong>
            <span>{t(language, 'replay.compareGroupEmptyNote')}</span>
          </div>
        </div>
        <div className="session-compare-empty-card">
          <strong>{t(language, 'replay.compareGroupEmptyTitle')}</strong>
          <span>{t(language, 'replay.compareGroupEmptyNote')}</span>
        </div>
      </div>
    ) : null;
  const sessionHandsPanel = selectedSessionGroup ? (
    <div className="session-detail-list">
      <div className="session-detail-subhead">
        <strong>{t(language, 'replay.handsInSession')}</strong>
        <span>{t(language, 'replay.filteredHandsValue', { current: selectedSessionFilteredHands.length, total: selectedSessionGroup.hands.length })}</span>
      </div>
      {selectedSessionAnalysis && (
        <>
          {sessionDetailFilterRow}
          {sessionDetailMarkerStrip}
        </>
      )}
      {selectedSessionFilteredHands.length === 0 ? (
        <div className="empty">{t(language, 'replay.noMatchingHands')}</div>
      ) : (
        <ul>
          {selectedSessionFilteredHands.map((item) => {
            const hand = item.record;
            const isCompared = visibleComparedSessionHands.some((entry) => entry.handKey === getHandHistoryRecordKey(hand));
            const activeJump = item.quickJumps.find((jump) => buildSessionJumpPreviewKey(hand, jump.step, jump.label) === previewedSessionJumpKey) ?? item.quickJumps[0];
            const markerLabels = [
              item.isBigPot ? '大底池' : null,
              item.isBigLoss ? '大额亏损' : null,
              item.hasAllIn ? '全下' : null,
              item.causedElimination ? '淘汰' : null,
              item.hasSidePot ? '边池' : null,
              item.reachedShowdown ? '摊牌' : null,
              item.heroWon ? '你赢' : null,
            ].filter((value): value is string => Boolean(value));
            const teachingLabels = item.teachingLabels.slice(0, 2);
            return (
              <li key={`${selectedSessionGroup.summary.key}-${hand.handId}-${hand.timestamp}`}>
                <div>
                  <strong>{t(language, 'replay.handNumber', { handId: hand.handId })}</strong>
                  <span>
                    {formatTime(hand.timestamp, language)} · {t(language, 'common.blinds')} {hand.blindInfo.smallBlind}/{hand.blindInfo.bigBlind} · {t(language, 'common.pot')} {item.totalPot}
                  </span>
                  {(markerLabels.length > 0 || teachingLabels.length > 0) && (
                    <div className="session-detail-tags">
                      {markerLabels.map((label) => (
                        <span key={`${hand.handId}-${label}`} className={`session-detail-tag ${sessionMarkerTone(label)}`}>
                          {translateSessionMarker(label, language)}
                        </span>
                      ))}
                      {teachingLabels.map((label) => (
                        <span key={`${hand.handId}-${label}`} className="session-detail-tag cyan">
                          {label}
                        </span>
                      ))}
                    </div>
                  )}
                  {item.quickJumps.length > 0 && (
                    <div className="session-detail-jumps">
                      {item.quickJumps.map((jump) => (
                        <button
                          key={`${hand.handId}-${jump.step}-${jump.label}`}
                          className={`session-detail-jump ${sessionJumpTone(jump.kind)}${
                            activeJump && activeJump.step === jump.step && activeJump.label === jump.label ? ' active' : ''
                          }`}
                          type="button"
                          title={translateSessionJumpNote(jump.note, jump.stage, language)}
                          onMouseEnter={() => onPreviewSessionJumpKeyChange(buildSessionJumpPreviewKey(hand, jump.step, jump.label))}
                          onFocus={() => onPreviewSessionJumpKeyChange(buildSessionJumpPreviewKey(hand, jump.step, jump.label))}
                          onClick={() =>
                            onOpenReplay(getHandHistoryRecordKey(hand), {
                              initialStep: jump.targetStep,
                            })
                          }
                        >
                          {translateSessionJumpLabel(jump.label, language)}
                        </button>
                      ))}
                    </div>
                  )}
                  {activeJump && (
                    <div className={`session-detail-jump-preview ${sessionJumpTone(activeJump.kind)}`}>
                      <div className="session-detail-jump-preview-head">
                        <strong>{translateSessionJumpLabel(activeJump.label, language)}</strong>
                        <span>
                          {translateSessionJumpLabel(activeJump.stageLabel, language)} · {t(language, 'common.pot')} {activeJump.totalPot}
                        </span>
                      </div>
                      <div className="session-detail-jump-preview-meta">
                        <span>{t(language, 'replay.boardCardsCount', { count: activeJump.boardCount })}</span>
                        <span>{t(language, 'replay.sidePotCount', { count: activeJump.sidePotCount })}</span>
                        <span>{t(language, 'replay.replayStep', { step: activeJump.targetStep })}</span>
                      </div>
                      {activeJump.boardCards.length > 0 && (
                        <div className="session-detail-jump-preview-board">
                          {[0, 1, 2, 3, 4].map((index) => {
                            const boardCard = activeJump.boardCards[index];
                            return (
                              <StaticCardView
                                key={`${hand.handId}-${activeJump.label}-${index}-${boardCard?.code ?? 'hidden'}`}
                                card={boardCard}
                                hidden={!boardCard}
                                tiny
                              />
                            );
                          })}
                        </div>
                      )}
                      <p>{translateSessionJumpNote(activeJump.note, activeJump.stage, language)}</p>
                      {activeJump.snapshotNote !== activeJump.note && (
                        <small>{t(language, 'replay.tableStateValue', { value: translateHoldemText(activeJump.snapshotNote, language) })}</small>
                      )}
                    </div>
                  )}
                </div>
                <div className="session-detail-hand-side">
                  <em className={item.profit >= 0 ? 'up' : 'down'}>{formatProfit(item.profit)}</em>
                  <button
                    className={`btn mini${isCompared ? ' active' : ''}`}
                    type="button"
                    onClick={() => onToggleComparedSessionHand(selectedSessionGroup.summary.key, item)}
                  >
                    {isCompared ? t(language, 'replay.alreadyInCompare') : t(language, 'replay.addToCompare')}
                  </button>
                  <button className="btn mini" type="button" onClick={() => onOpenReplay(getHandHistoryRecordKey(hand))}>
                    {t(language, 'common.replay')}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  ) : null;

  return (
    <section className="session-archive-board glass-panel">
      <input ref={archiveImportRef} className="visually-hidden-input" type="file" accept=".json,application/json" onChange={onArchiveImportFileChange} />
      <div className="session-archive-head">
        <div>
          <h3>{t(language, 'replay.sessionSummary')}</h3>
          <span>
            {t(language, 'replay.sessionSummaryMeta', {
              totalSessions: replaySessionSummaries.length,
              archiveSessions: replayArchiveSummary.sessionCount,
              archiveHands: replayArchiveSummary.handCount,
            })}
          </span>
        </div>
        <div className="session-archive-actions">
          <span>{replayArchiveSummary.updatedAt ? t(language, 'replay.archiveUpdatedAt', { time: formatTime(replayArchiveSummary.updatedAt, language) }) : t(language, 'replay.noReplayArchiveYet')}</span>
          <button className="btn mini" type="button" onClick={() => onImportReplayArchiveClick('merge')}>
            {t(language, 'replay.mergeImport')}
          </button>
          <button className="btn mini" type="button" onClick={() => onImportReplayArchiveClick('replace')}>
            {t(language, 'replay.replaceImport')}
          </button>
          <button className="btn mini" type="button" onClick={onExportReplayArchive} disabled={replayArchiveSummary.handCount === 0}>
            {t(language, 'replay.exportArchive')}
          </button>
          <button className="btn mini" type="button" onClick={onClearReplayArchive} disabled={replayArchiveSummary.handCount === 0}>
            {t(language, 'replay.clearReplayArchive')}
          </button>
        </div>
      </div>
      {archiveFeedback && <div className={`career-feedback ${archiveFeedback.tone}`}>{archiveFeedback.message}</div>}
      {pendingReplayImport && pendingReplayImportPreview && selectedReplayImportArchive && (
        <section className="archive-import-preview">
          <div className="archive-import-preview-head">
            <div>
              <strong>{pendingReplayImport.mode === 'merge' ? t(language, 'replay.mergeImportPreview') : t(language, 'replay.replaceImportPreview')}</strong>
              <span>{pendingReplayImport.fileName}</span>
            </div>
            <button className="btn mini" type="button" onClick={onCancelReplayImport}>
              {t(language, 'common.close')}
            </button>
          </div>
          <div className="archive-import-preview-grid">
            <div>
              <span>{t(language, 'replay.currentArchive')}</span>
              <strong>
                {t(language, 'replay.sessionHandCounts', {
                  sessions: pendingReplayImportPreview.currentSessionCount,
                  hands: pendingReplayImportPreview.currentHandCount,
                })}
              </strong>
            </div>
            <div>
              <span>{t(language, 'replay.sourceFile')}</span>
              <strong>
                {t(language, 'replay.sessionHandCounts', {
                  sessions: pendingReplayImport.archive.archivedSessionIds.length,
                  hands: pendingReplayImport.archive.hands.length,
                })}
              </strong>
            </div>
            <div>
              <span>{t(language, 'replay.selectedImport')}</span>
              <strong>
                {t(language, 'replay.sessionHandCounts', {
                  sessions: selectedReplayImportArchive.archivedSessionIds.length,
                  hands: selectedReplayImportArchive.hands.length,
                })}
              </strong>
            </div>
            <div>
              <span>{t(language, 'replay.resultAfterImport')}</span>
              <strong>
                {t(language, 'replay.sessionHandCounts', {
                  sessions: pendingReplayImportPreview.resultSessionCount,
                  hands: pendingReplayImportPreview.resultHandCount,
                })}
              </strong>
            </div>
            <div>
              <span>{t(language, 'replay.duplicateHands')}</span>
              <strong>{t(language, 'replay.handCountValue', { count: pendingReplayImportPreview.duplicateHandCount })}</strong>
            </div>
          </div>
          <div className="archive-import-selection">
            <div className="archive-import-selection-head">
              <div>
                <strong>{t(language, 'replay.selectImportSessions')}</strong>
                <span>
                  {t(language, 'replay.selectedSessionsProgress', {
                    selected: pendingReplayImport.selectedSessionIds.length,
                    total: pendingReplayImport.archive.archivedSessionIds.length,
                  })}
                </span>
              </div>
              <div className="archive-import-selection-actions">
                <button className="btn mini" type="button" onClick={onSelectAllReplayImportSessions}>
                  {t(language, 'replay.selectAll')}
                </button>
                <button className="btn mini" type="button" onClick={onClearReplayImportSessions}>
                  {t(language, 'replay.clearSelection')}
                </button>
              </div>
            </div>
            <div className="archive-import-session-grid">
              {pendingReplayImportSessions.map((session) => (
                <button
                  key={`import-session-${session.sessionId}`}
                  className={`archive-import-session-card ${session.selected ? 'active' : ''}`}
                  type="button"
                  onClick={() => onToggleReplayImportSession(session.sessionId)}
                >
                  <div className="archive-import-session-card-head">
                    <strong>{formatSessionToken(session.sessionId)}</strong>
                    <em>{session.selected ? t(language, 'replay.selected') : t(language, 'replay.notSelected')}</em>
                  </div>
                  <span>
                    {modeLabel(session.mode, language)} · {sessionModeLabel(session.sessionMode, language)} · {t(language, 'replay.difficultyValue', { value: difficultyLabel(session.aiDifficulty, language) })}
                  </span>
                  <small>
                    {t(language, 'replay.handCountValue', { count: session.handCount })} · {t(language, 'replay.lastAt', { time: formatTime(session.endedAt, language) })}
                  </small>
                </button>
              ))}
            </div>
          </div>
          <div className="archive-import-preview-meta">
            <span>{t(language, 'replay.newSessionsCount', { count: pendingReplayImportPreview.newSessionIds.length })}</span>
            <span>{t(language, 'replay.overlapSessionsCount', { count: pendingReplayImportPreview.overlappingSessionIds.length })}</span>
            <span>{t(language, 'replay.removedSessionsCount', { count: pendingReplayImportPreview.removedSessionIds.length })}</span>
            <span>{t(language, 'replay.overflowSessionsCount', { count: pendingReplayImportPreview.overflowSessionIds.length })}</span>
          </div>
          {pinnedImportHands.length > 0 && (
            <div className="archive-import-pinned">
              <div className="archive-import-pinned-head">
                <div>
                  <strong>{t(language, 'replay.reviewBasket')}</strong>
                  <span>{t(language, 'replay.reviewBasketNote', { count: pinnedImportHands.length })}</span>
                </div>
                <button className="btn mini" type="button" onClick={onClearPinnedImportHands}>
                  {t(language, 'replay.clearBasket')}
                </button>
              </div>
              <div className="archive-import-pinned-list">
                {pinnedImportHands.map((item) => (
                  <div key={`pinned-${item.handKey}`} className={`archive-import-pinned-card${lastViewedImportHand?.handKey === item.handKey ? ' active' : ''}`}>
                    <button className="archive-import-pinned-main" type="button" onClick={() => onOpenImportHandReplay(item)}>
                      <div className="archive-import-pinned-card-head">
                        <strong>#{item.handId}</strong>
                        <em>{lastViewedImportHand?.handKey === item.handKey ? t(language, 'common.current') : t(language, 'replay.pinned')}</em>
                      </div>
                      <span>
                        {formatSessionToken(item.sessionId)} · {modeLabel(item.gameMode, language)}
                      </span>
                      <small>
                        {sessionModeLabel(item.sessionMode, language)} · {t(language, 'replay.difficultyValue', { value: difficultyLabel(item.aiDifficulty, language) })} · {formatTime(item.timestamp, language)}
                      </small>
                    </button>
                    <button className="btn mini" type="button" onClick={() => onTogglePinnedImportHand(item)}>
                      {t(language, 'replay.unpin')}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {recentViewedImportHands.length > 0 && (
            <div className="archive-import-recent">
              <div className="archive-import-recent-head">
                <div>
                  <strong>{t(language, 'replay.recentViewedHands')}</strong>
                  <span>{t(language, 'replay.recentViewedNote', { count: recentViewedImportHands.length })}</span>
                </div>
                <button className="btn mini" type="button" onClick={onClearRecentImportHands}>
                  {t(language, 'common.clear')}
                </button>
              </div>
              <div className="archive-import-recent-list">
                {recentViewedImportHands.map((item) => {
                  const isPinned = pinnedImportHands.some((entry) => entry.handKey === item.handKey);
                  return (
                    <div key={`recent-${item.handKey}`} className={`archive-import-recent-card${lastViewedImportHand?.handKey === item.handKey ? ' active' : ''}`}>
                      <button className="archive-import-recent-main" type="button" onClick={() => onOpenImportHandReplay(item)}>
                        <div className="archive-import-recent-card-head">
                          <strong>#{item.handId}</strong>
                          <em>{lastViewedImportHand?.handKey === item.handKey ? t(language, 'common.current') : t(language, 'replay.recent')}</em>
                        </div>
                        <span>
                          {formatSessionToken(item.sessionId)} · {modeLabel(item.gameMode, language)}
                        </span>
                        <small>
                          {sessionModeLabel(item.sessionMode, language)} · {t(language, 'replay.difficultyValue', { value: difficultyLabel(item.aiDifficulty, language) })} · {formatTime(item.timestamp, language)}
                        </small>
                      </button>
                      <button className={`btn mini${isPinned ? ' active' : ''}`} type="button" onClick={() => onTogglePinnedImportHand(item)}>
                        {isPinned ? t(language, 'replay.pinned') : t(language, 'replay.addToBasket')}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
            {pendingReplayImportPreview.sessionDiffs.length > 0 && (
              <div className="archive-import-diff-table">
                <div className="archive-import-diff-head">
                  <div>
                    <strong>{t(language, 'replay.sessionDiffTable')}</strong>
                    <span>{t(language, 'replay.sessionDiffTableNote')}</span>
                  </div>
                  <button className={`btn mini${isDiffTableExpanded ? ' primary' : ''}`} type="button" onClick={() => setIsDiffTableExpanded((prev) => !prev)}>
                    {isDiffTableExpanded ? t(language, 'replay.collapseDiffTable') : t(language, 'replay.expandDiffTable')}
                  </button>
                </div>
                {diffSummary && (
                  <div className="archive-import-diff-summary">
                    <span>{t(language, 'replay.coveredSessionsCount', { count: diffSummary.sessionCount })}</span>
                    <span>{t(language, 'replay.sessionsWithNewHands', { count: diffSummary.newSessions })}</span>
                    <span>{t(language, 'replay.sessionsWithDuplicates', { count: diffSummary.duplicateSessions })}</span>
                    <span>{t(language, 'replay.keptSessionsCount', { count: diffSummary.keptSessions })}</span>
                  </div>
                )}
                {isDiffTableExpanded && (
                  <div className="archive-import-diff-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>{t(language, 'replay.session')}</th>
                          <th>{t(language, 'common.mode')}</th>
                          <th>{t(language, 'replay.current')}</th>
                          <th>{t(language, 'replay.incoming')}</th>
                          <th>{t(language, 'replay.new')}</th>
                          <th>{t(language, 'replay.duplicate')}</th>
                          <th>{t(language, 'replay.result')}</th>
                          <th>{t(language, 'replay.status')}</th>
                          <th>{t(language, 'replay.details')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingReplayImportPreview.sessionDiffs.map((diff) => {
                          const isRecentSession =
                            lastViewedImportHand?.sessionId === diff.sessionId &&
                            [...diff.currentHandIds, ...diff.incomingHandIds, ...diff.resultHandIds].includes(lastViewedImportHand.handId);
                          const isSessionExpanded = expandedDiffSessionIds.includes(diff.sessionId);

                          return (
                            <Fragment key={`diff-group-${diff.sessionId}`}>
                              <tr key={`diff-${diff.sessionId}`} className={isRecentSession ? 'archive-import-diff-row recent' : 'archive-import-diff-row'}>
                                <td>
                                  <div className="archive-import-diff-session">
                                    <strong>{formatSessionToken(diff.sessionId)}</strong>
                                    <span>{formatTime(diff.endedAt, language)}</span>
                                  </div>
                                </td>
                                <td>
                                  <div className="archive-import-diff-session">
                                    <strong>{modeLabel(diff.gameMode, language)}</strong>
                                    <span>
                                      {sessionModeLabel(diff.sessionMode, language)} · {t(language, 'replay.difficultyValue', { value: difficultyLabel(diff.aiDifficulty, language) })}
                                    </span>
                                  </div>
                                </td>
                                <td>{t(language, 'replay.handCountValue', { count: diff.currentHandCount })}</td>
                                <td>{t(language, 'replay.handCountValue', { count: diff.incomingHandCount })}</td>
                                <td className={diff.newHandCount > 0 ? 'up' : ''}>+{diff.newHandCount}</td>
                                <td>{t(language, 'replay.handCountValue', { count: diff.duplicateHandCount })}</td>
                                <td>{t(language, 'replay.handCountValue', { count: diff.resultHandCount })}</td>
                                <td>
                                  <span className={`archive-import-diff-status ${replayImportStatusTone(diff)}`}>
                                    {replayImportStatusLabel(diff, pendingReplayImport.mode, language)}
                                  </span>
                                </td>
                                <td>
                                  <button className={`btn mini${isSessionExpanded ? ' primary' : ''}`} type="button" onClick={() => toggleDiffSessionExpanded(diff.sessionId)}>
                                    {isSessionExpanded ? t(language, 'replay.collapse') : t(language, 'replay.expand')}
                                  </button>
                                </td>
                              </tr>
                              {isSessionExpanded && (
                                <tr key={`diff-detail-${diff.sessionId}`} className={`archive-import-diff-detail-row${isRecentSession ? ' recent' : ''}`}>
                                  <td colSpan={9}>
                                    <div className="archive-import-diff-detail">
                                      {diff.newHandIds.length > 0 && (
                                        <div>
                                          <span>{t(language, 'replay.newHandIds')}</span>
                                          <div className="archive-import-hand-pills">
                                            {renderHandIdPills(diff.sessionId, diff.newHandIds, 'cyan')}
                                            {diff.newHandIds.length > 6 && <small>+{diff.newHandIds.length - 6}</small>}
                                          </div>
                                        </div>
                                      )}
                                      {diff.duplicateHandIds.length > 0 && (
                                        <div>
                                          <span>{t(language, 'replay.duplicateHandIds')}</span>
                                          <div className="archive-import-hand-pills">
                                            {renderHandIdPills(diff.sessionId, diff.duplicateHandIds, 'gold')}
                                            {diff.duplicateHandIds.length > 6 && <small>+{diff.duplicateHandIds.length - 6}</small>}
                                          </div>
                                        </div>
                                      )}
                                      <div>
                                        <span>{t(language, 'replay.keptAfterImport')}</span>
                                        <div className="archive-import-hand-pills">
                                          {renderHandIdPills(diff.sessionId, diff.resultHandIds, diff.keptInResult ? 'steel' : 'gold')}
                                          {diff.resultHandIds.length > 6 && <small>+{diff.resultHandIds.length - 6}</small>}
                                          {diff.resultHandIds.length === 0 && <small>{t(language, 'replay.notKept')}</small>}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          <div className="archive-import-preview-list">
            {pendingReplayImportPreview.newSessionIds.length > 0 && (
              <div>
                <span>{t(language, 'replay.newSessions')}</span>
                <div className="archive-import-preview-pills">
                  {pendingReplayImportPreview.newSessionIds.slice(0, 6).map((sessionId) => (
                    <em key={`new-${sessionId}`}>{formatSessionToken(sessionId)}</em>
                  ))}
                </div>
              </div>
            )}
            {pendingReplayImportPreview.overlappingSessionIds.length > 0 && (
              <div>
                <span>{pendingReplayImport.mode === 'merge' ? t(language, 'replay.sessionsToMerge') : t(language, 'replay.sessionsAlreadyExist')}</span>
                <div className="archive-import-preview-pills">
                  {pendingReplayImportPreview.overlappingSessionIds.slice(0, 6).map((sessionId) => (
                    <em key={`overlap-${sessionId}`}>{formatSessionToken(sessionId)}</em>
                  ))}
                </div>
              </div>
            )}
            {pendingReplayImportPreview.removedSessionIds.length > 0 && (
              <div>
                <span>{t(language, 'replay.willBeRemoved')}</span>
                <div className="archive-import-preview-pills">
                  {pendingReplayImportPreview.removedSessionIds.slice(0, 6).map((sessionId) => (
                    <em key={`removed-${sessionId}`}>{formatSessionToken(sessionId)}</em>
                  ))}
                </div>
              </div>
            )}
            {pendingReplayImportPreview.overflowSessionIds.length > 0 && (
              <div>
                <span>{t(language, 'replay.notKeptDueToLimit')}</span>
                <div className="archive-import-preview-pills">
                  {pendingReplayImportPreview.overflowSessionIds.slice(0, 6).map((sessionId) => (
                    <em key={`overflow-${sessionId}`}>{formatSessionToken(sessionId)}</em>
                  ))}
                </div>
              </div>
            )}
          </div>
          {pendingReplayImport.selectedSessionIds.length === 0 && <div className="archive-preview-note">{t(language, 'replay.noSessionSelectedForImport')}</div>}
          {pendingReplayImport.warning && <div className="archive-preview-note warning">{pendingReplayImport.warning}</div>}
          <div className="archive-import-preview-actions">
            <button className="btn" type="button" onClick={onCancelReplayImport}>
              {t(language, 'common.close')}
            </button>
            <button className="btn primary" type="button" onClick={onConfirmReplayImport} disabled={pendingReplayImport.selectedSessionIds.length === 0}>
              {pendingReplayImport.mode === 'merge' ? t(language, 'replay.confirmMergeImport') : t(language, 'replay.confirmReplaceImport')}
            </button>
          </div>
        </section>
      )}
      {replaySessionSummaries.length === 0 ? (
        <div className="empty">{t(language, 'replay.noSessionSummary')}</div>
      ) : (
        <div className="session-archive-layout">
          <ul className="session-archive-list">
            {replaySessionSummaries.map((session, index) => (
              <li key={session.key}>
                <button
                  className={`session-archive-card ${selectedSessionGroup?.summary.key === session.key ? 'active' : ''}`}
                  type="button"
                  onClick={() => {
                    onSelectSessionKey(session.key);
                    onSelectedSessionHandFilterChange('all');
                    setSessionDetailTab('overview');
                    setCompareDigestFocus(null);
                  }}
                >
                  <div className="session-archive-card-head">
                    <div>
                      <strong>{currentSessionId && session.sessionId === currentSessionId ? t(language, 'replay.currentCachedSession') : t(language, 'replay.localArchiveSessionNumber', { index: index + 1 })}</strong>
                      <span>
                        {modeLabel(session.mode, language)} · {sessionModeLabel(session.sessionMode, language)} · {t(language, 'replay.difficultyValue', { value: difficultyLabel(session.aiDifficulty, language) })}
                      </span>
                    </div>
                    <em className={`session-origin-badge ${currentSessionId && session.sessionId === currentSessionId ? 'live' : 'archive'}`}>
                      {currentSessionId && session.sessionId === currentSessionId ? t(language, 'common.current') : t(language, 'replay.archive')}
                    </em>
                  </div>
                  <div className="session-archive-kpis">
                    <div>
                      <span>{t(language, 'replay.handCount')}</span>
                      <strong>{session.handCount}</strong>
                    </div>
                    <div>
                      <span>{t(language, 'replay.winRate')}</span>
                      <strong>{session.winRate}%</strong>
                    </div>
                    <div>
                      <span>{t(language, 'replay.profit')}</span>
                      <strong className={session.totalProfit >= 0 ? 'up' : 'down'}>{formatProfit(session.totalProfit)}</strong>
                    </div>
                    <div>
                      <span>{t(language, 'replay.biggestPot')}</span>
                      <strong>{session.biggestPot}</strong>
                    </div>
                  </div>
                  <div className="session-archive-meta">
                    <span>
                      #{session.firstHandId} - #{session.lastHandId}
                    </span>
                    <span>{formatTime(session.endedAt, language)}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
          {selectedSessionGroup && (
            <section className="session-detail-card">
              <div className="session-detail-head">
                <div>
                  <strong>{t(language, 'replay.sessionDetails')}</strong>
                  <span>
                    {modeLabel(selectedSessionGroup.summary.mode, language)} · {sessionModeLabel(selectedSessionGroup.summary.sessionMode, language)} · {t(language, 'replay.difficultyValue', { value: difficultyLabel(selectedSessionGroup.summary.aiDifficulty, language) })}
                  </span>
                </div>
                <button className="btn mini" type="button" onClick={onSwitchToHands}>
                  {t(language, 'replay.backToHandsView')}
                </button>
              </div>
              {showIpadSessionDetailTabs ? (
                <>
                  <div className="session-detail-panel-switch" role="tablist" aria-label={t(language, 'replay.sessionDetails')}>
                    {sessionDetailTabs.map((tab) => (
                      <button
                        key={tab.key}
                        className={`session-detail-panel-button ${resolvedSessionDetailTab === tab.key ? 'active' : ''}`}
                        type="button"
                        role="tab"
                        aria-selected={resolvedSessionDetailTab === tab.key}
                        onClick={() => setSessionDetailTab(tab.key)}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  <div className="session-detail-panel-shell" role="tabpanel" aria-label={sessionDetailTabs.find((tab) => tab.key === resolvedSessionDetailTab)?.label}>
                    {resolvedSessionDetailTab === 'overview'
                      ? sessionOverviewPanel
                      : resolvedSessionDetailTab === 'compare'
                        ? sessionComparePanel
                        : sessionHandsPanel}
                  </div>
                </>
              ) : (
                <>
                  {sessionDetailMetrics}
                  {sessionDetailMeta}
                  {sessionComparePanel}
                  {sessionHandsPanel}
                </>
              )}
            </section>
          )}
        </div>
      )}
    </section>
  );
}
