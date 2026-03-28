import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AIDifficulty } from '../types/game';
import type { HumanPortraitKey } from '../types/portrait';
import {
  canPass,
  clearSelectedCards,
  computeSessionStats,
  createGuandanSession,
  cycleHint,
  legalPatternsForPlayer,
  nextGuandanRound,
  passTurn,
  playSelectedCards,
  restartGuandanSession,
  runAiAction,
  runAutoPlayerAction,
  setAIDifficulty,
  toggleSelectedCard,
} from '../guandan/engine';
import type { GdConfig, GdRoundRuntime, GdRoundSummary, GdSessionStats } from '../guandan/types';

export type GuandanScreen = 'menu' | 'table';
export type GuandanTrusteeMode = 'off' | 'turn' | 'round';

interface GuandanControllerState {
  screen: GuandanScreen;
  runtime: GdRoundRuntime | null;
  history: GdRoundSummary[];
  stats: GdSessionStats;
  paused: boolean;
  trusteeMode: GuandanTrusteeMode;
}

const emptyStats: GdSessionStats = {
  rounds: 0,
  humanTeamWins: 0,
  alphaWins: 0,
  betaWins: 0,
  bestFinish: 4,
};

interface UseGuandanControllerOptions {
  defaultHumanPortraitKey?: HumanPortraitKey;
}

export function useGuandanController({ defaultHumanPortraitKey }: UseGuandanControllerOptions = {}) {
  const [state, setState] = useState<GuandanControllerState>({
    screen: 'menu',
    runtime: null,
    history: [],
    stats: emptyStats,
    paused: false,
    trusteeMode: 'off',
  });

  const applyRuntimeUpdate = useCallback((updater: (runtime: GdRoundRuntime) => { runtime: GdRoundRuntime; roundCompleted?: GdRoundSummary; error?: string }) => {
    setState((prev) => {
      if (!prev.runtime) return prev;
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
      const history = result.roundCompleted ? [result.roundCompleted, ...prev.history].slice(0, 60) : prev.history;
      return {
        ...prev,
        runtime: result.runtime,
        history,
        stats: result.roundCompleted ? computeSessionStats(history) : prev.stats,
      };
    });
  }, []);

  const startGame = useCallback(
    (input?: Partial<Omit<GdConfig, 'humanPortraitKey'>>) => {
      const config: GdConfig = {
        aiDifficulty: input?.aiDifficulty ?? 'standard',
        autoNextRound: input?.autoNextRound ?? false,
        humanPortraitKey: defaultHumanPortraitKey,
      };
      setState({
        screen: 'table',
        runtime: createGuandanSession(config),
        history: [],
        stats: emptyStats,
        paused: false,
        trusteeMode: 'off',
      });
    },
    [defaultHumanPortraitKey],
  );

  const backToMenu = useCallback(() => {
    setState((prev) => ({ ...prev, screen: 'menu', paused: false }));
  }, []);

  const restartSession = useCallback(() => {
    setState((prev) => {
      if (!prev.runtime) return prev;
      return {
        screen: 'table',
        runtime: restartGuandanSession(prev.runtime),
        history: [],
        stats: emptyStats,
        paused: false,
        trusteeMode: 'off',
      };
    });
  }, []);

  const nextRound = useCallback(() => {
    setState((prev) => {
      if (!prev.runtime) return prev;
      return {
        ...prev,
        runtime: nextGuandanRound(prev.runtime),
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

  const humanHint = useCallback(() => {
    applyRuntimeUpdate((runtime) => cycleHint(runtime));
  }, [applyRuntimeUpdate]);

  const humanPlay = useCallback(() => {
    applyRuntimeUpdate((runtime) => playSelectedCards(runtime, 'P0'));
  }, [applyRuntimeUpdate]);

  const humanPass = useCallback(() => {
    applyRuntimeUpdate((runtime) => passTurn(runtime, 'P0'));
  }, [applyRuntimeUpdate]);

  const changeAIDifficulty = useCallback((difficulty: AIDifficulty) => {
    setState((prev) => {
      if (!prev.runtime) return prev;
      return {
        ...prev,
        runtime: setAIDifficulty(prev.runtime, difficulty),
      };
    });
  }, []);

  const setTrusteeMode = useCallback((mode: GuandanTrusteeMode) => {
    setState((prev) => ({
      ...prev,
      trusteeMode: mode,
      runtime: prev.runtime
        ? {
            ...prev.runtime,
            banner:
              mode === 'round'
                ? '已开启托管整局，会自动推进到本局结算。'
                : mode === 'turn'
                  ? '已开启托管一回合，会自动完成你当前动作。'
                  : '已关闭托管，恢复手动操作。',
          }
        : prev.runtime,
    }));
  }, []);

  const flushAutoStep = useCallback((runtime: GdRoundRuntime, trusteeMode: GuandanTrusteeMode) => {
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
    if (!runtime || state.screen !== 'table' || state.paused) return;
    const actor = runtime.players.find((player) => player.id === runtime.currentPlayerId);
    if (!actor) return;

    if (!actor.isHuman || state.trusteeMode !== 'off') {
      const timer = window.setTimeout(() => {
        setState((prev) => {
          if (!prev.runtime || prev.screen !== 'table' || prev.paused) return prev;
          const runtime = prev.runtime;
          const liveActor = runtime.players.find((player) => player.id === runtime.currentPlayerId);
          if (!liveActor || (liveActor.isHuman && prev.trusteeMode === 'off')) return prev;
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
            liveActor.isHuman && prev.trusteeMode === 'turn' && result.runtime.phase !== 'settlement'
              ? {
                  ...result.runtime,
                  banner: '托管一回合完成，已恢复手动操作。',
                }
              : result.runtime;
          const history = result.roundCompleted ? [result.roundCompleted, ...prev.history].slice(0, 60) : prev.history;
          return {
            ...prev,
            runtime: nextRuntime,
            history,
            stats: result.roundCompleted ? computeSessionStats(history) : prev.stats,
            trusteeMode: nextTrusteeMode,
          };
        });
      }, actor.isHuman ? 520 : 760);
      return () => window.clearTimeout(timer);
    }
  }, [flushAutoStep, state.paused, state.runtime, state.screen, state.trusteeMode]);

  const advanceTime = useCallback(
    (ms: number) => {
      const steps = Math.max(1, Math.floor(ms / 760));
      setState((prev) => {
        let nextState = prev;
        for (let idx = 0; idx < steps; idx += 1) {
          const runtime = nextState.runtime;
          if (!runtime || nextState.screen !== 'table' || nextState.paused) break;
          const actor = runtime.players.find((player) => player.id === runtime.currentPlayerId);
          if (runtime.phase === 'settlement') {
            break;
          }
          if (!actor || (actor.isHuman && nextState.trusteeMode === 'off')) break;
          const result = flushAutoStep(runtime, nextState.trusteeMode);
          if (result.error) {
            nextState = { ...nextState, runtime: { ...runtime, banner: result.error } };
            break;
          }
          const history = result.roundCompleted ? [result.roundCompleted, ...nextState.history].slice(0, 60) : nextState.history;
          const nextTrusteeMode = actor.isHuman && nextState.trusteeMode === 'turn' ? 'off' : nextState.trusteeMode;
          nextState = {
            ...nextState,
            runtime:
              actor.isHuman && nextState.trusteeMode === 'turn' && result.runtime.phase !== 'settlement'
                ? { ...result.runtime, banner: '托管一回合完成，已恢复手动操作。' }
                : result.runtime,
            history,
            stats: result.roundCompleted ? computeSessionStats(history) : nextState.stats,
            trusteeMode: nextTrusteeMode,
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
      selectedCards: state.runtime ? state.runtime.players.find((player) => player.id === 'P0')?.hand.filter((card) => state.runtime?.selectedCardIds.includes(card.id)) ?? [] : [],
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
    humanToggleCard,
    humanClearSelection,
    humanHint,
    humanPlay,
    humanPass,
    setAIDifficulty: changeAIDifficulty,
    setTrusteeMode,
    advanceTime,
  };
}
