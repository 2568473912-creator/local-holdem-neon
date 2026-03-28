import { motion } from 'framer-motion';
import { t, type AppLanguage } from '../../i18n';
import { useLanguage } from '../../i18n/languageContext';
import type { PlayerState } from '../../types/game';
import type { CardSkinKey } from '../../types/cardSkin';
import type { HumanPortraitKey } from '../../types/portrait';
import type { CardSizeVariant } from './CardView';
import { CardView } from './CardView';
import type { PlayerPortraitSize } from './PlayerPortrait';
import { PlayerPortrait } from './PlayerPortrait';
import { resolvePlayerPortrait, resolvePlayerPortraitMood } from '../playerPortraits';
import type { SeatDensity, SeatLayoutMode } from '../seatLayout';
import { translateHoldemText } from '../holdemText';

interface SeatPanelProps {
  player: PlayerState;
  isDealer: boolean;
  isSmallBlind: boolean;
  isBigBlind: boolean;
  isStraddle?: boolean;
  isActive: boolean;
  isWinner?: boolean;
  showHoleCards: boolean;
  density?: SeatDensity;
  context?: SeatLayoutMode;
  characterCardMode?: boolean;
  crowdedTableMode?: boolean;
  seatClassName?: string;
  humanPortraitKeyOverride?: HumanPortraitKey;
  cardSkinKey?: CardSkinKey;
}

function statusText(player: PlayerState, isActive: boolean, language: AppLanguage): string {
  if (player.eliminated) return t(language, 'seat.eliminated');
  if (player.folded) return t(language, 'seat.folded');
  if (player.allIn) return t(language, 'seat.allIn');
  if (isActive) return t(language, 'seat.thinking');
  return translateHoldemText(player.lastAction, language) || t(language, 'seat.waiting');
}

function getPortraitSize(density: SeatDensity, context: SeatLayoutMode, characterCardMode: boolean, isIpadLike: boolean): PlayerPortraitSize {
  if (context === 'focus') {
    if (isIpadLike) {
      if (density === 'dense') return 'seat-sm';
      return 'seat';
    }
    return density === 'dense' ? 'seat-xl' : 'focus';
  }
  if (characterCardMode) {
    if (isIpadLike) {
      if (density === 'dense') return 'seat-sm';
      if (density === 'compact') return 'seat-sm';
      if (density === 'balanced') return 'seat';
      return 'seat-lg';
    }
    return density === 'dense' ? 'seat-lg' : 'seat-xl';
  }
  if (context === 'replay') {
    return density === 'dense' ? 'seat' : 'seat-lg';
  }
  if (density === 'roomy') {
    return 'seat-xl';
  }
  if (density === 'dense') {
    return 'seat-lg';
  }
  if (density === 'compact') {
    return 'seat-lg';
  }
  return 'seat-xl';
}

function getCardSize(
  cardCount: number,
  density: SeatDensity,
  context: SeatLayoutMode,
  characterCardMode: boolean,
  isIpadLike: boolean,
  crowdedTableMode: boolean,
): CardSizeVariant {
  if (cardCount >= 4) {
    if (context === 'focus') {
      if (isIpadLike) {
        return density === 'roomy' ? 'seat-balanced' : 'seat-compact';
      }
      if (density === 'dense') return 'seat-balanced';
      if (density === 'compact') return 'seat-balanced';
      return 'seat-roomy';
    }
    if (characterCardMode) {
      if (isIpadLike) {
        if (crowdedTableMode) {
          return density === 'dense' ? 'seat-compact' : 'seat-balanced';
        }
        if (density === 'compact') return 'seat-balanced';
        return density === 'dense' ? 'seat-compact' : 'seat-balanced';
      }
      if (density === 'dense') return 'seat-dense';
      if (density === 'compact') return 'seat-balanced';
      return 'seat-roomy';
    }
    if (context === 'replay') {
      return density === 'dense' ? 'seat-dense' : 'seat-omaha';
    }
    return density === 'dense' ? 'seat-dense' : density === 'compact' ? 'seat-omaha' : 'seat-balanced';
  }

  if (context === 'focus') {
    if (isIpadLike) {
      return density === 'roomy' ? 'seat-balanced' : 'seat-compact';
    }
    if (density === 'dense') return 'seat-balanced';
    if (density === 'compact') return 'seat-balanced';
    return 'seat-roomy';
  }

  if (characterCardMode) {
    if (isIpadLike) {
      if (crowdedTableMode) {
        return density === 'dense' ? 'seat-compact' : 'seat-balanced';
      }
      if (density === 'dense') return 'seat-compact';
      if (density === 'compact') return 'seat-compact';
      if (density === 'balanced') return 'seat-balanced';
      return 'seat-roomy';
    }
    if (density === 'dense') return 'seat-compact';
    if (density === 'compact') return 'seat-balanced';
    return 'seat-roomy';
  }

  if (context === 'replay') {
    if (density === 'roomy') return 'seat-balanced';
    if (density === 'balanced') return 'seat-compact';
    return 'seat-dense';
  }

  if (density === 'roomy') return 'seat-balanced';
  if (density === 'balanced') return 'seat-compact';
  return 'seat-dense';
}

export function SeatPanel({
  player,
  isDealer,
  isSmallBlind,
  isBigBlind,
  isStraddle = false,
  isActive,
  isWinner = false,
  showHoleCards,
  density = 'balanced',
  context = 'table',
  characterCardMode = false,
  crowdedTableMode = false,
  seatClassName,
  humanPortraitKeyOverride,
  cardSkinKey,
}: SeatPanelProps) {
  const language = useLanguage();
  const isIpadLike = typeof document !== 'undefined' && document.documentElement.dataset.ipadLike === 'true';
  const badges: string[] = [];
  if (isDealer) badges.push(t(language, 'seat.dealer'));
  if (isSmallBlind) badges.push('SB');
  if (isBigBlind) badges.push('BB');
  if (isStraddle) badges.push('ST');

  const portraitPlayer =
    player.isHuman && !player.portraitKey && humanPortraitKeyOverride
      ? {
          ...player,
          portraitKey: humanPortraitKeyOverride,
        }
      : player;

  const cardsToRender = player.holeCards.slice(0, 5);
  const portrait = resolvePlayerPortrait(portraitPlayer, language);
  const portraitMood = resolvePlayerPortraitMood(player, { active: isActive, winner: isWinner });
  const useCharacterCardMode = context === 'focus' || characterCardMode;
  const compactTableCharacterCard = context === 'table' && characterCardMode;
  const useCrowdedTableMode = isIpadLike && context === 'table' && crowdedTableMode;
  const portraitSize = getPortraitSize(density, context, characterCardMode, isIpadLike);
  const cardSize = getCardSize(cardsToRender.length, density, context, characterCardMode, isIpadLike, useCrowdedTableMode);
  const status = statusText(player, isActive, language);
  const portraitMotionProfile = context === 'table' ? 'stable' : 'full';
  const showPortraitSubtitle = context !== 'table' || useCharacterCardMode;
  const showCompactStatusPill = !useCrowdedTableMode || player.isHuman || isActive || player.currentBet > 0 || player.folded || player.allIn || player.eliminated;
  const focusDetailRaw =
    player.folded || player.eliminated
      ? translateHoldemText(player.lastAction, language)
      : player.lastAction === '等待' && isActive
        ? t(language, 'seat.waitingForYou')
        : translateHoldemText(player.lastAction, language);
  const focusDetail = !focusDetailRaw || focusDetailRaw === status || focusDetailRaw === t(language, 'seat.waiting') ? null : focusDetailRaw;
  const cardSubtitle = compactTableCharacterCard || isIpadLike ? null : portrait.title;
  const cardDetail = compactTableCharacterCard || (isIpadLike && context === 'focus') ? null : focusDetail;
  const allowSeatMotion = context === 'focus' || context === 'replay';

  return (
    <motion.div
      className={`seat-panel seat-context-${context} seat-density-${density} ${player.isHuman ? 'human' : 'ai'} ${isActive ? 'active' : ''} ${isWinner ? 'winner' : ''} ${
        player.folded ? 'folded' : ''
      } ${useCharacterCardMode && context !== 'focus' ? 'seat-character-card' : ''} ${useCrowdedTableMode ? 'ipad-seat-condensed' : ''} portrait-mood-${portraitMood} ${
        seatClassName ?? ''
      }`}
      animate={{
        scale: allowSeatMotion && isActive ? 1.02 : 1,
        y: allowSeatMotion && isActive ? -2 : 0,
        boxShadow: isActive ? '0 0 34px rgba(15,226,255,0.42)' : player.isHuman ? '0 0 22px rgba(249,194,90,0.24)' : '0 0 20px rgba(0,0,0,0.4)',
      }}
      transition={{ type: 'spring', stiffness: 190, damping: 18 }}
    >
      {useCharacterCardMode ? (
        <>
          <div className="seat-focus-top">
            <div className="seat-focus-portrait-wrap">
              <PlayerPortrait
                player={portraitPlayer}
                active={isActive}
                mood={portraitMood}
                size={portraitSize}
                variant="panel"
                motionProfile={portraitMotionProfile}
              />
            </div>
            <div className="seat-focus-copy">
                <div className="seat-focus-name-row">
                  <div className="seat-name-stack">
                    <strong title={player.name}>{player.name}</strong>
                    {cardSubtitle ? <span>{cardSubtitle}</span> : null}
                  </div>
                  <div className="seat-badges">
                  {badges.map((badge) => (
                    <span key={badge} className="seat-badge">
                      {badge}
                    </span>
                  ))}
                </div>
              </div>
              <div className={`seat-focus-meta-row ${player.isHuman ? '' : 'single'} ${showCompactStatusPill ? '' : 'compact-empty'}`}>
                {player.isHuman && <span className="seat-focus-hero-line">{t(language, 'seat.heroSkin')}</span>}
                {showCompactStatusPill ? <span className="seat-status-pill">{status}</span> : null}
              </div>
              {cardDetail && <div className="seat-focus-detail">{cardDetail}</div>}
            </div>
          </div>

          <div className="seat-cards seat-cards-focus">
            {cardsToRender.map((card, idx) => (
              <CardView key={`${player.id}-card-${idx}-${card.code}`} card={card} hidden={!showHoleCards} size={cardSize} delay={idx * 0.05} cardSkinKey={cardSkinKey} />
            ))}
          </div>

          <div className={`seat-focus-footer ${useCrowdedTableMode ? 'seat-focus-footer-inline' : ''}`}>
            {useCrowdedTableMode ? (
              <>
                <span className="seat-focus-inline-chip">
                  {t(language, 'seat.chipsShort')} {player.stack}
                </span>
                {(player.currentBet > 0 || player.isHuman || isActive) && (
                  <span className="seat-focus-inline-chip">
                    {t(language, 'seat.betShort')} {player.currentBet}
                  </span>
                )}
              </>
            ) : (
              <>
                <div className="seat-focus-metric">
                  <span>{t(language, 'seat.chips')}</span>
                  <strong>{player.stack}</strong>
                </div>
                <div className="seat-focus-metric">
                  <span>{t(language, 'seat.bet')}</span>
                  <strong>{player.currentBet}</strong>
                </div>
              </>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="seat-header">
            <div className="seat-identity">
              <PlayerPortrait
                player={portraitPlayer}
                active={isActive}
                mood={portraitMood}
                size={portraitSize}
                variant="orb"
                motionProfile={portraitMotionProfile}
              />
              <div className="seat-name-stack">
                <strong title={player.name}>{player.name}</strong>
                {showPortraitSubtitle ? <span>{portrait.title}</span> : null}
              </div>
            </div>
            <div className="seat-badges">
              {badges.map((badge) => (
                <span key={badge} className="seat-badge">
                  {badge}
                </span>
              ))}
            </div>
          </div>

          <div className="seat-info-strip">
            <span>{t(language, 'seat.chipsShort')} {player.stack}</span>
            <span>{t(language, 'seat.betShort')} {player.currentBet}</span>
            <span className="seat-status-pill">{status}</span>
          </div>

          <div className="seat-cards">
            {cardsToRender.map((card, idx) => (
              <CardView key={`${player.id}-card-${idx}-${card.code}`} card={card} hidden={!showHoleCards} size={cardSize} delay={idx * 0.05} cardSkinKey={cardSkinKey} />
            ))}
          </div>
        </>
      )}
    </motion.div>
  );
}
