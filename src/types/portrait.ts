export const HUMAN_PORTRAIT_KEYS = [
  'human-host',
  'human-comet',
  'human-orbit',
  'human-noir',
  'human-ember',
  'human-raven',
  'human-lotus',
  'human-cipher',
  'human-sable',
  'human-mistral',
  'human-velvet',
  'human-summit',
] as const;

export type HumanPortraitKey = (typeof HUMAN_PORTRAIT_KEYS)[number];

export const STARTER_HUMAN_PORTRAIT_KEYS = ['human-host', 'human-comet', 'human-orbit'] as const satisfies readonly HumanPortraitKey[];

export const HUMAN_PORTRAIT_UNLOCK_COSTS: Record<HumanPortraitKey, number> = {
  'human-host': 0,
  'human-comet': 0,
  'human-orbit': 0,
  'human-noir': 120,
  'human-ember': 150,
  'human-raven': 180,
  'human-lotus': 220,
  'human-cipher': 260,
  'human-sable': 300,
  'human-mistral': 340,
  'human-velvet': 380,
  'human-summit': 440,
};
