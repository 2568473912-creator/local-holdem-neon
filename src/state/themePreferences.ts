import { STARTER_TABLE_THEME_KEYS, TABLE_THEME_KEYS, type TableThemeKey } from '../types/theme';

export interface ThemePreferences {
  tableThemeKey: TableThemeKey;
  ownedThemeKeys: TableThemeKey[];
  tournamentPointsSpent: number;
}

export interface ThemePurchaseResult {
  ok: boolean;
  message: string;
  messageKey?: string;
  messageVars?: Record<string, string | number>;
  preferences: ThemePreferences;
  purchased: boolean;
}

export const THEME_PREFERENCES_STORAGE_KEY = 'neon.holdem.theme-preferences.v1';

const DEFAULT_THEME_PREFERENCES: ThemePreferences = {
  tableThemeKey: 'neon-ocean',
  ownedThemeKeys: [...STARTER_TABLE_THEME_KEYS],
  tournamentPointsSpent: 0,
};

function isTableThemeKey(value: unknown): value is TableThemeKey {
  return typeof value === 'string' && TABLE_THEME_KEYS.includes(value as TableThemeKey);
}

function uniqueThemeKeys(value: unknown, fallback: TableThemeKey[]): TableThemeKey[] {
  if (!Array.isArray(value)) {
    return [...fallback];
  }
  const normalized = [...new Set(value.filter((entry): entry is TableThemeKey => isTableThemeKey(entry)))];
  return normalized.length > 0 ? normalized : [...fallback];
}

function normalizeThemePreferences(value: Partial<ThemePreferences> | null | undefined): ThemePreferences {
  const tableThemeKey = isTableThemeKey(value?.tableThemeKey) ? value.tableThemeKey : DEFAULT_THEME_PREFERENCES.tableThemeKey;
  const ownedThemeKeys = uniqueThemeKeys(value?.ownedThemeKeys, DEFAULT_THEME_PREFERENCES.ownedThemeKeys);
  if (!ownedThemeKeys.includes(tableThemeKey)) {
    ownedThemeKeys.unshift(tableThemeKey);
  }

  return {
    tableThemeKey,
    ownedThemeKeys,
    tournamentPointsSpent:
      typeof value?.tournamentPointsSpent === 'number' && Number.isFinite(value.tournamentPointsSpent)
        ? Math.max(0, Math.round(value.tournamentPointsSpent))
        : 0,
  };
}

export function createDefaultThemePreferences(): ThemePreferences {
  return normalizeThemePreferences(DEFAULT_THEME_PREFERENCES);
}

export function readThemePreferences(): ThemePreferences {
  if (typeof window === 'undefined') {
    return createDefaultThemePreferences();
  }

  try {
    const raw = window.localStorage.getItem(THEME_PREFERENCES_STORAGE_KEY);
    if (!raw) {
      return createDefaultThemePreferences();
    }
    const parsed = JSON.parse(raw) as Partial<ThemePreferences>;
    return normalizeThemePreferences(parsed);
  } catch {
    return createDefaultThemePreferences();
  }
}

export function writeThemePreferences(preferences: ThemePreferences): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(THEME_PREFERENCES_STORAGE_KEY, JSON.stringify(normalizeThemePreferences(preferences)));
}

export function isThemeOwned(preferences: ThemePreferences, key: TableThemeKey): boolean {
  return preferences.ownedThemeKeys.includes(key);
}

export function selectTableTheme(preferences: ThemePreferences, key: TableThemeKey): ThemePreferences {
  if (!isThemeOwned(preferences, key)) {
    return preferences;
  }
  return {
    ...preferences,
    tableThemeKey: key,
  };
}

export function purchaseTableTheme(
  preferences: ThemePreferences,
  availablePoints: number,
  key: TableThemeKey,
  unlockCost: number,
): ThemePurchaseResult {
  if (isThemeOwned(preferences, key)) {
    return {
      ok: true,
      message: `已切换为 ${key} 主题。`,
      messageKey: 'shop.feedback.themeSwitched',
      messageVars: { item: key },
      preferences: selectTableTheme(preferences, key),
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
    message: `已解锁并切换牌桌主题，消耗 ${cost} 积分。`,
    messageKey: 'shop.feedback.themeUnlocked',
    messageVars: { cost },
    preferences: {
      tableThemeKey: key,
      ownedThemeKeys: [...preferences.ownedThemeKeys, key],
      tournamentPointsSpent: preferences.tournamentPointsSpent + cost,
    },
    purchased: true,
  };
}

export function cycleOwnedTableTheme(current: TableThemeKey, owned: TableThemeKey[]): TableThemeKey {
  const safeOwned = owned.filter((key): key is TableThemeKey => isTableThemeKey(key));
  if (safeOwned.length === 0) {
    return current;
  }
  const index = safeOwned.indexOf(current);
  if (index < 0) {
    return safeOwned[0];
  }
  return safeOwned[(index + 1) % safeOwned.length];
}
