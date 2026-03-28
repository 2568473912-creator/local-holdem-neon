import { CARD_SKIN_KEYS, CARD_SKIN_UNLOCK_COSTS, STARTER_CARD_SKIN_KEYS, type CardSkinKey } from '../types/cardSkin';

export const CARD_SKIN_STORAGE_KEY = 'neon.holdem.card-skin-preferences.v1';

export interface CardSkinPreferences {
  cardSkinKey: CardSkinKey;
  ownedCardSkinKeys: CardSkinKey[];
  tournamentPointsSpent: number;
}

export interface CardSkinPurchaseResult {
  ok: boolean;
  purchased: boolean;
  message: string;
  messageKey?: string;
  messageVars?: Record<string, string | number>;
  preferences: CardSkinPreferences;
}

export function createDefaultCardSkinPreferences(): CardSkinPreferences {
  return {
    cardSkinKey: STARTER_CARD_SKIN_KEYS[0],
    ownedCardSkinKeys: [...STARTER_CARD_SKIN_KEYS],
    tournamentPointsSpent: 0,
  };
}

function normalizeOwnedCardSkinKeys(keys: unknown): CardSkinKey[] {
  if (!Array.isArray(keys)) {
    return [...STARTER_CARD_SKIN_KEYS];
  }
  const valid = keys.filter((entry): entry is CardSkinKey => typeof entry === 'string' && CARD_SKIN_KEYS.includes(entry as CardSkinKey));
  const merged = new Set<CardSkinKey>([...STARTER_CARD_SKIN_KEYS, ...valid]);
  return [...merged];
}

export function readCardSkinPreferences(): CardSkinPreferences {
  if (typeof window === 'undefined') {
    return createDefaultCardSkinPreferences();
  }

  try {
    const raw = window.localStorage.getItem(CARD_SKIN_STORAGE_KEY);
    if (!raw) {
      return createDefaultCardSkinPreferences();
    }
    const parsed = JSON.parse(raw) as Partial<CardSkinPreferences> & { cardSkinKey?: string };
    const preferred = typeof parsed.cardSkinKey === 'string' && CARD_SKIN_KEYS.includes(parsed.cardSkinKey as CardSkinKey)
      ? (parsed.cardSkinKey as CardSkinKey)
      : STARTER_CARD_SKIN_KEYS[0];
    const owned = normalizeOwnedCardSkinKeys(
      preferred ? [...(Array.isArray(parsed.ownedCardSkinKeys) ? parsed.ownedCardSkinKeys : []), preferred] : parsed.ownedCardSkinKeys,
    );
    return {
      cardSkinKey: owned.includes(preferred) ? preferred : owned[0],
      ownedCardSkinKeys: owned,
      tournamentPointsSpent: Math.max(0, Number(parsed.tournamentPointsSpent ?? 0) || 0),
    };
  } catch {
    return createDefaultCardSkinPreferences();
  }
}

export function writeCardSkinPreferences(preferences: CardSkinPreferences) {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(CARD_SKIN_STORAGE_KEY, JSON.stringify(preferences));
}

export function isCardSkinOwned(preferences: CardSkinPreferences, key: CardSkinKey): boolean {
  return preferences.ownedCardSkinKeys.includes(key);
}

export function selectCardSkin(preferences: CardSkinPreferences, key: CardSkinKey): CardSkinPreferences {
  if (!isCardSkinOwned(preferences, key)) {
    return preferences;
  }
  return {
    ...preferences,
    cardSkinKey: key,
  };
}

export function purchaseCardSkin(
  preferences: CardSkinPreferences,
  availablePoints: number,
  key: CardSkinKey,
  unlockCost = CARD_SKIN_UNLOCK_COSTS[key],
): CardSkinPurchaseResult {
  if (isCardSkinOwned(preferences, key)) {
    return {
      ok: true,
      purchased: false,
      message: '该牌面皮肤已拥有，已为你切换。',
      messageKey: 'shop.feedback.cardSkinSwitched',
      preferences: selectCardSkin(preferences, key),
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

  const nextPreferences: CardSkinPreferences = {
    cardSkinKey: key,
    ownedCardSkinKeys: [...preferences.ownedCardSkinKeys, key],
    tournamentPointsSpent: preferences.tournamentPointsSpent + unlockCost,
  };

  return {
    ok: true,
    purchased: true,
    message: `已解锁并切换牌面皮肤，消耗 ${unlockCost} 积分。`,
    messageKey: 'shop.feedback.cardSkinUnlocked',
    messageVars: { cost: unlockCost },
    preferences: nextPreferences,
  };
}
