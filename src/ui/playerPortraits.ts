import type { AppLanguage } from '../i18n';
import type { CSSProperties } from 'react';
import type { PlayerState, PlayerStyle } from '../types/game';
import { HUMAN_PORTRAIT_UNLOCK_COSTS, STARTER_HUMAN_PORTRAIT_KEYS, type HumanPortraitKey } from '../types/portrait';

export interface PortraitSubject {
  id: string;
  name: string;
  style: PlayerStyle;
  isHuman: boolean;
  portraitKey?: HumanPortraitKey;
}

export type PortraitHairStyle = 'slick' | 'swept' | 'bob' | 'wave' | 'short' | 'fade' | 'quiff';
export type PortraitAccessory = 'none' | 'earpiece' | 'monocle' | 'visor' | 'dealer' | 'shades' | 'headset';
export type PortraitMark = 'none' | 'scar' | 'stripe' | 'mole';
export type PortraitFacialHair = 'none' | 'stubble' | 'goatee';
export type PortraitFigure = 'tailored' | 'broad' | 'poised' | 'agile';
export type PortraitBackdrop = 'halo' | 'grid' | 'rays' | 'curtain';

export interface PortraitArt {
  skin: string;
  skinShadow: string;
  hair: string;
  hairShade: string;
  jacket: string;
  jacketShade: string;
  shirt: string;
  accent: string;
  eye: string;
  lip: string;
  hairStyle: PortraitHairStyle;
  accessory: PortraitAccessory;
  mark: PortraitMark;
  facialHair: PortraitFacialHair;
  figure: PortraitFigure;
  backdrop: PortraitBackdrop;
}

export interface PlayerPortrait {
  key: string;
  title: string;
  sigil: string;
  ornament: 'crown' | 'spade' | 'diamond' | 'club' | 'heart' | 'star' | 'bolt' | 'wave';
  art: PortraitArt;
  styleVars: CSSProperties;
}

export interface HumanPortraitOption extends PlayerPortrait {
  description: string;
  unlockCost: number;
  starter: boolean;
}

export type PlayerPortraitMood = 'calm' | 'focused' | 'thinking' | 'checking' | 'calling' | 'raising' | 'all-in' | 'folded' | 'winner' | 'busted';

type PortraitPreset = Omit<PlayerPortrait, 'styleVars'> & {
  colors: {
    shell: string;
    glow: string;
    rim: string;
    glyph: string;
  };
};

function buildArt(overrides: Partial<PortraitArt> & Pick<PortraitArt, 'skin' | 'skinShadow' | 'hair' | 'hairShade' | 'jacket' | 'jacketShade' | 'shirt' | 'accent'>): PortraitArt {
  return {
    eye: '#eaf7ff',
    lip: 'rgba(129, 73, 81, 0.75)',
    hairStyle: 'slick',
    accessory: 'none',
    mark: 'none',
    facialHair: 'none',
    figure: 'tailored',
    backdrop: 'halo',
    ...overrides,
  };
}

const HUMAN_PRESETS: Record<HumanPortraitKey, PortraitPreset & { description: string }> = {
  'human-host': {
    key: 'human-host',
    title: '牌桌主理人',
    sigil: '你',
    ornament: 'crown',
    description: '黑金主场风，稳重、核心、默认主题。',
    art: buildArt({
      skin: '#ecc2a2',
      skinShadow: '#c18b6f',
      hair: '#1d1a20',
      hairShade: '#423842',
      jacket: '#182234',
      jacketShade: '#0a111b',
      shirt: '#f0e7d7',
      accent: '#dfb35a',
      hairStyle: 'slick',
      accessory: 'dealer',
      mark: 'mole',
      figure: 'broad',
      backdrop: 'rays',
    }),
    colors: {
      shell: 'linear-gradient(145deg, rgba(255, 214, 124, 0.92), rgba(142, 94, 24, 0.9))',
      glow: 'rgba(255, 212, 112, 0.42)',
      rim: 'rgba(255, 226, 159, 0.84)',
      glyph: '#fff1cc',
    },
  },
  'human-comet': {
    key: 'human-comet',
    title: '彗光领航',
    sigil: '彗',
    ornament: 'bolt',
    description: '冷蓝电弧风，更偏进攻与速度感。',
    art: buildArt({
      skin: '#f0c9ab',
      skinShadow: '#c78e72',
      hair: '#f4f9ff',
      hairShade: '#8abed6',
      jacket: '#17365d',
      jacketShade: '#0b1b2f',
      shirt: '#d8f4ff',
      accent: '#7fe3ff',
      hairStyle: 'quiff',
      accessory: 'visor',
      mark: 'scar',
      figure: 'agile',
      backdrop: 'grid',
    }),
    colors: {
      shell: 'linear-gradient(145deg, rgba(153, 247, 255, 0.94), rgba(40, 86, 162, 0.94))',
      glow: 'rgba(122, 234, 255, 0.4)',
      rim: 'rgba(214, 248, 255, 0.84)',
      glyph: '#eefcff',
    },
  },
  'human-orbit': {
    key: 'human-orbit',
    title: '轨迹策士',
    sigil: '轨',
    ornament: 'wave',
    description: '青绿轨道风，偏冷静控制与节奏。',
    art: buildArt({
      skin: '#cfa78a',
      skinShadow: '#9d725c',
      hair: '#243329',
      hairShade: '#466d5b',
      jacket: '#11352f',
      jacketShade: '#081816',
      shirt: '#dcf7ee',
      accent: '#77f2c8',
      hairStyle: 'short',
      accessory: 'earpiece',
      facialHair: 'stubble',
      figure: 'tailored',
      backdrop: 'halo',
    }),
    colors: {
      shell: 'linear-gradient(145deg, rgba(140, 255, 220, 0.94), rgba(22, 118, 93, 0.94))',
      glow: 'rgba(122, 255, 217, 0.38)',
      rim: 'rgba(218, 255, 241, 0.82)',
      glyph: '#ecfff7',
    },
  },
  'human-noir': {
    key: 'human-noir',
    title: '夜幕策展',
    sigil: '夜',
    ornament: 'diamond',
    description: '蓝紫夜厅风，更神秘、更偏高阶会所质感。',
    art: buildArt({
      skin: '#e4bb9e',
      skinShadow: '#b27b63',
      hair: '#251835',
      hairShade: '#6f4eb5',
      jacket: '#24173f',
      jacketShade: '#0d0f1c',
      shirt: '#efe8ff',
      accent: '#c4a6ff',
      hairStyle: 'wave',
      accessory: 'monocle',
      lip: 'rgba(141, 92, 120, 0.8)',
      figure: 'poised',
      backdrop: 'curtain',
    }),
    colors: {
      shell: 'linear-gradient(145deg, rgba(196, 171, 255, 0.94), rgba(72, 45, 144, 0.96))',
      glow: 'rgba(190, 154, 255, 0.36)',
      rim: 'rgba(235, 223, 255, 0.84)',
      glyph: '#f4eeff',
    },
  },
  'human-ember': {
    key: 'human-ember',
    title: '焰芯突进',
    sigil: '焰',
    ornament: 'heart',
    description: '赤金高速风，偏强攻、偏抢节奏，适合想把人物感拉满的桌面。',
    art: buildArt({
      skin: '#efc2a2',
      skinShadow: '#c38667',
      hair: '#48161a',
      hairShade: '#f08a58',
      jacket: '#431d17',
      jacketShade: '#1d0f0d',
      shirt: '#fff0e6',
      accent: '#ff9f6f',
      hairStyle: 'fade',
      accessory: 'none',
      mark: 'stripe',
      lip: 'rgba(151, 82, 68, 0.82)',
      figure: 'broad',
      backdrop: 'rays',
    }),
    colors: {
      shell: 'linear-gradient(145deg, rgba(255, 165, 110, 0.94), rgba(126, 42, 18, 0.96))',
      glow: 'rgba(255, 161, 105, 0.4)',
      rim: 'rgba(255, 224, 193, 0.84)',
      glyph: '#fff2e6',
    },
  },
  'human-raven': {
    key: 'human-raven',
    title: '黑羽潜行',
    sigil: '羽',
    ornament: 'spade',
    description: '墨蓝冷锋风，更像高压读牌型角色，适合夜场主题。',
    art: buildArt({
      skin: '#d8b294',
      skinShadow: '#a97a60',
      hair: '#0f131b',
      hairShade: '#4d6084',
      jacket: '#171e2f',
      jacketShade: '#0a0d16',
      shirt: '#edf3ff',
      accent: '#8ea7dc',
      hairStyle: 'swept',
      accessory: 'shades',
      facialHair: 'stubble',
      figure: 'tailored',
      backdrop: 'grid',
    }),
    colors: {
      shell: 'linear-gradient(145deg, rgba(150, 170, 221, 0.94), rgba(38, 47, 82, 0.96))',
      glow: 'rgba(148, 170, 232, 0.34)',
      rim: 'rgba(227, 236, 255, 0.84)',
      glyph: '#f2f6ff',
    },
  },
  'human-lotus': {
    key: 'human-lotus',
    title: '青莲控局',
    sigil: '莲',
    ornament: 'wave',
    description: '青碧控场风，偏静稳和高识别度，和深海牌桌很搭。',
    art: buildArt({
      skin: '#e5c1a4',
      skinShadow: '#b88469',
      hair: '#143028',
      hairShade: '#57c8b6',
      jacket: '#12342d',
      jacketShade: '#081713',
      shirt: '#e8fff8',
      accent: '#7ff0d2',
      hairStyle: 'wave',
      accessory: 'headset',
      mark: 'mole',
      lip: 'rgba(137, 89, 102, 0.78)',
      figure: 'poised',
      backdrop: 'halo',
    }),
    colors: {
      shell: 'linear-gradient(145deg, rgba(131, 250, 214, 0.94), rgba(20, 105, 84, 0.95))',
      glow: 'rgba(126, 245, 212, 0.38)',
      rim: 'rgba(222, 255, 243, 0.84)',
      glyph: '#f0fff8',
    },
  },
  'human-cipher': {
    key: 'human-cipher',
    title: '密钥操盘',
    sigil: '密',
    ornament: 'diamond',
    description: '紫银密码风，偏算力和科技感，适合未来感更强的桌面。',
    art: buildArt({
      skin: '#f0c9ae',
      skinShadow: '#c48d72',
      hair: '#2b1e49',
      hairShade: '#9f86ff',
      jacket: '#25183b',
      jacketShade: '#100a1d',
      shirt: '#f2eeff',
      accent: '#c6a8ff',
      hairStyle: 'bob',
      accessory: 'earpiece',
      mark: 'scar',
      figure: 'tailored',
      backdrop: 'curtain',
    }),
    colors: {
      shell: 'linear-gradient(145deg, rgba(204, 174, 255, 0.94), rgba(78, 47, 144, 0.96))',
      glow: 'rgba(197, 163, 255, 0.38)',
      rim: 'rgba(240, 227, 255, 0.84)',
      glyph: '#f7f0ff',
    },
  },
  'human-sable': {
    key: 'human-sable',
    title: '玄曜调度',
    sigil: '曜',
    ornament: 'spade',
    description: '冷黑银边风，人物对比更硬，适合偏夜场和高压桌面。',
    art: buildArt({
      skin: '#dfb493',
      skinShadow: '#ad7d61',
      hair: '#0f1016',
      hairShade: '#67748f',
      jacket: '#161b28',
      jacketShade: '#090b10',
      shirt: '#f4f7fb',
      accent: '#c9d5f1',
      hairStyle: 'fade',
      accessory: 'headset',
      facialHair: 'none',
      mark: 'scar',
      figure: 'agile',
      backdrop: 'curtain',
    }),
    colors: {
      shell: 'linear-gradient(145deg, rgba(192, 207, 237, 0.94), rgba(47, 57, 79, 0.96))',
      glow: 'rgba(199, 214, 245, 0.34)',
      rim: 'rgba(237, 243, 255, 0.84)',
      glyph: '#f6f9ff',
    },
  },
  'human-mistral': {
    key: 'human-mistral',
    title: '风暴落点',
    sigil: '岚',
    ornament: 'bolt',
    description: '银蓝疾风风格，姿态更轻、更锋利，适合主动推进的角色感。',
    art: buildArt({
      skin: '#f0c7a7',
      skinShadow: '#c38b71',
      hair: '#ecf6ff',
      hairShade: '#8ac2f1',
      jacket: '#18365f',
      jacketShade: '#08172b',
      shirt: '#eaf7ff',
      accent: '#8bdfff',
      hairStyle: 'swept',
      accessory: 'visor',
      mark: 'stripe',
      figure: 'agile',
      backdrop: 'rays',
    }),
    colors: {
      shell: 'linear-gradient(145deg, rgba(166, 238, 255, 0.94), rgba(36, 95, 176, 0.96))',
      glow: 'rgba(140, 228, 255, 0.4)',
      rim: 'rgba(228, 250, 255, 0.84)',
      glyph: '#f3fdff',
    },
  },
  'human-velvet': {
    key: 'human-velvet',
    title: '绒幕裁决',
    sigil: '绒',
    ornament: 'heart',
    description: '暗红丝绒风，人物对比更柔和，但牌桌辨识度很高。',
    art: buildArt({
      skin: '#edc1a5',
      skinShadow: '#bd8468',
      hair: '#4d1824',
      hairShade: '#cf6c85',
      jacket: '#4e1827',
      jacketShade: '#180810',
      shirt: '#fff0f5',
      accent: '#ff9ab1',
      hairStyle: 'wave',
      accessory: 'none',
      mark: 'mole',
      lip: 'rgba(168, 79, 103, 0.84)',
      figure: 'poised',
      backdrop: 'curtain',
    }),
    colors: {
      shell: 'linear-gradient(145deg, rgba(255, 165, 194, 0.94), rgba(121, 30, 58, 0.96))',
      glow: 'rgba(255, 158, 186, 0.36)',
      rim: 'rgba(255, 223, 234, 0.84)',
      glyph: '#fff3f8',
    },
  },
  'human-summit': {
    key: 'human-summit',
    title: '峰值破局',
    sigil: '峰',
    ornament: 'star',
    description: '青金高峰风，轮廓更挺、更适合想让主角感更强的桌面。',
    art: buildArt({
      skin: '#e6bb98',
      skinShadow: '#b27f62',
      hair: '#173224',
      hairShade: '#7bdab1',
      jacket: '#12352c',
      jacketShade: '#071612',
      shirt: '#eefff7',
      accent: '#9df6d5',
      hairStyle: 'quiff',
      accessory: 'none',
      mark: 'scar',
      figure: 'broad',
      backdrop: 'halo',
    }),
    colors: {
      shell: 'linear-gradient(145deg, rgba(159, 248, 212, 0.94), rgba(23, 114, 84, 0.96))',
      glow: 'rgba(153, 245, 208, 0.38)',
      rim: 'rgba(227, 255, 244, 0.84)',
      glyph: '#f4fff9',
    },
  },
};

const AI_PRESETS: PortraitPreset[] = [
  {
    key: 'neon-shark',
    title: '深水诈压',
    sigil: '鲨',
    ornament: 'wave',
    art: buildArt({
      skin: '#dfb090',
      skinShadow: '#a87558',
      hair: '#091a2c',
      hairShade: '#2e77b5',
      jacket: '#10263d',
      jacketShade: '#08111d',
      shirt: '#e6f6ff',
      accent: '#55e0ff',
      hairStyle: 'slick',
      accessory: 'earpiece',
      mark: 'scar',
      facialHair: 'stubble',
    }),
    colors: {
      shell: 'linear-gradient(145deg, rgba(74, 232, 255, 0.92), rgba(22, 77, 132, 0.92))',
      glow: 'rgba(74, 232, 255, 0.38)',
      rim: 'rgba(166, 247, 255, 0.8)',
      glyph: '#dffbff',
    },
  },
  {
    key: 'spade-hunter',
    title: '伏击读牌',
    sigil: '猎',
    ornament: 'spade',
    art: buildArt({
      skin: '#f0c7a8',
      skinShadow: '#c58a70',
      hair: '#111418',
      hairShade: '#526073',
      jacket: '#21293a',
      jacketShade: '#0d1220',
      shirt: '#e6ebf9',
      accent: '#9ba7d0',
      hairStyle: 'short',
      accessory: 'shades',
    }),
    colors: {
      shell: 'linear-gradient(145deg, rgba(137, 160, 210, 0.92), rgba(29, 40, 72, 0.94))',
      glow: 'rgba(136, 167, 234, 0.34)',
      rim: 'rgba(201, 216, 255, 0.82)',
      glyph: '#eef3ff',
    },
  },
  {
    key: 'chip-mage',
    title: '筹码编排',
    sigil: '法',
    ornament: 'star',
    art: buildArt({
      skin: '#d5aa84',
      skinShadow: '#a2704e',
      hair: '#4a2614',
      hairShade: '#9d6e37',
      jacket: '#4a2415',
      jacketShade: '#1e110d',
      shirt: '#fff3de',
      accent: '#ffc15f',
      hairStyle: 'wave',
      accessory: 'visor',
      facialHair: 'goatee',
    }),
    colors: {
      shell: 'linear-gradient(145deg, rgba(255, 194, 92, 0.94), rgba(120, 68, 18, 0.94))',
      glow: 'rgba(255, 197, 98, 0.34)',
      rim: 'rgba(255, 228, 163, 0.84)',
      glyph: '#fff2d2',
    },
  },
  {
    key: 'deep-reader',
    title: '冷静洞察',
    sigil: '读',
    ornament: 'diamond',
    art: buildArt({
      skin: '#dfb598',
      skinShadow: '#a87661',
      hair: '#1b203f',
      hairShade: '#4a60bf',
      jacket: '#18234f',
      jacketShade: '#090e21',
      shirt: '#eef1ff',
      accent: '#8fa8ff',
      hairStyle: 'bob',
      accessory: 'monocle',
      lip: 'rgba(117, 72, 91, 0.74)',
    }),
    colors: {
      shell: 'linear-gradient(145deg, rgba(112, 160, 255, 0.92), rgba(39, 45, 124, 0.94))',
      glow: 'rgba(110, 155, 255, 0.34)',
      rim: 'rgba(194, 212, 255, 0.82)',
      glyph: '#eaf0ff',
    },
  },
  {
    key: 'cold-sniper',
    title: '静默收口',
    sigil: '狙',
    ornament: 'bolt',
    art: buildArt({
      skin: '#dcb294',
      skinShadow: '#aa795a',
      hair: '#d8eaf8',
      hairShade: '#7ab0cc',
      jacket: '#1c2c44',
      jacketShade: '#0c1420',
      shirt: '#f4f9ff',
      accent: '#c0d8f8',
      hairStyle: 'fade',
      accessory: 'none',
      mark: 'none',
      facialHair: 'stubble',
    }),
    colors: {
      shell: 'linear-gradient(145deg, rgba(212, 228, 255, 0.92), rgba(55, 72, 108, 0.94))',
      glow: 'rgba(198, 216, 255, 0.34)',
      rim: 'rgba(232, 242, 255, 0.82)',
      glyph: '#f0f6ff',
    },
  },
  {
    key: 'aurora-player',
    title: '节奏掌控',
    sigil: '极',
    ornament: 'star',
    art: buildArt({
      skin: '#f3cbab',
      skinShadow: '#cd926f',
      hair: '#1f3628',
      hairShade: '#74d8ab',
      jacket: '#14392f',
      jacketShade: '#091712',
      shirt: '#e8fff4',
      accent: '#8cffcd',
      hairStyle: 'quiff',
      accessory: 'headset',
    }),
    colors: {
      shell: 'linear-gradient(145deg, rgba(116, 255, 195, 0.94), rgba(24, 113, 83, 0.94))',
      glow: 'rgba(116, 255, 195, 0.34)',
      rim: 'rgba(206, 255, 235, 0.8)',
      glyph: '#e7fff6',
    },
  },
  {
    key: 'hidden-fox',
    title: '埋伏偷袭',
    sigil: '狐',
    ornament: 'heart',
    art: buildArt({
      skin: '#e9bb9d',
      skinShadow: '#bb8064',
      hair: '#5f1d22',
      hairShade: '#db7f8b',
      jacket: '#4b1a21',
      jacketShade: '#1d0d12',
      shirt: '#fff1f3',
      accent: '#ff8c95',
      hairStyle: 'bob',
      accessory: 'none',
      mark: 'mole',
      lip: 'rgba(162, 71, 88, 0.82)',
    }),
    colors: {
      shell: 'linear-gradient(145deg, rgba(255, 137, 137, 0.94), rgba(114, 32, 40, 0.94))',
      glow: 'rgba(255, 137, 137, 0.32)',
      rim: 'rgba(255, 210, 210, 0.8)',
      glyph: '#fff0f0',
    },
  },
  {
    key: 'sidepot-engineer',
    title: '边池算师',
    sigil: '工',
    ornament: 'club',
    art: buildArt({
      skin: '#d9af90',
      skinShadow: '#a2745b',
      hair: '#221b43',
      hairShade: '#9b90ff',
      jacket: '#261944',
      jacketShade: '#0f0b20',
      shirt: '#f1edff',
      accent: '#b9abff',
      hairStyle: 'fade',
      accessory: 'dealer',
      mark: 'mole',
      facialHair: 'goatee',
    }),
    colors: {
      shell: 'linear-gradient(145deg, rgba(177, 170, 255, 0.94), rgba(65, 42, 126, 0.94))',
      glow: 'rgba(177, 170, 255, 0.34)',
      rim: 'rgba(225, 221, 255, 0.82)',
      glyph: '#f1efff',
    },
  },
  {
    key: 'heart-drifter',
    title: '临界浪游',
    sigil: '浪',
    ornament: 'heart',
    art: buildArt({
      skin: '#f0c09d',
      skinShadow: '#bf835d',
      hair: '#8a3040',
      hairShade: '#e07090',
      jacket: '#6a1830',
      jacketShade: '#2a0c14',
      shirt: '#fff0f5',
      accent: '#ff9abf',
      hairStyle: 'wave',
      accessory: 'none',
      mark: 'none',
    }),
    colors: {
      shell: 'linear-gradient(145deg, rgba(255, 148, 185, 0.94), rgba(140, 40, 72, 0.94))',
      glow: 'rgba(255, 148, 178, 0.34)',
      rim: 'rgba(255, 218, 232, 0.82)',
      glyph: '#fff0f6',
    },
  },
  {
    key: 'night-dealer',
    title: '暗厅节拍',
    sigil: '庄',
    ornament: 'diamond',
    art: buildArt({
      skin: '#e2ba9d',
      skinShadow: '#af8168',
      hair: '#172447',
      hairShade: '#61d0ff',
      jacket: '#15244a',
      jacketShade: '#0b101e',
      shirt: '#effbff',
      accent: '#75d9ff',
      hairStyle: 'swept',
      accessory: 'dealer',
      facialHair: 'stubble',
    }),
    colors: {
      shell: 'linear-gradient(145deg, rgba(81, 218, 255, 0.94), rgba(31, 64, 120, 0.94))',
      glow: 'rgba(81, 218, 255, 0.34)',
      rim: 'rgba(194, 241, 255, 0.82)',
      glyph: '#e9fbff',
    },
  },
  {
    key: 'river-poet',
    title: '河牌诗眼',
    sigil: '诗',
    ornament: 'diamond',
    art: buildArt({
      skin: '#edc4a5',
      skinShadow: '#be896d',
      hair: '#3a2448',
      hairShade: '#be94f6',
      jacket: '#2a1736',
      jacketShade: '#100917',
      shirt: '#f8f1ff',
      accent: '#d5b4ff',
      hairStyle: 'wave',
      accessory: 'none',
      lip: 'rgba(154, 86, 118, 0.82)',
      figure: 'poised',
      backdrop: 'curtain',
    }),
    colors: {
      shell: 'linear-gradient(145deg, rgba(214, 180, 255, 0.94), rgba(92, 56, 143, 0.94))',
      glow: 'rgba(212, 181, 255, 0.34)',
      rim: 'rgba(244, 233, 255, 0.84)',
      glyph: '#fbf6ff',
    },
  },
  {
    key: 'stack-viper',
    title: '筹塔突刺',
    sigil: '塔',
    ornament: 'bolt',
    art: buildArt({
      skin: '#ddb090',
      skinShadow: '#aa775b',
      hair: '#0c1a0e',
      hairShade: '#4a8a2a',
      jacket: '#0e2010',
      jacketShade: '#050e06',
      shirt: '#eefff0',
      accent: '#c0ff50',
      hairStyle: 'fade',
      accessory: 'shades',
      mark: 'scar',
      figure: 'agile',
      backdrop: 'rays',
    }),
    colors: {
      shell: 'linear-gradient(145deg, rgba(192, 255, 80, 0.94), rgba(42, 102, 14, 0.94))',
      glow: 'rgba(182, 255, 72, 0.34)',
      rim: 'rgba(228, 255, 178, 0.84)',
      glyph: '#f2ffe0',
    },
  },
  {
    key: 'felt-marshal',
    title: '毡面统筹',
    sigil: '帅',
    ornament: 'club',
    art: buildArt({
      skin: '#e3b693',
      skinShadow: '#b07f62',
      hair: '#1a1c22',
      hairShade: '#6c7186',
      jacket: '#222733',
      jacketShade: '#0d1016',
      shirt: '#eff3fa',
      accent: '#cfd8eb',
      hairStyle: 'short',
      accessory: 'earpiece',
      facialHair: 'goatee',
      figure: 'broad',
      backdrop: 'halo',
    }),
    colors: {
      shell: 'linear-gradient(145deg, rgba(212, 222, 241, 0.94), rgba(66, 76, 101, 0.94))',
      glow: 'rgba(214, 224, 243, 0.34)',
      rim: 'rgba(245, 248, 255, 0.84)',
      glyph: '#f8fbff',
    },
  },
  {
    key: 'cinder-blade',
    title: '灰焰切线',
    sigil: '灰',
    ornament: 'heart',
    art: buildArt({
      skin: '#efbea0',
      skinShadow: '#c28362',
      hair: '#3a0808',
      hairShade: '#cc4040',
      jacket: '#3c0a0a',
      jacketShade: '#150404',
      shirt: '#fff4f4',
      accent: '#ff4040',
      hairStyle: 'quiff',
      accessory: 'monocle',
      figure: 'agile',
      backdrop: 'rays',
    }),
    colors: {
      shell: 'linear-gradient(145deg, rgba(255, 68, 68, 0.94), rgba(130, 12, 12, 0.96))',
      glow: 'rgba(255, 68, 68, 0.36)',
      rim: 'rgba(255, 188, 188, 0.84)',
      glyph: '#fff4f4',
    },
  },
  {
    key: 'mirror-count',
    title: '镜像算子',
    sigil: '镜',
    ornament: 'spade',
    art: buildArt({
      skin: '#e8bda1',
      skinShadow: '#b38267',
      hair: '#bcc8e2',
      hairShade: '#8090ae',
      jacket: '#1e2434',
      jacketShade: '#0c1018',
      shirt: '#f2f4fa',
      accent: '#d0d8f0',
      hairStyle: 'bob',
      accessory: 'headset',
      figure: 'tailored',
      backdrop: 'grid',
    }),
    colors: {
      shell: 'linear-gradient(145deg, rgba(222, 230, 252, 0.94), rgba(72, 82, 118, 0.94))',
      glow: 'rgba(205, 215, 245, 0.34)',
      rim: 'rgba(240, 244, 255, 0.84)',
      glyph: '#f6f8ff',
    },
  },
  {
    key: 'storm-rider',
    title: '风暴追注',
    sigil: '暴',
    ornament: 'wave',
    art: buildArt({
      skin: '#f1c9ab',
      skinShadow: '#c68f73',
      hair: '#f0ecff',
      hairShade: '#9080e0',
      jacket: '#1c1848',
      jacketShade: '#0a0820',
      shirt: '#eeeeff',
      accent: '#b8a8ff',
      hairStyle: 'swept',
      accessory: 'visor',
      mark: 'stripe',
      figure: 'agile',
      backdrop: 'grid',
    }),
    colors: {
      shell: 'linear-gradient(145deg, rgba(185, 170, 255, 0.94), rgba(52, 38, 140, 0.96))',
      glow: 'rgba(182, 168, 255, 0.34)',
      rim: 'rgba(230, 225, 255, 0.84)',
      glyph: '#f5f2ff',
    },
  },
];

const AI_NAME_TO_PRESET_KEY: Record<string, string> = {
  霓虹鲨鱼: 'neon-shark',
  黑桃猎手: 'spade-hunter',
  筹码法师: 'chip-mage',
  深蓝读牌者: 'deep-reader',
  冷面狙击手: 'cold-sniper',
  极光玩家: 'aurora-player',
  隐身猎狐: 'hidden-fox',
  边池工程师: 'sidepot-engineer',
  红心流浪者: 'heart-drifter',
  夜店庄家: 'night-dealer',
  河牌诗人: 'river-poet',
  筹塔毒蛇: 'stack-viper',
  毡面元帅: 'felt-marshal',
  灰烬刀锋: 'cinder-blade',
  镜像伯爵: 'mirror-count',
  风暴骑手: 'storm-rider',
};

const STYLE_FALLBACK: Record<PlayerStyle, PortraitPreset> = {
  balanced: AI_PRESETS[0],
  tight: AI_PRESETS[1],
  aggressive: AI_PRESETS[4],
  loose: AI_PRESETS[8],
};

function makeStyleVars(preset: PortraitPreset): CSSProperties {
  return {
    '--portrait-shell': preset.colors.shell,
    '--portrait-glow': preset.colors.glow,
    '--portrait-rim': preset.colors.rim,
    '--portrait-glyph': preset.colors.glyph,
  } as CSSProperties;
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function toPortrait(preset: PortraitPreset): PlayerPortrait {
  return {
    key: preset.key,
    title: preset.title,
    sigil: preset.sigil,
    ornament: preset.ornament,
    art: preset.art,
    styleVars: makeStyleVars(preset),
  };
}

const HUMAN_PORTRAIT_LOCALIZATION: Record<HumanPortraitKey, { title: string; description: string; sigil?: string }> = {
  'human-host': { title: 'Table Host', description: 'Black-gold home table styling with a steady lead presence.', sigil: 'Y' },
  'human-comet': { title: 'Comet Lead', description: 'Cold blue speed lines with a more aggressive profile.' },
  'human-orbit': { title: 'Orbit Caller', description: 'Cool green control styling built around pace and stability.' },
  'human-noir': { title: 'Noir Curator', description: 'Blue-violet lounge styling with a more premium room mood.' },
  'human-ember': { title: 'Ember Charge', description: 'Red-gold burst styling for a stronger attacking presence.' },
  'human-raven': { title: 'Raven Shade', description: 'Dark navy pressure styling suited to night-table themes.' },
  'human-lotus': { title: 'Lotus Control', description: 'Mint-teal control styling with very clear table contrast.' },
  'human-cipher': { title: 'Cipher Dealer', description: 'Purple-silver tech styling with a sharper futuristic read.' },
  'human-sable': { title: 'Sable Director', description: 'Cold black-silver styling for high-pressure table moods.' },
  'human-mistral': { title: 'Mistral Point', description: 'Steel-blue motion styling for proactive pacing.' },
  'human-velvet': { title: 'Velvet Verdict', description: 'Deep red velvet styling with softer portrait contrast.' },
  'human-summit': { title: 'Summit Breaker', description: 'Teal-gold hero styling with a stronger main-character read.' },
};

function localizeHumanOption(option: HumanPortraitOption, language?: AppLanguage): HumanPortraitOption {
  if (!language || language === 'zh-CN') {
    return option;
  }
  return {
    ...option,
    ...HUMAN_PORTRAIT_LOCALIZATION[option.key as HumanPortraitKey],
  };
}

function localizedPortraitTitle(title: string, key: string, language?: AppLanguage): string {
  if (!language || language === 'zh-CN') {
    return title;
  }
  if (key in HUMAN_PORTRAIT_LOCALIZATION) {
    return HUMAN_PORTRAIT_LOCALIZATION[key as HumanPortraitKey].title;
  }
  return title;
}

export function getHumanPortraitOptions(language?: AppLanguage): HumanPortraitOption[] {
  return (Object.values(HUMAN_PRESETS) as Array<PortraitPreset & { description: string }>).map((preset) =>
    localizeHumanOption(
      {
        ...toPortrait(preset),
        description: preset.description,
        unlockCost: HUMAN_PORTRAIT_UNLOCK_COSTS[preset.key as HumanPortraitKey],
        starter: (STARTER_HUMAN_PORTRAIT_KEYS as readonly HumanPortraitKey[]).includes(preset.key as HumanPortraitKey),
      },
      language,
    ),
  );
}

export function resolvePlayerPortrait(player: PortraitSubject, language?: AppLanguage): PlayerPortrait {
  if (player.isHuman) {
    const preset = HUMAN_PRESETS[player.portraitKey ?? 'human-host'] ?? HUMAN_PRESETS['human-host'];
    const portrait = toPortrait(preset);
    return {
      ...portrait,
      sigil: language && language !== 'zh-CN' ? HUMAN_PORTRAIT_LOCALIZATION[preset.key as HumanPortraitKey]?.sigil ?? portrait.sigil : portrait.sigil,
      title: localizedPortraitTitle(portrait.title, preset.key, language),
    };
  }

  const presetKey = AI_NAME_TO_PRESET_KEY[player.name];
  const matched = presetKey ? AI_PRESETS.find((preset) => preset.key === presetKey) : undefined;
  const fallback = STYLE_FALLBACK[player.style];
  const preset = matched ?? AI_PRESETS[hashString(`${player.id}-${player.name}`) % AI_PRESETS.length] ?? fallback;

  return {
    ...toPortrait(preset),
    title: language && language !== 'zh-CN' ? player.name : toPortrait(preset).title,
  };
}

export function resolvePlayerPortraitMood(
  player: Pick<PlayerState, 'allIn' | 'folded' | 'eliminated' | 'lastAction'>,
  options: { active: boolean; winner: boolean },
): PlayerPortraitMood {
  if (options.winner) {
    return 'winner';
  }
  if (player.eliminated) {
    return 'busted';
  }
  if (player.allIn) {
    return 'all-in';
  }
  if (player.folded) {
    return 'folded';
  }
  if (options.active && (!player.lastAction || player.lastAction === '等待' || player.lastAction.startsWith('进入'))) {
    return 'thinking';
  }
  if (player.lastAction === '过牌') {
    return 'checking';
  }
  if (player.lastAction.startsWith('跟注')) {
    return 'calling';
  }
  if (player.lastAction.startsWith('下注到') || player.lastAction.startsWith('加注到')) {
    return 'raising';
  }
  if (options.active) {
    return 'focused';
  }
  return 'calm';
}
