export const EFFECT_SKIN_KEYS = [
  'club-classic',
  'neon-comet',
  'ember-strike',
  'lotus-dream',
  'prism-pulse',
  'gilded-burst',
  'void-sigil',
] as const;

export type EffectSkinKey = (typeof EFFECT_SKIN_KEYS)[number];

export const STARTER_EFFECT_SKIN_KEYS: EffectSkinKey[] = ['club-classic'];

export const EFFECT_SKIN_UNLOCK_COSTS: Record<EffectSkinKey, number> = {
  'club-classic': 0,
  'neon-comet': 160,
  'ember-strike': 240,
  'lotus-dream': 320,
  'prism-pulse': 420,
  'gilded-burst': 520,
  'void-sigil': 620,
};
