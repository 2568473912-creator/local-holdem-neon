import type { Card } from '../../types/cards';
import { CardView } from './CardView';

interface StaticCardViewProps {
  card?: Card;
  hidden?: boolean;
  small?: boolean;
  tiny?: boolean;
  highlighted?: boolean;
}

export function StaticCardView({ card, hidden = false, small = false, tiny = false, highlighted = false }: StaticCardViewProps) {
  return (
    <CardView
      card={card}
      hidden={hidden}
      small={small}
      tiny={tiny}
      highlighted={highlighted}
      animated={false}
    />
  );
}
