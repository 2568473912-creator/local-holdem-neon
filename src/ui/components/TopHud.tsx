import type { AIDifficulty, GameConfig, TableState } from '../../types/game';

interface TopHudProps {
  table: TableState;
  config: GameConfig;
  banner: string;
  paused: boolean;
  onPause: () => void;
  onNextHand: () => void;
  onRestart: () => void;
  onHistory: () => void;
  onMenu: () => void;
  onChangeAIDifficulty: (level: AIDifficulty) => void;
}

export function TopHud({
  table,
  config,
  banner,
  paused,
  onPause,
  onNextHand,
  onRestart,
  onHistory,
  onMenu,
  onChangeAIDifficulty,
}: TopHudProps) {
  const modeLabel = config.mode === 'standard' ? '标准德州' : '短牌德州';
  const sessionLabel = config.sessionMode === 'cash' ? '现金局' : `锦标赛 L${config.blindLevel}`;
  const speedLabel = config.fastMode ? '快速模式' : '标准节奏';
  const difficultyLabel = config.aiDifficulty === 'conservative' ? '保守' : config.aiDifficulty === 'aggressive' ? '激进' : '标准';
  const ante = config.sessionMode === 'tournament' ? Math.max(1, Math.round(config.bigBlind * 0.1)) : 0;
  const handsUntilBlindUp = (() => {
    if (config.sessionMode !== 'tournament') {
      return '';
    }
    const interval = Math.max(2, config.blindUpEveryHands);
    const remainder = table.handId % interval;
    if (remainder === 0) {
      return '本手后';
    }
    return `${interval - remainder} 手后`;
  })();

  return (
    <header className="top-hud glass-panel">
      <div className="hud-left">
        <h1>霓虹德州俱乐部</h1>
        <p>{banner}</p>
      </div>

      <div className="hud-center">
        <div className="hud-pill">玩法：{modeLabel}</div>
        <div className="hud-pill">局制：{sessionLabel}</div>
        <div className="hud-pill">AI：{difficultyLabel}</div>
        <div className="hud-pill">节奏：{speedLabel}</div>
        <div className="hud-pill">盲注：{config.smallBlind}/{config.bigBlind}</div>
        {config.sessionMode === 'tournament' && <div className="hud-pill">前注：{ante}</div>}
        {config.sessionMode === 'tournament' && <div className="hud-pill">升盲：每 {config.blindUpEveryHands} 手</div>}
        {config.sessionMode === 'tournament' && <div className="hud-pill">下次升盲：{handsUntilBlindUp}</div>}
        <div className="hud-pill glowing">底池：{table.totalPot}</div>
      </div>

      <div className="hud-actions">
        <label className="hud-select-wrap">
          AI
          <select value={config.aiDifficulty} onChange={(event) => onChangeAIDifficulty(event.target.value as AIDifficulty)}>
            <option value="conservative">保守</option>
            <option value="standard">标准</option>
            <option value="aggressive">激进</option>
          </select>
        </label>
        <button className="btn" onClick={onPause}>
          {paused ? '继续' : '暂停'}
        </button>
        <button className="btn" onClick={onHistory}>
          历史回放
        </button>
        <button className="btn" onClick={onNextHand} disabled={table.stage !== 'complete'}>
          下一手
        </button>
        <button className="btn" onClick={onRestart}>
          重新开局
        </button>
        <button className="btn" onClick={onMenu}>
          返回菜单
        </button>
      </div>
    </header>
  );
}
