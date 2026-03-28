import { useMemo, useState, type CSSProperties } from 'react';
import { t } from '../../i18n';
import { useLanguage } from '../../i18n/languageContext';
import { analyzeTournamentPressure } from '../../engine/tournamentPressure';
import type { TableState } from '../../types/game';
import type { HandHistoryRecord } from '../../types/replay';
import { getTournamentPrizeForRank, getTournamentPrizeLines } from '../../engine/tournamentPrize';
import { getNextTournamentLevel, getTournamentLevel, getTournamentStructure, getUpcomingTournamentLevels } from '../../engine/tournamentStructure';

interface SessionInsightsPanelProps {
  table: TableState;
  history: HandHistoryRecord[];
  style?: CSSProperties;
}

interface EliminationMeta {
  handId: number;
  ts: number;
}

interface StandingItem {
  id: string;
  name: string;
  seat: number;
  stack: number;
  eliminated: boolean;
  isHuman: boolean;
  rank: number;
  elimination?: EliminationMeta;
}

function formatHandsUntilBlindUp(table: TableState): string {
  if (table.config.sessionMode !== 'tournament') {
    return '固定盲注';
  }

  const interval = Math.max(2, table.config.blindUpEveryHands);
  const remainder = table.handId % interval;
  const nextLevel = getNextTournamentLevel(table.config);
  const nextBlindLabel = nextLevel ? `，升至 ${nextLevel.smallBlind}/${nextLevel.bigBlind} · 前注 ${nextLevel.ante}` : '，已到最终级别';
  if (remainder === 0) {
    return `本手结束后升盲${nextBlindLabel}`;
  }
  return `${interval - remainder} 手后升盲${nextBlindLabel}`;
}

export function SessionInsightsPanel({ table, history, style }: SessionInsightsPanelProps) {
  const language = useLanguage();
  const [standingView, setStandingView] = useState<'alive' | 'all'>('alive');
  const [sortMode, setSortMode] = useState<'stack' | 'momentum'>('stack');
  const [momentumWindow, setMomentumWindow] = useState<3 | 5 | 10>(5);
  const eliminationByPlayer = useMemo(() => {
    const map = new Map<string, EliminationMeta>();
    const chronological = [...history].reverse();

    for (const hand of chronological) {
      for (const event of hand.events) {
        if (event.type !== 'elimination') continue;
        if (map.has(event.actorId)) continue;
        map.set(event.actorId, { handId: hand.handId, ts: hand.timestamp });
      }
    }

    return map;
  }, [history]);

  const recentDeltaByPlayer = useMemo(() => {
    const delta: Record<string, number> = {};
    const recentHands = history.slice(0, momentumWindow);

    for (const hand of recentHands) {
      for (const participant of hand.participants) {
        const start = hand.startingChips[participant.id] ?? 0;
        const end = hand.endingChips[participant.id] ?? start;
        delta[participant.id] = (delta[participant.id] ?? 0) + (end - start);
      }
    }

    return delta;
  }, [history, momentumWindow]);

  const standings = useMemo<StandingItem[]>(() => {
    const sorted = [...table.players].sort((a, b) => {
      if (a.eliminated !== b.eliminated) {
        return a.eliminated ? 1 : -1;
      }

      const aMomentum = recentDeltaByPlayer[a.id] ?? 0;
      const bMomentum = recentDeltaByPlayer[b.id] ?? 0;

      if (sortMode === 'momentum' && aMomentum !== bMomentum) {
        return bMomentum - aMomentum;
      }

      if (b.stack !== a.stack) {
        return b.stack - a.stack;
      }

      if (a.eliminated && b.eliminated) {
        const aHand = eliminationByPlayer.get(a.id)?.handId ?? -1;
        const bHand = eliminationByPlayer.get(b.id)?.handId ?? -1;
        if (aHand !== bHand) {
          return bHand - aHand;
        }
      }

      return a.seat - b.seat;
    });

    return sorted.map((player, idx) => ({
      id: player.id,
      name: player.name,
      seat: player.seat,
      stack: player.stack,
      eliminated: player.eliminated,
      isHuman: player.isHuman,
      rank: idx + 1,
      elimination: eliminationByPlayer.get(player.id),
    }));
  }, [eliminationByPlayer, recentDeltaByPlayer, sortMode, table.players]);

  const alive = standings.filter((item) => !item.eliminated);
  const out = standings.filter((item) => item.eliminated);
  const displayedStandings = standingView === 'alive' ? alive : standings;
  const maxStack = Math.max(...alive.map((i) => i.stack), 1);
  const human = standings.find((item) => item.isHuman);
  const averageStack = alive.length > 0 ? Math.round(alive.reduce((sum, item) => sum + item.stack, 0) / alive.length) : 0;
  const tournamentLevel = table.config.sessionMode === 'tournament' ? getTournamentLevel(table.config) : null;
  const structureLabel = table.config.sessionMode === 'tournament' ? getTournamentStructure(table.config.tournamentStructureId ?? 'standard').label : null;
  const tournamentPrizeLines = table.config.sessionMode === 'tournament' ? getTournamentPrizeLines(table.players.length) : [];
  const heroProjectedPrize = table.config.sessionMode === 'tournament' && human ? getTournamentPrizeForRank(table.players.length, human.rank) : null;
  const upcomingLevels = table.config.sessionMode === 'tournament' ? getUpcomingTournamentLevels(table.config, 5) : [];
  const pressure = table.config.sessionMode === 'tournament' ? analyzeTournamentPressure(table.config, table.players) : null;
  const ante = tournamentLevel?.ante ?? 0;
  const orbitCost = table.config.smallBlind + table.config.bigBlind + ante * Math.max(2, alive.length);
  const humanM = human ? Number((human.stack / Math.max(1, orbitCost)).toFixed(2)) : 0;

  return (
    <aside className="session-insights glass-panel" style={style}>
      <div className="panel-title-row">
        <h3>{t(language, 'panel.tableState')}</h3>
        <span>{table.config.sessionMode === 'tournament' ? t(language, 'common.tournament') : t(language, 'common.cash')}</span>
      </div>
      <div className="session-kpis">
        <div>
          <span>{t(language, 'panel.playersLeft')}</span>
          <strong>{alive.length}</strong>
        </div>
        <div>
          <span>{t(language, 'panel.averageStack')}</span>
          <strong>{averageStack}</strong>
        </div>
        <div>
          <span>{t(language, 'panel.yourRank')}</span>
          <strong>{human ? `#${human.rank}` : '-'}</strong>
        </div>
        <div>
          <span>M 值</span>
          <strong>{human ? humanM.toFixed(2) : '-'}</strong>
        </div>
      </div>

      <div className="session-next-level">
        <span>盲注节奏</span>
        <strong>{formatHandsUntilBlindUp(table)}</strong>
      </div>

      {table.config.sessionMode === 'tournament' && (
        <div className="session-next-level">
          <span>结构与当前级别</span>
          <strong>
            {structureLabel} · L{table.config.blindLevel} · {table.config.smallBlind}/{table.config.bigBlind} · 前注 {ante}
          </strong>
        </div>
      )}

      {table.config.sessionMode === 'tournament' && pressure && (
        <div className={`session-pressure-card ${pressure.zone}`}>
          <div className="session-pressure-head">
            <strong>锦标赛压力</strong>
            <span>{pressure.bubbleLabel}</span>
          </div>
          <div className="session-pressure-grid">
            <div>
              <span>当前区间</span>
              <strong>{pressure.zoneLabel}</strong>
            </div>
            <div>
              <span>当前筹码</span>
              <strong>
                {pressure.heroM.toFixed(2)} M · {pressure.heroBigBlinds.toFixed(2)}BB
              </strong>
            </div>
            <div>
              <span>下一级后</span>
              <strong>
                {pressure.nextLevelM !== null && pressure.nextLevelBigBlinds !== null
                  ? `${pressure.nextLevelM.toFixed(2)} M · ${pressure.nextLevelBigBlinds.toFixed(2)}BB`
                  : '无下一档'}
              </strong>
            </div>
          </div>
          <p>{pressure.recommendation}</p>
        </div>
      )}

      {table.config.sessionMode === 'tournament' && (
        <div className="session-prize-ladder">
          <div className="session-list-head">
            <h4>奖励圈</h4>
            <span>{heroProjectedPrize ? `当前名次可得 ${heroProjectedPrize.percentage}%` : '当前未进奖励圈'}</span>
          </div>
          <div className="session-prize-grid">
            {tournamentPrizeLines.map((line) => (
              <div
                key={`ladder-${line.place}`}
                className={`session-prize-card ${human?.rank === line.place ? 'active' : ''}`}
              >
                <span>{line.label}</span>
                <strong>{line.percentage}%</strong>
                <em>{line.buyInMultiplier} 份买入</em>
              </div>
            ))}
          </div>
        </div>
      )}

      {table.config.sessionMode === 'tournament' && (
        <div className="session-level-preview">
          <div className="session-list-head">
            <h4>后续盲注</h4>
            <span>当前至后续 5 档</span>
          </div>
          <div className="session-level-list">
            {upcomingLevels.map((level) => (
              <div key={`level-${level.level}`} className={`session-level-row ${level.level === table.config.blindLevel ? 'active' : ''}`}>
                <span>L{level.level}</span>
                <strong>
                  {level.smallBlind}/{level.bigBlind}
                </strong>
                <em>前注 {level.ante}</em>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="session-standing-list">
        <div className="session-list-head">
          <h4>筹码排名</h4>
          <div className="session-list-controls">
            <div className="session-toggle">
              <button
                className={standingView === 'alive' ? 'active' : ''}
                onClick={() => setStandingView('alive')}
                type="button"
              >
                仅在局
              </button>
              <button
                className={standingView === 'all' ? 'active' : ''}
                onClick={() => setStandingView('all')}
                type="button"
              >
                全部
              </button>
            </div>
            <div className="session-toggle">
              <button
                className={sortMode === 'stack' ? 'active' : ''}
                onClick={() => setSortMode('stack')}
                type="button"
              >
                筹码
              </button>
              <button
                className={sortMode === 'momentum' ? 'active' : ''}
                onClick={() => setSortMode('momentum')}
                type="button"
              >
                近N手
              </button>
            </div>
            <div className={`session-toggle ${sortMode !== 'momentum' ? 'disabled' : ''}`}>
              {[3, 5, 10].map((n) => (
                <button
                  key={`window-${n}`}
                  className={momentumWindow === n ? 'active' : ''}
                  onClick={() => setMomentumWindow(n as 3 | 5 | 10)}
                  type="button"
                  disabled={sortMode !== 'momentum'}
                >
                  {n}手
                </button>
              ))}
            </div>
          </div>
        </div>
        <p className="session-list-subtitle">
          当前排序：{sortMode === 'stack' ? '筹码' : `近${momentumWindow}手净变化`}
        </p>
        <ul>
          {displayedStandings.map((item) => (
            <li
              key={item.id}
              className={`${item.isHuman ? 'human' : ''} ${item.eliminated ? 'out' : ''}`}
              style={{ '--stack-pct': item.eliminated ? '0%' : `${Math.round((item.stack / maxStack) * 100)}%` } as CSSProperties}
            >
              <div>
                <span className="rank">#{item.rank}</span>
                <span className="name">{item.name}</span>
              </div>
              <div>
                <span className={`delta ${(recentDeltaByPlayer[item.id] ?? 0) >= 0 ? 'up' : 'down'}`}>
                  {(recentDeltaByPlayer[item.id] ?? 0) >= 0 ? '+' : ''}
                  {recentDeltaByPlayer[item.id] ?? 0}
                </span>
                {item.eliminated ? (
                  <span className="status">第 {item.elimination?.handId ?? '-'} 手出局</span>
                ) : (
                  <strong>{item.stack}</strong>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="session-out-list">
        <h4>淘汰记录</h4>
        {out.length === 0 ? (
          <p>暂无淘汰</p>
        ) : (
          <ul>
            {out.slice(0, 12).map((item) => (
              <li key={`out-${item.id}`}>
                <span>{item.name}</span>
                <span>
                  第 {item.elimination?.handId ?? '-'} 手 · {item.elimination ? new Date(item.elimination.ts).toLocaleTimeString('zh-CN', { hour12: false }) : '--:--:--'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
