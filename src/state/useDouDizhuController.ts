import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AIDifficulty } from '../types/game';
import type { HumanPortraitKey } from '../types/portrait';
import {
  applyBid,
  canPass,
  clearSelectedCards,
  computeSessionStats,
  createDouDizhuSession,
  cycleHint,
  getSelectedCards,
  legalPatternsForPlayer,
  nextDouDizhuRound,
  passTurn,
  playSelectedCards,
  restartDouDizhuSession,
  runAutoPlayerAction,
  runAiAction,
  toggleSelectedCard,
} from '../doudizhu/engine';
import type { DdzConfig, DdzRoundRuntime, DdzRoundSummary, DdzSessionStats } from '../doudizhu/types';

export type DdzScreen = 'menu' | 'table';
export type DdzTrusteeMode = 'off' | 'turn' | 'round';

interface DouDizhuControllerState {
  screen: DdzScreen;
  runtime: DdzRoundRuntime | null;
  history: DdzRoundSummary[];
  stats: DdzSessionStats;
  paused: boolean;
  trusteeMode: DdzTrusteeMode;
  historyViewerOpen: boolean;
  historyViewerRound: number | null;
}

const emptyStats: DdzSessionStats = {
  rounds: 0,
  humanWins: 0,
  landlordWins: 0,
  farmerWins: 0,
  bestSwing: 0,
};
const DDZ_AI_DELAY_MS = 580;
const DDZ_TRUSTEE_DELAY_MS = 420;

interface UseDouDizhuControllerOptions {
  defaultHumanPortraitKey?: HumanPortraitKey;
}

export function useDouDizhuController({ defaultHumanPortraitKey }: UseDouDizhuControllerOptions = {}) {
  const [state, setState] = useState<DouDizhuControllerState>({
    screen: 'menu',
    runtime: null,
    history: [],
    stats: emptyStats,
    paused: false,
    trusteeMode: 'off',
    historyViewerOpen: false,
    historyViewerRound: null,
  });

  const applyRuntimeUpdate = useCallback((updater: (runtime: DdzRoundRuntime) => { runtime: DdzRoundRuntime; roundCompleted?: DdzRoundSummary; error?: string }) => {
    setState((prev) => {
      if (!prev.runtime) {
        return prev;
      }
      const result = updater(prev.runtime);
      if (result.error) {
        return {
          ...prev,
          runtime: {
            ...prev.runtime,
            banner: result.error,
          },
        };
      }
      const history = result.roundCompleted ? [result.roundCompleted, ...prev.history].slice(0, 80) : prev.history;
      const historyViewerRound =
        result.roundCompleted && prev.historyViewerRound === null
          ? history[0]?.round ?? null
          : prev.historyViewerRound !== null && history.some((entry) => entry.round === prev.historyViewerRound)
            ? prev.historyViewerRound
            : history[0]?.round ?? null;
      return {
        ...prev,
        runtime: result.runtime,
        history,
        stats: result.roundCompleted ? computeSessionStats(history) : prev.stats,
        historyViewerRound,
      };
    });
  }, []);

  const startGame = useCallback(
    (input?: Partial<Omit<DdzConfig, 'humanPortraitKey'>>) => {
      const config: DdzConfig = {
        aiDifficulty: input?.aiDifficulty ?? 'standard',
        autoNextRound: input?.autoNextRound ?? false,
        humanPortraitKey: defaultHumanPortraitKey,
      };
      setState({
        screen: 'table',
        runtime: createDouDizhuSession(config),
        history: [],
        stats: emptyStats,
        paused: false,
        trusteeMode: 'off',
        historyViewerOpen: false,
        historyViewerRound: null,
      });
    },
    [defaultHumanPortraitKey],
  );

  const backToMenu = useCallback(() => {
    setState((prev) => ({
      ...prev,
      screen: 'menu',
      paused: false,
      historyViewerOpen: false,
      historyViewerRound: null,
    }));
  }, []);

  const restartSession = useCallback(() => {
    setState((prev) => {
      if (!prev.runtime) return prev;
      return {
        screen: 'table',
        runtime: restartDouDizhuSession(prev.runtime),
        history: [],
        stats: emptyStats,
        paused: false,
        trusteeMode: 'off',
        historyViewerOpen: false,
        historyViewerRound: null,
      };
    });
  }, []);

  const nextRound = useCallback(() => {
    setState((prev) => {
      if (!prev.runtime) return prev;
      return {
        ...prev,
        runtime: nextDouDizhuRound(prev.runtime),
        paused: false,
      };
    });
  }, []);

  const togglePause = useCallback(() => {
    setState((prev) => ({
      ...prev,
      paused: !prev.paused,
      runtime: prev.runtime
        ? {
            ...prev.runtime,
            banner: !prev.paused ? '已暂停本局' : prev.runtime.banner,
          }
        : prev.runtime,
    }));
  }, []);

  const humanBid = useCallback((bid: number) => {
    applyRuntimeUpdate((runtime) => applyBid(runtime, 'P0', bid));
  }, [applyRuntimeUpdate]);

  const humanToggleCard = useCallback((cardId: string) => {
    setState((prev) => {
      if (!prev.runtime || prev.paused) return prev;
      return {
        ...prev,
        runtime: toggleSelectedCard(prev.runtime, cardId),
      };
    });
  }, []);

  const humanClearSelection = useCallback(() => {
    setState((prev) => {
      if (!prev.runtime) return prev;
      return {
        ...prev,
        runtime: clearSelectedCards(prev.runtime),
      };
    });
  }, []);

  const humanSelectPattern = useCallback((cardIds: string[]) => {
    setState((prev) => {
      if (!prev.runtime || prev.paused) return prev;
      return {
        ...prev,
        runtime: {
          ...prev.runtime,
          selectedCardIds: cardIds,
          pendingHintIndex: 0,
          banner: `已选中 ${cardIds.length} 张建议牌`,
        },
      };
    });
  }, []);

  const humanHint = useCallback(() => {
    applyRuntimeUpdate((runtime) => cycleHint(runtime));
  }, [applyRuntimeUpdate]);

  const humanPlay = useCallback(() => {
    applyRuntimeUpdate((runtime) => playSelectedCards(runtime, 'P0'));
  }, [applyRuntimeUpdate]);

  const humanPass = useCallback(() => {
    applyRuntimeUpdate((runtime) => passTurn(runtime, 'P0'));
  }, [applyRuntimeUpdate]);

  const setAIDifficulty = useCallback((aiDifficulty: AIDifficulty) => {
    setState((prev) => {
      if (!prev.runtime) return prev;
      return {
        ...prev,
        runtime: {
          ...prev.runtime,
          config: {
            ...prev.runtime.config,
            aiDifficulty,
          },
          banner: `AI 难度已切换为 ${aiDifficulty === 'conservative' ? '保守' : aiDifficulty === 'aggressive' ? '激进' : '标准'}`,
        },
      };
    });
  }, []);

  const setTrusteeMode = useCallback((nextMode: DdzTrusteeMode) => {
    setState((prev) => ({
      ...prev,
      trusteeMode: nextMode,
      runtime: prev.runtime
        ? {
            ...prev.runtime,
            banner:
              nextMode === 'round'
                ? '已开启托管整局，将自动操作直到本局结算或你关闭。'
                : nextMode === 'turn'
                  ? '已开启托管一回合，将自动接管你当前动作。'
                  : '已关闭托管，恢复手动操作。',
          }
        : prev.runtime,
    }));
  }, []);

  const openHistoryViewer = useCallback((round?: number) => {
    setState((prev) => ({
      ...prev,
      historyViewerOpen: true,
      historyViewerRound:
        round && prev.history.some((entry) => entry.round === round)
          ? round
          : prev.historyViewerRound !== null && prev.history.some((entry) => entry.round === prev.historyViewerRound)
            ? prev.historyViewerRound
            : prev.history[0]?.round ?? null,
    }));
  }, []);

  const closeHistoryViewer = useCallback(() => {
    setState((prev) => ({
      ...prev,
      historyViewerOpen: false,
    }));
  }, []);

  const selectHistoryViewerRound = useCallback((round: number) => {
    setState((prev) =>
      prev.history.some((entry) => entry.round === round)
        ? {
            ...prev,
            historyViewerRound: round,
          }
        : prev,
    );
  }, []);

  const flushAutoStep = useCallback((runtime: DdzRoundRuntime, trusteeMode: DdzTrusteeMode) => {
    if (runtime.phase === 'settlement') {
      return { runtime };
    }
    const actor = runtime.players.find((player) => player.id === runtime.currentPlayerId);
    if (actor?.isHuman && trusteeMode !== 'off') {
      return runAutoPlayerAction(runtime, actor.id);
    }
    return runAiAction(runtime);
  }, []);

  useEffect(() => {
    const runtime = state.runtime;
    if (!runtime || state.screen !== 'table' || state.paused) {
      return;
    }
    const actor = runtime.players.find((player) => player.id === runtime.currentPlayerId);
    if (!actor) {
      return;
    }

    if (!actor.isHuman || state.trusteeMode !== 'off') {
      const timer = window.setTimeout(() => {
        setState((prev) => {
          if (!prev.runtime || prev.screen !== 'table' || prev.paused) {
            return prev;
          }
          const runtime = prev.runtime;
          const liveActor = runtime.players.find((player) => player.id === runtime.currentPlayerId);
          if (!liveActor || (liveActor.isHuman && prev.trusteeMode === 'off')) {
            return prev;
          }
          const result = flushAutoStep(runtime, prev.trusteeMode);
          if (result.error) {
            return {
              ...prev,
              runtime: {
                ...runtime,
                banner: result.error,
              },
            };
          }
          const nextTrusteeMode = liveActor.isHuman && prev.trusteeMode === 'turn' ? 'off' : prev.trusteeMode;
          const nextRuntime =
            liveActor.isHuman && prev.trusteeMode === 'turn'
              ? {
                  ...result.runtime,
                  banner: result.runtime.phase === 'settlement' ? result.runtime.banner : '托管一回合完成，已恢复手动操作。',
                }
              : result.runtime;
          const history = result.roundCompleted ? [result.roundCompleted, ...prev.history].slice(0, 80) : prev.history;
          const historyViewerRound =
            result.roundCompleted && prev.historyViewerRound === null
              ? history[0]?.round ?? null
              : prev.historyViewerRound !== null && history.some((entry) => entry.round === prev.historyViewerRound)
                ? prev.historyViewerRound
                : history[0]?.round ?? null;
          return {
            ...prev,
            runtime: nextRuntime,
            history,
            stats: result.roundCompleted ? computeSessionStats(history) : prev.stats,
            trusteeMode: nextTrusteeMode,
            historyViewerRound,
          };
        });
      }, actor.isHuman ? DDZ_TRUSTEE_DELAY_MS : DDZ_AI_DELAY_MS);
      return () => window.clearTimeout(timer);
    }
  }, [flushAutoStep, state.paused, state.runtime, state.screen, state.trusteeMode]);

  const advanceTime = useCallback(
    (ms: number) => {
      const steps = Math.max(1, Math.floor(ms / DDZ_AI_DELAY_MS));
      setState((prev) => {
        let nextState = prev;
        for (let idx = 0; idx < steps; idx += 1) {
          const runtime = nextState.runtime;
          if (!runtime || nextState.screen !== 'table' || nextState.paused) {
            break;
          }
          const actor = runtime.players.find((player) => player.id === runtime.currentPlayerId);
          if (runtime.phase === 'settlement') {
            break;
          }
          if (!actor || (actor.isHuman && nextState.trusteeMode === 'off')) {
            break;
          }
          const result = flushAutoStep(runtime, nextState.trusteeMode);
          if (result.error) {
            nextState = {
              ...nextState,
              runtime: {
                ...runtime,
                banner: result.error,
              },
            };
            break;
          }
          const history = result.roundCompleted ? [result.roundCompleted, ...nextState.history].slice(0, 80) : nextState.history;
          const nextTrusteeMode = actor.isHuman && nextState.trusteeMode === 'turn' ? 'off' : nextState.trusteeMode;
          const historyViewerRound =
            result.roundCompleted && nextState.historyViewerRound === null
              ? history[0]?.round ?? null
              : nextState.historyViewerRound !== null && history.some((entry) => entry.round === nextState.historyViewerRound)
                ? nextState.historyViewerRound
                : history[0]?.round ?? null;
          nextState = {
            ...nextState,
            runtime:
              actor.isHuman && nextState.trusteeMode === 'turn' && result.runtime.phase !== 'settlement'
                ? {
                    ...result.runtime,
                    banner: '托管一回合完成，已恢复手动操作。',
                  }
                : result.runtime,
            history,
            stats: result.roundCompleted ? computeSessionStats(history) : nextState.stats,
            trusteeMode: nextTrusteeMode,
            historyViewerRound,
          };
        }
        return nextState;
      });
    },
    [flushAutoStep],
  );

  const runtime = state.runtime;
  const currentPlayer = runtime?.players.find((player) => player.id === runtime.currentPlayerId) ?? null;
  const human = runtime?.players.find((player) => player.isHuman) ?? null;

  const view = useMemo(
    () => ({
      selectedCards: state.runtime ? getSelectedCards(state.runtime) : [],
      canPass: state.runtime ? canPass(state.runtime, 'P0') : false,
      legalPatterns: state.runtime ? legalPatternsForPlayer(state.runtime, 'P0') : [],
      currentPlayer,
      human,
    }),
    [currentPlayer, human, state.runtime],
  );

  return {
    state,
    view,
    startGame,
    backToMenu,
    restartSession,
    nextRound,
    togglePause,
    humanBid,
    humanToggleCard,
    humanSelectPattern,
    humanClearSelection,
    humanHint,
    humanPlay,
    humanPass,
    setAIDifficulty,
    setTrusteeMode,
    openHistoryViewer,
    closeHistoryViewer,
    selectHistoryViewerRound,
    advanceTime,
  };
}
