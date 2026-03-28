export const AI_PACK_KEYS = ['club-core', 'midnight-syndicate', 'jade-circuit', 'sunset-raiders', 'royal-opera', 'signal-run'] as const;

export type AIPackKey = (typeof AI_PACK_KEYS)[number];

export const STARTER_AI_PACK_KEYS = ['club-core'] as const satisfies readonly AIPackKey[];

export const AI_PACK_UNLOCK_COSTS: Record<AIPackKey, number> = {
  'club-core': 0,
  'midnight-syndicate': 180,
  'jade-circuit': 240,
  'sunset-raiders': 320,
  'royal-opera': 420,
  'signal-run': 560,
};
