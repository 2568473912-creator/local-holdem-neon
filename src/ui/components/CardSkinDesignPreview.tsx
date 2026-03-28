import type { CSSProperties } from 'react';
import type { AppLanguage } from '../../i18n';
import type { CardSkinKey } from '../../types/cardSkin';
import { getCardSkinOption } from '../cardSkins';
import { CardView } from './CardView';
import { DouDizhuCard } from './DouDizhuCard';

interface CardSkinDesignPreviewProps {
  language: AppLanguage;
  skinKey: CardSkinKey;
  compact?: boolean;
}

function artDirectionLabel(skinKey: CardSkinKey, language: AppLanguage): string {
  if (skinKey === 'jade-legends' || skinKey === 'mint-casino')
    return language === 'zh-CN' ? '东方纹章' : language === 'ja' ? '東方紋章' : language === 'fr' ? 'Blason oriental' : language === 'de' ? 'Östliches Wappen' : 'Eastern Crest';
  if (skinKey === 'velvet-opera' || skinKey === 'scarlet-ink' || skinKey === 'sunset-myth')
    return language === 'zh-CN' ? '戏剧宫廷' : language === 'ja' ? '劇場宮廷' : language === 'fr' ? 'Cour théâtrale' : language === 'de' ? 'Theatralischer Hof' : 'Theatrical Court';
  if (skinKey === 'neon-royal' || skinKey === 'arcade-bloom')
    return language === 'zh-CN' ? '赛博霓虹' : language === 'ja' ? 'サイバーネオン' : language === 'fr' ? 'Cyber néon' : language === 'de' ? 'Cyber-Neon' : 'Cyber Neon';
  if (skinKey === 'obsidian-lattice' || skinKey === 'onyx-regent' || skinKey === 'midnight-gala')
    return language === 'zh-CN' ? '黑金晚宴' : language === 'ja' ? '黒金の夜会' : language === 'fr' ? 'Soirée noir et or' : language === 'de' ? 'Schwarzgold-Gala' : 'Black Tie Night';
  return language === 'zh-CN' ? '经典会所' : language === 'ja' ? 'クラシッククラブ' : language === 'fr' ? 'Club classique' : language === 'de' ? 'Klassischer Club' : 'Classic Club';
}

export function CardSkinDesignPreview({ language, skinKey, compact = false }: CardSkinDesignPreviewProps) {
  const skin = getCardSkinOption(skinKey, language);
  const isIpadLike = typeof document !== 'undefined' && document.documentElement.dataset.ipadLike === 'true';
  const inlineJoker = isIpadLike && !compact;
  const previewCardSize = inlineJoker ? 'seat-roomy' : compact ? 'seat-dense' : 'seat-balanced';
  const previewCards = compact
    ? [
        <CardView key={`${skinKey}-back`} hidden size={previewCardSize} cardSkinKey={skinKey} animated={false} />,
        <CardView key={`${skinKey}-jack`} card={{ suit: 'spades', rank: 11, code: `${skinKey}-jack-preview` }} size={previewCardSize} cardSkinKey={skinKey} animated={false} />,
        <CardView key={`${skinKey}-queen`} card={{ suit: 'hearts', rank: 12, code: `${skinKey}-queen-preview` }} size={previewCardSize} cardSkinKey={skinKey} animated={false} />,
      ]
    : [
        <CardView key={`${skinKey}-back`} hidden size={previewCardSize} cardSkinKey={skinKey} animated={false} />,
        <CardView key={`${skinKey}-nine`} card={{ suit: 'clubs', rank: 9, code: `${skinKey}-nine-preview` }} size={previewCardSize} cardSkinKey={skinKey} animated={false} />,
        <CardView key={`${skinKey}-jack`} card={{ suit: 'spades', rank: 11, code: `${skinKey}-jack-preview` }} size={previewCardSize} cardSkinKey={skinKey} animated={false} />,
        <CardView key={`${skinKey}-queen`} card={{ suit: 'hearts', rank: 12, code: `${skinKey}-queen-preview` }} size={previewCardSize} cardSkinKey={skinKey} animated={false} />,
        <CardView key={`${skinKey}-king`} card={{ suit: 'diamonds', rank: 13, code: `${skinKey}-king-preview` }} size={previewCardSize} cardSkinKey={skinKey} animated={false} />,
      ];

  return (
    <div
      className={`card-skin-design-preview ${compact ? 'compact' : ''} ${inlineJoker ? 'ipad-inline-joker' : ''}`}
      style={
        {
          '--skin-aura': skin.palette.aura,
          '--skin-frame': skin.palette.frame,
          '--skin-paper': skin.palette.paper,
          '--skin-paper-shade': skin.palette.paperShade,
          '--skin-accent': skin.palette.accent,
          '--skin-fabric': skin.palette.fabric,
          '--skin-emblem': skin.palette.emblem,
          '--skin-rank': skin.palette.rank,
          '--skin-back-primary': skin.palette.backPrimary,
          '--skin-back-secondary': skin.palette.backSecondary,
          '--skin-back-accent': skin.palette.backAccent,
        } as CSSProperties
      }
    >
      <>
        <div className="card-skin-preview-hero">
          <div className="card-skin-preview-copy">
            <span>{artDirectionLabel(skinKey, language)}</span>
            <strong>{skin.title}</strong>
          </div>
          <div className="card-skin-preview-badges">
            <span>{skin.eyebrow}</span>
            <span>{skin.backGlyph}</span>
          </div>
        </div>
        <div className="card-skin-preview-stage">
          <span className="card-skin-preview-orbit orbit-a" />
          <span className="card-skin-preview-orbit orbit-b" />
          <div className={`card-skin-preview-row ${inlineJoker ? 'showcase-six-row' : ''}`}>
            {previewCards}
            {inlineJoker ? (
              <DouDizhuCard card={{ suit: 'joker', rank: 17, label: 'JOKER', shortLabel: 'JOKER' }} compact cardSkinKey={skinKey} />
            ) : null}
          </div>
          {!inlineJoker ? (
            <div className="card-skin-preview-joker-wrap">
              <DouDizhuCard card={{ suit: 'joker', rank: 17, label: 'JOKER', shortLabel: 'JOKER' }} compact={compact} cardSkinKey={skinKey} />
            </div>
          ) : null}
        </div>
      </>
    </div>
  );
}
