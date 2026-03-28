import { analyzeTournamentPressure } from '../../engine/tournamentPressure';
import { getTournamentPaidPlaces, getTournamentPrizeLines } from '../../engine/tournamentPrize';
import { getTournamentStructure } from '../../engine/tournamentStructure';
import type { TableState } from '../../types/game';

interface TournamentInfoPanelProps {
  table: TableState;
  onClose: () => void;
}

export function TournamentInfoPanel({ table, onClose }: TournamentInfoPanelProps) {
  const structure = getTournamentStructure(table.config.tournamentStructureId ?? 'standard');
  const prizeLines = getTournamentPrizeLines(table.players.length);
  const paidPlaces = getTournamentPaidPlaces(table.players.length);
  const alivePlayers = table.players.filter((player) => !player.eliminated);
  const averageStack = alivePlayers.length > 0 ? Math.round(alivePlayers.reduce((sum, player) => sum + player.stack, 0) / alivePlayers.length) : 0;
  const hero = table.players.find((player) => player.isHuman) ?? null;
  const standings = [...table.players]
    .sort((a, b) => {
      if (a.eliminated !== b.eliminated) {
        return a.eliminated ? 1 : -1;
      }
      if (b.stack !== a.stack) {
        return b.stack - a.stack;
      }
      return a.seat - b.seat;
    })
    .map((player, index) => ({
      ...player,
      rank: index + 1,
    }));
  const heroStanding = standings.find((player) => player.id === hero?.id) ?? null;
  const heroRank = heroStanding?.rank ?? null;
  const currentLevelIndex = Math.max(0, table.config.blindLevel - 1);
  const currentLevel = structure.levels[currentLevelIndex] ?? structure.levels[0];
  const nextLevel = structure.levels[currentLevelIndex + 1] ?? null;
  const pressure = analyzeTournamentPressure(table.config, table.players);

  return (
    <div className="tournament-panel-layer" role="dialog" aria-modal="true">
      <button className="tournament-panel-backdrop" type="button" aria-label="关闭赛制详情" onClick={onClose} />
      <section className="tournament-panel glass-panel">
        <div className="tournament-panel-head">
          <div>
            <strong>锦标赛详情</strong>
            <span>
              {structure.label} · 共 {table.players.length} 人 · 奖励前 {paidPlaces} 名
            </span>
          </div>
          <button className="btn mini" type="button" onClick={onClose}>
            关闭
          </button>
        </div>

        <div className="tournament-panel-kpis">
          <div>
            <span>当前级别</span>
            <strong>L{currentLevel.level}</strong>
            <em>
              {currentLevel.smallBlind}/{currentLevel.bigBlind} · 前注 {currentLevel.ante}
            </em>
          </div>
          <div>
            <span>下一级别</span>
            <strong>{nextLevel ? `L${nextLevel.level}` : '已封顶'}</strong>
            <em>{nextLevel ? `${nextLevel.smallBlind}/${nextLevel.bigBlind} · 前注 ${nextLevel.ante}` : '当前已是最终档位'}</em>
          </div>
          <div>
            <span>剩余人数</span>
            <strong>{alivePlayers.length}</strong>
            <em>平均筹码 {averageStack}</em>
          </div>
          <div>
            <span>你的态势</span>
            <strong>{heroRank ? `第 ${heroRank} 名 · ${pressure.zoneLabel}` : '-'}</strong>
            <em>{hero ? `M 值 ${pressure.heroM.toFixed(2)} · ${pressure.heroBigBlinds.toFixed(2)}BB` : '无玩家数据'}</em>
          </div>
        </div>

        <div className="tournament-panel-banner">
          <span>奖励圈状态</span>
          <strong>{pressure.bubbleLabel}</strong>
        </div>

        <div className="tournament-panel-guidance">
          <div className={`tournament-guidance-chip ${pressure.zone}`}>
            <span>筹码压力</span>
            <strong>{pressure.zoneLabel}</strong>
          </div>
          <div className={`tournament-guidance-chip ${pressure.bubbleState}`}>
            <span>奖励圈形势</span>
            <strong>{pressure.bubbleLabel}</strong>
          </div>
          <div className="tournament-guidance-chip neutral">
            <span>下一级影响</span>
            <strong>
              {pressure.nextLevelM !== null && pressure.nextLevelBigBlinds !== null
                ? `M ${pressure.nextLevelM.toFixed(2)} · ${pressure.nextLevelBigBlinds.toFixed(2)}BB`
                : '当前已无下一档'}
            </strong>
          </div>
          <p>{pressure.recommendation}</p>
        </div>

        <div className="tournament-panel-grid">
          <section className="tournament-panel-section">
            <div className="tournament-panel-section-head">
              <strong>奖励结构</strong>
              <span>按当前参赛人数生成</span>
            </div>
            <div className="tournament-panel-prizes">
              {prizeLines.map((line) => (
                <div key={`panel-prize-${line.place}`} className={`tournament-panel-prize ${heroRank === line.place ? 'active' : ''}`}>
                  <span>{line.label}</span>
                  <strong>{line.percentage}%</strong>
                  <em>{line.buyInMultiplier} 份买入</em>
                </div>
              ))}
            </div>
          </section>

          <section className="tournament-panel-section">
            <div className="tournament-panel-section-head">
              <strong>完整盲注表</strong>
              <span>当前级别已高亮</span>
            </div>
            <div className="tournament-panel-levels">
              {structure.levels.map((level) => (
                <div key={`panel-level-${level.level}`} className={`tournament-panel-level ${level.level === currentLevel.level ? 'active' : ''}`}>
                  <span>L{level.level}</span>
                  <strong>
                    {level.smallBlind}/{level.bigBlind}
                  </strong>
                  <em>前注 {level.ante}</em>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
