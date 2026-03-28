import { describe, expect, it, vi } from 'vitest';
import {
  createDefaultThemePreferences,
  cycleOwnedTableTheme,
  readThemePreferences,
  THEME_PREFERENCES_STORAGE_KEY,
  purchaseTableTheme,
  writeThemePreferences,
} from '../src/state/themePreferences';

describe('themePreferences', () => {
  it('cycles through owned table themes only', () => {
    expect(cycleOwnedTableTheme('neon-ocean', ['neon-ocean', 'emerald-classic'])).toBe('emerald-classic');
    expect(cycleOwnedTableTheme('emerald-classic', ['neon-ocean', 'emerald-classic'])).toBe('neon-ocean');
  });

  it('writes and reads theme preference', () => {
    let storedValue: string | null = null;
    vi.stubGlobal('window', {
      localStorage: {
        getItem: vi.fn(() => storedValue),
        setItem: vi.fn((key: string, value: string) => {
          if (key === THEME_PREFERENCES_STORAGE_KEY) {
            storedValue = value;
          }
        }),
      },
    });

    writeThemePreferences({
      tableThemeKey: 'crimson-royale',
      ownedThemeKeys: ['neon-ocean', 'emerald-classic', 'crimson-royale'],
      tournamentPointsSpent: 260,
    });
    expect(readThemePreferences()).toEqual({
      tableThemeKey: 'crimson-royale',
      ownedThemeKeys: ['neon-ocean', 'emerald-classic', 'crimson-royale'],
      tournamentPointsSpent: 260,
    });
  });

  it('migrates legacy theme payloads and preserves the selected theme', () => {
    let storedValue = JSON.stringify({ tableThemeKey: 'crimson-royale' });
    vi.stubGlobal('window', {
      localStorage: {
        getItem: vi.fn(() => storedValue),
        setItem: vi.fn((key: string, value: string) => {
          if (key === THEME_PREFERENCES_STORAGE_KEY) {
            storedValue = value;
          }
        }),
      },
    });

    expect(readThemePreferences()).toEqual({
      tableThemeKey: 'crimson-royale',
      ownedThemeKeys: ['crimson-royale', 'neon-ocean', 'emerald-classic'],
      tournamentPointsSpent: 0,
    });
  });

  it('purchases and equips a locked theme', () => {
    const result = purchaseTableTheme(createDefaultThemePreferences(), 300, 'crimson-royale', 260);
    expect(result.ok).toBe(true);
    expect(result.purchased).toBe(true);
    expect(result.preferences.tableThemeKey).toBe('crimson-royale');
    expect(result.preferences.ownedThemeKeys).toContain('crimson-royale');
    expect(result.preferences.tournamentPointsSpent).toBe(260);
  });
});
