import { useId, type CSSProperties } from 'react';
import type { CardSkinKey } from '../../types/cardSkin';
import { getCardSkinOption } from '../cardSkins';

export type FaceCardFigureKind = 'jack' | 'queen' | 'king' | 'joker-small' | 'joker-big';

interface FaceCardFigureProps {
  kind: FaceCardFigureKind;
  badge: string;
  skinKey?: CardSkinKey;
  compact?: boolean;
}

type FigureTier = 'starter' | 'premium' | 'elite' | 'mythic';
type FigureMotif = 'classic' | 'neon' | 'opera' | 'jade' | 'gala' | 'solar' | 'glacier' | 'obsidian' | 'rose' | 'arcade' | 'mint' | 'scarlet';

function crownPath(kind: FaceCardFigureKind): string {
  if (kind === 'queen') return 'M24 42 L34 26 L44 42 L54 24 L64 42 L76 28 L78 50 L22 50 Z';
  if (kind === 'king') return 'M20 46 L30 22 L40 36 L50 18 L60 36 L70 22 L80 46 L78 56 L22 56 Z';
  if (kind === 'joker-big') return 'M18 50 C30 26, 48 20, 58 34 C66 18, 84 18, 88 44 L82 58 C74 46, 60 44, 50 54 C40 42, 28 42, 18 50 Z';
  if (kind === 'joker-small') return 'M20 48 C30 30, 42 24, 52 34 C58 24, 74 28, 80 44 L74 56 C64 44, 54 44, 46 54 C36 44, 26 44, 20 48 Z';
  return 'M26 42 L36 30 L42 44 L52 28 L60 44 L70 34 L72 52 L24 52 Z';
}

function fabricPath(kind: FaceCardFigureKind): string {
  if (kind === 'queen') return 'M18 124 C24 88, 38 72, 50 72 C62 72, 76 88, 82 124 Z';
  if (kind === 'king') return 'M16 124 C22 86, 34 68, 50 68 C66 68, 78 86, 84 124 Z';
  if (kind === 'joker-big') return 'M18 124 C22 92, 32 78, 50 74 C68 78, 78 92, 82 124 Z';
  if (kind === 'joker-small') return 'M18 124 C24 94, 34 82, 50 78 C66 82, 76 94, 82 124 Z';
  return 'M20 124 C24 92, 36 76, 50 74 C64 76, 76 92, 80 124 Z';
}

function hairPath(kind: FaceCardFigureKind): string {
  if (kind === 'queen') return 'M28 54 C32 36, 44 28, 50 28 C62 28, 70 38, 72 54 L72 72 C66 64, 60 62, 54 62 L46 62 C40 62, 34 64, 28 72 Z';
  if (kind === 'king') return 'M26 54 C28 34, 42 26, 50 26 C64 26, 72 38, 74 54 L70 68 C62 60, 58 58, 50 58 C42 58, 36 60, 30 68 Z';
  if (kind === 'joker-big') return 'M24 56 C28 36, 42 24, 52 24 C66 24, 76 38, 76 58 L74 66 C66 60, 56 58, 48 58 C40 58, 30 60, 24 68 Z';
  if (kind === 'joker-small') return 'M26 58 C30 40, 42 30, 50 30 C62 30, 72 40, 72 58 L70 66 C62 60, 56 58, 50 58 C42 58, 34 60, 28 66 Z';
  return 'M28 56 C30 40, 42 30, 50 30 C58 30, 68 40, 70 56 L66 66 C60 60, 56 58, 50 58 C44 58, 38 60, 32 66 Z';
}

function badgeTone(kind: FaceCardFigureKind): string {
  if (kind === 'joker-big') return '大王';
  if (kind === 'joker-small') return '小王';
  if (kind === 'king') return 'K';
  if (kind === 'queen') return 'Q';
  return 'J';
}

function resolveFigureTier(unlockCost: number): FigureTier {
  if (unlockCost >= 580) return 'mythic';
  if (unlockCost >= 420) return 'elite';
  if (unlockCost >= 220) return 'premium';
  return 'starter';
}

function resolveFigureMotif(skinKey: CardSkinKey): FigureMotif {
  if (skinKey === 'neon-royal') return 'neon';
  if (skinKey === 'velvet-opera') return 'opera';
  if (skinKey === 'jade-legends') return 'jade';
  if (skinKey === 'midnight-gala' || skinKey === 'onyx-regent') return 'gala';
  if (skinKey === 'sunset-myth') return 'solar';
  if (skinKey === 'glacier-crest') return 'glacier';
  if (skinKey === 'obsidian-lattice') return 'obsidian';
  if (skinKey === 'rose-atelier') return 'rose';
  if (skinKey === 'arcade-bloom') return 'arcade';
  if (skinKey === 'mint-casino') return 'mint';
  if (skinKey === 'scarlet-ink') return 'scarlet';
  return 'classic';
}

function renderTierHalo(tier: FigureTier, accent: string, emblem: string) {
  if (tier === 'starter') {
    return null;
  }
  if (tier === 'premium') {
    return (
      <>
        <ellipse cx="50" cy="46" rx="30" ry="20" fill="none" stroke={accent} strokeWidth="2.2" opacity="0.44" />
        <path d="M22 44 30 38" stroke={emblem} strokeWidth="2" strokeLinecap="round" opacity="0.52" />
        <path d="M70 38 78 44" stroke={emblem} strokeWidth="2" strokeLinecap="round" opacity="0.52" />
      </>
    );
  }
  if (tier === 'elite') {
    return (
      <>
        <path d="M50 16 58 30 74 30 61 40 66 56 50 46 34 56 39 40 26 30 42 30Z" fill={accent} opacity="0.18" />
        <ellipse cx="50" cy="46" rx="33" ry="22" fill="none" stroke={emblem} strokeWidth="2.4" opacity="0.46" />
      </>
    );
  }
  return (
    <>
      <path d="M50 10 60 28 82 30 66 44 72 66 50 54 28 66 34 44 18 30 40 28Z" fill={accent} opacity="0.16" />
      <ellipse cx="50" cy="46" rx="35" ry="24" fill="none" stroke={emblem} strokeWidth="2.6" opacity="0.58" />
      <path d="M50 18V8M22 44H12M88 44H78M32 24 24 16M68 24 76 16" stroke={emblem} strokeWidth="2" strokeLinecap="round" opacity="0.56" />
    </>
  );
}

function renderMotifAccent(motif: FigureMotif, palette: ReturnType<typeof getCardSkinOption>['palette']) {
  if (motif === 'neon') {
    return (
      <>
        <path d="M33 52 67 52 62 58 38 58Z" fill={palette.emblem} opacity="0.82" />
        <path d="M20 92 34 84 40 94 26 102Z" fill={palette.frame} opacity="0.74" />
        <path d="M80 92 66 84 60 94 74 102Z" fill={palette.frame} opacity="0.74" />
      </>
    );
  }
  if (motif === 'opera' || motif === 'scarlet' || motif === 'rose') {
    return (
      <>
        <path d="M18 120 C24 98, 32 88, 42 86 C36 98, 36 108, 38 122 Z" fill={palette.accent} opacity="0.76" />
        <path d="M82 120 C76 98, 68 88, 58 86 C64 98, 64 108, 62 122 Z" fill={palette.accent} opacity="0.76" />
        <circle cx="50" cy="92" r="4.6" fill={palette.frame} opacity="0.9" />
      </>
    );
  }
  if (motif === 'jade' || motif === 'mint') {
    return (
      <>
        <circle cx="50" cy="22" r="8.5" fill={palette.emblem} opacity="0.86" />
        <circle cx="50" cy="22" r="5.2" fill={palette.accent} opacity="0.82" />
        <path d="M43 94 36 120M57 94 64 120" stroke={palette.frame} strokeWidth="2.6" strokeLinecap="round" opacity="0.74" />
      </>
    );
  }
  if (motif === 'gala' || motif === 'obsidian') {
    return (
      <>
        <path d="M34 54 C40 48, 60 48, 66 54 L62 60 C56 56, 44 56, 38 60 Z" fill={palette.frame} opacity="0.78" />
        <path d="M28 86 C34 76, 44 72, 50 72 C56 72, 66 76, 72 86" stroke={palette.emblem} strokeWidth="3.6" strokeLinecap="round" opacity="0.56" />
      </>
    );
  }
  if (motif === 'solar') {
    return (
      <>
        <path d="M50 18 56 28 68 22 64 34 76 36 66 44 74 54 62 54 62 68 50 60 38 68 38 54 26 54 34 44 24 36 36 34 32 22 44 28Z" fill={palette.accent} opacity="0.24" />
      </>
    );
  }
  if (motif === 'glacier') {
    return (
      <>
        <path d="M30 28 38 20 42 30 48 18 54 30 62 20 70 28 62 36 54 30 48 40 42 30 38 36Z" fill={palette.emblem} opacity="0.86" />
      </>
    );
  }
  if (motif === 'arcade') {
    return (
      <>
        <path d="M28 88 34 82 40 88 34 94Z" fill={palette.emblem} opacity="0.84" />
        <path d="M60 86h10v4H60zM63 83h4v10h-4z" fill={palette.accent} opacity="0.82" />
      </>
    );
  }
  return (
    <path d="M32 86 C38 78, 44 74, 50 74 C56 74, 62 78, 68 86" stroke={palette.frame} strokeWidth="3.2" strokeLinecap="round" opacity="0.5" />
  );
}

function renderKindAdornment(kind: FaceCardFigureKind, palette: ReturnType<typeof getCardSkinOption>['palette'], tier: FigureTier) {
  if (kind === 'queen') {
    return (
      <>
        <circle cx="33" cy="63" r="2.4" fill={palette.emblem} opacity="0.92" />
        <circle cx="67" cy="63" r="2.4" fill={palette.emblem} opacity="0.92" />
        <path d="M36 82 C42 76, 58 76, 64 82 L60 88 C55 84, 45 84, 40 88 Z" fill={palette.accent} opacity="0.84" />
        {tier !== 'starter' ? <path d="M50 30 54 36 50 42 46 36Z" fill={palette.emblem} opacity="0.9" /> : null}
      </>
    );
  }
  if (kind === 'king') {
    return (
      <>
        <path d="M42 67 C46 71, 54 71, 58 67" stroke="#4b2e29" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M42 61 C45 58, 48 57, 50 57 C52 57, 55 58, 58 61" stroke="#4b2e29" strokeWidth="2.2" strokeLinecap="round" opacity="0.88" />
        <path d="M34 84 50 76 66 84 60 92 40 92Z" fill={palette.frame} opacity="0.78" />
        {tier === 'mythic' ? <path d="M72 74 78 60 82 94" stroke={palette.emblem} strokeWidth="2.4" strokeLinecap="round" opacity="0.9" /> : null}
      </>
    );
  }
  if (kind === 'jack') {
    return (
      <>
        <path d="M30 84 C36 78, 44 76, 50 76 C56 76, 64 78, 70 84" stroke={palette.accent} strokeWidth="4" strokeLinecap="round" opacity="0.8" />
        <path d="M28 48 34 36 42 42" stroke={palette.emblem} strokeWidth="2.3" strokeLinecap="round" opacity="0.8" />
        {tier !== 'starter' ? <path d="M70 48 76 36 82 42" stroke={palette.emblem} strokeWidth="2.3" strokeLinecap="round" opacity="0.8" /> : null}
      </>
    );
  }
  if (kind === 'joker-small') {
    return (
      <>
        <path d="M28 34 C36 18, 50 16, 58 28" stroke={palette.accent} strokeWidth="3.2" strokeLinecap="round" opacity="0.84" />
        <circle cx="28" cy="35" r="3.2" fill={palette.emblem} opacity="0.88" />
        <circle cx="58" cy="28" r="3.2" fill={palette.emblem} opacity="0.88" />
        <path d="M40 67 Q50 74 60 67" stroke="#5b342d" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      </>
    );
  }
  return (
    <>
      <path d="M26 30 C34 14, 48 12, 58 24 C66 14, 82 16, 86 34" stroke={palette.accent} strokeWidth="3.4" strokeLinecap="round" opacity="0.86" />
      <circle cx="26" cy="31" r="3.4" fill={palette.emblem} opacity="0.9" />
      <circle cx="58" cy="24" r="3.4" fill={palette.emblem} opacity="0.9" />
      <circle cx="86" cy="35" r="3.4" fill={palette.emblem} opacity="0.9" />
      <path d="M40 67 Q50 77 60 67" stroke="#5b342d" strokeWidth="2.7" strokeLinecap="round" fill="none" />
      {tier !== 'starter' ? <path d="M30 90 50 82 70 90 60 98 40 98Z" fill={palette.frame} opacity="0.72" /> : null}
    </>
  );
}

function renderKindPose(kind: FaceCardFigureKind, palette: ReturnType<typeof getCardSkinOption>['palette'], tier: FigureTier) {
  if (kind === 'queen') {
    return (
      <>
        <path d="M24 102 C30 92, 38 88, 46 88" stroke={palette.frame} strokeWidth="4.6" strokeLinecap="round" opacity="0.7" />
        <path d="M76 102 C70 92, 62 88, 54 88" stroke={palette.frame} strokeWidth="4.6" strokeLinecap="round" opacity="0.7" />
        <path d="M26 108 C34 112, 42 114, 50 114 C58 114, 66 112, 74 108" stroke={palette.accent} strokeWidth="3" strokeLinecap="round" opacity="0.74" />
      </>
    );
  }
  if (kind === 'king') {
    return (
      <>
        <path d="M20 106 C28 94, 36 90, 46 90" stroke={palette.frame} strokeWidth="5.2" strokeLinecap="round" opacity="0.76" />
        <path d="M80 106 C72 94, 64 90, 54 90" stroke={palette.frame} strokeWidth="5.2" strokeLinecap="round" opacity="0.76" />
        <path d="M72 80 72 114" stroke={palette.emblem} strokeWidth={tier === 'mythic' ? '3.6' : '2.8'} strokeLinecap="round" opacity="0.88" />
        <path d="M66 82 78 82" stroke={palette.emblem} strokeWidth="2.2" strokeLinecap="round" opacity="0.8" />
      </>
    );
  }
  if (kind === 'jack') {
    return (
      <>
        <path d="M24 104 C32 92, 40 88, 48 88" stroke={palette.frame} strokeWidth="4.4" strokeLinecap="round" opacity="0.68" />
        <path d="M74 100 C68 88, 60 82, 52 80" stroke={palette.accent} strokeWidth="4.2" strokeLinecap="round" opacity="0.78" />
        <path d="M30 96 46 108 62 94" stroke={palette.emblem} strokeWidth="2.4" strokeLinecap="round" opacity="0.72" />
      </>
    );
  }
  if (kind === 'joker-small') {
    return (
      <>
        <path d="M24 104 C32 90, 40 86, 48 88" stroke={palette.frame} strokeWidth="4.2" strokeLinecap="round" opacity="0.66" />
        <path d="M76 104 C68 90, 60 86, 52 88" stroke={palette.accent} strokeWidth="4.2" strokeLinecap="round" opacity="0.76" />
        <path d="M28 110 Q40 104 50 110 Q60 104 72 110" stroke={palette.emblem} strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.68" />
      </>
    );
  }
  return (
    <>
      <path d="M22 102 C30 88, 40 82, 48 84" stroke={palette.frame} strokeWidth="4.4" strokeLinecap="round" opacity="0.7" />
      <path d="M78 102 C70 88, 60 82, 52 84" stroke={palette.accent} strokeWidth="4.4" strokeLinecap="round" opacity="0.8" />
      <path d="M26 114 C34 104, 44 102, 50 104 C56 102, 66 104, 74 114" stroke={palette.emblem} strokeWidth="2.4" strokeLinecap="round" fill="none" opacity="0.7" />
    </>
  );
}

export function FaceCardFigure({ kind, badge, skinKey = 'classic-court', compact = false }: FaceCardFigureProps) {
  const skin = getCardSkinOption(skinKey);
  const palette = skin.palette;
  const tier = resolveFigureTier(skin.unlockCost);
  const motif = resolveFigureMotif(skinKey);
  const gradientId = useId().replace(/:/g, '');
  const toneFontSize = compact ? 8.8 : 10;
  const toneY = compact ? 95 : 95.5;
  const badgeFontSize = compact ? 8.6 : 11;
  const badgeY = compact ? 118 : 120;
  const style = {
    '--figure-shadow': palette.shadow,
  } as CSSProperties;

  return (
    <div className={`face-card-figure ${compact ? 'compact' : ''}`} style={style}>
      <svg viewBox="0 0 100 130" aria-hidden="true">
        <defs>
          <linearGradient id={`aura-${gradientId}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={palette.aura} stopOpacity="0.95" />
            <stop offset="100%" stopColor={palette.frame} stopOpacity="0.2" />
          </linearGradient>
          <linearGradient id={`fabric-${gradientId}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={palette.accent} />
            <stop offset="100%" stopColor={palette.fabric} />
          </linearGradient>
        </defs>
        <ellipse cx="50" cy="54" rx="36" ry="28" fill={`url(#aura-${gradientId})`} opacity="0.38" />
        {renderTierHalo(tier, palette.accent, palette.emblem)}
        {renderMotifAccent(motif, palette)}
        <path d={fabricPath(kind)} fill={`url(#fabric-${gradientId})`} />
        <path d={crownPath(kind)} fill={palette.frame} opacity="0.92" />
        <path d={hairPath(kind)} fill={palette.hair} />
        <circle cx="50" cy="56" r="18" fill={palette.face} />
        <ellipse cx="43" cy="56" rx="2.2" ry="2.8" fill="#2d1d1a" />
        <ellipse cx="57" cy="56" rx="2.2" ry="2.8" fill="#2d1d1a" />
        <path d="M44 66 Q50 70 56 66" stroke="#5b342d" strokeWidth="2.4" strokeLinecap="round" fill="none" />
        {renderKindAdornment(kind, palette, tier)}
        {renderKindPose(kind, palette, tier)}
        <path d="M35 82 C42 76, 58 76, 65 82" stroke={palette.frame} strokeWidth={tier === 'mythic' ? '6' : '5'} strokeLinecap="round" fill="none" opacity="0.9" />
        <path d="M26 124 C30 106, 38 94, 50 92 C62 94, 70 106, 74 124" fill={palette.fabric} opacity="0.56" />
        <circle cx="50" cy="92" r={tier === 'mythic' ? '10.5' : tier === 'elite' ? '9.5' : '9'} fill={palette.emblem} opacity="0.95" />
        <text x="50" y={toneY} textAnchor="middle" fontSize={toneFontSize} fontWeight="700" fill={palette.fabric}>
          {badgeTone(kind)}
        </text>
        <text x="50" y={badgeY} textAnchor="middle" fontSize={badgeFontSize} fontWeight="700" fill={palette.emblem}>
          {badge}
        </text>
      </svg>
    </div>
  );
}
