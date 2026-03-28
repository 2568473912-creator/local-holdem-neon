import { HUMAN_PORTRAIT_KEYS, STARTER_HUMAN_PORTRAIT_KEYS, type HumanPortraitKey } from '../types/portrait';

export interface PortraitPreferences {
  humanPortraitKey: HumanPortraitKey;
  ownedPortraitKeys: HumanPortraitKey[];
  tournamentPointsSpent: number;
}

export interface PortraitPurchaseResult {
  ok: boolean;
  message: string;
  messageKey?: string;
  messageVars?: Record<string, string | number>;
  preferences: PortraitPreferences;
  purchased: boolean;
}

export const PORTRAIT_PREFERENCES_STORAGE_KEY = 'neon.holdem.portrait-preferences.v1';

const DEFAULT_PORTRAIT_PREFERENCES: PortraitPreferences = {
  humanPortraitKey: 'human-host',
  ownedPortraitKeys: [...STARTER_HUMAN_PORTRAIT_KEYS],
  tournamentPointsSpent: 0,
};

function isHumanPortraitKey(value: unknown): value is HumanPortraitKey {
  return typeof value === 'string' && HUMAN_PORTRAIT_KEYS.includes(value as HumanPortraitKey);
}

function uniquePortraitKeys(value: unknown, fallback: HumanPortraitKey[]): HumanPortraitKey[] {
  if (!Array.isArray(value)) {
    return [...fallback];
  }

  const normalized = [...new Set(value.filter((entry): entry is HumanPortraitKey => isHumanPortraitKey(entry)))];
  return normalized.length > 0 ? normalized : [...fallback];
}

function normalizePortraitPreferences(value: Partial<PortraitPreferences> | null | undefined): PortraitPreferences {
  const humanPortraitKey = isHumanPortraitKey(value?.humanPortraitKey) ? value.humanPortraitKey : DEFAULT_PORTRAIT_PREFERENCES.humanPortraitKey;
  const ownedPortraitKeys = uniquePortraitKeys(value?.ownedPortraitKeys, DEFAULT_PORTRAIT_PREFERENCES.ownedPortraitKeys);
  if (!ownedPortraitKeys.includes(humanPortraitKey)) {
    ownedPortraitKeys.unshift(humanPortraitKey);
  }

  return {
    humanPortraitKey,
    ownedPortraitKeys,
    tournamentPointsSpent: typeof value?.tournamentPointsSpent === 'number' && Number.isFinite(value.tournamentPointsSpent)
      ? Math.max(0, Math.round(value.tournamentPointsSpent))
      : 0,
  };
}

export function createDefaultPortraitPreferences(): PortraitPreferences {
  return normalizePortraitPreferences(DEFAULT_PORTRAIT_PREFERENCES);
}

export function isPortraitOwned(preferences: PortraitPreferences, key: HumanPortraitKey): boolean {
  return preferences.ownedPortraitKeys.includes(key);
}

export function selectHumanPortrait(preferences: PortraitPreferences, key: HumanPortraitKey): PortraitPreferences {
  if (!isPortraitOwned(preferences, key)) {
    return preferences;
  }
  return {
    ...preferences,
    humanPortraitKey: key,
  };
}

export function purchaseHumanPortrait(
  preferences: PortraitPreferences,
  availablePoints: number,
  key: HumanPortraitKey,
  unlockCost: number,
): PortraitPurchaseResult {
  if (isPortraitOwned(preferences, key)) {
    return {
      ok: true,
      message: `已切换为 ${key}。`,
      messageKey: 'shop.feedback.portraitSwitched',
      messageVars: { item: key },
      preferences: selectHumanPortrait(preferences, key),
      purchased: false,
    };
  }

  const cost = Math.max(0, Math.round(unlockCost));
  if (availablePoints < cost) {
    return {
      ok: false,
      message: `锦标赛积分不足，还需要 ${cost - availablePoints} 分。`,
      messageKey: 'shop.feedback.pointsShort',
      messageVars: { remaining: cost - availablePoints },
      preferences,
      purchased: false,
    };
  }

  return {
    ok: true,
    message: `已解锁并装备新皮肤，消耗 ${cost} 积分。`,
    messageKey: 'shop.feedback.portraitUnlocked',
    messageVars: { cost },
    preferences: {
      humanPortraitKey: key,
      ownedPortraitKeys: [...preferences.ownedPortraitKeys, key],
      tournamentPointsSpent: preferences.tournamentPointsSpent + cost,
    },
    purchased: true,
  };
}

export function readPortraitPreferences(): PortraitPreferences {
  if (typeof window === 'undefined') {
    return createDefaultPortraitPreferences();
  }

  try {
    const raw = window.localStorage.getItem(PORTRAIT_PREFERENCES_STORAGE_KEY);
    if (!raw) {
      return createDefaultPortraitPreferences();
    }

    const parsed = JSON.parse(raw) as Partial<PortraitPreferences>;
    return normalizePortraitPreferences(parsed);
  } catch {
    return createDefaultPortraitPreferences();
  }
}

export function writePortraitPreferences(preferences: PortraitPreferences): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(PORTRAIT_PREFERENCES_STORAGE_KEY, JSON.stringify(normalizePortraitPreferences(preferences)));
}
