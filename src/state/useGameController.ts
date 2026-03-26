import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AIDifficulty, GameConfig, PlayerAction, SessionStats } from '../types/game';
import type { HandHistoryRecord, ReplayViewerState } from '../types/replay';
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

export type ScreenType = 'menu' | 'table' | 'history' | 'replay';

interface ControllerState {
  screen: ScreenType;
  baseConfig: GameConfig | null;
  config: GameConfig | null;
  runtime: HandRuntime | null;
  history: HandHistoryRecord[];
  stats: SessionStats;
  replayViewer: ReplayViewerState | null;
  paused: boolean;
  banner: string;
}

const emptyStats: SessionStats = {
  totalHands: 0,
  wins: 0,
  winRate: 0,
  totalProfit: 0,
  maxSinglePotWin: 0,
};

const MAX_HISTORY_HANDS = 200;
const BLIND_GROWTH_FACTOR = 1.5;
const FAST_NEXT_HAND_DELAY_MS = 1100;

function roundBlind(value: number): number {
  return Math.max(1, Math.round(value / 5) * 5);
}

function aiDifficultyLabel(level: AIDifficulty): string {
  if (level === 'conservative') return '保守';
  if (level === 'aggressive') return '激进';
  return '标准';
}

function maybeUpgradeBlinds(config: GameConfig, completedHands: number): { nextConfig: GameConfig; upgraded: boolean } {
  if (config.sessionMode !== 'tournament') {
    return { nextConfig: config, upgraded: false };
  }

  if (completedHands <= 0 || completedHands % config.blindUpEveryHands !== 0) {
    return { nextConfig: config, upgraded: false };
  }

  const nextSb = roundBlind(config.smallBlind * BLIND_GROWTH_FACTOR);
  const nextBb = Math.max(roundBlind(config.bigBlind * BLIND_GROWTH_FACTOR), nextSb * 2);

  return {
    nextConfig: {
      ...config,
      smallBlind: nextSb,
      bigBlind: nextBb,
      blindLevel: config.blindLevel + 1,
    },
    upgraded: true,
  };
}

export function useGameController() {
  const [state, setState] = useState<ControllerState>({
    screen: 'menu',
    baseConfig: null,
    config: null,
    runtime: null,
    history: [],
    stats: emptyStats,
    replayViewer: null,
    paused: false,
    banner: '欢迎来到霓虹德州单机局',
  });

  const currentReplayRecord = useMemo(() => {
    if (!state.replayViewer) return null;
    return state.history.find((h) => h.handId === state.replayViewer?.handId) ?? null;
  }, [state.history, state.replayViewer]);

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
    );

    const banner = upgraded
      ? `盲注升级至 ${nextConfig.smallBlind}/${nextConfig.bigBlind}（等级 L${nextConfig.blindLevel}）`
      : `第 ${nextRuntime.table.handId} 手开始`;

    return {
      ...prev,
      config: nextConfig,
      runtime: nextRuntime,
      paused: false,
      banner,
    };
  }, []);

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

    const timer = window.setTimeout(() => {
      setState((prev) => {
        if (!prev.runtime) return prev;
        const currentActor = getCurrentPlayer(prev.runtime.table);
        if (!currentActor || currentActor.isHuman || currentActor.id !== actor.id) {
          return prev;
        }

        const action = decideAiAction(prev.runtime.table, currentActor);
        const result = applyAction(prev.runtime, currentActor.id, action);
        if (result.error) {
          return {
            ...prev,
            banner: `AI 行动失败：${result.error}`,
          };
        }

        let history = prev.history;
        let stats = prev.stats;

        if (result.handCompleted && result.handRecord) {
          history = [result.handRecord, ...prev.history].slice(0, MAX_HISTORY_HANDS);
          stats = computeSessionStats(history, 'P0');
        }

        const sessionOver = isSessionOver(result.runtime.table.players);
        const banner = sessionOver ? '比赛结束，仅剩一名玩家' : result.runtime.table.statusText;

        return {
          ...prev,
          runtime: result.runtime,
          history,
          stats,
          banner,
        };
      });
    }, 800 + Math.floor(Math.random() * 500));

    return () => window.clearTimeout(timer);
  }, [state.screen, state.paused, state.runtime]);

  useEffect(() => {
    if (state.screen !== 'table' || !state.runtime || !state.config || state.paused || !state.config.fastMode) {
      return;
    }

    if (state.runtime.table.stage !== 'complete' || isSessionOver(state.runtime.table.players)) {
      return;
    }

    const timer = window.setTimeout(() => {
      setState((prev) => proceedToNextHand(prev));
    }, FAST_NEXT_HAND_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [state.screen, state.runtime, state.config, state.paused, proceedToNextHand]);

  const replayAutoplay = state.replayViewer?.autoplay ?? false;
  const replayHandId = state.replayViewer?.handId;

  useEffect(() => {
    if (state.screen !== 'replay' || !replayAutoplay || !currentReplayRecord) {
      return;
    }

    const timer = window.setInterval(() => {
      setState((prev) => {
        if (!prev.replayViewer) return prev;
        const target = prev.history.find((h) => h.handId === prev.replayViewer?.handId);
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
  }, [state.screen, replayAutoplay, replayHandId, currentReplayRecord]);

  const startGame = (config: GameConfig) => {
    const cleanConfig: GameConfig = {
      ...config,
      blindLevel: 1,
      blindUpEveryHands: Math.max(2, config.blindUpEveryHands),
      aiDifficulty: config.aiDifficulty ?? 'standard',
    };
    const runtime = createInitialHand(cleanConfig);
    setState({
      screen: 'table',
      baseConfig: cleanConfig,
      config: cleanConfig,
      runtime,
      history: [],
      stats: emptyStats,
      replayViewer: null,
      paused: false,
      banner: '新牌局开始',
    });
  };

  const humanAction = (action: PlayerAction) => {
    setState((prev) => {
      if (!prev.runtime) return prev;
      const human = prev.runtime.table.players.find((p) => p.isHuman);
      if (!human) return prev;

      const result = applyAction(prev.runtime, human.id, action);
      if (result.error) {
        return {
          ...prev,
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
      return {
        ...prev,
        runtime: result.runtime,
        history,
        stats,
        banner: sessionOver ? '比赛结束，仅剩一名玩家' : result.runtime.table.statusText,
      };
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
      runtime: null,
      banner: '已返回主菜单',
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
    }));
  };

  const openTable = () => {
    setState((prev) => ({
      ...prev,
      screen: 'table',
      replayViewer: null,
    }));
  };

  const openReplay = (handId: number) => {
    setState((prev) => ({
      ...prev,
      screen: 'replay',
      replayViewer: {
        handId,
        step: 0,
        autoplay: false,
      },
    }));
  };

  const replayStep = (delta: number) => {
    setState((prev) => {
      if (!prev.replayViewer) return prev;
      const record = prev.history.find((h) => h.handId === prev.replayViewer?.handId);
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
      const record = prev.history.find((h) => h.handId === prev.replayViewer?.handId);
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
      const record = prev.history.find((h) => h.handId === prev.replayViewer?.handId);
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

      return {
        ...prev,
        baseConfig: prev.baseConfig ? { ...prev.baseConfig, aiDifficulty } : prev.baseConfig,
        config: nextConfig,
        runtime: nextRuntime,
        banner: `AI 难度已切换：${aiDifficultyLabel(aiDifficulty)}`,
      };
    });
  };

  return {
    state,
    currentReplayRecord,
    humanActionOptions,
    startGame,
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
    setAIDifficulty,
  };
}
