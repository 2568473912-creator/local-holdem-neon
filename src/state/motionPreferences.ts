export type MotionLevel = 'full' | 'soft' | 'reduced';

export interface MotionPreferences {
  level: MotionLevel;
}

export const MOTION_PREFERENCES_STORAGE_KEY = 'neon.holdem.motion-preferences.v1';

const DEFAULT_MOTION_LEVEL: MotionLevel = 'full';

function isMotionLevel(value: unknown): value is MotionLevel {
  return value === 'full' || value === 'soft' || value === 'reduced';
}

export function readMotionPreferences(): MotionPreferences {
  if (typeof window === 'undefined') {
    return { level: DEFAULT_MOTION_LEVEL };
  }

  try {
    const raw = window.localStorage.getItem(MOTION_PREFERENCES_STORAGE_KEY);
    if (!raw) {
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        return { level: 'reduced' };
      }
      return { level: DEFAULT_MOTION_LEVEL };
    }
    const parsed = JSON.parse(raw) as Partial<MotionPreferences>;
    return {
      level: isMotionLevel(parsed.level) ? parsed.level : DEFAULT_MOTION_LEVEL,
    };
  } catch {
    return { level: DEFAULT_MOTION_LEVEL };
  }
}

export function writeMotionPreferences(preferences: MotionPreferences): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(MOTION_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
}

export function cycleMotionLevel(level: MotionLevel): MotionLevel {
  if (level === 'full') return 'soft';
  if (level === 'soft') return 'reduced';
  return 'full';
}

export function motionLevelLabel(level: MotionLevel): string {
  if (level === 'full') return '满';
  if (level === 'soft') return '柔';
  return '减';
}
