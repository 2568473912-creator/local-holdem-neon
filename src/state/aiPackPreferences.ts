import { AI_PACK_KEYS, STARTER_AI_PACK_KEYS, type AIPackKey } from '../types/aiPack';

export interface AIPackPreferences {
  aiPackKey: AIPackKey;
  ownedAiPackKeys: AIPackKey[];
  tournamentPointsSpent: number;
}

export interface AIPackPurchaseResult {
  ok: boolean;
  purchased: boolean;
  message: string;
  messageKey?: string;
  messageVars?: Record<string, string | number>;
  preferences: AIPackPreferences;
}

export const AI_PACK_STORAGE_KEY = 'neon.holdem.ai-pack-preferences.v1';

export function createDefaultAIPackPreferences(): AIPackPreferences {
  return {
    aiPackKey: STARTER_AI_PACK_KEYS[0],
    ownedAiPackKeys: [...STARTER_AI_PACK_KEYS],
    tournamentPointsSpent: 0,
  };
}

function normalizeOwnedAiPackKeys(value: unknown): AIPackKey[] {
  if (!Array.isArray(value)) {
    return [...STARTER_AI_PACK_KEYS];
  }
  const valid = value.filter((entry): entry is AIPackKey => typeof entry === 'string' && AI_PACK_KEYS.includes(entry as AIPackKey));
  return [...new Set<AIPackKey>([...STARTER_AI_PACK_KEYS, ...valid])];
}

export function readAIPackPreferences(): AIPackPreferences {
  if (typeof window === 'undefined') {
    return createDefaultAIPackPreferences();
  }

  try {
    const raw = window.localStorage.getItem(AI_PACK_STORAGE_KEY);
    if (!raw) {
      return createDefaultAIPackPreferences();
    }
    const parsed = JSON.parse(raw) as Partial<AIPackPreferences> & { aiPackKey?: string };
    const preferred = typeof parsed.aiPackKey === 'string' && AI_PACK_KEYS.includes(parsed.aiPackKey as AIPackKey)
      ? (parsed.aiPackKey as AIPackKey)
      : STARTER_AI_PACK_KEYS[0];
    const owned = normalizeOwnedAiPackKeys(
      preferred ? [...(Array.isArray(parsed.ownedAiPackKeys) ? parsed.ownedAiPackKeys : []), preferred] : parsed.ownedAiPackKeys,
    );
    return {
      aiPackKey: owned.includes(preferred) ? preferred : owned[0],
      ownedAiPackKeys: owned,
      tournamentPointsSpent: Math.max(0, Number(parsed.tournamentPointsSpent ?? 0) || 0),
    };
  } catch {
    return createDefaultAIPackPreferences();
  }
}

export function writeAIPackPreferences(preferences: AIPackPreferences) {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(AI_PACK_STORAGE_KEY, JSON.stringify(preferences));
}

export function isAIPackOwned(preferences: AIPackPreferences, key: AIPackKey): boolean {
  return preferences.ownedAiPackKeys.includes(key);
}

export function selectAIPack(preferences: AIPackPreferences, key: AIPackKey): AIPackPreferences {
  if (!isAIPackOwned(preferences, key)) {
    return preferences;
  }
  return {
    ...preferences,
    aiPackKey: key,
  };
}

export function purchaseAIPack(
  preferences: AIPackPreferences,
  availablePoints: number,
  key: AIPackKey,
  unlockCost: number,
): AIPackPurchaseResult {
  if (isAIPackOwned(preferences, key)) {
    return {
      ok: true,
      purchased: false,
      message: '该 AI 形象包已拥有，已为你切换。',
      messageKey: 'shop.feedback.aiPackSwitched',
      preferences: selectAIPack(preferences, key),
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
    message: `已解锁并切换 AI 形象包，消耗 ${unlockCost} 积分。`,
    messageKey: 'shop.feedback.aiPackUnlocked',
    messageVars: { cost: unlockCost },
    preferences: {
      aiPackKey: key,
      ownedAiPackKeys: [...preferences.ownedAiPackKeys, key],
      tournamentPointsSpent: preferences.tournamentPointsSpent + unlockCost,
    },
  };
}
