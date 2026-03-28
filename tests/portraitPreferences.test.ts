import { beforeEach, describe, expect, it } from 'vitest';
import {
  createDefaultPortraitPreferences,
  PORTRAIT_PREFERENCES_STORAGE_KEY,
  purchaseHumanPortrait,
  readPortraitPreferences,
  selectHumanPortrait,
  writePortraitPreferences,
} from '../src/state/portraitPreferences';

function installWindowMock() {
  const store = new Map<string, string>();
  const localStorage = {
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };

  Object.defineProperty(globalThis, 'window', {
    value: { localStorage },
    configurable: true,
  });

  return { store, localStorage };
}

describe('portraitPreferences', () => {
  beforeEach(() => {
    installWindowMock();
  });

  it('returns default portrait preferences when storage is empty', () => {
    expect(readPortraitPreferences()).toEqual(createDefaultPortraitPreferences());
  });

  it('reads and writes the selected human portrait theme', () => {
    writePortraitPreferences({
      humanPortraitKey: 'human-sable',
      ownedPortraitKeys: ['human-host', 'human-comet', 'human-orbit', 'human-sable'],
      tournamentPointsSpent: 300,
    });
    expect(readPortraitPreferences()).toEqual({
      humanPortraitKey: 'human-sable',
      ownedPortraitKeys: ['human-host', 'human-comet', 'human-orbit', 'human-sable'],
      tournamentPointsSpent: 300,
    });
    expect(window.localStorage.getItem(PORTRAIT_PREFERENCES_STORAGE_KEY)).toBe(
      JSON.stringify({
        humanPortraitKey: 'human-sable',
        ownedPortraitKeys: ['human-host', 'human-comet', 'human-orbit', 'human-sable'],
        tournamentPointsSpent: 300,
      }),
    );
  });

  it('migrates legacy portrait payloads and auto-owns the selected portrait', () => {
    window.localStorage.setItem(PORTRAIT_PREFERENCES_STORAGE_KEY, JSON.stringify({ humanPortraitKey: 'human-noir' }));

    expect(readPortraitPreferences()).toEqual({
      humanPortraitKey: 'human-noir',
      ownedPortraitKeys: ['human-noir', 'human-host', 'human-comet', 'human-orbit'],
      tournamentPointsSpent: 0,
    });
  });

  it('purchases a locked portrait with tournament points and auto-equips it', () => {
    const result = purchaseHumanPortrait(createDefaultPortraitPreferences(), 200, 'human-noir', 120);
    expect(result.ok).toBe(true);
    expect(result.purchased).toBe(true);
    expect(result.preferences.humanPortraitKey).toBe('human-noir');
    expect(result.preferences.ownedPortraitKeys).toContain('human-noir');
    expect(result.preferences.tournamentPointsSpent).toBe(120);
  });

  it('only selects an owned portrait without charging points', () => {
    const selected = selectHumanPortrait(
      {
        humanPortraitKey: 'human-host',
        ownedPortraitKeys: ['human-host', 'human-comet', 'human-orbit', 'human-noir'],
        tournamentPointsSpent: 120,
      },
      'human-noir',
    );

    expect(selected.humanPortraitKey).toBe('human-noir');
    expect(selected.tournamentPointsSpent).toBe(120);
  });
});
