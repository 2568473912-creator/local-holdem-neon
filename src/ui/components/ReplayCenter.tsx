import { useMemo, useState } from 'react';
import type { SessionStats } from '../../types/game';
import type { HandHistoryRecord } from '../../types/replay';

interface ReplayCenterProps {
  history: HandHistoryRecord[];
  stats: SessionStats;
  onBack: () => void;
  onOpenReplay: (handId: number) => void;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    hour12: false,
  });
}

function handTotalPot(hand: HandHistoryRecord): number {
  return hand.payoutBreakdown.reduce((sum, item) => sum + item.amount, 0);
}

export function ReplayCenter({ history, stats, onBack, onOpenReplay }: ReplayCenterProps) {
  const [modeFilter, setModeFilter] = useState<'all' | 'standard' | 'shortDeck'>('all');
  const [sessionFilter, setSessionFilter] = useState<'all' | 'cash' | 'tournament'>('all');
  const [resultFilter, setResultFilter] = useState<'all' | 'humanWin' | 'humanLose'>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | 'conservative' | 'standard' | 'aggressive'>('all');
  const [minPot, setMinPot] = useState(0);

  const filteredHistory = useMemo(() => {
    return history.filter((hand) => {
      if (modeFilter !== 'all' && hand.gameMode !== modeFilter) {
        return false;
      }

      if (sessionFilter !== 'all' && hand.sessionMode !== sessionFilter) {
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
  }, [history, modeFilter, sessionFilter, resultFilter, minPot, difficultyFilter]);

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
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    return {
      aiActions: aiActions.length,
      aggressiveRate: aiActions.length > 0 ? Math.round((aggressiveCount / aiActions.length) * 100) : 0,
      pressureFoldRate: tagged.length > 0 ? Math.round((pressureFold / tagged.length) * 100) : 0,
      topTags,
    };
  }, [filteredHistory]);

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

  return (
    <main className="history-screen">
      <section className="history-header glass-panel">
        <h2>历史回放中心</h2>
        <div className="history-actions">
          <button className="btn" onClick={exportFilteredHistory} disabled={filteredHistory.length === 0}>
            导出筛选结果
          </button>
          <button className="btn" onClick={onBack}>
            返回牌桌
          </button>
        </div>
      </section>

      <section className="history-filters glass-panel">
        <label>
          模式筛选
          <select value={modeFilter} onChange={(event) => setModeFilter(event.target.value as typeof modeFilter)}>
            <option value="all">全部</option>
            <option value="standard">标准德州</option>
            <option value="shortDeck">短牌德州</option>
          </select>
        </label>
        <label>
          局制筛选
          <select value={sessionFilter} onChange={(event) => setSessionFilter(event.target.value as typeof sessionFilter)}>
            <option value="all">全部</option>
            <option value="cash">现金局</option>
            <option value="tournament">锦标赛</option>
          </select>
        </label>
        <label>
          结果筛选
          <select value={resultFilter} onChange={(event) => setResultFilter(event.target.value as typeof resultFilter)}>
            <option value="all">全部</option>
            <option value="humanWin">仅看你赢</option>
            <option value="humanLose">仅看你未赢</option>
          </select>
        </label>
        <label>
          AI 难度
          <select value={difficultyFilter} onChange={(event) => setDifficultyFilter(event.target.value as typeof difficultyFilter)}>
            <option value="all">全部</option>
            <option value="conservative">保守</option>
            <option value="standard">标准</option>
            <option value="aggressive">激进</option>
          </select>
        </label>
        <label>
          最小底池
          <input type="number" min={0} step={10} value={minPot} onChange={(event) => setMinPot(Math.max(0, Number(event.target.value) || 0))} />
        </label>
        <div className="history-filter-summary">筛选结果：{filteredHistory.length} 手</div>
      </section>

      <section className="stats-grid">
        <div className="stat-card glass-panel">
          <span>总局数</span>
          <strong>{stats.totalHands}</strong>
        </div>
        <div className="stat-card glass-panel">
          <span>胜局数</span>
          <strong>{stats.wins}</strong>
        </div>
        <div className="stat-card glass-panel">
          <span>胜率</span>
          <strong>{stats.winRate}%</strong>
        </div>
        <div className="stat-card glass-panel">
          <span>总盈亏</span>
          <strong className={stats.totalProfit >= 0 ? 'up' : 'down'}>{stats.totalProfit >= 0 ? '+' : ''}{stats.totalProfit}</strong>
        </div>
        <div className="stat-card glass-panel">
          <span>单局最大赢池</span>
          <strong>{stats.maxSinglePotWin}</strong>
        </div>
      </section>

      <section className="history-list glass-panel">
        <div className="history-analysis">
          <div>
            <span>AI 行动数</span>
            <strong>{analyzed.aiActions}</strong>
          </div>
          <div>
            <span>进攻频率</span>
            <strong>{analyzed.aggressiveRate}%</strong>
          </div>
          <div>
            <span>压力弃牌占比</span>
            <strong>{analyzed.pressureFoldRate}%</strong>
          </div>
          <div>
            <span>Top 教学标签</span>
            <strong>{analyzed.topTags.map((item) => `${item[0]}(${item[1]})`).join(' / ') || '无'}</strong>
          </div>
        </div>
        <h3>手牌列表</h3>
        {filteredHistory.length === 0 ? (
          <div className="empty">当前无历史手牌</div>
        ) : (
          <ul>
            {filteredHistory.map((hand) => (
              <li key={hand.handId}>
                <div>
                  <strong>第 {hand.handId} 手</strong>
                  <span>{formatTime(hand.timestamp)}</span>
                  <span>{hand.gameMode === 'standard' ? '标准德州' : '短牌德州'}</span>
                  <span>{hand.sessionMode === 'tournament' ? '锦标赛' : '现金局'}</span>
                  <span>难度 {hand.aiDifficulty === 'conservative' ? '保守' : hand.aiDifficulty === 'aggressive' ? '激进' : '标准'}</span>
                  <span>盲注 {hand.blindInfo.smallBlind}/{hand.blindInfo.bigBlind}</span>
                  <span>底池 {handTotalPot(hand)}</span>
                </div>
                <div>
                  <span>赢家：{hand.winners.join(' / ') || '无'}</span>
                  <button className="btn primary" onClick={() => onOpenReplay(hand.handId)}>
                    打开回放
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
