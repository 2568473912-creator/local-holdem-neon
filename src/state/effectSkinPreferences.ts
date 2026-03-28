import { EFFECT_SKIN_KEYS, EFFECT_SKIN_UNLOCK_COSTS, STARTER_EFFECT_SKIN_KEYS, type EffectSkinKey } from '../types/effectSkin';

export const EFFECT_SKIN_STORAGE_KEY = 'neon.holdem.effect-skin-preferences.v1';

export interface EffectSkinPreferences {
  effectSkinKey: EffectSkinKey;
  ownedEffectSkinKeys: EffectSkinKey[];
  tournamentPointsSpent: number;
}

export interface EffectSkinPurchaseResult {
  ok: boolean;
  purchased: boolean;
  message: string;
  messageKey?: string;
  messageVars?: Record<string, string | number>;
  preferences: EffectSkinPreferences;
}

export function createDefaultEffectSkinPreferences(): EffectSkinPreferences {
  return {
    effectSkinKey: STARTER_EFFECT_SKIN_KEYS[0],
    ownedEffectSkinKeys: [...STARTER_EFFECT_SKIN_KEYS],
    tournamentPointsSpent: 0,
  };
}

function normalizeOwnedEffectSkinKeys(value: unknown): EffectSkinKey[] {
  if (!Array.isArray(value)) {
    return [...STARTER_EFFECT_SKIN_KEYS];
  }
  const valid = value.filter((entry): entry is EffectSkinKey => typeof entry === 'string' && EFFECT_SKIN_KEYS.includes(entry as EffectSkinKey));
  return [...new Set<EffectSkinKey>([...STARTER_EFFECT_SKIN_KEYS, ...valid])];
}

export function readEffectSkinPreferences(): EffectSkinPreferences {
  if (typeof window === 'undefined') {
    return createDefaultEffectSkinPreferences();
  }

  try {
    const raw = window.localStorage.getItem(EFFECT_SKIN_STORAGE_KEY);
    if (!raw) {
      return createDefaultEffectSkinPreferences();
    }
    const parsed = JSON.parse(raw) as Partial<EffectSkinPreferences> & { effectSkinKey?: string };
    const preferred =
      typeof parsed.effectSkinKey === 'string' && EFFECT_SKIN_KEYS.includes(parsed.effectSkinKey as EffectSkinKey)
        ? (parsed.effectSkinKey as EffectSkinKey)
        : STARTER_EFFECT_SKIN_KEYS[0];
    const owned = normalizeOwnedEffectSkinKeys(
      preferred ? [...(Array.isArray(parsed.ownedEffectSkinKeys) ? parsed.ownedEffectSkinKeys : []), preferred] : parsed.ownedEffectSkinKeys,
    );
    return {
      effectSkinKey: owned.includes(preferred) ? preferred : owned[0],
      ownedEffectSkinKeys: owned,
      tournamentPointsSpent: Math.max(0, Number(parsed.tournamentPointsSpent ?? 0) || 0),
    };
  } catch {
    return createDefaultEffectSkinPreferences();
  }
}

export function writeEffectSkinPreferences(preferences: EffectSkinPreferences) {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(EFFECT_SKIN_STORAGE_KEY, JSON.stringify(preferences));
}

export function isEffectSkinOwned(preferences: EffectSkinPreferences, key: EffectSkinKey): boolean {
  return preferences.ownedEffectSkinKeys.includes(key);
}

export function selectEffectSkin(preferences: EffectSkinPreferences, key: EffectSkinKey): EffectSkinPreferences {
  if (!isEffectSkinOwned(preferences, key)) {
    return preferences;
  }
  return {
    ...preferences,
    effectSkinKey: key,
  };
}

export function purchaseEffectSkin(
  preferences: EffectSkinPreferences,
  availablePoints: number,
  key: EffectSkinKey,
  unlockCost = EFFECT_SKIN_UNLOCK_COSTS[key],
): EffectSkinPurchaseResult {
  if (isEffectSkinOwned(preferences, key)) {
    return {
      ok: true,
      purchased: false,
      message: '该特效包已拥有，已为你切换。',
      messageKey: 'shop.feedback.effectSkinSwitched',
      preferences: selectEffectSkin(preferences, key),
    };
  }

  if (availablePoints < unlockCost) {
    return {
      ok: false,
      purchased: false,
      message: `积分不足，还需要 ${unlockCost - availablePoints} 积分。`,
      messageKey: 'shop.feedback.pointsShort',
      messageVars: { remaining: unlockCost - availablePoints },
      preferences,
    };
  }

  return {
    ok: true,
    purchased: true,
    message: `已解锁并切换出牌特效，消耗 ${unlockCost} 积分。`,
    messageKey: 'shop.feedback.effectSkinUnlocked',
    messageVars: { cost: unlockCost },
    preferences: {
      effectSkinKey: key,
      ownedEffectSkinKeys: [...preferences.ownedEffectSkinKeys, key],
      tournamentPointsSpent: preferences.tournamentPointsSpent + unlockCost,
    },
  };
}
