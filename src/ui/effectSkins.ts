import type { AppLanguage } from '../i18n';
import { EFFECT_SKIN_UNLOCK_COSTS, type EffectSkinKey } from '../types/effectSkin';

export interface EffectSkinOption {
  key: EffectSkinKey;
  title: string;
  eyebrow: string;
  description: string;
  starter: boolean;
  unlockCost: number;
  previewLabel: string;
  motif: 'classic' | 'comet' | 'ember' | 'lotus' | 'prism' | 'gilded' | 'void';
  tier: 'starter' | 'club' | 'premium' | 'mythic' | 'collector' | 'legend';
  palette: {
    primary: string;
    secondary: string;
    glow: string;
    spark: string;
    chip: string;
  };
}

const OPTIONS: EffectSkinOption[] = [
  {
    key: 'club-classic',
    title: '会所标准',
    eyebrow: 'Starter',
    description: '稳重的金蓝脉冲，适合默认桌面和长期游玩。',
    starter: true,
    unlockCost: EFFECT_SKIN_UNLOCK_COSTS['club-classic'],
    previewLabel: '标准入池',
    motif: 'classic',
    tier: 'starter',
    palette: {
      primary: '#47d2ff',
      secondary: '#f0cb73',
      glow: 'rgba(71, 210, 255, 0.24)',
      spark: '#eff8ff',
      chip: '#f5c86f',
    },
  },
  {
    key: 'neon-comet',
    title: '霓虹彗尾',
    eyebrow: 'Club Line',
    description: '电紫彗尾与冷蓝残影，粒子轨迹更锐利，节奏快速局面专属。',
    starter: false,
    unlockCost: EFFECT_SKIN_UNLOCK_COSTS['neon-comet'],
    previewLabel: '彗尾飞入',
    motif: 'comet',
    tier: 'club',
    palette: {
      primary: '#a060ff',
      secondary: '#40e8ff',
      glow: 'rgba(160, 96, 255, 0.30)',
      spark: '#f0e8ff',
      chip: '#c890ff',
    },
  },
  {
    key: 'ember-strike',
    title: '炽焰重击',
    eyebrow: 'Premium',
    description: '橙红爆震和热浪火花，适合炸弹、王炸和重注入池。',
    starter: false,
    unlockCost: EFFECT_SKIN_UNLOCK_COSTS['ember-strike'],
    previewLabel: '爆震重击',
    motif: 'ember',
    tier: 'premium',
    palette: {
      primary: '#ff8055',
      secondary: '#ffcb73',
      glow: 'rgba(255, 128, 85, 0.28)',
      spark: '#fff1d7',
      chip: '#ffb459',
    },
  },
  {
    key: 'lotus-dream',
    title: '莲辉梦幕',
    eyebrow: 'Mythic',
    description: '青粉流光和柔性花瓣粒子，适合人物卡和典雅桌面。',
    starter: false,
    unlockCost: EFFECT_SKIN_UNLOCK_COSTS['lotus-dream'],
    previewLabel: '花幕舒展',
    motif: 'lotus',
    tier: 'mythic',
    palette: {
      primary: '#8ae5c7',
      secondary: '#f4a6d7',
      glow: 'rgba(138, 229, 199, 0.26)',
      spark: '#fff3fb',
      chip: '#b9f0d7',
    },
  },
  {
    key: 'prism-pulse',
    title: '棱镜脉冲',
    eyebrow: 'Collector',
    description: '多层折射和冷暖交替脉冲，适合摊牌和胜者扫光。',
    starter: false,
    unlockCost: EFFECT_SKIN_UNLOCK_COSTS['prism-pulse'],
    previewLabel: '棱镜折射',
    motif: 'prism',
    tier: 'collector',
    palette: {
      primary: '#ff6ed0',
      secondary: '#40ffb0',
      glow: 'rgba(255, 110, 208, 0.28)',
      spark: '#ffffff',
      chip: '#ffb0e8',
    },
  },
  {
    key: 'gilded-burst',
    title: '鎏金礼炮',
    eyebrow: 'Legend',
    description: '带金叶碎片和礼炮轨迹的高阶特效，适合高积分主题和结算瞬间。',
    starter: false,
    unlockCost: EFFECT_SKIN_UNLOCK_COSTS['gilded-burst'],
    previewLabel: '礼炮入池',
    motif: 'gilded',
    tier: 'legend',
    palette: {
      primary: '#ffd980',
      secondary: '#a46cff',
      glow: 'rgba(255, 217, 128, 0.3)',
      spark: '#fff8dc',
      chip: '#f4c06d',
    },
  },
  {
    key: 'void-sigil',
    title: '虚空印记',
    eyebrow: 'Mythic+',
    description: '更深的黑曜印章和裂缝辉光，适合收藏级桌面与终局演出。',
    starter: false,
    unlockCost: EFFECT_SKIN_UNLOCK_COSTS['void-sigil'],
    previewLabel: '裂隙开印',
    motif: 'void',
    tier: 'legend',
    palette: {
      primary: '#8b8dff',
      secondary: '#5df3d5',
      glow: 'rgba(98, 114, 255, 0.28)',
      spark: '#e8f7ff',
      chip: '#77c9ff',
    },
  },
];

const EFFECT_SKIN_LOCALIZATION: Record<EffectSkinKey, { title: string; eyebrow: string; description: string; previewLabel: string }> = {
  'club-classic': { title: 'Club Classic', eyebrow: 'Starter', description: 'Steady gold-blue pulses for default tables and long sessions.', previewLabel: 'Standard Pot Trail' },
  'neon-comet': { title: 'Neon Comet', eyebrow: 'Club Line', description: 'Longer blue-violet comet tails for faster table pacing.', previewLabel: 'Comet Entry' },
  'ember-strike': { title: 'Ember Strike', eyebrow: 'Premium', description: 'Orange-red shock bursts for bombs, rockets, and heavy pots.', previewLabel: 'Shock Burst' },
  'lotus-dream': { title: 'Lotus Dream', eyebrow: 'Mythic', description: 'Soft petals and jade-pink glows for elegant tables.', previewLabel: 'Lotus Bloom' },
  'prism-pulse': { title: 'Prism Pulse', eyebrow: 'Collector', description: 'Layered refraction for showdown and winner spotlight moments.', previewLabel: 'Prism Refraction' },
  'gilded-burst': { title: 'Gilded Burst', eyebrow: 'Legend', description: 'Gold-leaf bursts and ceremonial trails for high-tier moments.', previewLabel: 'Ceremonial Pot Drop' },
  'void-sigil': { title: 'Void Sigil', eyebrow: 'Mythic+', description: 'Obsidian glyph rings and split-light trails for collector tables.', previewLabel: 'Void Seal' },
};

function localizeEffectSkin(option: EffectSkinOption, language?: AppLanguage): EffectSkinOption {
  if (!language || language === 'zh-CN') {
    return option;
  }
  return {
    ...option,
    ...EFFECT_SKIN_LOCALIZATION[option.key],
  };
}

export function getEffectSkinOptions(language?: AppLanguage): EffectSkinOption[] {
  return OPTIONS.map((option) => localizeEffectSkin(option, language));
}

export function getEffectSkinOption(key: EffectSkinKey, language?: AppLanguage): EffectSkinOption {
  return localizeEffectSkin(OPTIONS.find((option) => option.key === key) ?? OPTIONS[0], language);
}
