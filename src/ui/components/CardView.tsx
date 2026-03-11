import { motion } from 'framer-motion';
import type { Card } from '../../types/cards';
import { RANK_LABEL, SUIT_COLOR, SUIT_SYMBOL } from '../../types/cards';

interface CardViewProps {
  card?: Card;
  hidden?: boolean;
  small?: boolean;
  highlighted?: boolean;
  delay?: number;
}

export function CardView({ card, hidden = false, small = false, highlighted = false, delay = 0 }: CardViewProps) {
  const width = small ? 34 : 58;
  const height = small ? 50 : 84;

  return (
    <motion.div
      className={`card-view ${hidden ? 'hidden' : ''} ${highlighted ? 'highlighted' : ''}`}
      style={{ width, height }}
      initial={{ rotateY: 90, opacity: 0.4, y: -8 }}
      animate={{ rotateY: 0, opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay }}
    >
      {hidden || !card ? (
        <div className="card-back" />
      ) : (
        <div className={`card-front ${SUIT_COLOR[card.suit]}`}>
          <span className="card-rank">{RANK_LABEL[card.rank]}</span>
          <span className="card-suit">{SUIT_SYMBOL[card.suit]}</span>
        </div>
      )}
    </motion.div>
  );
}
