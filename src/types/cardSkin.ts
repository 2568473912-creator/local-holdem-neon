export const CARD_SKIN_KEYS = [
  'classic-court',
  'neon-royal',
  'velvet-opera',
  'jade-legends',
  'midnight-gala',
  'sunset-myth',
  'glacier-crest',
  'obsidian-lattice',
  'rose-atelier',
  'arcade-bloom',
  'onyx-regent',
  'mint-casino',
  'scarlet-ink',
] as const;

export type CardSkinKey = (typeof CARD_SKIN_KEYS)[number];

export const STARTER_CARD_SKIN_KEYS: CardSkinKey[] = ['classic-court'];

export const CARD_SKIN_UNLOCK_COSTS: Record<CardSkinKey, number> = {
  'classic-court': 0,
  'neon-royal': 140,
  'velvet-opera': 220,
  'jade-legends': 280,
  'midnight-gala': 320,
  'sunset-myth': 360,
  'glacier-crest': 420,
  'obsidian-lattice': 460,
  'rose-atelier': 500,
  'arcade-bloom': 540,
  'onyx-regent': 580,
  'mint-casino': 620,
  'scarlet-ink': 660,
};
