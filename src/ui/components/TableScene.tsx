import { motion } from 'framer-motion';
import type { ActionOption, PlayerAction, TableState } from '../../types/game';
import type { HandHistoryRecord, ReplayEvent } from '../../types/replay';
import { evaluateByMode } from '../../engine/evaluators';
import { CardView } from './CardView';
import { ControlsPanel } from './ControlsPanel';
import { SeatPanel } from './SeatPanel';
import { ActionLogPanel } from './ActionLogPanel';
import { SessionInsightsPanel } from './SessionInsightsPanel';

interface TableSceneProps {
  table: TableState;
  paused: boolean;
  humanOptions: ActionOption[];
  onAction: (action: PlayerAction) => void;
  events: ReplayEvent[];
  history: HandHistoryRecord[];
}

interface SeatPosition {
  x: number;
  y: number;
  scale: number;
}

function getSeatPositions(total: number): SeatPosition[] {
  const positions: SeatPosition[] = [];
  const radiusX = 44;
  const radiusY = 42;
  const start = 90;
  const baseScale = total >= 10 ? 0.78 : total >= 9 ? 0.82 : total >= 8 ? 0.86 : total >= 7 ? 0.92 : 1;

  for (let i = 0; i < total; i += 1) {
    const angle = ((start + (360 / total) * i) * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const x = 50 + cos * radiusX;
    let y = 50 + sin * radiusY;

    // Push upper seats above the board and move side seats away from the center lane.
    if (sin < -0.2) {
      y -= 18;
    } else if (sin > 0.2) {
      y += 6;
    } else {
      y += cos > 0 ? 12 : -12;
    }

    const scale = sin < -0.2 ? baseScale * 0.92 : baseScale;
    positions.push({ x, y, scale });
  }

  return positions;
}

function handStageLabel(stage: TableState['stage']): string {
  switch (stage) {
    case 'preflop':
      return '翻前';
    case 'flop':
      return '翻牌';
    case 'turn':
      return '转牌';
    case 'river':
      return '河牌';
    case 'showdown':
      return '摊牌';
    case 'settlement':
      return '结算';
    case 'complete':
      return '本手结束';
    default:
      return stage;
  }
}

function getHumanHint(table: TableState): string {
  const human = table.players.find((p) => p.isHuman);
  if (!human) return '无玩家';

  const cards = [...human.holeCards, ...table.board];
  if (cards.length < 5) {
    return '当前最佳牌型：牌面不足 5 张';
  }

  const evaluated = evaluateByMode(table.mode, cards);
  return `当前最佳牌型：${evaluated.description}`;
}

function getActionDisabledReason(options: ActionOption[]): string {
  const blocked = options.filter((opt) => opt.enabled === false && opt.reason);
  if (blocked.length === 0) {
    return '';
  }
  return blocked[0].reason ?? '';
}

export function TableScene({ table, paused, humanOptions, onAction, events, history }: TableSceneProps) {
  const seatPositions = getSeatPositions(table.players.length);
  const disabled = paused || table.stage === 'complete' || table.activePlayerId !== 'P0';
  const disabledReason = getActionDisabledReason(humanOptions);

  return (
    <main className="table-scene">
      <section className="table-stage glass-panel">
        <div className="stage-label current">阶段：{handStageLabel(table.stage)}</div>
        <div className="stage-label">手牌编号：#{table.handId}</div>
        <div className="stage-label">行动玩家：{table.players.find((p) => p.id === table.activePlayerId)?.name ?? '自动推进中'}</div>
      </section>

      <section className="table-wrap">
        <div className="table-felt">
          <div className="board-area">
            <div className="board-title">公共牌</div>
            <div className="board-cards">
              {[0, 1, 2, 3, 4].map((idx) => {
                const card = table.board[idx];
                return <CardView key={`board-${idx}-${card?.code ?? 'empty'}`} card={card} hidden={!card} highlighted={idx === table.board.length - 1} delay={idx * 0.06} />;
              })}
            </div>
          </div>

          <motion.div
            key={`pot-${table.totalPot}`}
            className="pot-display"
            initial={{ scale: 0.95, opacity: 0.6 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.35 }}
          >
            <span>主底池</span>
            <strong>{table.totalPot}</strong>
          </motion.div>

          {table.pots.length > 1 && (
            <div className="side-pot-list">
              {table.pots.slice(1).map((pot) => (
                <div key={pot.id} className="side-pot-item">
                  <span>{pot.id}</span>
                  <strong>{pot.amount}</strong>
                </div>
              ))}
            </div>
          )}

          {table.players.map((player, idx) => {
            const pos = seatPositions[idx];
            const isWinner = table.stage === 'complete' && table.winners.includes(player.id);
            return (
              <div
                key={player.id}
                className={`seat-anchor ${isWinner ? 'winner' : ''}`}
                style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: `translate(-50%, -50%) scale(${pos.scale})` }}
              >
                <SeatPanel
                  player={player}
                  isDealer={player.seat === table.dealerSeat}
                  isSmallBlind={player.seat === table.smallBlindSeat}
                  isBigBlind={player.seat === table.bigBlindSeat}
                  isActive={table.activePlayerId === player.id}
                  showHoleCards={player.isHuman || player.revealed || table.stage === 'showdown' || table.stage === 'complete'}
                />
              </div>
            );
          })}
        </div>
      </section>

      <section className="bottom-row">
        <div className="left-stack">
          <div className="hint-box glass-panel">{getHumanHint(table)}</div>
          {disabledReason && disabled && <div className="hint-box warning">{disabledReason}</div>}
          <ControlsPanel table={table} options={humanOptions} disabled={disabled} onAction={onAction} />
        </div>

        <ActionLogPanel events={events} />
        <SessionInsightsPanel table={table} history={history} />
      </section>
    </main>
  );
}
