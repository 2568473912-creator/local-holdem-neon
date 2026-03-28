import { describe, expect, it, vi } from 'vitest';
import {
  createDefaultCardSkinPreferences,
  readCardSkinPreferences,
  CARD_SKIN_STORAGE_KEY,
  purchaseCardSkin,
  selectCardSkin,
  writeCardSkinPreferences,
} from '../src/state/cardSkinPreferences';

describe('cardSkinPreferences', () => {
  it('writes and reads card skin preference payloads', () => {
    let storedValue: string | null = null;
    vi.stubGlobal('window', {
      localStorage: {
        getItem: vi.fn(() => storedValue),
        setItem: vi.fn((key: string, value: string) => {
          if (key === CARD_SKIN_STORAGE_KEY) {
            storedValue = value;
          }
        }),
      },
    });

    writeCardSkinPreferences({
      cardSkinKey: 'jade-legends',
      ownedCardSkinKeys: ['classic-court', 'jade-legends'],
      tournamentPointsSpent: 360,
    });

    expect(readCardSkinPreferences()).toEqual({
      cardSkinKey: 'jade-legends',
      ownedCardSkinKeys: ['classic-court', 'jade-legends'],
      tournamentPointsSpent: 360,
    });
  });

  it('migrates legacy payloads and auto-owns the selected skin', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: vi.fn(() => JSON.stringify({ cardSkinKey: 'velvet-opera' })),
        setItem: vi.fn(),
      },
    });

    expect(readCardSkinPreferences()).toEqual({
      cardSkinKey: 'velvet-opera',
      ownedCardSkinKeys: ['classic-court', 'velvet-opera'],
      tournamentPointsSpent: 0,
    });
  });

  it('purchases and equips a locked card skin', () => {
    const result = purchaseCardSkin(createDefaultCardSkinPreferences(), 400, 'jade-legends', 360);

    expect(result.ok).toBe(true);
    expect(result.purchased).toBe(true);
    expect(result.preferences.cardSkinKey).toBe('jade-legends');
    expect(result.preferences.ownedCardSkinKeys).toContain('jade-legends');
    expect(result.preferences.tournamentPointsSpent).toBe(360);
  });

  it('selects only owned card skins', () => {
    const next = selectCardSkin(
      {
        cardSkinKey: 'classic-court',
        ownedCardSkinKeys: ['classic-court', 'neon-royal'],
        tournamentPointsSpent: 180,
      },
      'neon-royal',
    );

    expect(next.cardSkinKey).toBe('neon-royal');
    expect(next.tournamentPointsSpent).toBe(180);
  });
});
