export const TABLE_THEME_KEYS = [
  'neon-ocean',
  'noir-gold',
  'emerald-classic',
  'crimson-royale',
  'moonlit-ivory',
  'violet-circuit',
  'amber-vault',
  'sapphire-lounge',
  'pearl-sunset',
  'cinder-club',
  'aurora-frost',
  'royal-plum',
  'bronze-harbor',
] as const;

export type TableThemeKey = (typeof TABLE_THEME_KEYS)[number];

export const STARTER_TABLE_THEME_KEYS = ['neon-ocean', 'emerald-classic'] as const satisfies readonly TableThemeKey[];

export const TABLE_THEME_UNLOCK_COSTS: Record<TableThemeKey, number> = {
  'neon-ocean': 0,
  'noir-gold': 180,
  'emerald-classic': 0,
  'crimson-royale': 260,
  'moonlit-ivory': 280,
  'violet-circuit': 320,
  'amber-vault': 360,
  'sapphire-lounge': 400,
  'pearl-sunset': 440,
  'cinder-club': 480,
  'aurora-frost': 520,
  'royal-plum': 560,
  'bronze-harbor': 600,
};
