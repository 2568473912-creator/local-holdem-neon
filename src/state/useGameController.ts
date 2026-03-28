import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AIDifficulty, AutoActionPreset, GameConfig, PlayerAction, SessionStats } from '../types/game';
import type { CareerProfile, CareerSessionEndReason } from '../types/profile';
import type { HumanPortraitKey } from '../types/portrait';
import type { HandHistoryRecord, ReplayOpenOptions, ReplayViewerState } from '../types/replay';
import { decideAiAction } from '../engine/ai';
import {
  applyAction,
  createInitialHand,
  getCurrentPlayer,
  getHumanActionOptions,
  isSessionOver,
  startHand,
  type HandRuntime,
} from '../engine/handEngine';
import { computeSessionStats } from '../replay/sessionStats';
import { getHandHistoryRecordKey } from '../replay/replayRecordKey';
import { maybeAdvanceTournamentLevel, syncTournamentConfig } from '../engine/tournamentStructure';
import { describeAutoActionPreset, resolveAutoActionPreset } from './autoAction';
import { buildCareerSessionRecord, clearCareerProfile as clearCareerProfileStorage, createEmptyCareerProfile, readCareerProfile, recordCareerSession, writeCareerProfile } from './careerProfile';
import {
  archiveReplaySession,
  clearReplayArchive as clearReplayArchiveStorage,
  createEmptyReplayArchive,
  loadReplayArchive,
  mergeReplayArchives,
  mergeReplayHistories,
  readReplayArchive,
  summarizeReplayArchive,
  writeReplayArchive,
  type ReplayArchive,
} from './replayArchive';
import {
  buildPersistedSession,
  clearPersistedSession,
  readPersistedSession,
  summarizePersistedSession,
  writePersistedSession,
  type PersistableSessionInput,
  type PersistedSessionSummary,
} from './sessionPersistence';

export type ScreenType = 'menu' | 'table' | 'history' | 'replay';

interface ControllerState {
  screen: ScreenType;
  sessionId: string | null;
  careerRecorded: boolean;
  baseConfig: GameConfig | null;
  config: GameConfig | null;
  runtime: HandRuntime | null;
  history: HandHistoryRecord[];
  stats: SessionStats;
  careerProfile: CareerProfile;
  replayArchive: ReplayArchive;
  replayViewer: ReplayViewerState | null;
  replayPreviewRecord: HandHistoryRecord | null;
  paused: boolean;
  banner: string;
  autoAction: AutoActionPreset | null;
  savedSessionMeta: PersistedSessionSummary | null;
}

const emptyStats: SessionStats = {
  totalHands: 0,
  wins: 0,
  winRate: 0,
  totalProfit: 0,
  maxSinglePotWin: 0,
};

const MAX_HISTORY_HANDS = 200;
const AUTO_ACTION_DELAY_MS = 140;
const AI_DELAY_BY_STAGE = {
  preflop: { base: 620, variance: 220 },
  flop: { base: 560, variance: 200 },
  turn: { base: 500, variance: 180 },
  river: { base: 440, variance: 140 },
  showdown: { base: 380, variance: 90 },
  settlement: { base: 340, variance: 70 },
} as const;

interface UseGameControllerOptions {
  defaultHumanPortraitKey?: HumanPortraitKey;
}

function makeSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function aiDifficultyLabel(level: AIDifficulty): string {
  if (level === 'conservative') return '保守';
  if (level === 'aggressive') return '激进';
  return '标准';
}

function ensureConfigPortraitKey(config: GameConfig, portraitKey?: HumanPortraitKey): GameConfig {
  if (!portraitKey || config.humanPortraitKey) {
    return config;
  }
  return {
    ...config,
    humanPortraitKey: portraitKey,
  };
}

function ensureRuntimePortraitKey(runtime: HandRuntime, portraitKey?: HumanPortraitKey): HandRuntime {
  if (!portraitKey) {
    return runtime;
  }

  let changed = false;
  const players = runtime.table.players.map((player) => {
    if (!player.isHuman || player.portraitKey) {
      return player;
    }
    changed = true;
    return {
      ...player,
      portraitKey,
    };
  });

  if (!changed) {
    return runtime;
  }

  return {
    ...runtime,
    table: {
      ...runtime.table,
      config: ensureConfigPortraitKey(runtime.table.config, portraitKey),
      players,
    },
  };
}

function maybeUpgradeBlinds(config: GameConfig, completedHands: number): { nextConfig: GameConfig; upgraded: boolean } {
  return maybeAdvanceTournamentLevel(config, completedHands);
}

function buildLiveSessionMeta(input: PersistableSessionInput): PersistedSessionSummary {
  return summarizePersistedSession(buildPersistedSession(input));
}

function archiveControllerHistory(archive: ReplayArchive, sessionId: string | null, history: HandHistoryRecord[]): ReplayArchive {
  if (!sessionId || history.length === 0) {
    return archive;
  }

  return archiveReplaySession(archive, sessionId, history);
}

function findReplayRecord(history: HandHistoryRecord[], archive: ReplayArchive, handKey: string): HandHistoryRecord | null {
  return mergeReplayHistories(history, archive.hands).find((record) => getHandHistoryRecordKey(record) === handKey) ?? null;
}

function isReplayArchiveSnapshotEqual(left: ReplayArchive, right: ReplayArchive): boolean {
  if (left.updatedAt !== right.updatedAt) {
    return false;
  }
  if (left.hands.length !== right.hands.length || left.archivedSessionIds.length !== right.archivedSessionIds.length) {
    return false;
  }

  const leftFirstHand = left.hands[0];
  const rightFirstHand = right.hands[0];
  if (Boolean(leftFirstHand) !== Boolean(rightFirstHand)) {
    return false;
  }
  if (leftFirstHand && rightFirstHand && getHandHistoryRecordKey(leftFirstHand) !== getHandHistoryRecordKey(rightFirstHand)) {
    return false;
  }

  return (left.archivedSessionIds[0] ?? null) === (right.archivedSessionIds[0] ?? null);
}

function resolveReplayRecord(
  history: HandHistoryRecord[],
  archive: ReplayArchive,
  previewRecord: HandHistoryRecord | null,
  handKey: string,
): HandHistoryRecord | null {
  if (previewRecord && getHandHistoryRecordKey(previewRecord) === handKey) {
    return previewRecord;
  }
  return findReplayRecord(history, archive, handKey);
}

function maybeFinalizeCareerSession(
  prev: ControllerState,
  endReason: CareerSessionEndReason,
): Pick<ControllerState, 'careerProfile' | 'careerRecorded'> {
  if (!prev.sessionId || prev.careerRecorded || !prev.runtime || !prev.config || prev.history.length === 0) {
    return {
      careerProfile: prev.careerProfile,
      careerRecorded: prev.careerRecorded,
    };
  }

  const sessionOver = isSessionOver(prev.runtime.table.players);
  if (prev.config.sessionMode === 'tournament' && !sessionOver) {
    return {
      careerProfile: prev.careerProfile,
      careerRecorded: prev.careerRecorded,
    };
  }

  const record = buildCareerSessionRecord({
    sessionId: prev.sessionId,
    runtime: prev.runtime,
    history: prev.history,
    stats: prev.stats,
    endReason,
  });

  if (!record) {
    return {
      careerProfile: prev.careerProfile,
      careerRecorded: prev.careerRecorded,
    };
  }

  return {
    careerProfile: recordCareerSession(prev.careerProfile, record),
    careerRecorded: true,
  };
}

function applyResolvedAction(
  prev: ControllerState,
  actorId: string,
  action: PlayerAction,
  options?: {
    clearAutoAction?: boolean;
    bannerPrefix?: string;
  },
): ControllerState {
  if (!prev.runtime) {
    return prev;
  }

  const result = applyAction(prev.runtime, actorId, action);
  if (result.error) {
    return {
      ...prev,
      autoAction: options?.clearAutoAction ? null : prev.autoAction,
      banner: result.error,
    };
  }

  let history = prev.history;
  let stats = prev.stats;
  if (result.handCompleted && result.handRecord) {
    history = [result.handRecord, ...prev.history].slice(0, MAX_HISTORY_HANDS);
    stats = computeSessionStats(history, 'P0');
  }

  const sessionOver = isSessionOver(result.runtime.table.players);
  const baseBanner = sessionOver ? '比赛结束，仅剩一名玩家' : result.runtime.table.statusText;
  const nextBanner = options?.bannerPrefix ? `${options.bannerPrefix}${baseBanner}` : baseBanner;
  const nextAutoAction = options?.clearAutoAction ? null : prev.autoAction;
  const nextReplayArchive = sessionOver && result.handCompleted ? archiveControllerHistory(prev.replayArchive, prev.sessionId, history) : prev.replayArchive;
  const nextCareer =
    sessionOver && result.handCompleted
      ? maybeFinalizeCareerSession(
          {
            ...prev,
            runtime: result.runtime,
            history,
            stats,
          },
          'completed',
        )
      : {
          careerProfile: prev.careerProfile,
          careerRecorded: prev.careerRecorded,
        };
  const savedSessionMeta =
    !sessionOver && prev.sessionId && prev.baseConfig && prev.config
      ? buildLiveSessionMeta({
          sessionId: prev.sessionId,
          careerRecorded: nextCareer.careerRecorded,
          baseConfig: prev.baseConfig,
          config: prev.config,
          runtime: result.runtime,
          history,
          stats,
          banner: nextBanner,
          paused: prev.paused,
          autoAction: nextAutoAction,
        })
      : prev.savedSessionMeta;

  return {
    ...prev,
    runtime: result.runtime,
    history,
    stats,
    careerProfile: nextCareer.careerProfile,
    replayArchive: nextReplayArchive,
    careerRecorded: nextCareer.careerRecorded,
    autoAction: nextAutoAction,
    banner: nextBanner,
    savedSessionMeta,
  };
}

export function useGameController(options: UseGameControllerOptions = {}) {
  const defaultHumanPortraitKey = options.defaultHumanPortraitKey;
  const initialSavedSession = readPersistedSession();
  const initialCareerProfile = readCareerProfile();
  const initialReplayArchiveState = readReplayArchive();
  const [state, setState] = useState<ControllerState>({
    screen: 'menu',
    sessionId: initialSavedSession?.sessionId ?? null,
    careerRecorded: initialSavedSession?.careerRecorded ?? false,
    baseConfig: null,
    config: null,
    runtime: null,
    history: [],
    stats: emptyStats,
    careerProfile: initialCareerProfile,
    replayArchive: initialReplayArchiveState,
    replayViewer: null,
    replayPreviewRecord: null,
    paused: false,
    banner: '欢迎来到霓虹德州单机局',
    autoAction: null,
    savedSessionMeta: initialSavedSession ? summarizePersistedSession(initialSavedSession) : null,
  });
  const [replayArchiveReady, setReplayArchiveReady] = useState(() => typeof window === 'undefined');
  const initialReplayArchiveRef = useRef(initialReplayArchiveState);

  const replayHistory = useMemo(() => mergeReplayHistories(state.history, state.replayArchive.hands), [state.history, state.replayArchive.hands]);
  const replayArchiveSummary = useMemo(() => summarizeReplayArchive(state.replayArchive), [state.replayArchive]);

  const currentReplayRecord = useMemo(() => {
    const viewer = state.replayViewer;
    if (!viewer) return null;
    return resolveReplayRecord(state.history, state.replayArchive, state.replayPreviewRecord, viewer.handKey);
  }, [state.history, state.replayArchive, state.replayPreviewRecord, state.replayViewer]);

  const proceedToNextHand = useCallback((prev: ControllerState): ControllerState => {
    if (!prev.runtime || !prev.config) {
      return prev;
    }

    if (prev.runtime.table.stage !== 'complete') {
      return prev;
    }

    const sessionOver = isSessionOver(prev.runtime.table.players);
    if (sessionOver) {
      return {
        ...prev,
        banner: '比赛已结束，请重新开始',
      };
    }

    const completedHands = prev.runtime.table.handId;
    const { nextConfig, upgraded } = maybeUpgradeBlinds(prev.config, completedHands);

    const nextRuntime = startHand(
      nextConfig,
      prev.runtime.table.players,
      prev.runtime.table.handId + 1,
      prev.runtime.table.dealerSeat,
      prev.sessionId ?? makeSessionId(),
    );

    const banner = upgraded
      ? `盲注升级至 ${nextConfig.smallBlind}/${nextConfig.bigBlind}（等级 L${nextConfig.blindLevel}）`
      : `第 ${nextRuntime.table.handId} 手开始`;
    const savedSessionMeta = prev.sessionId && prev.baseConfig
      ? buildLiveSessionMeta({
          sessionId: prev.sessionId,
          careerRecorded: prev.careerRecorded,
          baseConfig: prev.baseConfig,
          config: nextConfig,
          runtime: nextRuntime,
          history: prev.history,
          stats: prev.stats,
          banner,
          paused: false,
          autoAction: null,
        })
      : prev.savedSessionMeta;

    return {
      ...prev,
      config: nextConfig,
      runtime: nextRuntime,
      paused: false,
      banner,
      autoAction: null,
      savedSessionMeta,
    };
  }, []);

  useEffect(() => {
    if (state.screen !== 'table' || state.paused || !state.runtime || !state.autoAction) {
      return;
    }

    const actor = getCurrentPlayer(state.runtime.table);
    if (!actor?.isHuman || state.runtime.table.stage === 'complete') {
      return;
    }

    const timer = window.setTimeout(() => {
      setState((prev) => {
        if (!prev.runtime || !prev.autoAction) {
          return prev;
        }

        const currentActor = getCurrentPlayer(prev.runtime.table);
        if (!currentActor?.isHuman || prev.runtime.table.stage === 'complete') {
          return prev;
        }

        const options = getHumanActionOptions(prev.runtime.table);
        const resolution = resolveAutoActionPreset(prev.autoAction, options, prev.runtime.table.config.bigBlind);
        if (!resolution.action) {
          return {
            ...prev,
            autoAction: resolution.clear ? null : prev.autoAction,
            banner: resolution.reason ?? '自动行动已取消',
          };
        }

        return applyResolvedAction(prev, currentActor.id, resolution.action, {
          clearAutoAction: resolution.clear,
          bannerPrefix: `${describeAutoActionPreset(prev.autoAction, prev.config?.language ?? 'zh-CN')}：`,
        });
      });
    }, AUTO_ACTION_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [state.autoAction, state.paused, state.runtime, state.screen]);

  useEffect(() => {
    writeCareerProfile(state.careerProfile);
  }, [state.careerProfile]);

  useEffect(() => {
    if (!replayArchiveReady) {
      return;
    }
    writeReplayArchive(state.replayArchive);
  }, [replayArchiveReady, state.replayArchive]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    let cancelled = false;
    void loadReplayArchive()
      .then((archive) => {
        if (cancelled) {
          return;
        }

        setState((prev) => {
          if (!isReplayArchiveSnapshotEqual(prev.replayArchive, initialReplayArchiveRef.current)) {
            return prev;
          }
          if (isReplayArchiveSnapshotEqual(prev.replayArchive, archive)) {
            return prev;
          }
          return {
            ...prev,
            replayArchive: archive,
          };
        });
      })
      .catch(() => {
        // IndexedDB hydration is best-effort; bootstrap/localStorage fallback stays usable.
      })
      .finally(() => {
        if (!cancelled) {
          setReplayArchiveReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!state.sessionId || !state.baseConfig || !state.config || !state.runtime) {
      return;
    }

    if (state.runtime.table.stage === 'complete' && isSessionOver(state.runtime.table.players)) {
      clearPersistedSession();
      return;
    }

    writePersistedSession(
      buildPersistedSession({
        sessionId: state.sessionId,
        careerRecorded: state.careerRecorded,
        baseConfig: state.baseConfig,
        config: state.config,
        runtime: state.runtime,
        history: state.history,
        stats: state.stats,
        banner: state.banner,
        paused: state.paused,
        autoAction: state.autoAction,
      }),
    );
  }, [state.autoAction, state.banner, state.baseConfig, state.careerRecorded, state.config, state.history, state.paused, state.runtime, state.sessionId, state.stats]);

  useEffect(() => {
    if (state.screen !== 'table' || state.paused || !state.runtime) {
      return;
    }

    const table = state.runtime.table;
    if (table.stage === 'complete') {
      return;
    }

    const actor = getCurrentPlayer(table);
    if (!actor || actor.isHuman) {
      return;
    }

    const delayProfile = AI_DELAY_BY_STAGE[table.stage] ?? AI_DELAY_BY_STAGE.turn;
    const timer = window.setTimeout(() => {
      setState((prev) => {
        if (!prev.runtime) return prev;
        const currentActor = getCurrentPlayer(prev.runtime.table);
        if (!currentActor || currentActor.isHuman || currentActor.id !== actor.id) {
          return prev;
        }

        const action = decideAiAction(prev.runtime.table, currentActor);
        return applyResolvedAction(prev, currentActor.id, action, {
          clearAutoAction: false,
        });
      });
    }, delayProfile.base + Math.floor(Math.random() * delayProfile.variance));

    return () => window.clearTimeout(timer);
  }, [state.screen, state.paused, state.runtime]);

  useEffect(() => {
    if (state.screen !== 'replay' || !state.replayViewer?.autoplay || !currentReplayRecord) {
      return;
    }

    const timer = window.setInterval(() => {
      setState((prev) => {
        if (!prev.replayViewer) return prev;
        const target = resolveReplayRecord(prev.history, prev.replayArchive, prev.replayPreviewRecord, prev.replayViewer.handKey);
        if (!target) return prev;

        const maxStep = Math.max(0, target.snapshots.length - 1);
        if (prev.replayViewer.step >= maxStep) {
          return {
            ...prev,
            replayViewer: {
              ...prev.replayViewer,
              autoplay: false,
            },
          };
        }

        return {
          ...prev,
          replayViewer: {
            ...prev.replayViewer,
            step: prev.replayViewer.step + 1,
          },
        };
      });
    }, 900);

    return () => window.clearInterval(timer);
  }, [state.screen, state.replayViewer, currentReplayRecord]);

  const startGame = (config: GameConfig) => {
    const cleanConfig = syncTournamentConfig({
      ...config,
      humanPortraitKey: config.humanPortraitKey ?? defaultHumanPortraitKey,
      blindLevel: 1,
      blindUpEveryHands: Math.max(2, config.blindUpEveryHands),
      aiDifficulty: config.aiDifficulty ?? 'standard',
      straddleMode: config.sessionMode === 'cash' && config.mode !== 'stud' ? config.straddleMode ?? 'off' : 'off',
      tournamentStructureId: config.tournamentStructureId ?? 'standard',
    });
    const nextSessionId = makeSessionId();
    const runtime = ensureRuntimePortraitKey(createInitialHand(cleanConfig, nextSessionId), cleanConfig.humanPortraitKey ?? defaultHumanPortraitKey);
    const dormantSavedSession = state.runtime ? null : readPersistedSession();
    setState((prev) => {
      const finalized = maybeFinalizeCareerSession(prev, 'replaced');
      const nextReplayArchive = prev.runtime
        ? archiveControllerHistory(prev.replayArchive, prev.sessionId, prev.history)
        : dormantSavedSession?.sessionId
          ? archiveControllerHistory(prev.replayArchive, dormantSavedSession.sessionId, dormantSavedSession.history)
          : prev.replayArchive;
      return {
        screen: 'table',
        sessionId: nextSessionId,
        careerRecorded: false,
        baseConfig: cleanConfig,
        config: cleanConfig,
        runtime,
        history: [],
        stats: emptyStats,
        careerProfile: finalized.careerProfile,
        replayArchive: nextReplayArchive,
        replayViewer: null,
        replayPreviewRecord: null,
        paused: false,
        banner: '新牌局开始',
        autoAction: null,
        savedSessionMeta: buildLiveSessionMeta({
          sessionId: nextSessionId,
          careerRecorded: false,
          baseConfig: cleanConfig,
          config: cleanConfig,
          runtime,
          history: [],
          stats: emptyStats,
          banner: '新牌局开始',
          paused: false,
          autoAction: null,
        }),
      };
    });
  };

  const resumeSavedSession = () => {
    const saved = readPersistedSession();
    if (!saved) {
      clearPersistedSession();
      setState((prev) => ({
        ...prev,
        savedSessionMeta: null,
        banner: '未找到可继续的存档',
      }));
      return;
    }

    const baseConfig = ensureConfigPortraitKey(saved.baseConfig, defaultHumanPortraitKey);
    const config = ensureConfigPortraitKey(saved.config, defaultHumanPortraitKey);
    const runtime = ensureRuntimePortraitKey(saved.runtime, defaultHumanPortraitKey);

    setState((prev) => ({
      screen: 'table',
      sessionId: saved.sessionId ?? `legacy-${saved.savedAt}`,
      careerRecorded: saved.careerRecorded ?? false,
      baseConfig,
      config,
      runtime,
      history: saved.history,
      stats: saved.stats,
      careerProfile: prev.careerProfile,
      replayArchive: prev.replayArchive,
      replayViewer: null,
      replayPreviewRecord: null,
      paused: false,
      banner: `继续第 ${runtime.table.handId} 手`,
      autoAction: saved.autoAction,
      savedSessionMeta: summarizePersistedSession({
        ...saved,
        baseConfig,
        config,
        runtime,
      }),
    }));
  };

  const clearSavedSessionEntry = () => {
    const saved = readPersistedSession();
    clearPersistedSession();
    setState((prev) => ({
      ...prev,
      replayArchive: saved?.sessionId ? archiveControllerHistory(prev.replayArchive, saved.sessionId, saved.history) : prev.replayArchive,
      savedSessionMeta: null,
      banner: saved?.history.length ? '已清除本地存档，历史手牌已转入回放归档' : '已清除本地存档',
    }));
  };

  const humanAction = (action: PlayerAction) => {
    setState((prev) => {
      if (!prev.runtime) return prev;
      const human = prev.runtime.table.players.find((p) => p.isHuman);
      if (!human) return prev;
      return applyResolvedAction(prev, human.id, action, {
        clearAutoAction: true,
      });
    });
  };

  const nextHand = () => {
    setState((prev) => proceedToNextHand(prev));
  };

  const restartSession = () => {
    const base = state.baseConfig ?? state.config;
    if (!base) {
      setState((prev) => ({ ...prev, screen: 'menu', runtime: null }));
      return;
    }
    startGame(base);
  };

  const backToMenu = () => {
    setState((prev) => ({
      ...prev,
      screen: 'menu',
      replayViewer: null,
      replayPreviewRecord: null,
      banner: '已返回主菜单',
      autoAction: null,
    }));
  };

  const togglePause = () => {
    setState((prev) => ({
      ...prev,
      paused: !prev.paused,
      banner: prev.paused ? '继续游戏' : '游戏已暂停',
    }));
  };

  const openHistory = () => {
    setState((prev) => ({
      ...prev,
      screen: 'history',
      replayViewer: null,
      replayPreviewRecord: null,
    }));
  };

  const openTable = () => {
    setState((prev) => ({
      ...prev,
      screen: 'table',
      replayViewer: null,
      replayPreviewRecord: null,
    }));
  };

  const openReplay = (handKey: string, options?: ReplayOpenOptions) => {
    const record = options?.record ?? replayHistory.find((item) => getHandHistoryRecordKey(item) === handKey);
    if (!record) {
      return;
    }

    const maxStep = Math.max(0, record.snapshots.length - 1);
    const initialStep = Math.max(0, Math.min(maxStep, options?.initialStep ?? 0));

    setState((prev) => ({
      ...prev,
      screen: 'replay',
      replayPreviewRecord: options?.record ?? null,
      replayViewer: {
        handKey,
        handId: record.handId,
        sessionId: record.sessionId,
        step: initialStep,
        autoplay: false,
      },
    }));
  };

  const replayStep = (delta: number) => {
    setState((prev) => {
      if (!prev.replayViewer) return prev;
      const record = resolveReplayRecord(prev.history, prev.replayArchive, prev.replayPreviewRecord, prev.replayViewer.handKey);
      if (!record) return prev;

      const maxStep = Math.max(0, record.snapshots.length - 1);
      const step = Math.max(0, Math.min(maxStep, prev.replayViewer.step + delta));
      return {
        ...prev,
        replayViewer: {
          ...prev.replayViewer,
          step,
        },
      };
    });
  };

  const replayJumpToStage = (stage: 'preflop' | 'flop' | 'turn' | 'river' | 'showdown') => {
    setState((prev) => {
      if (!prev.replayViewer) return prev;
      const record = resolveReplayRecord(prev.history, prev.replayArchive, prev.replayPreviewRecord, prev.replayViewer.handKey);
      if (!record) return prev;
      const idx = record.snapshots.findIndex((s) => s.stage === stage);
      if (idx < 0) return prev;

      return {
        ...prev,
        replayViewer: {
          ...prev.replayViewer,
          step: idx,
          autoplay: false,
        },
      };
    });
  };

  const replaySetStep = (step: number) => {
    setState((prev) => {
      if (!prev.replayViewer) return prev;
      const record = resolveReplayRecord(prev.history, prev.replayArchive, prev.replayPreviewRecord, prev.replayViewer.handKey);
      if (!record) return prev;
      const maxStep = Math.max(0, record.snapshots.length - 1);
      return {
        ...prev,
        replayViewer: {
          ...prev.replayViewer,
          step: Math.max(0, Math.min(maxStep, step)),
        },
      };
    });
  };

  const replayToggleAutoplay = () => {
    setState((prev) => {
      if (!prev.replayViewer) return prev;
      return {
        ...prev,
        replayViewer: {
          ...prev.replayViewer,
          autoplay: !prev.replayViewer.autoplay,
        },
      };
    });
  };

  const humanActionOptions = state.runtime ? getHumanActionOptions(state.runtime.table) : [];

  const setAutoAction = (preset: AutoActionPreset | null) => {
    setState((prev) => {
      const banner = preset
        ? `已设置自动行动：${describeAutoActionPreset(preset, prev.config?.language ?? 'zh-CN')}`
        : '已清除自动行动';
      const savedSessionMeta =
        prev.sessionId && prev.baseConfig && prev.config && prev.runtime
          ? buildLiveSessionMeta({
              sessionId: prev.sessionId,
              careerRecorded: prev.careerRecorded,
              baseConfig: prev.baseConfig,
              config: prev.config,
              runtime: prev.runtime,
              history: prev.history,
              stats: prev.stats,
              banner,
              paused: prev.paused,
              autoAction: preset,
            })
          : prev.savedSessionMeta;

      return {
        ...prev,
        autoAction: preset,
        banner,
        savedSessionMeta,
      };
    });
  };

  const setAIDifficulty = (aiDifficulty: AIDifficulty) => {
    setState((prev) => {
      if (!prev.config || prev.config.aiDifficulty === aiDifficulty) {
        return prev;
      }

      const nextConfig: GameConfig = {
        ...prev.config,
        aiDifficulty,
      };

      const nextRuntime = prev.runtime
        ? {
            ...prev.runtime,
            table: {
              ...prev.runtime.table,
              config: {
                ...prev.runtime.table.config,
                aiDifficulty,
              },
            },
          }
        : null;
      const banner = `AI 难度已切换：${aiDifficultyLabel(aiDifficulty)}`;
      const savedSessionMeta =
        prev.baseConfig && nextRuntime
          ? buildLiveSessionMeta({
              baseConfig: { ...prev.baseConfig, aiDifficulty },
              sessionId: prev.sessionId ?? makeSessionId(),
              careerRecorded: prev.careerRecorded,
              config: nextConfig,
              runtime: nextRuntime,
              history: prev.history,
              stats: prev.stats,
              banner,
              paused: prev.paused,
              autoAction: prev.autoAction,
            })
          : prev.savedSessionMeta;

      return {
        ...prev,
        baseConfig: prev.baseConfig ? { ...prev.baseConfig, aiDifficulty } : prev.baseConfig,
        config: nextConfig,
        runtime: nextRuntime,
        banner,
        savedSessionMeta,
      };
    });
  };

  const clearCareerArchive = () => {
    clearCareerProfileStorage();
    setState((prev) => ({
      ...prev,
      careerProfile: createEmptyCareerProfile(),
      banner: '已清空本地生涯战绩',
    }));
  };

  const importCareerArchive = (profile: CareerProfile, message?: string) => {
    setState((prev) => ({
      ...prev,
      careerProfile: profile,
      banner: message ?? '已导入本地生涯战绩',
    }));
  };

  const importReplayArchive = (archive: ReplayArchive, mode: 'replace' | 'merge', message?: string) => {
    setState((prev) => ({
      ...prev,
      replayArchive: mode === 'merge' ? mergeReplayArchives(prev.replayArchive, archive) : archive,
      banner: message ?? (mode === 'merge' ? '已合并本地回放归档' : '已导入本地回放归档'),
    }));
  };

  const clearReplayArchive = () => {
    clearReplayArchiveStorage();
    setState((prev) => ({
      ...prev,
      replayArchive: createEmptyReplayArchive(),
      banner: '已清空本地回放归档',
    }));
  };

  return {
    state,
    currentReplayRecord,
    replayHistory,
    replayArchiveSummary,
    replayArchive: state.replayArchive,
    humanActionOptions,
    autoAction: state.autoAction,
    careerProfile: state.careerProfile,
    savedSessionMeta: state.savedSessionMeta,
    startGame,
    resumeSavedSession,
    clearSavedSessionEntry,
    humanAction,
    nextHand,
    restartSession,
    backToMenu,
    togglePause,
    openHistory,
    openTable,
    openReplay,
    replayStep,
    replayJumpToStage,
    replaySetStep,
    replayToggleAutoplay,
    setAutoAction,
    setAIDifficulty,
    clearCareerArchive,
    clearReplayArchive,
    importCareerArchive,
    importReplayArchive,
  };
}
