import type { CSSProperties } from 'react';
import type { CardSkinKey } from '../../types/cardSkin';
import { suitGlyph } from '../../doudizhu/cards';
import { getCardSkinOption } from '../cardSkins';
import { FaceCardFigure, type FaceCardFigureKind } from './FaceCardFigure';

interface PlayCardLike {
  suit: 'spade' | 'heart' | 'club' | 'diamond' | 'joker';
  rank: number;
  label: string;
  shortLabel: string;
}

interface DouDizhuCardProps {
  card: PlayCardLike;
  cardId?: string;
  selected?: boolean;
  hidden?: boolean;
  compact?: boolean;
  showSuitLabel?: boolean;
  backLabel?: string;
  cardSkinKey?: CardSkinKey;
  onClick?: () => void;
}

function getFigureKind(card: PlayCardLike): FaceCardFigureKind | null {
  if (card.suit === 'joker') {
    return card.rank === 17 ? 'joker-big' : 'joker-small';
  }
  if (card.shortLabel === 'J') return 'jack';
  if (card.shortLabel === 'Q') return 'queen';
  if (card.shortLabel === 'K') return 'king';
  return null;
}

export function DouDizhuCard({
  card,
  cardId,
  selected = false,
  hidden = false,
  compact = false,
  showSuitLabel = false,
  backLabel = '斗地主',
  cardSkinKey,
  onClick,
}: DouDizhuCardProps) {
  const skin = getCardSkinOption(cardSkinKey ?? 'classic-court');
  const palette = skin.palette;
  const isRed = card.suit === 'heart' || card.suit === 'diamond' || card.rank === 17;
  const isJoker = card.suit === 'joker';
  const jokerTone = card.rank === 17 ? 'big' : 'small';
  const figureKind = getFigureKind(card);
  return (
    <button
      type="button"
      data-card-id={cardId}
      aria-pressed={selected}
      className={`ddz-card skin-${skin.key} ${compact ? 'compact' : ''} ${selected ? 'selected' : ''} ${hidden ? 'hidden' : ''} ${isJoker ? `joker-card ${jokerTone}` : ''} ${figureKind ? 'figure-card' : ''}`}
      style={
        {
          '--card-back-primary': palette.backPrimary,
          '--card-back-secondary': palette.backSecondary,
          '--card-back-accent': palette.backAccent,
          '--card-back-pattern': palette.backPattern,
        } as CSSProperties
      }
      onClick={onClick}
      disabled={!onClick}
    >
      {hidden ? (
        <div className="ddz-card-back">
          <strong>{skin.backGlyph}</strong>
          <span>{backLabel}</span>
        </div>
      ) : (
        <>
          <div className={`ddz-card-corner ${isJoker ? 'joker' : isRed ? 'red' : 'black'}`}>
            <strong>{isJoker ? (card.rank === 17 ? '大' : '小') : card.shortLabel}</strong>
            <span>{isJoker ? 'JOKER' : suitGlyph(card.suit)}</span>
          </div>
          <div className={`ddz-card-center ${isJoker ? `joker ${jokerTone}` : isRed ? 'red' : 'black'} ${figureKind ? 'figure' : ''} ${showSuitLabel && !figureKind && !isJoker ? 'with-suit' : ''}`}>
            {figureKind ? (
              <>
                <FaceCardFigure
                  kind={figureKind}
                  badge={isJoker ? '王' : suitGlyph(card.suit)}
                  skinKey={cardSkinKey}
                  compact={compact}
                />
                <strong>{isJoker ? '王' : card.shortLabel}</strong>
                {isJoker && compact ? null : <span>{isJoker ? card.label : `${card.shortLabel} 角色牌`}</span>}
              </>
            ) : (
              <>
                <strong>{isJoker ? '王' : card.shortLabel}</strong>
                {isJoker && !compact ? <span>{card.label}</span> : showSuitLabel && !isJoker ? <span>{suitGlyph(card.suit)}</span> : null}
              </>
            )}
          </div>
        </>
      )}
    </button>
  );
}
