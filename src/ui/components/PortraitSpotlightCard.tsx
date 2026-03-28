import { useLanguage } from '../../i18n/languageContext';
import { PlayerPortrait } from './PlayerPortrait';
import { resolvePlayerPortrait, type PlayerPortraitMood } from '../playerPortraits';
import type { HumanPortraitKey } from '../../types/portrait';
import type { PlayerStyle } from '../../types/game';
import type { PlayerPortraitSize } from './PlayerPortrait';

interface SpotlightPlayer {
  id: string;
  name: string;
  style: PlayerStyle;
  isHuman: boolean;
  portraitKey?: HumanPortraitKey;
}

interface PortraitSpotlightCardProps {
  player: SpotlightPlayer;
  mood?: PlayerPortraitMood;
  eyebrow: string;
  detail: string;
  note?: string;
  value?: string;
  compact?: boolean;
  featured?: boolean;
  className?: string;
}

export function PortraitSpotlightCard({
  player,
  mood = 'calm',
  eyebrow,
  detail,
  note,
  value,
  compact = false,
  featured = false,
  className,
}: PortraitSpotlightCardProps) {
  const language = useLanguage();
  const portrait = resolvePlayerPortrait(player, language);
  const portraitSize: PlayerPortraitSize = featured ? 'hero' : compact ? 'seat-xl' : 'focus';

  return (
    <div className={`portrait-spotlight-card ${compact ? 'compact' : ''} ${featured ? 'featured' : ''} mood-${mood} ${className ?? ''}`}>
      <div className="portrait-spotlight-head">
        <span>{eyebrow}</span>
        {value && <strong>{value}</strong>}
      </div>
      <div className="portrait-spotlight-body">
        <PlayerPortrait player={player} mood={mood} size={portraitSize} variant="panel" />
        <div className="portrait-spotlight-copy">
          <h4>{player.name}</h4>
          <span>{portrait.title}</span>
          <p>{detail}</p>
          {note && <em>{note}</em>}
        </div>
      </div>
    </div>
  );
}
