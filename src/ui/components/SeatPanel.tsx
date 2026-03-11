import { motion } from 'framer-motion';
import type { PlayerState } from '../../types/game';
import { CardView } from './CardView';

interface SeatPanelProps {
  player: PlayerState;
  isDealer: boolean;
  isSmallBlind: boolean;
  isBigBlind: boolean;
  isActive: boolean;
  showHoleCards: boolean;
  seatClassName?: string;
}

function statusText(player: PlayerState): string {
  if (player.eliminated) return '淘汰';
  if (player.folded) return '弃牌';
  if (player.allIn) return '全下';
  return player.lastAction || '等待';
}

export function SeatPanel({
  player,
  isDealer,
  isSmallBlind,
  isBigBlind,
  isActive,
  showHoleCards,
  seatClassName,
}: SeatPanelProps) {
  const badges: string[] = [];
  if (isDealer) badges.push('庄');
  if (isSmallBlind) badges.push('SB');
  if (isBigBlind) badges.push('BB');

  return (
    <motion.div
      className={`seat-panel ${player.isHuman ? 'human' : 'ai'} ${isActive ? 'active' : ''} ${player.folded ? 'folded' : ''} ${
        seatClassName ?? ''
      }`}
      animate={{ scale: isActive ? 1.04 : 1, boxShadow: isActive ? '0 0 30px rgba(15,226,255,0.42)' : '0 0 20px rgba(0,0,0,0.4)' }}
      transition={{ type: 'spring', stiffness: 190, damping: 18 }}
    >
      <div className="seat-header">
        <strong>{player.name}</strong>
        <div className="seat-badges">
          {badges.map((b) => (
            <span key={b} className="seat-badge">
              {b}
            </span>
          ))}
        </div>
      </div>

      <div className="seat-meta">
        <span>筹码 {player.stack}</span>
        <span>本轮下注 {player.currentBet}</span>
      </div>

      <div className="seat-status">{statusText(player)}</div>

      <div className="seat-cards">
        <CardView card={player.holeCards[0]} hidden={!showHoleCards || player.holeCards.length === 0} small />
        <CardView card={player.holeCards[1]} hidden={!showHoleCards || player.holeCards.length === 0} small delay={0.06} />
      </div>
    </motion.div>
  );
}
