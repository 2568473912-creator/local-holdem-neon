import { motion } from 'framer-motion';
import type { CSSProperties } from 'react';
import type { Card } from '../../types/cards';
import type { CardSkinKey } from '../../types/cardSkin';
import { RANK_LABEL, SUIT_COLOR, SUIT_SYMBOL } from '../../types/cards';
import { getCardSkinOption } from '../cardSkins';
import { FaceCardFigure, type FaceCardFigureKind } from './FaceCardFigure';

interface CardViewProps {
  card?: Card;
  hidden?: boolean;
  size?: CardSizeVariant;
  small?: boolean;
  tiny?: boolean;
  highlighted?: boolean;
  delay?: number;
  cardSkinKey?: CardSkinKey;
  animated?: boolean;
}

interface PipToken {
  col: 1 | 2 | 3;
  row: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  inverted?: boolean;
  accent?: boolean;
}

interface CardPoint {
  x: number;
  y: number;
}

interface PipRenderMetrics {
  compact: boolean;
  pipFontSize: number;
  accentFontSize: number;
  rankFontSize: number;
  suitFontSize: number;
  topCornerX: number;
  topRankY: number;
  topSuitY: number;
  bottomCornerX: number;
  bottomRankY: number;
  bottomSuitY: number;
  showBottomCorner: boolean;
}

interface CornerMetrics {
  rankSize: string;
  suitSize: string;
  topOffset: string;
  sideOffset: string;
  gap: string;
}

type CardBackTier = 'starter' | 'premium' | 'elite' | 'mythic';
type CardBackMotif = 'crest' | 'neon' | 'opera' | 'jade' | 'gala' | 'glacier';

export type CardSizeVariant = 'board' | 'seat-roomy' | 'seat-balanced' | 'seat-compact' | 'seat-dense' | 'seat-omaha';

const CARD_BASE_DIMENSIONS = { width: 60, height: 88 } as const;

const CARD_SCALE: Record<CardSizeVariant, number> = {
  board: 1,
  'seat-roomy': 0.94,
  'seat-balanced': 0.88,
  'seat-compact': 0.8,
  'seat-dense': 0.72,
  'seat-omaha': 0.68,
};

const PIP_LAYOUTS: Record<number, PipToken[]> = {
  2: [
    { col: 2, row: 1 },
    { col: 2, row: 7, inverted: true },
  ],
  3: [
    { col: 2, row: 1 },
    { col: 2, row: 4 },
    { col: 2, row: 7, inverted: true },
  ],
  4: [
    { col: 1, row: 1 },
    { col: 3, row: 1 },
    { col: 1, row: 7, inverted: true },
    { col: 3, row: 7, inverted: true },
  ],
  5: [
    { col: 1, row: 1 },
    { col: 3, row: 1 },
    { col: 2, row: 4, accent: true },
    { col: 1, row: 7, inverted: true },
    { col: 3, row: 7, inverted: true },
  ],
  6: [
    { col: 1, row: 1 },
    { col: 3, row: 1 },
    { col: 1, row: 4 },
    { col: 3, row: 4 },
    { col: 1, row: 7, inverted: true },
    { col: 3, row: 7, inverted: true },
  ],
  7: [
    { col: 1, row: 1 },
    { col: 3, row: 1 },
    { col: 2, row: 2 },
    { col: 1, row: 4 },
    { col: 3, row: 4 },
    { col: 1, row: 7, inverted: true },
    { col: 3, row: 7, inverted: true },
  ],
  8: [
    { col: 1, row: 1 },
    { col: 3, row: 1 },
    { col: 2, row: 2 },
    { col: 1, row: 4 },
    { col: 3, row: 4 },
    { col: 2, row: 6, inverted: true },
    { col: 1, row: 7, inverted: true },
    { col: 3, row: 7, inverted: true },
  ],
  9: [
    { col: 1, row: 1 },
    { col: 3, row: 1 },
    { col: 2, row: 2 },
    { col: 1, row: 4 },
    { col: 2, row: 4, accent: true },
    { col: 3, row: 4 },
    { col: 2, row: 6, inverted: true },
    { col: 1, row: 7, inverted: true },
    { col: 3, row: 7, inverted: true },
  ],
  10: [
    { col: 1, row: 1 },
    { col: 3, row: 1 },
    { col: 2, row: 2 },
    { col: 1, row: 3 },
    { col: 3, row: 3 },
    { col: 1, row: 5, inverted: true },
    { col: 3, row: 5, inverted: true },
    { col: 2, row: 6, inverted: true },
    { col: 1, row: 7, inverted: true },
    { col: 3, row: 7, inverted: true },
  ],
};

function resolveCardSize(size?: CardSizeVariant, small = false, tiny = false): CardSizeVariant {
  if (size) {
    return size;
  }
  if (tiny) {
    return 'seat-dense';
  }
  if (small) {
    return 'seat-compact';
  }
  return 'board';
}

function getFigureKind(rank: number): FaceCardFigureKind | null {
  if (rank === 11) return 'jack';
  if (rank === 12) return 'queen';
  if (rank === 13) return 'king';
  return null;
}

function getPipLayout(rank: number): PipToken[] {
  if (rank === 14) {
    return [{ col: 2, row: 4, accent: true }];
  }
  return PIP_LAYOUTS[rank] ?? [{ col: 2, row: 4, accent: true }];
}

function getPipPoint(token: PipToken): CardPoint {
  const columnMap: Record<PipToken['col'], number> = {
    1: 18,
    2: 30,
    3: 42,
  };
  const rowMap: Record<PipToken['row'], number> = {
    1: 20,
    2: 29,
    3: 37,
    4: 44,
    5: 51,
    6: 59,
    7: 68,
  };

  return { x: columnMap[token.col], y: rowMap[token.row] };
}

function getPipRenderMetrics(size: CardSizeVariant): PipRenderMetrics {
  if (size === 'board' || size === 'seat-roomy') {
    return {
      compact: false,
      pipFontSize: 11.2,
      accentFontSize: 11.8,
      rankFontSize: 11,
      suitFontSize: 10.8,
      topCornerX: 9.5,
      topRankY: 12,
      topSuitY: 20.5,
      bottomCornerX: 50.5,
      bottomRankY: 76,
      bottomSuitY: 67.5,
      showBottomCorner: false,
    };
  }

  if (size === 'seat-balanced') {
    return {
      compact: true,
      pipFontSize: 10.2,
      accentFontSize: 10.8,
      rankFontSize: 9.5,
      suitFontSize: 8.8,
      topCornerX: 9,
      topRankY: 11.5,
      topSuitY: 18.3,
      bottomCornerX: 51,
      bottomRankY: 76,
      bottomSuitY: 68,
      showBottomCorner: false,
    };
  }

  return {
    compact: true,
    pipFontSize: 9.5,
    accentFontSize: 10.1,
    rankFontSize: 8.7,
    suitFontSize: 7.9,
    topCornerX: 8.8,
    topRankY: 11.2,
    topSuitY: 17.2,
    bottomCornerX: 51,
    bottomRankY: 76,
    bottomSuitY: 68,
    showBottomCorner: false,
  };
}

function getCornerMetrics(size: CardSizeVariant): CornerMetrics {
  switch (size) {
    case 'board':
      return { rankSize: '0.72rem', suitSize: '0.9rem', topOffset: '4px', sideOffset: '5px', gap: '0px' };
    case 'seat-roomy':
      return { rankSize: '0.68rem', suitSize: '0.86rem', topOffset: '4px', sideOffset: '5px', gap: '0px' };
    case 'seat-balanced':
      return { rankSize: '0.64rem', suitSize: '0.8rem', topOffset: '4px', sideOffset: '4px', gap: '0px' };
    case 'seat-compact':
      return { rankSize: '0.58rem', suitSize: '0.72rem', topOffset: '3px', sideOffset: '4px', gap: '0px' };
    case 'seat-dense':
      return { rankSize: '0.54rem', suitSize: '0.66rem', topOffset: '3px', sideOffset: '3px', gap: '0px' };
    case 'seat-omaha':
      return { rankSize: '0.52rem', suitSize: '0.62rem', topOffset: '3px', sideOffset: '3px', gap: '0px' };
    default:
      return { rankSize: '0.72rem', suitSize: '0.9rem', topOffset: '4px', sideOffset: '5px', gap: '0px' };
  }
}

function getCardBackTier(unlockCost: number): CardBackTier {
  if (unlockCost >= 580) return 'mythic';
  if (unlockCost >= 420) return 'elite';
  if (unlockCost >= 220) return 'premium';
  return 'starter';
}

function getCardBackMotif(skinKey: CardSkinKey): CardBackMotif {
  if (skinKey === 'neon-royal' || skinKey === 'arcade-bloom') return 'neon';
  if (skinKey === 'velvet-opera' || skinKey === 'scarlet-ink' || skinKey === 'sunset-myth') return 'opera';
  if (skinKey === 'jade-legends' || skinKey === 'mint-casino') return 'jade';
  if (skinKey === 'glacier-crest') return 'glacier';
  if (skinKey === 'midnight-gala' || skinKey === 'obsidian-lattice' || skinKey === 'onyx-regent') return 'gala';
  return 'crest';
}

function renderBackMotifShape(cardSkin: ReturnType<typeof getCardSkinOption>) {
  const motif = getCardBackMotif(cardSkin.key);
  const tier = getCardBackTier(cardSkin.unlockCost);
  const accent = cardSkin.palette.backAccent;
  const frame = cardSkin.palette.frame;
  const emblem = cardSkin.palette.emblem;
  const softStroke = { stroke: accent, strokeWidth: tier === 'mythic' ? 2 : 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };

  if (motif === 'neon') {
    return (
      <>
        <path d="M30 18 41 24 41 36 30 42 19 36 19 24Z" fill={accent} opacity="0.18" />
        <path d="M30 23 37 27 37 35 30 39 23 35 23 27Z" fill="none" stroke={accent} strokeWidth="1.6" />
        <path d="M12 44 22 44M38 44 48 44M30 8 30 18M30 42 30 54" {...softStroke} opacity="0.7" />
      </>
    );
  }
  if (motif === 'opera') {
    return (
      <>
        <path d="M16 42 C22 30, 26 26, 30 26 C34 26, 38 30, 44 42" fill={accent} opacity="0.16" />
        <path d="M18 42 C22 34, 26 31, 30 31 C34 31, 38 34, 42 42" fill="none" stroke={frame} strokeWidth="1.8" />
        <path d="M20 50 C23 46, 27 44, 30 44 C33 44, 37 46, 40 50" fill="none" stroke={emblem} strokeWidth="1.3" opacity="0.7" />
      </>
    );
  }
  if (motif === 'jade') {
    return (
      <>
        <circle cx="30" cy="30" r="9.5" fill={accent} opacity="0.18" />
        <circle cx="30" cy="30" r="6.4" fill="none" stroke={frame} strokeWidth="1.8" />
        <path d="M22 43 18 52M38 43 42 52" {...softStroke} opacity="0.74" />
        <circle cx="18" cy="52" r="1.8" fill={emblem} opacity="0.7" />
        <circle cx="42" cy="52" r="1.8" fill={emblem} opacity="0.7" />
      </>
    );
  }
  if (motif === 'gala') {
    return (
      <>
        <path d="M18 40 C22 30, 28 24, 30 24 C32 24, 38 30, 42 40 C37 36, 34 34, 30 34 C26 34, 23 36, 18 40Z" fill={accent} opacity="0.18" />
        <path d="M18 40 C22 32, 27 28, 30 28 C33 28, 38 32, 42 40" fill="none" stroke={frame} strokeWidth="1.8" />
        <path d="M22 46 C25 42, 28 40, 30 40 C32 40, 35 42, 38 46" fill="none" stroke={emblem} strokeWidth="1.3" opacity="0.68" />
      </>
    );
  }
  if (motif === 'glacier') {
    return (
      <>
        <path d="M30 18 35 26 44 27 38 34 40 43 30 38 20 43 22 34 16 27 25 26Z" fill={accent} opacity="0.16" />
        <path d="M30 22 33 28 39 29 35 33 36 39 30 36 24 39 25 33 21 29 27 28Z" fill="none" stroke={emblem} strokeWidth="1.6" />
      </>
    );
  }

  return (
    <>
      <path d="M30 18 38 26 30 34 22 26Z" fill={accent} opacity="0.18" />
      <path d="M30 22 34 26 30 30 26 26Z" fill="none" stroke={frame} strokeWidth="1.6" />
      {tier !== 'starter' ? <path d="M20 40 30 46 40 40" fill="none" stroke={emblem} strokeWidth="1.4" opacity="0.7" /> : null}
    </>
  );
}

function renderCardBackArt(cardSkin: ReturnType<typeof getCardSkinOption>) {
  const tier = getCardBackTier(cardSkin.unlockCost);
  const accent = cardSkin.palette.backAccent;
  const frame = cardSkin.palette.frame;
  const emblem = cardSkin.palette.emblem;

  return (
    <svg className={`card-back-art tier-${tier} motif-${getCardBackMotif(cardSkin.key)}`} viewBox="0 0 60 88" aria-hidden="true">
      <rect x="7" y="7" width="46" height="74" rx="8" className="card-back-border" />
      <rect x="12" y="12" width="36" height="64" rx="6" className="card-back-border inner" />
      <path d="M16 16 H44 M16 72 H44 M16 16 V72 M44 16 V72" className="card-back-rail" />
      <path d="M16 30 C24 24, 36 24, 44 30" className="card-back-rail soft" />
      <path d="M16 58 C24 64, 36 64, 44 58" className="card-back-rail soft" />
      <g className="card-back-center">
        {renderBackMotifShape(cardSkin)}
        {tier !== 'starter' ? <circle cx="30" cy="44" r={tier === 'mythic' ? 14 : tier === 'elite' ? 12.5 : 11} fill={accent} opacity="0.08" /> : null}
        <text x="30" y="48" textAnchor="middle" className="card-back-glyph">
          {cardSkin.backGlyph}
        </text>
      </g>
      {tier !== 'starter' ? (
        <g className="card-back-corners">
          <circle cx="18" cy="18" r="1.8" fill={emblem} opacity="0.72" />
          <circle cx="42" cy="18" r="1.8" fill={emblem} opacity="0.72" />
          <circle cx="18" cy="70" r="1.8" fill={emblem} opacity="0.72" />
          <circle cx="42" cy="70" r="1.8" fill={emblem} opacity="0.72" />
        </g>
      ) : null}
      {tier === 'mythic' ? <path d="M30 10 34 16 42 16 36 20 38 28 30 24 22 28 24 20 18 16 26 16Z" fill={frame} opacity="0.72" /> : null}
    </svg>
  );
}

function renderPipCardSvg(card: Card, size: CardSizeVariant) {
  const rankLabel = RANK_LABEL[card.rank];
  const suitLabel = SUIT_SYMBOL[card.suit];
  const pips = getPipLayout(card.rank);
  const metrics = getPipRenderMetrics(size);
  const svgStyle = {
    '--card-svg-pip-size': `${metrics.pipFontSize}px`,
    '--card-svg-pip-accent-size': `${metrics.accentFontSize}px`,
    '--card-svg-rank-size': `${metrics.rankFontSize}px`,
    '--card-svg-suit-size': `${metrics.suitFontSize}px`,
  } as CSSProperties;

  return (
    <svg className={`card-pip-svg ${metrics.compact ? 'compact' : ''}`} viewBox="0 0 60 88" aria-hidden="true" style={svgStyle}>
      <g className="card-svg-corner card-svg-corner-top">
        <text x={metrics.topCornerX} y={metrics.topRankY} className="card-svg-rank">
          {rankLabel}
        </text>
      </g>
      <g className="card-svg-pips">
        {pips.map((pip, index) => {
          const point = getPipPoint(pip);
          return (
            <text
              key={`${card.code}-svg-pip-${index}`}
              x={point.x}
              y={point.y}
              className={`card-svg-pip ${pip.accent ? 'accent' : ''}`}
              textAnchor="middle"
              dominantBaseline="middle"
              transform={pip.inverted ? `rotate(180 ${point.x} ${point.y})` : undefined}
            >
              {suitLabel}
            </text>
          );
        })}
      </g>
      {metrics.showBottomCorner ? (
        <g className="card-svg-corner card-svg-corner-bottom" transform={`rotate(180 ${metrics.bottomCornerX} ${metrics.bottomRankY})`}>
          <text x={metrics.bottomCornerX} y={metrics.bottomRankY} className="card-svg-rank">
            {rankLabel}
          </text>
        </g>
      ) : null}
    </svg>
  );
}

export function CardView({
  card,
  hidden = false,
  size,
  small = false,
  tiny = false,
  highlighted = false,
  delay = 0,
  cardSkinKey = 'classic-court',
  animated = true,
}: CardViewProps) {
  const resolvedSize = resolveCardSize(size, small, tiny);
  const scale = CARD_SCALE[resolvedSize];
  const width = Math.round(CARD_BASE_DIMENSIONS.width * scale);
  const height = Math.round(CARD_BASE_DIMENSIONS.height * scale);
  const figureKind = card ? getFigureKind(card.rank) : null;
  const cardSkin = getCardSkinOption(cardSkinKey);
  const cornerMetrics = getCornerMetrics(resolvedSize);
  const cardStyle = {
    width,
    height,
    '--card-scale': scale,
    '--card-skin-pip': cardSkin.palette.pip,
    '--card-skin-pip-shadow': cardSkin.palette.pipShadow,
    '--card-skin-paper': cardSkin.palette.paper,
    '--card-skin-paper-shade': cardSkin.palette.paperShade,
    '--card-skin-edge': cardSkin.palette.edge,
    '--card-skin-rank': cardSkin.palette.rank,
    '--card-back-primary': cardSkin.palette.backPrimary,
    '--card-back-secondary': cardSkin.palette.backSecondary,
    '--card-back-accent': cardSkin.palette.backAccent,
    '--card-back-pattern': cardSkin.palette.backPattern,
    '--card-corner-rank-size': cornerMetrics.rankSize,
    '--card-corner-suit-size': cornerMetrics.suitSize,
    '--card-corner-top-offset': cornerMetrics.topOffset,
    '--card-corner-side-offset': cornerMetrics.sideOffset,
    '--card-corner-gap': cornerMetrics.gap,
  } as CSSProperties;

  const content = hidden || !card ? (
    <div className="card-back">
      {renderCardBackArt(cardSkin)}
    </div>
  ) : (
    <div className={`card-front ${SUIT_COLOR[card.suit]} ${figureKind ? 'face-card' : 'pip-card'} rank-${card.rank}`}>
      {figureKind ? (
        <div className="card-corner-stack">
          <span className="card-rank">{RANK_LABEL[card.rank]}</span>
          <span className="card-suit">{SUIT_SYMBOL[card.suit]}</span>
        </div>
      ) : null}
      {figureKind ? (
        <div className="card-face-stage">
          <FaceCardFigure kind={figureKind} badge={SUIT_SYMBOL[card.suit]} skinKey={cardSkinKey} compact={resolvedSize !== 'board'} />
        </div>
      ) : (
        <div className={`card-pip-stage ${card.rank === 14 ? 'ace' : `pips-${card.rank}`}`}>{renderPipCardSvg(card, resolvedSize)}</div>
      )}
    </div>
  );

  const className = `card-view skin-${cardSkin.key} ${small ? 'small' : ''} ${tiny ? 'tiny' : ''} ${hidden ? 'hidden' : ''} ${highlighted ? 'highlighted' : ''}`;

  if (!animated) {
    return (
      <div className={`${className} static`} style={cardStyle}>
        <div className="card-view-surface">{content}</div>
      </div>
    );
  }

  return (
    <motion.div
      className={className}
      style={cardStyle}
      initial={{ rotateY: 90, opacity: 0.4, y: -8, scale: 0.94 }}
      animate={{ rotateY: 0, opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 240, damping: 20, mass: 0.8, delay }}
    >
      <div className="card-view-surface">{content}</div>
    </motion.div>
  );
}
