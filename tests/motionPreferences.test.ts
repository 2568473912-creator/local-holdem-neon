import { describe, expect, it, vi } from 'vitest';
import {
  cycleMotionLevel,
  motionLevelLabel,
  MOTION_PREFERENCES_STORAGE_KEY,
  readMotionPreferences,
  writeMotionPreferences,
} from '../src/state/motionPreferences';

describe('motionPreferences', () => {
  it('cycles motion levels in order', () => {
    expect(cycleMotionLevel('full')).toBe('soft');
    expect(cycleMotionLevel('soft')).toBe('reduced');
    expect(cycleMotionLevel('reduced')).toBe('full');
  });

  it('reads reduced motion from media query when storage is empty', () => {
    const getItem = vi.fn(() => null);
    const setItem = vi.fn();
    vi.stubGlobal('window', {
      localStorage: { getItem, setItem },
      matchMedia: vi.fn(() => ({ matches: true })),
    });

    expect(readMotionPreferences().level).toBe('reduced');
    expect(motionLevelLabel('reduced')).toBe('减');
  });

  it('writes and reads stored preferences', () => {
    let storedValue: string | null = null;
    vi.stubGlobal('window', {
      localStorage: {
        getItem: vi.fn(() => storedValue),
        setItem: vi.fn((key: string, value: string) => {
          if (key === MOTION_PREFERENCES_STORAGE_KEY) {
            storedValue = value;
          }
        }),
      },
      matchMedia: vi.fn(() => ({ matches: false })),
    });

    writeMotionPreferences({ level: 'soft' });
    expect(readMotionPreferences().level).toBe('soft');
  });
});
