import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AUDIO_PREFERENCES_STORAGE_KEY,
  audioLevelGain,
  audioLevelLabel,
  createDefaultAudioPreferences,
  cycleAudioLevel,
  readAudioPreferences,
  writeAudioPreferences,
} from '../src/state/audioPreferences';

function installAudioWindowMock() {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: vi.fn((key: string) => (store.has(key) ? store.get(key)! : null)),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
  };

  vi.stubGlobal('window', {
    localStorage,
  });

  return { store, localStorage };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('audio preferences', () => {
  it('cycles levels and exposes user-facing labels', () => {
    expect(cycleAudioLevel('off')).toBe('soft');
    expect(cycleAudioLevel('soft')).toBe('full');
    expect(cycleAudioLevel('full')).toBe('off');

    expect(audioLevelLabel('off')).toBe('关');
    expect(audioLevelLabel('soft')).toBe('柔');
    expect(audioLevelLabel('full')).toBe('满');
    expect(audioLevelGain('off')).toBe(0);
    expect(audioLevelGain('soft')).toBeGreaterThan(0);
    expect(audioLevelGain('full')).toBe(1);
  });

  it('reads and writes persisted audio preferences with fallback defaults', () => {
    const harness = installAudioWindowMock();
    expect(readAudioPreferences()).toEqual(createDefaultAudioPreferences());

    writeAudioPreferences({ level: 'full' });
    expect(harness.store.get(AUDIO_PREFERENCES_STORAGE_KEY)).toBe(JSON.stringify({ level: 'full' }));
    expect(readAudioPreferences()).toEqual({ level: 'full' });

    harness.store.set(AUDIO_PREFERENCES_STORAGE_KEY, JSON.stringify({ level: 'broken' }));
    expect(readAudioPreferences()).toEqual(createDefaultAudioPreferences());
  });
});
