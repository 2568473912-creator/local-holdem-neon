import { useMemo, useState } from 'react';
import type { GameConfig } from '../../types/game';

interface MainMenuProps {
  onStart: (config: GameConfig) => void;
}

const BLIND_PRESETS = [
  { sb: 10, bb: 20 },
  { sb: 20, bb: 40 },
  { sb: 25, bb: 50 },
  { sb: 50, bb: 100 },
  { sb: 100, bb: 200 },
];

export function MainMenu({ onStart }: MainMenuProps) {
  const [mode, setMode] = useState<GameConfig['mode']>('standard');
  const [sessionMode, setSessionMode] = useState<GameConfig['sessionMode']>('cash');
  const [aiDifficulty, setAiDifficulty] = useState<GameConfig['aiDifficulty']>('standard');
  const [aiCount, setAiCount] = useState(5);
  const [startingChips, setStartingChips] = useState(5000);
  const [blindIdx, setBlindIdx] = useState(1);
  const [fastMode, setFastMode] = useState(false);
  const [blindUpEveryHands, setBlindUpEveryHands] = useState(5);

  const blindInfo = BLIND_PRESETS[blindIdx];

  const summary = useMemo(() => {
    const sessionLabel = sessionMode === 'cash' ? '现金局' : `锦标赛（每 ${blindUpEveryHands} 手升盲）`;
    const speedLabel = fastMode ? '快速模式' : '手动节奏';
    const difficultyLabel = aiDifficulty === 'conservative' ? '保守' : aiDifficulty === 'aggressive' ? '激进' : '标准';
    return `1 人类玩家 + ${aiCount} AI，难度 ${difficultyLabel}，${sessionLabel}，${speedLabel}，初始 ${startingChips} 筹码，盲注 ${blindInfo.sb}/${blindInfo.bb}`;
  }, [aiCount, aiDifficulty, startingChips, blindInfo, sessionMode, blindUpEveryHands, fastMode]);

  const submit = () => {
    onStart({
      mode,
      sessionMode,
      aiCount,
      startingChips,
      smallBlind: blindInfo.sb,
      bigBlind: blindInfo.bb,
      blindLevel: 1,
      blindUpEveryHands: Math.max(2, blindUpEveryHands),
      fastMode,
      aiDifficulty,
    });
  };

  return (
    <main className="menu-screen">
      <div className="menu-backdrop" />
      <section className="menu-card glass-panel">
        <h1>霓虹德州俱乐部</h1>
        <p className="subtitle">单机完整规则 · 标准德州 / 短牌德州 · 可视化回放</p>

        <div className="menu-grid">
          <label>
            游戏模式
            <select value={mode} onChange={(event) => setMode(event.target.value as GameConfig['mode'])}>
              <option value="standard">标准德州</option>
              <option value="shortDeck">短牌德州（6+）</option>
            </select>
          </label>

          <label>
            对局模式
            <select value={sessionMode} onChange={(event) => setSessionMode(event.target.value as GameConfig['sessionMode'])}>
              <option value="cash">现金局（固定盲注）</option>
              <option value="tournament">锦标赛（自动升盲）</option>
            </select>
          </label>

          <label>
            AI 难度
            <select value={aiDifficulty} onChange={(event) => setAiDifficulty(event.target.value as GameConfig['aiDifficulty'])}>
              <option value="conservative">保守（更少诈唬，更少激进全下）</option>
              <option value="standard">标准（平衡）</option>
              <option value="aggressive">激进（更高压，更频繁争夺底池）</option>
            </select>
          </label>

          <label>
            AI 人数（1-10）
            <input
              type="range"
              min={1}
              max={10}
              value={aiCount}
              onChange={(event) => setAiCount(Number(event.target.value))}
            />
            <strong>{aiCount}</strong>
          </label>

          <label>
            初始筹码
            <input
              type="number"
              min={500}
              step={100}
              value={startingChips}
              onChange={(event) => setStartingChips(Math.max(500, Number(event.target.value) || 500))}
            />
          </label>

          <label>
            盲注档位
            <select value={blindIdx} onChange={(event) => setBlindIdx(Number(event.target.value))}>
              {BLIND_PRESETS.map((blind, idx) => (
                <option key={`${blind.sb}-${blind.bb}`} value={idx}>
                  {blind.sb}/{blind.bb}
                </option>
              ))}
            </select>
          </label>

          <label>
            节奏模式
            <select value={fastMode ? 'fast' : 'normal'} onChange={(event) => setFastMode(event.target.value === 'fast')}>
              <option value="normal">标准节奏（手动下一手）</option>
              <option value="fast">快速模式（自动下一手）</option>
            </select>
          </label>

          <label>
            升盲间隔（锦标赛）
            <input
              type="range"
              min={2}
              max={15}
              value={blindUpEveryHands}
              disabled={sessionMode !== 'tournament'}
              onChange={(event) => setBlindUpEveryHands(Number(event.target.value))}
            />
            <strong>{blindUpEveryHands} 手</strong>
          </label>
        </div>

        <div className="menu-summary">{summary}</div>

        <button className="btn primary big" onClick={submit}>
          开始游戏
        </button>
      </section>
    </main>
  );
}
