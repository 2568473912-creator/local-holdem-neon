import { describe, expect, it, vi } from 'vitest';
import {
  createDefaultEffectSkinPreferences,
  EFFECT_SKIN_STORAGE_KEY,
  purchaseEffectSkin,
  readEffectSkinPreferences,
  selectEffectSkin,
  writeEffectSkinPreferences,
} from '../src/state/effectSkinPreferences';

describe('effectSkinPreferences', () => {
  it('writes and reads effect skin preferences', () => {
    let storedValue: string | null = null;
    vi.stubGlobal('window', {
      localStorage: {
        getItem: vi.fn(() => storedValue),
        setItem: vi.fn((key: string, value: string) => {
          if (key === EFFECT_SKIN_STORAGE_KEY) {
            storedValue = value;
          }
        }),
      },
    });

    writeEffectSkinPreferences({
      effectSkinKey: 'prism-pulse',
      ownedEffectSkinKeys: ['club-classic', 'prism-pulse'],
      tournamentPointsSpent: 420,
    });

    expect(readEffectSkinPreferences()).toEqual({
      effectSkinKey: 'prism-pulse',
      ownedEffectSkinKeys: ['club-classic', 'prism-pulse'],
      tournamentPointsSpent: 420,
    });
  });

  it('migrates legacy payloads and auto-owns the selected effect skin', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: vi.fn(() => JSON.stringify({ effectSkinKey: 'ember-strike' })),
        setItem: vi.fn(),
      },
    });

    expect(readEffectSkinPreferences()).toEqual({
      effectSkinKey: 'ember-strike',
      ownedEffectSkinKeys: ['club-classic', 'ember-strike'],
      tournamentPointsSpent: 0,
    });
  });

  it('purchases and equips a locked effect skin', () => {
    const result = purchaseEffectSkin(createDefaultEffectSkinPreferences(), 500, 'lotus-dream', 320);

    expect(result.ok).toBe(true);
    expect(result.purchased).toBe(true);
    expect(result.preferences.effectSkinKey).toBe('lotus-dream');
    expect(result.preferences.ownedEffectSkinKeys).toContain('lotus-dream');
    expect(result.preferences.tournamentPointsSpent).toBe(320);
  });

  it('only selects owned effect skins', () => {
    const next = selectEffectSkin(
      {
        effectSkinKey: 'club-classic',
        ownedEffectSkinKeys: ['club-classic', 'neon-comet'],
        tournamentPointsSpent: 160,
      },
      'neon-comet',
    );

    expect(next.effectSkinKey).toBe('neon-comet');
    expect(next.tournamentPointsSpent).toBe(160);
  });
});
