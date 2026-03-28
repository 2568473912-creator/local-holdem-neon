import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { t } from '../../i18n';
import { useLanguage } from '../../i18n/languageContext';
import type { SessionStats } from '../../types/game';
import type { GameMode } from '../../types/cards';
import type { CareerProfile } from '../../types/profile';
import type { HandHistoryRecord, ReplayOpenOptions } from '../../types/replay';
import type { ReplayArchive, ReplayArchiveImportMode, ReplayArchiveImportPreview, ReplayArchiveSummary } from '../../state/replayArchive';
import { exportCareerProfile, getCareerModeBreakdown, parseCareerProfileImport } from '../../state/careerProfile';
import { buildReplayArchiveImportPreview, exportReplayArchive, parseReplayArchiveImport, pickReplayArchiveSessions } from '../../state/replayArchive';
import {
  analyzeReplaySessionHands,
  buildReplaySessionGroups,
  filterReplaySessionHandInsights,
  summarizeReplaySessions,
  type ReplaySessionHandFilter,
  type ReplaySessionHandInsight,
} from '../../replay/sessionHistory';
import { getHandHistoryRecordKey } from '../../replay/replayRecordKey';
import {
  buildComparedSessionDiffState,
  buildSessionCompareEntry,
  type ComparedSessionHandState,
  type LastViewedImportHandState,
  type PendingReplayImportState,
  type PinnedImportHandState,
  type RecentViewedImportHandState,
  type ReplayCenterViewCache,
} from './replayCenterShared';

const ReplayHandsPanel = lazy(() => import('./ReplayHandsPanel').then((module) => ({ default: module.ReplayHandsPanel })));
const ReplaySessionsPanel = lazy(() => import('./ReplaySessionsPanel').then((module) => ({ default: module.ReplaySessionsPanel })));

let handsPanelPreloadPromise: Promise<unknown> | null = null;
let sessionsPanelPreloadPromise: Promise<unknown> | null = null;

interface ReplayCenterProps {
  history: HandHistoryRecord[];
  stats: SessionStats;
  careerProfile: CareerProfile;
  currentSessionId: string | null;
  replayArchive: ReplayArchive;
  replayArchiveSummary: ReplayArchiveSummary;
  onBack: () => void;
  onOpenReplay: (handKey: string, options?: ReplayOpenOptions) => void;
  onClearReplayArchive: () => void;
  onImportReplayArchive: (archive: ReplayArchive, mode: ReplayArchiveImportMode, message?: string) => void;
  onClearCareer: () => void;
  onImportCareer: (profile: CareerProfile, message?: string) => void;
  onPerfUpdate?: (metrics: Record<string, unknown> | null) => void;
}

let replayImportDraftCache: PendingReplayImportState | null = null;
let replayCenterViewCache: ReplayCenterViewCache = {
  viewMode: 'hands',
  selectedSessionKey: null,
  selectedSessionHandFilter: 'all',
  compareHighlightDiffs: false,
  modeFilter: 'all',
  sessionFilter: 'all',
  sourceFilter: 'all',
  resultFilter: 'all',
  difficultyFilter: 'all',
  minPot: 0,
};
let lastViewedImportHandCache: LastViewedImportHandState | null = null;
let recentViewedImportHandsCache: RecentViewedImportHandState[] = [];
let pinnedImportHandsCache: PinnedImportHandState[] = [];
let comparedSessionHandsCache: ComparedSessionHandState[] = [];
const MAX_RECENT_IMPORT_HANDS = 6;
const MAX_PINNED_IMPORT_HANDS = 8;
const MAX_COMPARED_SESSION_HANDS = 4;

function preloadHandsPanel() {
  handsPanelPreloadPromise ??= import('./ReplayHandsPanel');
  return handsPanelPreloadPromise;
}

function preloadSessionsPanel() {
  sessionsPanelPreloadPromise ??= Promise.all([
    import('./ReplaySessionsPanel'),
    import('./ReplaySessionArchivePanel'),
    import('./ReplayCareerPanel'),
  ]);
  return sessionsPanelPreloadPromise;
}

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

function scheduleBackgroundWork(callback: () => void): () => void {
  if (typeof window === 'undefined') {
    callback();
    return () => undefined;
  }

  let timeoutId: number | null = null;
  let idleCancel: (() => void) | null = null;
  const idleWindow = window as IdleWindow;
  timeoutId = window.setTimeout(() => {
    if (typeof idleWindow.requestIdleCallback === 'function') {
      const idleId = idleWindow.requestIdleCallback(callback, { timeout: 480 });
      idleCancel = () => {
        if (typeof idleWindow.cancelIdleCallback === 'function') {
          idleWindow.cancelIdleCallback(idleId);
        }
      };
      return;
    }
    callback();
  }, 140);

  return () => {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
    idleCancel?.();
  };
}

function ReplayPanelLoader({ label }: { label: string }) {
  const language = useLanguage();
  return (
    <section className="screen-loader glass-panel replay-panel-loader" role="status" aria-live="polite">
      <div className="screen-loader-ring" />
      <strong>{label}</strong>
      <span>{t(language, 'replay.splittingHistoryResources')}</span>
    </section>
  );
}

function writeLastViewedImportHandCache(value: LastViewedImportHandState | null): void {
  lastViewedImportHandCache = value;
}

function writeRecentViewedImportHandsCache(value: RecentViewedImportHandState[]): void {
  recentViewedImportHandsCache = value;
}

function writePinnedImportHandsCache(value: PinnedImportHandState[]): void {
  pinnedImportHandsCache = value;
}

function writeComparedSessionHandsCache(value: ComparedSessionHandState[]): void {
  comparedSessionHandsCache = value;
}

function handTotalPot(hand: HandHistoryRecord): number {
  return hand.payoutBreakdown.reduce((sum, item) => sum + item.amount, 0);
}

export function ReplayCenter({
  history,
  stats,
  careerProfile,
  currentSessionId,
  replayArchive,
  replayArchiveSummary,
  onBack,
  onOpenReplay,
  onClearReplayArchive,
  onImportReplayArchive,
  onClearCareer,
  onImportCareer,
  onPerfUpdate,
}: ReplayCenterProps) {
  const language = useLanguage();
  const [viewMode, setViewMode] = useState<'hands' | 'sessions'>(() => replayCenterViewCache.viewMode);
  const [selectedSessionKey, setSelectedSessionKey] = useState<string | null>(() => replayCenterViewCache.selectedSessionKey);
  const [selectedSessionHandFilter, setSelectedSessionHandFilter] = useState<ReplaySessionHandFilter>(() => replayCenterViewCache.selectedSessionHandFilter);
  const [compareHighlightDiffs, setCompareHighlightDiffs] = useState(() => replayCenterViewCache.compareHighlightDiffs);
  const [modeFilter, setModeFilter] = useState<'all' | GameMode>(() => replayCenterViewCache.modeFilter);
  const [sessionFilter, setSessionFilter] = useState<'all' | 'cash' | 'tournament'>(() => replayCenterViewCache.sessionFilter);
  const [sourceFilter, setSourceFilter] = useState<'all' | 'current' | 'archive'>(() => replayCenterViewCache.sourceFilter);
  const [resultFilter, setResultFilter] = useState<'all' | 'humanWin' | 'humanLose'>(() => replayCenterViewCache.resultFilter);
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | 'conservative' | 'standard' | 'aggressive'>(() => replayCenterViewCache.difficultyFilter);
  const [minPot, setMinPot] = useState(() => replayCenterViewCache.minPot);
  const [archiveFeedback, setArchiveFeedback] = useState<{ tone: 'neutral' | 'error'; message: string } | null>(null);
  const [careerFeedback, setCareerFeedback] = useState<{ tone: 'neutral' | 'error'; message: string } | null>(null);
  const [pendingReplayImport, setPendingReplayImport] = useState<PendingReplayImportState | null>(() => replayImportDraftCache);
  const [lastViewedImportHand, setLastViewedImportHand] = useState<LastViewedImportHandState | null>(() => lastViewedImportHandCache);
  const [recentViewedImportHands, setRecentViewedImportHands] = useState<RecentViewedImportHandState[]>(() => recentViewedImportHandsCache);
  const [pinnedImportHands, setPinnedImportHands] = useState<PinnedImportHandState[]>(() => pinnedImportHandsCache);
  const [comparedSessionHands, setComparedSessionHands] = useState<ComparedSessionHandState[]>(() => comparedSessionHandsCache);
  const [previewedSessionJumpKey, setPreviewedSessionJumpKey] = useState<string | null>(null);
  const archiveImportRef = useRef<HTMLInputElement | null>(null);
  const archiveImportModeRef = useRef<ReplayArchiveImportMode>('merge');
  const careerImportRef = useRef<HTMLInputElement | null>(null);
  const importHandRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const historyOpenedPerfRef = useRef(0);
  const perfRef = useRef<Record<string, unknown>>({
    activeView: replayCenterViewCache.viewMode,
    openedAtEpoch: 0,
    sessionsPrefetched: false,
    handsPrefetched: false,
  });

  const elapsedFromOpen = useCallback(() => {
    if (typeof performance === 'undefined') {
      return 0;
    }
    return Math.round(performance.now() - historyOpenedPerfRef.current);
  }, []);

  const publishPerf = useCallback(
    (patch: Record<string, unknown>) => {
      const next = {
        ...perfRef.current,
        ...patch,
      };

      const warnings: string[] = [];
      if (typeof next.handsPanelReadyMs === 'number' && next.handsPanelReadyMs > 700) {
        warnings.push(t(language, 'replay.warningHandsSlow'));
      }
      if (typeof next.sessionArchiveReadyMs === 'number' && next.sessionArchiveReadyMs > 900) {
        warnings.push(t(language, 'replay.warningArchiveSlow'));
      }
      if (typeof next.careerPanelReadyMs === 'number' && next.careerPanelReadyMs > 1300) {
        warnings.push(t(language, 'replay.warningCareerSlow'));
      }

      perfRef.current = {
        ...next,
        warnings,
      };
      onPerfUpdate?.({ ...perfRef.current });
    },
    [language, onPerfUpdate],
  );

  useEffect(() => {
    historyOpenedPerfRef.current = typeof performance !== 'undefined' ? performance.now() : 0;
    perfRef.current = {
      activeView: replayCenterViewCache.viewMode,
      openedAtEpoch: Date.now(),
      sessionsPrefetched: false,
      handsPrefetched: false,
    };
    onPerfUpdate?.({ ...perfRef.current });
    return () => {
      onPerfUpdate?.(null);
    };
  }, [language, onPerfUpdate]);

  useEffect(() => {
    publishPerf({
      activeView: viewMode,
      activeViewAtMs: elapsedFromOpen(),
    });
  }, [elapsedFromOpen, publishPerf, viewMode]);

  useEffect(() => {
    const cancel = scheduleBackgroundWork(() => {
      if (viewMode === 'hands') {
        void preloadSessionsPanel().then(() => {
          publishPerf({
            sessionsPrefetched: true,
            sessionsPrefetchedAtMs: elapsedFromOpen(),
          });
        });
        return;
      }
      void preloadHandsPanel().then(() => {
        publishPerf({
          handsPrefetched: true,
          handsPrefetchedAtMs: elapsedFromOpen(),
        });
      });
    });

    return cancel;
  }, [elapsedFromOpen, publishPerf, viewMode]);

  useEffect(() => {
    replayImportDraftCache = pendingReplayImport;
  }, [pendingReplayImport]);

  useEffect(() => {
    writeLastViewedImportHandCache(lastViewedImportHand);
  }, [lastViewedImportHand]);

  useEffect(() => {
    writeRecentViewedImportHandsCache(recentViewedImportHands);
  }, [recentViewedImportHands]);

  useEffect(() => {
    writePinnedImportHandsCache(pinnedImportHands);
  }, [pinnedImportHands]);

  useEffect(() => {
    replayCenterViewCache = {
      viewMode,
      selectedSessionKey,
      selectedSessionHandFilter,
      compareHighlightDiffs,
      modeFilter,
      sessionFilter,
      sourceFilter,
      resultFilter,
      difficultyFilter,
      minPot,
    };
  }, [compareHighlightDiffs, difficultyFilter, minPot, modeFilter, resultFilter, selectedSessionHandFilter, selectedSessionKey, sessionFilter, sourceFilter, viewMode]);

  const careerModeBreakdown = useMemo(() => (viewMode === 'sessions' ? getCareerModeBreakdown(careerProfile) : []), [careerProfile, viewMode]);

  const replaySessionSummaries = useMemo(() => (viewMode === 'sessions' ? summarizeReplaySessions(history) : []), [history, viewMode]);
  const replaySessionGroups = useMemo(() => (viewMode === 'sessions' ? buildReplaySessionGroups(history) : []), [history, viewMode]);

  const recentDifficultyBreakdown = useMemo(() => {
    if (viewMode !== 'sessions') {
      return {
        conservative: 0,
        standard: 0,
        aggressive: 0,
      };
    }

    const summary = {
      conservative: 0,
      standard: 0,
      aggressive: 0,
    };

    for (const entry of careerProfile.recentSessions) {
      summary[entry.aiDifficulty] += 1;
    }

    return summary;
  }, [careerProfile.recentSessions, viewMode]);

  const selectedReplayImportArchive = useMemo(() => {
    if (!pendingReplayImport) {
      return null;
    }
    return pickReplayArchiveSessions(pendingReplayImport.archive, pendingReplayImport.selectedSessionIds);
  }, [pendingReplayImport]);

  const pendingReplayImportPreview = useMemo<ReplayArchiveImportPreview | null>(() => {
    if (!pendingReplayImport || !selectedReplayImportArchive) {
      return null;
    }
    return buildReplayArchiveImportPreview(replayArchive, selectedReplayImportArchive, pendingReplayImport.mode);
  }, [pendingReplayImport, replayArchive, selectedReplayImportArchive]);

  const pendingReplayImportSessions = useMemo(() => {
    if (!pendingReplayImport) {
      return [];
    }

    const selectedSet = new Set(pendingReplayImport.selectedSessionIds);

    return pendingReplayImport.archive.archivedSessionIds.map((sessionId) => {
      const hands = pendingReplayImport.archive.hands.filter((hand) => hand.sessionId === sessionId);
      const latestHand = hands[0];
      return {
        sessionId,
        handCount: hands.length,
        endedAt: latestHand?.timestamp ?? pendingReplayImport.archive.updatedAt,
        mode: latestHand?.gameMode ?? 'standard',
        sessionMode: latestHand?.sessionMode ?? 'cash',
        aiDifficulty: latestHand?.aiDifficulty ?? 'standard',
        selected: selectedSet.has(sessionId),
      };
    });
  }, [pendingReplayImport]);

  const importPreviewRecordMap = useMemo(() => {
    if (viewMode !== 'sessions' && !pendingReplayImport) {
      return new Map<string, HandHistoryRecord>();
    }

    const map = new Map<string, HandHistoryRecord>();

    for (const hand of history) {
      if (!hand.sessionId) continue;
      map.set(`${hand.sessionId}:${hand.handId}`, hand);
    }
    for (const hand of replayArchive.hands) {
      if (!hand.sessionId) continue;
      map.set(`${hand.sessionId}:${hand.handId}`, hand);
    }
    if (pendingReplayImport) {
      for (const hand of pendingReplayImport.archive.hands) {
        if (!hand.sessionId) continue;
        map.set(`${hand.sessionId}:${hand.handId}`, hand);
      }
    }

    return map;
  }, [history, pendingReplayImport, replayArchive.hands, viewMode]);

  const availableReplayRecordKeys = useMemo(() => {
    if (viewMode !== 'sessions') {
      return new Set<string>();
    }
    const keys = new Set<string>();
    for (const hand of history) {
      keys.add(getHandHistoryRecordKey(hand));
    }
    for (const hand of replayArchive.hands) {
      keys.add(getHandHistoryRecordKey(hand));
    }
    return keys;
  }, [history, replayArchive.hands, viewMode]);

  const visibleComparedSessionHands = useMemo(
    () => (viewMode === 'sessions' ? comparedSessionHands.filter((item) => availableReplayRecordKeys.has(item.handKey)) : []),
    [availableReplayRecordKeys, comparedSessionHands, viewMode],
  );

  const comparedSessionDiffs = useMemo(() => buildComparedSessionDiffState(visibleComparedSessionHands), [visibleComparedSessionHands]);

  useEffect(() => {
    writeComparedSessionHandsCache(visibleComparedSessionHands);
  }, [visibleComparedSessionHands]);

  useEffect(() => {
    if (viewMode !== 'sessions' || !pendingReplayImport || !lastViewedImportHand) {
      return;
    }

    const target = importHandRefs.current.get(lastViewedImportHand.handKey);
    if (!target) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      target.scrollIntoView({
        block: 'center',
        inline: 'center',
        behavior: 'smooth',
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [lastViewedImportHand, pendingReplayImport, viewMode]);

  const filteredHistory = useMemo(() => {
    return history.filter((hand) => {
      if (modeFilter !== 'all' && hand.gameMode !== modeFilter) {
        return false;
      }

      if (sessionFilter !== 'all' && hand.sessionMode !== sessionFilter) {
        return false;
      }

      const fromCurrentSession = currentSessionId !== null && hand.sessionId === currentSessionId;
      if (sourceFilter === 'current' && !fromCurrentSession) {
        return false;
      }
      if (sourceFilter === 'archive' && fromCurrentSession) {
        return false;
      }

      const humanWon = hand.winners.includes('P0');
      if (resultFilter === 'humanWin' && !humanWon) {
        return false;
      }
      if (resultFilter === 'humanLose' && humanWon) {
        return false;
      }

      if (handTotalPot(hand) < minPot) {
        return false;
      }

      const level = hand.aiDifficulty ?? 'standard';
      if (difficultyFilter !== 'all' && level !== difficultyFilter) {
        return false;
      }

      return true;
    });
  }, [currentSessionId, difficultyFilter, history, minPot, modeFilter, resultFilter, sessionFilter, sourceFilter]);

  const analyzed = useMemo(() => {
    const allActions = filteredHistory.flatMap((hand) => hand.actions);
    const aiActions = allActions.filter((action) => action.actorId !== 'P0');
    const tagged = aiActions.filter((action) => Boolean(action.teachingTag));
    const aggressiveCount = aiActions.filter((action) => action.actionType === 'bet' || action.actionType === 'raise' || action.actionType === 'all-in').length;
    const pressureFold = tagged.filter((action) => action.teachingTag === 'pressure_fold').length;

    const tagCount = new Map<string, number>();
    for (const action of tagged) {
      if (!action.teachingLabel) continue;
      tagCount.set(action.teachingLabel, (tagCount.get(action.teachingLabel) ?? 0) + 1);
    }

    const topTags = [...tagCount.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 3);

    return {
      aiActions: aiActions.length,
      aggressiveRate: aiActions.length > 0 ? Math.round((aggressiveCount / aiActions.length) * 100) : 0,
      pressureFoldRate: tagged.length > 0 ? Math.round((pressureFold / tagged.length) * 100) : 0,
      topTags,
    };
  }, [filteredHistory]);

  const effectiveSelectedSessionKey =
    selectedSessionKey && replaySessionGroups.some((group) => group.summary.key === selectedSessionKey)
      ? selectedSessionKey
      : replaySessionGroups[0]?.summary.key ?? null;

  const selectedSessionGroup = useMemo(() => {
    if (viewMode !== 'sessions') {
      return null;
    }
    if (!effectiveSelectedSessionKey) {
      return replaySessionGroups[0] ?? null;
    }
    return replaySessionGroups.find((group) => group.summary.key === effectiveSelectedSessionKey) ?? replaySessionGroups[0] ?? null;
  }, [effectiveSelectedSessionKey, replaySessionGroups, viewMode]);

  const selectedSessionAnalysis = useMemo(
    () => (viewMode === 'sessions' && selectedSessionGroup ? analyzeReplaySessionHands(selectedSessionGroup.hands) : null),
    [selectedSessionGroup, viewMode],
  );
  const selectedSessionFilteredHands = useMemo(
    () => (selectedSessionAnalysis ? filterReplaySessionHandInsights(selectedSessionAnalysis.items, selectedSessionHandFilter) : []),
    [selectedSessionAnalysis, selectedSessionHandFilter],
  );

  const exportFilteredHistory = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      filters: {
        modeFilter,
        sessionFilter,
        resultFilter,
        difficultyFilter,
        minPot,
      },
      hands: filteredHistory,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `holdem-history-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const handleExportCareer = () => {
    exportCareerProfile(careerProfile);
  };

  const handleClearCareer = () => {
    if (careerProfile.totalSessions === 0) {
      return;
    }
    if (typeof window !== 'undefined' && !window.confirm(t(language, 'replay.confirmClearCareer'))) {
      return;
    }
    onClearCareer();
    setCareerFeedback({
      tone: 'neutral',
      message: t(language, 'replay.careerCleared'),
    });
  };

  const handleClearReplayArchive = () => {
    if (replayArchiveSummary.handCount === 0) {
      return;
    }
    if (typeof window !== 'undefined' && !window.confirm(t(language, 'replay.confirmClearArchive'))) {
      return;
    }
    onClearReplayArchive();
    setPendingReplayImport(null);
    setLastViewedImportHand(null);
    setRecentViewedImportHands([]);
    setPinnedImportHands([]);
    setArchiveFeedback({
      tone: 'neutral',
      message: t(language, 'replay.archiveCleared'),
    });
  };

  const handleExportReplayArchive = () => {
    exportReplayArchive(replayArchive);
    setArchiveFeedback({
      tone: 'neutral',
      message: t(language, 'replay.archiveExported'),
    });
  };

  const handleImportReplayArchiveClick = (mode: ReplayArchiveImportMode) => {
    archiveImportModeRef.current = mode;
    archiveImportRef.current?.click();
  };

  const handleImportReplayArchiveFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    const raw = await file.text();
    const parsed = parseReplayArchiveImport(raw);
    if (!parsed.result) {
      setPendingReplayImport(null);
      setArchiveFeedback({
        tone: 'error',
        message: parsed.error ?? t(language, 'replay.importArchiveFailed'),
      });
      return;
    }

    const mode = archiveImportModeRef.current;
    setArchiveFeedback({
      tone: parsed.result.warning ? 'error' : 'neutral',
      message: parsed.result.warning ?? t(language, 'replay.importArchiveRead', { fileName: file.name }),
    });
    setLastViewedImportHand(null);
    setRecentViewedImportHands([]);
    setPinnedImportHands([]);
    setPendingReplayImport({
      fileName: file.name,
      archive: parsed.result.archive,
      mode,
      warning: parsed.result.warning,
      selectedSessionIds: parsed.result.archive.archivedSessionIds,
    });
  };

  const handleConfirmReplayImport = () => {
    if (!pendingReplayImport || !selectedReplayImportArchive || pendingReplayImport.selectedSessionIds.length === 0) {
      return;
    }

    const summary = t(language, 'replay.sessionHandCounts', {
      sessions: selectedReplayImportArchive.archivedSessionIds.length,
      hands: selectedReplayImportArchive.hands.length,
    });
    onImportReplayArchive(
      selectedReplayImportArchive,
      pendingReplayImport.mode,
      pendingReplayImport.mode === 'merge'
        ? t(language, 'replay.archiveMergedSummary', { summary })
        : t(language, 'replay.archiveReplacedSummary', { summary }),
    );
    setArchiveFeedback({
      tone: pendingReplayImport.warning ? 'error' : 'neutral',
      message:
        pendingReplayImport.warning ??
        (pendingReplayImport.mode === 'merge'
          ? t(language, 'replay.archiveMergedFile', { fileName: pendingReplayImport.fileName, summary })
          : t(language, 'replay.archiveImportedFile', { fileName: pendingReplayImport.fileName, summary })),
    });
    setPendingReplayImport(null);
    setLastViewedImportHand(null);
    setRecentViewedImportHands([]);
    setPinnedImportHands([]);
  };

  const handleCancelReplayImport = () => {
    setPendingReplayImport(null);
    setLastViewedImportHand(null);
    setRecentViewedImportHands([]);
    setPinnedImportHands([]);
    setArchiveFeedback({
      tone: 'neutral',
      message: t(language, 'replay.importCancelled'),
    });
  };

  const handleClearRecentImportHands = () => {
    setLastViewedImportHand(null);
    setRecentViewedImportHands([]);
  };

  const handleClearPinnedImportHands = () => {
    setPinnedImportHands([]);
  };

  const handleToggleReplayImportSession = (sessionId: string) => {
    setPendingReplayImport((current) => {
      if (!current) {
        return current;
      }

      const selectedSet = new Set(current.selectedSessionIds);
      if (selectedSet.has(sessionId)) {
        selectedSet.delete(sessionId);
      } else {
        selectedSet.add(sessionId);
      }

      return {
        ...current,
        selectedSessionIds: current.archive.archivedSessionIds.filter((entry) => selectedSet.has(entry)),
      };
    });
  };

  const handleSelectAllReplayImportSessions = () => {
    setPendingReplayImport((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        selectedSessionIds: current.archive.archivedSessionIds,
      };
    });
  };

  const handleClearReplayImportSessions = () => {
    setPendingReplayImport((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        selectedSessionIds: [],
      };
    });
  };

  const handleImportCareerClick = () => {
    careerImportRef.current?.click();
  };

  const handleImportCareerFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    const raw = await file.text();
    const parsed = parseCareerProfileImport(raw);
    if (!parsed.result) {
      setCareerFeedback({
        tone: 'error',
        message: parsed.error ?? t(language, 'replay.importCareerFailed'),
      });
      return;
    }

    if (typeof window !== 'undefined' && !window.confirm(t(language, 'replay.confirmImportCareerOverwrite'))) {
      return;
    }

    onImportCareer(parsed.result.profile, parsed.result.warning ?? t(language, 'replay.careerImported'));
    setCareerFeedback({
      tone: parsed.result.warning ? 'error' : 'neutral',
      message: parsed.result.warning ?? t(language, 'replay.importedFile', { fileName: file.name }),
    });
  };

  const openReplayRecord = (record: HandHistoryRecord) => {
    if (!record.sessionId) {
      return;
    }

    const handKey = getHandHistoryRecordKey(record);
    const nextViewed = {
      handKey,
      sessionId: record.sessionId,
      handId: record.handId,
    };
    const nextRecentEntry: RecentViewedImportHandState = {
      ...nextViewed,
      gameMode: record.gameMode,
      sessionMode: record.sessionMode,
      aiDifficulty: record.aiDifficulty,
      timestamp: record.timestamp,
    };
    const nextRecentHands = [nextRecentEntry, ...recentViewedImportHands.filter((item) => item.handKey !== handKey)].slice(0, MAX_RECENT_IMPORT_HANDS);

    writeLastViewedImportHandCache(nextViewed);
    writeRecentViewedImportHandsCache(nextRecentHands);
    setLastViewedImportHand(nextViewed);
    setRecentViewedImportHands(nextRecentHands);
    onOpenReplay(handKey, { record });
  };

  const openImportHandReplay = (item: RecentViewedImportHandState) => {
    const record = importPreviewRecordMap.get(`${item.sessionId}:${item.handId}`);
    if (!record) {
      return;
    }
    openReplayRecord(record);
  };

  const togglePinnedImportHand = (item: PinnedImportHandState) => {
    setPinnedImportHands((prev) => {
      const exists = prev.some((entry) => entry.handKey === item.handKey);
      if (exists) {
        const next = prev.filter((entry) => entry.handKey !== item.handKey);
        writePinnedImportHandsCache(next);
        return next;
      }
      const next = [item, ...prev].slice(0, MAX_PINNED_IMPORT_HANDS);
      writePinnedImportHandsCache(next);
      return next;
    });
  };

  const toggleComparedSessionHand = (sessionKey: string, item: ReplaySessionHandInsight) => {
    const entry = buildSessionCompareEntry(sessionKey, item);
    setComparedSessionHands((prev) => {
      const baseline = prev.filter((candidate) => availableReplayRecordKeys.has(candidate.handKey));
      const exists = baseline.some((candidate) => candidate.handKey === entry.handKey);
      const next = exists
        ? baseline.filter((candidate) => candidate.handKey !== entry.handKey)
        : [entry, ...baseline].slice(0, MAX_COMPARED_SESSION_HANDS);
      writeComparedSessionHandsCache(next);
      return next;
    });
  };

  const removeComparedSessionHand = (handKey: string) => {
    setComparedSessionHands((prev) => {
      const next = prev.filter((candidate) => candidate.handKey !== handKey);
      writeComparedSessionHandsCache(next);
      return next;
    });
  };

  const handleClearComparedSessionHands = () => {
    writeComparedSessionHandsCache([]);
    setComparedSessionHands([]);
  };

  const renderHandIdPills = (sessionId: string, handIds: number[], tone: 'cyan' | 'gold' | 'steel') =>
    handIds.slice(0, 6).map((handId) => {
      const record = importPreviewRecordMap.get(`${sessionId}:${handId}`);
      const handKey = record ? getHandHistoryRecordKey(record) : `${sessionId}:${handId}`;
      const isRecent = lastViewedImportHand?.handKey === handKey;
      if (!record) {
        return (
          <em key={`${sessionId}-${tone}-${handId}`} className={`archive-import-hand-pill ${tone}${isRecent ? ' recent' : ''}`}>
            #{handId}
          </em>
        );
      }

      return (
        <button
          key={handKey}
          ref={(node) => {
            if (node) {
              importHandRefs.current.set(handKey, node);
            } else {
              importHandRefs.current.delete(handKey);
            }
          }}
          data-import-hand-key={handKey}
          className={`archive-import-hand-pill ${tone}${isRecent ? ' recent' : ''}`}
          type="button"
          onClick={() => openReplayRecord(record)}
        >
          #{handId}
        </button>
      );
    });

  const handleHandsPanelReady = useCallback(() => {
    publishPerf({
      handsPanelReadyMs: elapsedFromOpen(),
    });
  }, [elapsedFromOpen, publishPerf]);

  const handleSessionsPanelReady = useCallback(() => {
    publishPerf({
      sessionsPanelReadyMs: elapsedFromOpen(),
    });
  }, [elapsedFromOpen, publishPerf]);

  const handleSessionArchiveReady = useCallback(() => {
    publishPerf({
      sessionArchiveReadyMs: elapsedFromOpen(),
    });
  }, [elapsedFromOpen, publishPerf]);

  const handleCareerPanelReady = useCallback(() => {
    publishPerf({
      careerPanelReadyMs: elapsedFromOpen(),
    });
  }, [elapsedFromOpen, publishPerf]);

  return (
    <main className="history-screen">
      <section className="history-header glass-panel">
        <div className="history-head-block">
          <h2>{t(language, 'replay.centerTitle')}</h2>
          <div className="history-view-switch">
            <button className={`history-view-button ${viewMode === 'hands' ? 'active' : ''}`} type="button" onClick={() => setViewMode('hands')}>
              {t(language, 'replay.handsView')}
            </button>
            <button className={`history-view-button ${viewMode === 'sessions' ? 'active' : ''}`} type="button" onClick={() => setViewMode('sessions')}>
              {t(language, 'replay.sessionsView')}
            </button>
          </div>
        </div>
        <div className="history-actions">
          {viewMode === 'hands' && (
            <button className="btn" onClick={exportFilteredHistory} disabled={filteredHistory.length === 0}>
              {t(language, 'replay.exportFiltered')}
            </button>
          )}
          <button className="btn" onClick={onBack}>
            {t(language, 'replay.backToTable')}
          </button>
        </div>
      </section>

      {viewMode === 'hands' ? (
        <Suspense fallback={<ReplayPanelLoader label={t(language, 'replay.loadingHandsView')} />}>
          <ReplayHandsPanel
            filteredHistory={filteredHistory}
            stats={stats}
            analyzed={analyzed}
            currentSessionId={currentSessionId}
            modeFilter={modeFilter}
            sessionFilter={sessionFilter}
            sourceFilter={sourceFilter}
            resultFilter={resultFilter}
            difficultyFilter={difficultyFilter}
            minPot={minPot}
            onModeFilterChange={setModeFilter}
            onSessionFilterChange={setSessionFilter}
            onSourceFilterChange={setSourceFilter}
            onResultFilterChange={setResultFilter}
            onDifficultyFilterChange={setDifficultyFilter}
            onMinPotChange={setMinPot}
            onOpenReplay={(handKey) => onOpenReplay(handKey)}
            onReady={handleHandsPanelReady}
          />
        </Suspense>
      ) : (
        <Suspense fallback={<ReplayPanelLoader label={t(language, 'replay.loadingSessionsView')} />}>
          <ReplaySessionsPanel
            archiveImportRef={archiveImportRef}
            careerImportRef={careerImportRef}
            replayArchiveSummary={replayArchiveSummary}
            currentSessionId={currentSessionId}
            pendingReplayImport={pendingReplayImport}
            pendingReplayImportPreview={pendingReplayImportPreview}
            selectedReplayImportArchive={selectedReplayImportArchive}
            pendingReplayImportSessions={pendingReplayImportSessions}
            lastViewedImportHand={lastViewedImportHand}
            recentViewedImportHands={recentViewedImportHands}
            pinnedImportHands={pinnedImportHands}
            replaySessionSummaries={replaySessionSummaries}
            selectedSessionGroup={selectedSessionGroup}
            selectedSessionAnalysis={selectedSessionAnalysis}
            selectedSessionFilteredHands={selectedSessionFilteredHands}
            selectedSessionHandFilter={selectedSessionHandFilter}
            visibleComparedSessionHands={visibleComparedSessionHands}
            comparedSessionDiffs={comparedSessionDiffs}
            compareHighlightDiffs={compareHighlightDiffs}
            previewedSessionJumpKey={previewedSessionJumpKey}
            careerProfile={careerProfile}
            careerModeBreakdown={careerModeBreakdown}
            recentDifficultyBreakdown={recentDifficultyBreakdown}
            archiveFeedback={archiveFeedback}
            careerFeedback={careerFeedback}
            renderHandIdPills={renderHandIdPills}
            onArchiveImportFileChange={handleImportReplayArchiveFile}
            onCareerImportFileChange={handleImportCareerFile}
            onImportReplayArchiveClick={handleImportReplayArchiveClick}
            onExportReplayArchive={handleExportReplayArchive}
            onClearReplayArchive={handleClearReplayArchive}
            onCancelReplayImport={handleCancelReplayImport}
            onConfirmReplayImport={handleConfirmReplayImport}
            onToggleReplayImportSession={handleToggleReplayImportSession}
            onSelectAllReplayImportSessions={handleSelectAllReplayImportSessions}
            onClearReplayImportSessions={handleClearReplayImportSessions}
            onOpenImportHandReplay={openImportHandReplay}
            onTogglePinnedImportHand={togglePinnedImportHand}
            onClearPinnedImportHands={handleClearPinnedImportHands}
            onClearRecentImportHands={handleClearRecentImportHands}
            onSelectSessionKey={setSelectedSessionKey}
            onSelectedSessionHandFilterChange={setSelectedSessionHandFilter}
            onSwitchToHands={() => setViewMode('hands')}
            onCompareHighlightDiffsChange={setCompareHighlightDiffs}
            onClearComparedSessionHands={handleClearComparedSessionHands}
            onRemoveComparedSessionHand={removeComparedSessionHand}
            onPreviewSessionJumpKeyChange={setPreviewedSessionJumpKey}
            onOpenReplay={onOpenReplay}
            onToggleComparedSessionHand={toggleComparedSessionHand}
            onImportCareerClick={handleImportCareerClick}
            onExportCareer={handleExportCareer}
            onClearCareer={handleClearCareer}
            onReady={handleSessionsPanelReady}
            onArchiveReady={handleSessionArchiveReady}
            onCareerReady={handleCareerPanelReady}
          />
        </Suspense>
      )}
    </main>
  );
}
