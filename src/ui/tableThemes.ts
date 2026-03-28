import type { AppLanguage } from '../i18n';
import { STARTER_TABLE_THEME_KEYS, TABLE_THEME_UNLOCK_COSTS, type TableThemeKey } from '../types/theme';

export interface TableThemeOption {
  key: TableThemeKey;
  title: string;
  shortLabel: string;
  eyebrow: string;
  description: string;
  unlockCost: number;
  starter: boolean;
  swatch: {
    felt: string;
    shell: string;
    accent: string;
    trim: string;
  };
}

const TABLE_THEME_OPTIONS: TableThemeOption[] = [
  {
    key: 'neon-ocean',
    title: '霓虹深海',
    shortLabel: '深海',
    eyebrow: '蓝青电感',
    description: '延续当前主视觉，偏冷色霓虹与会所电光。',
    unlockCost: TABLE_THEME_UNLOCK_COSTS['neon-ocean'],
    starter: (STARTER_TABLE_THEME_KEYS as readonly TableThemeKey[]).includes('neon-ocean'),
    swatch: {
      felt: 'linear-gradient(140deg, #0a6b58, #071f21)',
      shell: 'linear-gradient(145deg, #0d1a35, #070d18)',
      accent: '#42ebff',
      trim: '#f8cb6d',
    },
  },
  {
    key: 'noir-gold',
    title: '黑金高厅',
    shortLabel: '黑金',
    eyebrow: '奢华包厢',
    description: '更重金属感与暖金边饰，适合冠军演出和高厅氛围。',
    unlockCost: TABLE_THEME_UNLOCK_COSTS['noir-gold'],
    starter: false,
    swatch: {
      felt: 'linear-gradient(140deg, #53441d, #12110d)',
      shell: 'linear-gradient(145deg, #1b1408, #090805)',
      accent: '#f2c56b',
      trim: '#ffe8b1',
    },
  },
  {
    key: 'emerald-classic',
    title: '祖母绿毡',
    shortLabel: '绿毡',
    eyebrow: '经典牌房',
    description: '更接近传统扑克室的绿毡桌，但保留现代灯带和玻璃层。',
    unlockCost: TABLE_THEME_UNLOCK_COSTS['emerald-classic'],
    starter: (STARTER_TABLE_THEME_KEYS as readonly TableThemeKey[]).includes('emerald-classic'),
    swatch: {
      felt: 'linear-gradient(140deg, #167254, #071f18)',
      shell: 'linear-gradient(145deg, #0f231a, #08110d)',
      accent: '#8cffcc',
      trim: '#ebffb9',
    },
  },
  {
    key: 'crimson-royale',
    title: '绯红王座',
    shortLabel: '绯红',
    eyebrow: '戏剧高压',
    description: '红酒绒面和冷蓝边光对撞，更有舞台化和决战感。',
    unlockCost: TABLE_THEME_UNLOCK_COSTS['crimson-royale'],
    starter: false,
    swatch: {
      felt: 'linear-gradient(140deg, #6c1f34, #1a0a12)',
      shell: 'linear-gradient(145deg, #220d17, #0b0810)',
      accent: '#ff8ea8',
      trim: '#9fe6ff',
    },
  },
  {
    key: 'moonlit-ivory',
    title: '月白沙龙',
    shortLabel: '月白',
    eyebrow: '象牙月厅',
    description: '更亮的象牙壳层和冷月桌毡，适合强调牌面细节和人物卡。',
    unlockCost: TABLE_THEME_UNLOCK_COSTS['moonlit-ivory'],
    starter: false,
    swatch: {
      felt: 'linear-gradient(140deg, #65789b, #182235)',
      shell: 'linear-gradient(145deg, #ede6d5, #9ba8bd)',
      accent: '#cfe8ff',
      trim: '#fff7df',
    },
  },
  {
    key: 'violet-circuit',
    title: '紫域回路',
    shortLabel: '紫域',
    eyebrow: '电路剧场',
    description: '冷紫电路与亮蓝边光，层次更锋利，适合夜场视觉。',
    unlockCost: TABLE_THEME_UNLOCK_COSTS['violet-circuit'],
    starter: false,
    swatch: {
      felt: 'linear-gradient(140deg, #4c2b8f, #120d28)',
      shell: 'linear-gradient(145deg, #180f28, #0a0716)',
      accent: '#8bd5ff',
      trim: '#f0c6ff',
    },
  },
  {
    key: 'amber-vault',
    title: '琥珀金库',
    shortLabel: '琥珀',
    eyebrow: '金库灯厅',
    description: '暖琥珀桌毡和铜金边框，更偏厚重实体感和筹码质感。',
    unlockCost: TABLE_THEME_UNLOCK_COSTS['amber-vault'],
    starter: false,
    swatch: {
      felt: 'linear-gradient(140deg, #8a5a10, #1c0e04)',
      shell: 'linear-gradient(145deg, #241408, #0d0704)',
      accent: '#ffb020',
      trim: '#fff4c0',
    },
  },
  {
    key: 'sapphire-lounge',
    title: '蓝宝沙龙',
    shortLabel: '蓝宝',
    eyebrow: '冷焰套厅',
    description: '更偏蓝钢与银光的高层包厢，人物卡和白色牌面反差更强。',
    unlockCost: TABLE_THEME_UNLOCK_COSTS['sapphire-lounge'],
    starter: false,
    swatch: {
      felt: 'linear-gradient(140deg, #1a3d6e, #0a1222)',
      shell: 'linear-gradient(145deg, #0e1c30, #060a10)',
      accent: '#50c8ff',
      trim: '#c8ecff',
    },
  },
  {
    key: 'pearl-sunset',
    title: '珍珠晚照',
    shortLabel: '晚照',
    eyebrow: '暖白会所',
    description: '奶白壳层与暖金桌毡，更适合柔和牌面和亮色人物形象。',
    unlockCost: TABLE_THEME_UNLOCK_COSTS['pearl-sunset'],
    starter: false,
    swatch: {
      felt: 'linear-gradient(140deg, #a06f48, #271a15)',
      shell: 'linear-gradient(145deg, #f0e4d7, #b8a696)',
      accent: '#ffd4a3',
      trim: '#fff7ec',
    },
  },
  {
    key: 'cinder-club',
    title: '灰烬会所',
    shortLabel: '灰烬',
    eyebrow: '熔芯包厢',
    description: '炭黑外壳、熔铜灯线和偏红桌毡，更适合强戏剧感人物和暖调牌面。',
    unlockCost: TABLE_THEME_UNLOCK_COSTS['cinder-club'],
    starter: false,
    swatch: {
      felt: 'linear-gradient(140deg, #3e1e10, #120a0a)',
      shell: 'linear-gradient(145deg, #181312, #080706)',
      accent: '#ff6030',
      trim: '#ffe8c0',
    },
  },
  {
    key: 'aurora-frost',
    title: '极光冰穹',
    shortLabel: '极光',
    eyebrow: '冷极大厅',
    description: '极光蓝绿与冰白壳层，整体更清透，牌面和人物卡边界更清晰。',
    unlockCost: TABLE_THEME_UNLOCK_COSTS['aurora-frost'],
    starter: false,
    swatch: {
      felt: 'linear-gradient(140deg, #1f6f71, #0c1e2a)',
      shell: 'linear-gradient(145deg, #dfeff6, #8aa7b8)',
      accent: '#8ff5e4',
      trim: '#e9fbff',
    },
  },
  {
    key: 'royal-plum',
    title: '皇室梅影',
    shortLabel: '梅影',
    eyebrow: '夜宴长廊',
    description: '深紫绒面配冷金线条，适合突出人像和结算演出。',
    unlockCost: TABLE_THEME_UNLOCK_COSTS['royal-plum'],
    starter: false,
    swatch: {
      felt: 'linear-gradient(140deg, #5e2060, #160a18)',
      shell: 'linear-gradient(145deg, #241028, #0a070e)',
      accent: '#e890ff',
      trim: '#ffd080',
    },
  },
  {
    key: 'bronze-harbor',
    title: '钢铁深港',
    shortLabel: '钢港',
    eyebrow: '钢铁工业',
    description: '钢铁蓝与工业银边，筹码质感更厚重，对战节奏更硬。',
    unlockCost: TABLE_THEME_UNLOCK_COSTS['bronze-harbor'],
    starter: false,
    swatch: {
      felt: 'linear-gradient(140deg, #243858, #0e1420)',
      shell: 'linear-gradient(145deg, #141c2a, #070b12)',
      accent: '#78c0e8',
      trim: '#d8ecf8',
    },
  },
];

const TABLE_THEME_LOCALIZATION: Record<TableThemeKey, { title: string; shortLabel: string; eyebrow: string; description: string }> = {
  'neon-ocean': { title: 'Neon Ocean', shortLabel: 'Ocean', eyebrow: 'Blue Current', description: 'Cold neon currents and club lighting based on the main visual theme.' },
  'noir-gold': { title: 'Noir Gold', shortLabel: 'Noir', eyebrow: 'VIP Room', description: 'Warm gold trim and heavier metal texture for a premium room feel.' },
  'emerald-classic': { title: 'Emerald Classic', shortLabel: 'Emerald', eyebrow: 'Card Room', description: 'Traditional green felt with modern light bars and glass layers.' },
  'crimson-royale': { title: 'Crimson Royale', shortLabel: 'Crimson', eyebrow: 'Stage Heat', description: 'Red velvet, cold blue rim-light, and a stronger showdown mood.' },
  'moonlit-ivory': { title: 'Moonlit Ivory', shortLabel: 'Ivory', eyebrow: 'Moon Salon', description: 'Bright ivory shell layers for sharper card and portrait contrast.' },
  'violet-circuit': { title: 'Violet Circuit', shortLabel: 'Violet', eyebrow: 'Circuit Hall', description: 'Sharper electric purple styling tuned for night-session visuals.' },
  'amber-vault': { title: 'Amber Vault', shortLabel: 'Amber', eyebrow: 'Vault Deck', description: 'Warm amber felt and bronze trim with heavier chip presence.' },
  'sapphire-lounge': { title: 'Sapphire Lounge', shortLabel: 'Sapphire', eyebrow: 'Blue Suite', description: 'Blue-steel lounge styling with stronger contrast on white cards.' },
  'pearl-sunset': { title: 'Pearl Sunset', shortLabel: 'Pearl', eyebrow: 'Warm Club', description: 'Cream shell layers and warm felt for softer tableside visuals.' },
  'cinder-club': { title: 'Cinder Club', shortLabel: 'Cinder', eyebrow: 'Molten Booth', description: 'Charcoal shell, copper light, and warmer dramatic table tones.' },
  'aurora-frost': { title: 'Aurora Frost', shortLabel: 'Aurora', eyebrow: 'Polar Hall', description: 'Aurora teal and icy shell layers for clearer table edges.' },
  'royal-plum': { title: 'Royal Plum', shortLabel: 'Plum', eyebrow: 'Night Banquet', description: 'Dark plum velvet with cold gold accents for portrait-forward play.' },
  'bronze-harbor': { title: 'Steel Harbor', shortLabel: 'Steel', eyebrow: 'Industrial Dock', description: 'Steel-navy decking with industrial silver edges and a heavier chip presence.' },
};

function localizeTableTheme(option: TableThemeOption, language?: AppLanguage): TableThemeOption {
  if (!language || language === 'zh-CN') {
    return option;
  }
  return {
    ...option,
    ...TABLE_THEME_LOCALIZATION[option.key],
  };
}

export function getTableThemeOptions(language?: AppLanguage): TableThemeOption[] {
  return TABLE_THEME_OPTIONS.map((option) => localizeTableTheme(option, language));
}

export function getTableThemeOption(key: TableThemeKey, language?: AppLanguage): TableThemeOption {
  return localizeTableTheme(TABLE_THEME_OPTIONS.find((option) => option.key === key) ?? TABLE_THEME_OPTIONS[0], language);
}
