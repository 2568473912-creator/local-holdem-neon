import type { ReactNode } from 'react';
import { resolvePlayerPortrait, type PortraitArt, type PlayerPortraitMood } from '../playerPortraits';
import type { PlayerState } from '../../types/game';

interface PlayerPortraitProps {
  player: Pick<PlayerState, 'id' | 'name' | 'style' | 'isHuman' | 'portraitKey'>;
  active?: boolean;
  mood?: PlayerPortraitMood;
  size?: PlayerPortraitSize;
  variant?: 'orb' | 'panel';
  motionProfile?: 'full' | 'stable';
}

export type PlayerPortraitSize = 'seat-sm' | 'seat' | 'seat-lg' | 'seat-xl' | 'focus' | 'hero';

interface FigureProfile {
  headTransform: string;
  torsoTransform: string;
  torsoMain: string;
  torsoShade: string;
  shirt: string;
}

function moodBadge(mood: PlayerPortraitMood): string {
  if (mood === 'focused') return '◎';
  if (mood === 'thinking') return '…';
  if (mood === 'checking') return '✓';
  if (mood === 'calling') return '↺';
  if (mood === 'raising') return '▲';
  if (mood === 'all-in') return '!';
  if (mood === 'winner') return '★';
  if (mood === 'folded') return '×';
  if (mood === 'busted') return '∅';
  return '';
}

function renderHair(art: PortraitArt) {
  switch (art.hairStyle) {
    case 'swept':
      return (
        <>
          <path d="M24 34c2-12 12-22 25-22 11 0 20 6 24 16-10-5-20-7-28-5-8 2-15 6-21 11Z" fill={art.hair} />
          <path d="M28 25c9-7 20-8 31-5-4-5-10-8-17-8-7 0-13 5-14 13Z" fill={art.hairShade} opacity="0.78" />
          <path d="M67 27c-3 3-5 8-5 14 0 2 .2 4 .6 6 4-4 7-11 7-20-1 0-1.7 0-2.6.2Z" fill={art.hairShade} opacity="0.64" />
        </>
      );
    case 'bob':
      return (
        <>
          <path d="M23 35c0-15 10-24 25-24s24 9 24 24c0 4-1 10-3 14-4-8-7-11-13-13-6-3-14-3-23 0-3 1-6 5-10 13-1-4 0-10 0-14Z" fill={art.hair} />
          <path d="M28 58c2-9 6-14 12-17-8 0-14 4-17 12l5 5Z" fill={art.hairShade} opacity="0.72" />
          <path d="M68 58c-2-9-6-14-12-17 8 0 14 4 17 12l-5 5Z" fill={art.hairShade} opacity="0.72" />
        </>
      );
    case 'wave':
      return (
        <>
          <path d="M25 35c1-14 11-23 24-23 13 0 22 8 23 20-4-3-8-4-12-4-4 0-8 1-12 4-2-4-6-6-11-6-4 0-8 2-12 9Z" fill={art.hair} />
          <path d="M34 21c4-5 9-8 15-8 7 0 12 4 15 10-5-1-10-1-14 1-5 1-10 0-16-3Z" fill={art.hairShade} opacity="0.78" />
          <path d="M25 35c3-5 6-8 9-9-2 5-1 11 3 18-5-1-9-4-12-9Z" fill={art.hairShade} opacity="0.62" />
        </>
      );
    case 'short':
      return (
        <>
          <path d="M27 34c2-13 12-22 22-22 12 0 20 7 23 19-7-4-15-6-24-5-8 0-15 3-21 8Z" fill={art.hair} />
          <path d="M32 20c4-5 10-8 17-8 5 0 10 2 14 7-7-1-13 0-19 2-4 1-8 1-12-1Z" fill={art.hairShade} opacity="0.72" />
        </>
      );
    case 'fade':
      return (
        <>
          <path d="M28 35c0-13 10-23 22-23 12 0 21 8 23 21-9-4-17-5-24-4-7 0-14 2-21 6Z" fill={art.hair} />
          <path d="M28 34c1 8 5 14 11 18-5 0-10-4-13-9 0-3 0-6 2-9Z" fill={art.hairShade} opacity="0.62" />
          <path d="M70 34c-1 8-5 14-11 18 5 0 10-4 13-9 0-3 0-6-2-9Z" fill={art.hairShade} opacity="0.62" />
        </>
      );
    case 'quiff':
      return (
        <>
          <path d="M24 36c2-15 12-24 25-24 12 0 21 7 24 19-6-1-11-4-17-7-5-2-12-2-19 0-5 2-9 6-13 12Z" fill={art.hair} />
          <path d="M36 16c4-3 8-4 13-4 8 0 14 4 17 12-7-2-12-2-17-1-5 0-9-2-13-7Z" fill={art.hairShade} opacity="0.78" />
        </>
      );
    case 'slick':
    default:
      return (
        <>
          <path d="M26 35c2-15 12-24 23-24 12 0 22 8 23 23-8-5-16-7-24-6-8 0-15 3-22 7Z" fill={art.hair} />
          <path d="M35 16c4-3 9-5 15-5 8 0 15 4 18 13-6-2-12-2-18-1-6 1-11-1-15-7Z" fill={art.hairShade} opacity="0.75" />
        </>
      );
  }
}

function renderAccessory(art: PortraitArt) {
  switch (art.accessory) {
    case 'earpiece':
      return (
        <>
          <circle cx="66" cy="47" r="4.2" fill="rgba(7, 13, 20, 0.9)" stroke={art.accent} strokeWidth="1.4" />
          <path d="M69.5 46.5 75 41" stroke={art.accent} strokeWidth="1.4" strokeLinecap="round" />
        </>
      );
    case 'monocle':
      return (
        <>
          <circle cx="57" cy="43" r="6.2" fill="rgba(255,255,255,0.08)" stroke={art.accent} strokeWidth="1.6" />
          <path d="M61 48 66 54" stroke={art.accent} strokeWidth="1.2" strokeLinecap="round" />
        </>
      );
    case 'visor':
      return <path d="M28 37c5-6 12-9 20-9 9 0 16 3 22 9-3 4-7 6-12 7H40c-5-1-9-3-12-7Z" fill={art.accent} opacity="0.58" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />;
    case 'dealer':
      return (
        <>
          <path d="M27 24c4-7 12-11 21-11 10 0 18 4 22 12-6-3-13-5-22-5-8 0-15 1-21 4Z" fill={art.accent} opacity="0.86" />
          <path d="M31 23h34" stroke="rgba(255,255,255,0.48)" strokeWidth="1.4" strokeLinecap="round" />
        </>
      );
    case 'shades':
      return (
        <>
          <rect x="34" y="38" width="11" height="7" rx="3.2" fill="rgba(9, 15, 24, 0.9)" stroke={art.accent} strokeWidth="1" />
          <rect x="51" y="38" width="11" height="7" rx="3.2" fill="rgba(9, 15, 24, 0.9)" stroke={art.accent} strokeWidth="1" />
          <path d="M45 41h6" stroke={art.accent} strokeWidth="1.1" strokeLinecap="round" />
        </>
      );
    case 'headset':
      return (
        <>
          <path d="M31 41c1-9 8-15 17-15s16 6 17 15" fill="none" stroke={art.accent} strokeWidth="1.5" strokeLinecap="round" />
          <rect x="28" y="42" width="4.5" height="8" rx="2" fill="rgba(9, 15, 24, 0.9)" stroke={art.accent} strokeWidth="1" />
          <rect x="63.5" y="42" width="4.5" height="8" rx="2" fill="rgba(9, 15, 24, 0.9)" stroke={art.accent} strokeWidth="1" />
          <path d="M65 48c4 1 6 4 6 8" stroke={art.accent} strokeWidth="1.1" strokeLinecap="round" />
        </>
      );
    case 'none':
    default:
      return null;
  }
}

function renderMark(art: PortraitArt) {
  if (art.mark === 'scar') {
    return <path d="M58 46 53 55" stroke="rgba(146, 52, 57, 0.55)" strokeWidth="1.5" strokeLinecap="round" />;
  }
  if (art.mark === 'stripe') {
    return <path d="M34 47c4-2 8-2 11 0" stroke={art.accent} strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />;
  }
  if (art.mark === 'mole') {
    return <circle cx="56.5" cy="49.5" r="1.2" fill="rgba(90, 54, 40, 0.72)" />;
  }
  return null;
}

function renderFacialHair(art: PortraitArt) {
  if (art.facialHair === 'stubble') {
    return <path d="M40 53c3 2 6 3 8 3 4 0 7-1 10-3" stroke="rgba(75, 49, 43, 0.58)" strokeWidth="2.4" strokeLinecap="round" opacity="0.7" />;
  }
  if (art.facialHair === 'goatee') {
    return (
      <>
        <path d="M43 54c2 2 3 3 5 3 3 0 4-1 6-3" stroke="rgba(66, 44, 41, 0.76)" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M47 56c0 3 .4 5 1.2 6" stroke="rgba(66, 44, 41, 0.76)" strokeWidth="2" strokeLinecap="round" />
      </>
    );
  }
  return null;
}

function renderBackdrop(art: PortraitArt): ReactNode {
  switch (art.backdrop) {
    case 'grid':
      return (
        <g className="player-portrait-backdrop">
          <path d="M18 18h60v60H18Z" fill={art.accent} opacity="0.08" />
          <path d="M18 34h60M18 50h60M18 66h60M34 18v60M50 18v60M66 18v60" stroke={art.accent} strokeWidth="1.1" opacity="0.16" />
        </g>
      );
    case 'rays':
      return (
        <g className="player-portrait-backdrop">
          <path d="M48 8 55 27 76 16 64 35 85 40 64 46 76 68 55 56 48 84 41 56 20 68 32 46 11 40 32 35 20 16 41 27Z" fill={art.accent} opacity="0.14" />
        </g>
      );
    case 'curtain':
      return (
        <g className="player-portrait-backdrop">
          <path d="M16 12c6 4 12 6 18 6s12-2 18-6v72c-6 3-12 5-18 5s-12-2-18-5V12Z" fill={art.accent} opacity="0.1" />
          <path d="M44 12c6 4 12 6 18 6s12-2 18-6v72c-6 3-12 5-18 5s-12-2-18-5V12Z" fill={art.accent} opacity="0.16" />
        </g>
      );
    case 'halo':
    default:
      return (
        <g className="player-portrait-backdrop">
          <circle cx="48" cy="32" r="22" fill={art.accent} opacity="0.12" />
          <circle cx="48" cy="32" r="12" fill={art.accent} opacity="0.08" />
        </g>
      );
  }
}

function getFigureProfile(art: PortraitArt, isPanel: boolean): FigureProfile {
  if (art.figure === 'broad') {
    return isPanel
      ? {
          headTransform: 'translate(-1.1 -13.2) scale(1.47)',
          torsoTransform: 'translate(0 5.2) scale(1.22)',
          torsoMain: 'M11 91c6-15 18-24 37-27 19 3 31 12 37 27-14 4-26 5-37 5s-23-1-37-5Z',
          torsoShade: 'M20 72c8 10 17 14 28 14 10 0 19-4 28-14l8 19H12l8-19Z',
          shirt: 'M31 68c4 8 10 13 17 13s13-4 17-13l7 18H24l7-18Z',
        }
      : {
          headTransform: 'translate(-0.6 -1.4) scale(1.06)',
          torsoTransform: 'translate(0 0.6) scale(1.04)',
          torsoMain: 'M16 88c4-11 13-19 22-22 6 3 13 5 20 5s14-2 20-5c10 4 18 11 22 22-15 5-31 7-42 7s-27-2-42-7Z',
          torsoShade: 'M27 71c7 7 14 11 21 11s14-4 21-11l8 18H19l8-18Z',
          shirt: 'M34 69c4 6 8 9 14 9 5 0 10-3 14-9l7 15H27l7-15Z',
        };
  }

  if (art.figure === 'poised') {
    return isPanel
      ? {
          headTransform: 'translate(-2.8 -13.7) scale(1.36)',
          torsoTransform: 'translate(0 3.4) scale(1.1)',
          torsoMain: 'M18 91c4-12 13-21 30-24 17 3 26 12 30 24-11 4-21 5-30 5s-19-1-30-5Z',
          torsoShade: 'M26 72c6 8 13 12 22 12s16-4 22-12l7 18H19l7-18Z',
          shirt: 'M35 70c4 6 8 10 13 10s9-4 13-10l6 15H29l6-15Z',
        }
      : {
          headTransform: 'translate(-1.2 -2.2) scale(1.04)',
          torsoTransform: 'translate(0 -0.3) scale(0.98)',
          torsoMain: 'M20 88c3-10 11-18 19-21 6 3 12 4 19 4s13-1 19-4c9 4 16 11 19 21-13 4-25 6-38 6s-25-2-38-6Z',
          torsoShade: 'M30 72c6 6 12 9 18 9s12-3 18-9l7 16H23l7-16Z',
          shirt: 'M37 70c3 5 7 8 11 8s8-3 11-8l6 14H31l6-14Z',
        };
  }

  if (art.figure === 'agile') {
    return isPanel
      ? {
          headTransform: 'translate(-2.0 -13.1) scale(1.43)',
          torsoTransform: 'translate(0 4.2) scale(1.15)',
          torsoMain: 'M14 92c6-14 18-25 34-27 18 3 30 11 34 26-13 4-23 5-34 5s-21-1-34-4Z',
          torsoShade: 'M24 72c7 9 15 13 24 13 9 0 17-4 24-13l8 19H16l8-19Z',
          shirt: 'M32 69c4 7 9 11 16 11s12-4 16-11l7 17H25l7-17Z',
        }
      : {
          headTransform: 'translate(-0.8 -1.8) scale(1.05)',
          torsoTransform: 'translate(0 0.2) scale(1.01)',
          torsoMain: 'M18 88c4-10 12-18 21-21 6 3 13 5 19 5 7 0 14-2 20-5 10 4 17 11 20 21-13 5-27 7-40 7s-27-2-40-7Z',
          torsoShade: 'M28 72c6 7 13 11 20 11s14-4 20-11l8 17H20l8-17Z',
          shirt: 'M35 69c4 6 8 9 13 9 5 0 9-3 13-9l7 15H28l7-15Z',
        };
  }

  return isPanel
    ? {
        headTransform: 'translate(-1.9 -12.6) scale(1.4)',
        torsoTransform: 'translate(0 4.4) scale(1.17)',
        torsoMain: 'M13 91c4-13 15-22 35-25 20 3 31 12 35 25-13 4-25 5-35 5s-22-1-35-5Z',
        torsoShade: 'M23 72c7 9 15 13 25 13 10 0 18-4 25-13l8 19H15l8-19Z',
        shirt: 'M33 69c4 8 9 12 15 12s11-4 15-12l7 18H26l7-18Z',
      }
    : {
        headTransform: '',
        torsoTransform: '',
        torsoMain: 'M18 88c3-10 11-18 20-21 6 3 13 5 20 5s14-2 20-5c10 4 18 11 20 21-14 5-30 7-40 7s-26-2-40-7Z',
        torsoShade: 'M29 72c6 6 12 10 19 10s13-3 19-10l7 17H22l7-17Z',
        shirt: 'M37 69c3 5 7 8 11 8s8-3 11-8l6 14H31l6-14Z',
      };
}

function getMoodAdjustments(mood: PlayerPortraitMood, isPanel: boolean) {
  const lift = isPanel ? 1.2 : 0.8;
  switch (mood) {
    case 'thinking':
      return {
        headTransform: `rotate(-6 48 42) translate(-1 ${-lift})`,
        torsoTransform: 'rotate(-2 48 66)',
      };
    case 'checking':
      return {
        headTransform: 'rotate(-2 48 42)',
        torsoTransform: 'translate(0 -0.8)',
      };
    case 'calling':
      return {
        headTransform: 'rotate(3 48 42)',
        torsoTransform: 'translate(0.8 -1.2) rotate(-2 48 68)',
      };
    case 'raising':
      return {
        headTransform: `translate(0 ${-lift}) rotate(4 48 42)`,
        torsoTransform: 'translate(0 -1.8) rotate(2 48 68)',
      };
    case 'all-in':
      return {
        headTransform: `translate(0 ${-lift * 1.2}) scale(1.02)`,
        torsoTransform: 'translate(0 -2.6) scale(1.03)',
      };
    case 'winner':
      return {
        headTransform: `translate(0 ${-lift * 1.4}) scale(1.03)`,
        torsoTransform: 'translate(0 -2.8) scale(1.04)',
      };
    case 'folded':
      return {
        headTransform: 'translate(0 1.2) rotate(6 48 42)',
        torsoTransform: 'translate(0 1.4) rotate(-4 48 68)',
      };
    case 'busted':
      return {
        headTransform: 'translate(0 2.4) rotate(8 48 42)',
        torsoTransform: 'translate(0 2.8) rotate(-5 48 68)',
      };
    case 'focused':
      return {
        headTransform: `translate(0 ${-lift * 0.5}) scale(1.01)`,
        torsoTransform: 'translate(0 -1.1)',
      };
    case 'calm':
    default:
      return {
        headTransform: '',
        torsoTransform: '',
      };
  }
}

function renderMoodAction(mood: PlayerPortraitMood, art: PortraitArt): ReactNode {
  const armStroke = art.skinShadow;
  const armGlow = art.accent;
  const chipFill = art.accent;
  const chipInner = 'rgba(255,255,255,0.24)';
  const baseArms = (
    <>
      <path d="M31 70c4-3 8-4 13-4" stroke={armStroke} strokeWidth="4.8" strokeLinecap="round" fill="none" />
      <path d="M65 70c-4-3-8-4-13-4" stroke={armStroke} strokeWidth="4.8" strokeLinecap="round" fill="none" />
    </>
  );

  if (mood === 'thinking') {
    return (
      <g className="player-portrait-action action-thinking">
        <path d="M30 71c6-4 11-5 16-5" stroke={armStroke} strokeWidth="4.8" strokeLinecap="round" fill="none" />
        <path d="M66 71c-5-8-8-14-9-20" stroke={armStroke} strokeWidth="4.8" strokeLinecap="round" fill="none" />
        <circle cx="56.5" cy="49.5" r="2.4" fill={armGlow} opacity="0.52" />
      </g>
    );
  }

  if (mood === 'checking') {
    return (
      <g className="player-portrait-action action-checking">
        <path d="M31 70c6-4 11-5 16-5" stroke={armStroke} strokeWidth="4.8" strokeLinecap="round" fill="none" />
        <path d="M65 70c4-6 8-9 12-11" stroke={armStroke} strokeWidth="4.8" strokeLinecap="round" fill="none" />
        <path d="M76 56.5c2.5 1.5 3.5 3.5 3 5.5" stroke={armGlow} strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.72" />
      </g>
    );
  }

  if (mood === 'calling') {
    return (
      <g className="player-portrait-action action-calling">
        <path d="M31 70c6-4 11-5 16-5" stroke={armStroke} strokeWidth="4.8" strokeLinecap="round" fill="none" />
        <path d="M65 70c-1-7 1-11 7-14" stroke={armStroke} strokeWidth="4.8" strokeLinecap="round" fill="none" />
        <g className="player-portrait-chip player-portrait-chip-call">
          <circle cx="69" cy="55" r="5.8" fill={chipFill} opacity="0.92" />
          <circle cx="69" cy="55" r="3.2" fill={chipInner} />
        </g>
      </g>
    );
  }

  if (mood === 'raising') {
    return (
      <g className="player-portrait-action action-raising">
        <path d="M31 70c6-4 11-5 16-5" stroke={armStroke} strokeWidth="4.8" strokeLinecap="round" fill="none" />
        <path d="M65 70c4-9 8-18 14-25" stroke={armStroke} strokeWidth="4.8" strokeLinecap="round" fill="none" />
        <g className="player-portrait-chip player-portrait-chip-raise">
          <circle cx="79" cy="42" r="6.4" fill={chipFill} opacity="0.94" />
          <circle cx="79" cy="42" r="3.5" fill={chipInner} />
        </g>
      </g>
    );
  }

  if (mood === 'all-in') {
    return (
      <g className="player-portrait-action action-all-in">
        <path d="M30 71c-4-10-7-18-12-25" stroke={armStroke} strokeWidth="4.8" strokeLinecap="round" fill="none" />
        <path d="M66 71c4-10 8-18 12-25" stroke={armStroke} strokeWidth="4.8" strokeLinecap="round" fill="none" />
        <g className="player-portrait-chip player-portrait-chip-all-in">
          <circle cx="20" cy="42" r="5.8" fill={chipFill} opacity="0.88" />
          <circle cx="20" cy="42" r="3.1" fill={chipInner} />
          <circle cx="76" cy="42" r="7.2" fill={chipFill} opacity="0.94" />
          <circle cx="76" cy="42" r="3.8" fill={chipInner} />
        </g>
      </g>
    );
  }

  if (mood === 'winner') {
    return (
      <g className="player-portrait-action action-winner">
        <path d="M30 71c-5-12-8-22-13-29" stroke={armStroke} strokeWidth="4.8" strokeLinecap="round" fill="none" />
        <path d="M66 71c5-12 8-22 13-29" stroke={armStroke} strokeWidth="4.8" strokeLinecap="round" fill="none" />
        <path d="M48 29 50.8 36.4 58.7 36.7 52.5 41.4 54.8 49 48 44.8 41.2 49 43.5 41.4 37.3 36.7 45.2 36.4Z" fill={chipFill} opacity="0.92" className="player-portrait-spark" />
      </g>
    );
  }

  if (mood === 'folded') {
    return (
      <g className="player-portrait-action action-folded">
        <path d="M31 68c8 2 13 4 18 7" stroke={armStroke} strokeWidth="4.8" strokeLinecap="round" fill="none" />
        <path d="M65 68c-8 2-13 4-18 7" stroke={armStroke} strokeWidth="4.8" strokeLinecap="round" fill="none" />
      </g>
    );
  }

  if (mood === 'busted') {
    return (
      <g className="player-portrait-action action-busted">
        <path d="M31 70c-3 6-6 10-10 13" stroke={armStroke} strokeWidth="4.8" strokeLinecap="round" fill="none" />
        <path d="M65 70c3 6 6 10 10 13" stroke={armStroke} strokeWidth="4.8" strokeLinecap="round" fill="none" />
      </g>
    );
  }

  return <g className="player-portrait-action action-idle">{baseArms}</g>;
}

export function PlayerPortrait({ player, active = false, mood = 'calm', size = 'seat', variant = 'orb', motionProfile = 'full' }: PlayerPortraitProps) {
  const portrait = resolvePlayerPortrait(player);
  const badge = moodBadge(mood);
  const isPanel = variant === 'panel';
  const figure = getFigureProfile(portrait.art, isPanel);
  const pose = getMoodAdjustments(mood, isPanel);
  const headTransform = [figure.headTransform, pose.headTransform].filter(Boolean).join(' ');
  const torsoTransform = [figure.torsoTransform, pose.torsoTransform].filter(Boolean).join(' ');

  return (
    <div className={`player-portrait-frame size-${size}`}>
      <div
        className={`player-portrait variant-${variant} ${active ? 'active' : ''} mood-${mood} ornament-${portrait.ornament} figure-${portrait.art.figure} motion-${motionProfile}`}
        style={portrait.styleVars}
      >
        <span className="player-portrait-halo" />
        <span className="player-portrait-flare" />
        <span className="player-portrait-shell" />
        <span className="player-portrait-silhouette" />
        <svg className="player-portrait-art" viewBox="0 0 96 96" aria-hidden="true">
          {renderBackdrop(portrait.art)}
          <g transform={torsoTransform}>
            <path d={figure.torsoMain} fill={portrait.art.jacket} />
            <path d={figure.torsoShade} fill={portrait.art.jacketShade} opacity="0.95" />
            <path d={figure.shirt} fill={portrait.art.shirt} />
            <path d={isPanel ? 'M48 64 58 80 48 90 38 80Z' : 'M48 66 56 78 48 85 40 78Z'} fill={portrait.art.accent} opacity="0.92" />
            {isPanel && (
              <>
                <path d="M31 71 42 70 37 85Z" fill={portrait.art.jacket} opacity="0.88" />
                <path d="M65 71 54 70 59 85Z" fill={portrait.art.jacket} opacity="0.88" />
                <path d="M48 70v21" stroke="rgba(255,255,255,0.15)" strokeWidth="1.2" strokeLinecap="round" />
              </>
            )}
          </g>
          {renderMoodAction(mood, portrait.art)}
          <g transform={headTransform}>
            <rect x="43" y="56" width="10" height="13" rx="5" fill={portrait.art.skinShadow} />
            <ellipse cx="34" cy="43" rx="3.5" ry="4.6" fill={portrait.art.skinShadow} opacity="0.9" />
            <ellipse cx="62" cy="43" rx="3.5" ry="4.6" fill={portrait.art.skinShadow} opacity="0.9" />
            <ellipse cx="48" cy="40" rx="18.5" ry="21" fill={portrait.art.skin} />
            <path d="M31 42c2-11 9-18 17-18s15 7 17 18c-4-3-10-5-17-5s-13 2-17 5Z" fill={portrait.art.skinShadow} opacity="0.16" />
            {renderHair(portrait.art)}
            <path d="M39 37c2-1 4-2 7-2" stroke="rgba(32, 27, 31, 0.68)" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M50 35c3 0 5 .6 7 2" stroke="rgba(32, 27, 31, 0.68)" strokeWidth="1.5" strokeLinecap="round" />
            <ellipse cx="41" cy="42" rx="2.2" ry="2.4" fill={portrait.art.eye} />
            <ellipse cx="55" cy="42" rx="2.2" ry="2.4" fill={portrait.art.eye} />
            <circle cx="41" cy="42.2" r="0.95" fill="rgba(8, 15, 24, 0.88)" />
            <circle cx="55" cy="42.2" r="0.95" fill="rgba(8, 15, 24, 0.88)" />
            <path d="M48 43v7" stroke={portrait.art.skinShadow} strokeWidth="1.3" strokeLinecap="round" opacity="0.8" />
            <path d="M43 52c3 2 6 3 10 0" stroke={portrait.art.lip} strokeWidth="1.8" strokeLinecap="round" />
            {renderMark(portrait.art)}
            {renderFacialHair(portrait.art)}
            {renderAccessory(portrait.art)}
          </g>
          <path d="M25 84c7 4 15 5 23 5s16-2 23-5" stroke={portrait.art.accent} strokeWidth="1.6" strokeLinecap="round" opacity="0.46" />
        </svg>
        <span className="player-portrait-glyph">{portrait.sigil}</span>
        <span className="player-portrait-ornament" />
        {badge && <span className="player-portrait-status">{badge}</span>}
      </div>
    </div>
  );
}
