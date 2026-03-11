import { useEffect } from 'react';
import './ui/styles/theme.css';
import { MainMenu } from './ui/components/MainMenu';
import { ReplayCenter } from './ui/components/ReplayCenter';
import { ReplayViewer } from './ui/components/ReplayViewer';
import { TableScene } from './ui/components/TableScene';
import { TopHud } from './ui/components/TopHud';
import { useGameController } from './state/useGameController';

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => void;
  }
}

function App() {
  const {
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
  } = useGameController();

  useEffect(() => {
    window.render_game_to_text = () => {
      const payload: Record<string, unknown> = {
        screen: state.screen,
        note: '坐标系说明：桌面中心为视觉原点，座位按顺时针环绕布局。',
      };

      if (state.runtime) {
        const ranked = [...state.runtime.table.players]
          .sort((a, b) => {
            if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
            return b.stack - a.stack;
          })
          .map((player, idx) => ({
            id: player.id,
            rank: idx + 1,
            stack: player.stack,
            eliminated: player.eliminated,
          }));

        payload.table = {
          handId: state.runtime.table.handId,
          stage: state.runtime.table.stage,
          pot: state.runtime.table.totalPot,
          config: {
            smallBlind: state.runtime.table.config.smallBlind,
            bigBlind: state.runtime.table.config.bigBlind,
            ante:
              state.runtime.table.config.sessionMode === 'tournament'
                ? Math.max(1, Math.round(state.runtime.table.config.bigBlind * 0.1))
                : 0,
            blindLevel: state.runtime.table.config.blindLevel,
            sessionMode: state.runtime.table.config.sessionMode,
            fastMode: state.runtime.table.config.fastMode,
            aiDifficulty: state.runtime.table.config.aiDifficulty,
          },
          board: state.runtime.table.board.map((c) => c.code),
          activePlayerId: state.runtime.table.activePlayerId,
          standings: ranked,
          players: state.runtime.table.players.map((p) => ({
            id: p.id,
            chips: p.stack,
            bet: p.currentBet,
            folded: p.folded,
            allIn: p.allIn,
          })),
        };
      }

      if (state.replayViewer) {
        payload.replay = {
          handId: state.replayViewer.handId,
          step: state.replayViewer.step,
          autoplay: state.replayViewer.autoplay,
        };
      }

      return JSON.stringify(payload);
    };

    window.advanceTime = (ms: number) => {
      if (state.screen !== 'replay' || !state.replayViewer || !currentReplayRecord) {
        return;
      }
      const jump = Math.max(1, Math.round(ms / 900));
      replaySetStep(state.replayViewer.step + jump);
    };

    return () => {
      window.render_game_to_text = undefined;
      window.advanceTime = undefined;
    };
  }, [state, replaySetStep, currentReplayRecord]);

  if (state.screen === 'menu') {
    return <MainMenu onStart={startGame} />;
  }

  if (state.screen === 'history') {
    return <ReplayCenter history={state.history} stats={state.stats} onBack={openTable} onOpenReplay={openReplay} />;
  }

  if (state.screen === 'replay' && currentReplayRecord && state.replayViewer) {
    return (
      <ReplayViewer
        record={currentReplayRecord}
        viewer={state.replayViewer}
        onBack={() => openHistory()}
        onPrev={() => replayStep(-1)}
        onNext={() => replayStep(1)}
        onToggleAutoplay={replayToggleAutoplay}
        onSetStep={replaySetStep}
        onJumpStage={replayJumpToStage}
      />
    );
  }

  if (!state.runtime || !state.config) {
    return <MainMenu onStart={startGame} />;
  }

  return (
    <div className="app-shell">
      <TopHud
        table={state.runtime.table}
        config={state.config}
        banner={state.banner}
        paused={state.paused}
        onPause={togglePause}
        onNextHand={nextHand}
        onRestart={restartSession}
        onHistory={openHistory}
        onMenu={backToMenu}
        onChangeAIDifficulty={setAIDifficulty}
      />

      <TableScene
        table={state.runtime.table}
        paused={state.paused}
        humanOptions={humanActionOptions}
        onAction={humanAction}
        events={state.runtime.replayBuilder.events}
        history={state.history}
      />
    </div>
  );
}

export default App;
