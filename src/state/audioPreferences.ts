export type AudioLevel = 'off' | 'soft' | 'full';

export interface AudioPreferences {
  level: AudioLevel;
}

export const AUDIO_PREFERENCES_STORAGE_KEY = 'neon.holdem.audio-preferences.v1';

const DEFAULT_AUDIO_PREFERENCES: AudioPreferences = {
  level: 'soft',
};

export function createDefaultAudioPreferences(): AudioPreferences {
  return {
    ...DEFAULT_AUDIO_PREFERENCES,
  };
}

export function readAudioPreferences(): AudioPreferences {
  if (typeof window === 'undefined') {
    return createDefaultAudioPreferences();
  }

  try {
    const raw = window.localStorage.getItem(AUDIO_PREFERENCES_STORAGE_KEY);
    if (!raw) {
      return createDefaultAudioPreferences();
    }

    const parsed = JSON.parse(raw) as Partial<AudioPreferences>;
    if (parsed.level === 'off' || parsed.level === 'soft' || parsed.level === 'full') {
      return { level: parsed.level };
    }
  } catch {
    // ignore broken preference payloads and fall back to defaults
  }

  return createDefaultAudioPreferences();
}

export function writeAudioPreferences(preferences: AudioPreferences): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(AUDIO_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
}

export function cycleAudioLevel(level: AudioLevel): AudioLevel {
  if (level === 'off') return 'soft';
  if (level === 'soft') return 'full';
  return 'off';
}

export function audioLevelLabel(level: AudioLevel): string {
  if (level === 'off') return '关';
  if (level === 'full') return '满';
  return '柔';
}

export function audioLevelGain(level: AudioLevel): number {
  if (level === 'off') return 0;
  if (level === 'full') return 1;
  return 0.58;
}
