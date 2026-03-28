import type { AppLanguage } from '../i18n';
import { AI_PACK_UNLOCK_COSTS, STARTER_AI_PACK_KEYS, type AIPackKey } from '../types/aiPack';
import type { PlayerStyle } from '../types/game';
import type { HumanPortraitKey } from '../types/portrait';

export interface AIPackOption {
  key: AIPackKey;
  title: string;
  eyebrow: string;
  description: string;
  starter: boolean;
  unlockCost: number;
  names: string[];
  portraitKeys: HumanPortraitKey[];
  stylePlan: PlayerStyle[];
  previewTone: 'club' | 'midnight' | 'jade' | 'sunset' | 'royal' | 'signal';
  tier: 'starter' | 'club' | 'premium' | 'signature' | 'collector';
}

const AI_PACK_OPTIONS: AIPackOption[] = [
  {
    key: 'club-core',
    title: '会所常驻',
    eyebrow: 'Starter',
    description: '当前默认的一桌常驻玩家，偏高厅俱乐部气质。',
    starter: true,
    unlockCost: AI_PACK_UNLOCK_COSTS['club-core'],
    portraitKeys: ['human-host', 'human-raven', 'human-orbit', 'human-noir'],
    stylePlan: ['balanced', 'tight', 'aggressive', 'loose'],
    previewTone: 'club',
    tier: 'starter',
    names: [
      '霓虹鲨鱼','黑桃猎手','筹码法师','深蓝读牌者','冷面狙击手','极光玩家','隐身猎狐','边池工程师','红心流浪者','夜店庄家','河牌诗人','筹塔毒蛇','毡面元帅','灰烬刀锋','镜像伯爵','风暴骑手',
    ],
  },
  {
    key: 'midnight-syndicate',
    title: '午夜行会',
    eyebrow: 'Night Pack',
    description: '更暗场、更会所、更偏夜厅的 AI 名字与人物组合。',
    starter: false,
    unlockCost: AI_PACK_UNLOCK_COSTS['midnight-syndicate'],
    portraitKeys: ['human-noir', 'human-raven', 'human-sable', 'human-velvet'],
    stylePlan: ['tight', 'balanced', 'aggressive', 'loose'],
    previewTone: 'midnight',
    tier: 'club',
    names: [
      '夜幕潜码者','灰厅密探','河口司仪','幕布切牌手','深筹伯爵','蓝焰观察员','霓墙调度者','暗池操盘手','尾灯猎犬','回声下注者','裂幕骑士','雾港算师','冷街清算官','夜虹索赔人','塔影监督','钟摆诈影',
    ],
  },
  {
    key: 'jade-circuit',
    title: '玉电回路',
    eyebrow: 'Eastern Line',
    description: '更东方、更精致的 AI 角色命名，适合青玉和传统戏服风牌面。',
    starter: false,
    unlockCost: AI_PACK_UNLOCK_COSTS['jade-circuit'],
    portraitKeys: ['human-lotus', 'human-orbit', 'human-host', 'human-mistral'],
    stylePlan: ['balanced', 'tight', 'loose', 'aggressive'],
    previewTone: 'jade',
    tier: 'premium',
    names: [
      '青灯筹师','玉衡听牌手','松影截流者','银铃拆牌官','竹幕静压者','琉璃翻牌师','鹤羽控池手','墨扇看河人','长街慢推客','金线调筹员','镜湖偷盲者','霁月三枪客','听雨记牌人','雁门压注手','玉台追注者','锦纹盯牌官',
    ],
  },
  {
    key: 'sunset-raiders',
    title: '晚霞突袭',
    eyebrow: 'Arcade Pack',
    description: '更张扬、更街机化的 AI 角色名，适合夸张牌桌和亮色皮肤。',
    starter: false,
    unlockCost: AI_PACK_UNLOCK_COSTS['sunset-raiders'],
    portraitKeys: ['human-ember', 'human-comet', 'human-cipher', 'human-summit'],
    stylePlan: ['aggressive', 'loose', 'balanced', 'tight'],
    previewTone: 'sunset',
    tier: 'premium',
    names: [
      '橙焰抢池者','尾光超车手','失速偷盲客','逆风补枪员','热浪炸池人','霓虹快拆手','高墙反压者','晚场点火员','滑轨追分客','赤频叫牌人','碎光突围者','连弯偷筹手','高桥轰池者','热弧切线员','角斗看河人','眩光落盲客',
    ],
  },
  {
    key: 'royal-opera',
    title: '皇家歌剧',
    eyebrow: 'Signature',
    description: '高积分席位用的华丽角色包，金纹、礼服和宫廷气质更重。',
    starter: false,
    unlockCost: AI_PACK_UNLOCK_COSTS['royal-opera'],
    portraitKeys: ['human-velvet', 'human-summit', 'human-noir', 'human-host'],
    stylePlan: ['tight', 'aggressive', 'balanced', 'loose'],
    previewTone: 'royal',
    tier: 'signature',
    names: [
      '金檐伯爵','绯幕总监','白厅筹策官','琥珀引盲师','剧院压注手','帷幕总管','冠冕读牌者','镀金慢推客','水晶让牌官','夜宴开池者','月台签单人','礼服断线手','宫厅执码师','王室点池人','镜厅司礼官','长席清算者',
    ],
  },
  {
    key: 'signal-run',
    title: '信号疾行',
    eyebrow: 'Collector',
    description: '顶档霓虹科技风角色包，轮廓更锐利，适合未来感桌面和高动态牌面。',
    starter: false,
    unlockCost: AI_PACK_UNLOCK_COSTS['signal-run'],
    portraitKeys: ['human-cipher', 'human-comet', 'human-sable', 'human-ember'],
    stylePlan: ['aggressive', 'balanced', 'tight', 'loose'],
    previewTone: 'signal',
    tier: 'collector',
    names: [
      '信号前锋','矢量截流者','零秒偷盲客','频闪读河人','冷启动筹师','回路压注官','霓端回收者','脉冲观察员','碎屏断牌手','高速切线者','电桥追分客','码流抬注人','空栈猎波者','轨缝偷池客','矩阵驻场官','半秒清桌者',
    ],
  },
];

const AI_PACK_LOCALIZATION: Record<AIPackKey, { title: string; eyebrow: string; description: string; names: string[] }> = {
  'club-core': {
    title: 'Club Core',
    eyebrow: 'Starter',
    description: 'The default club roster with a premium room tone.',
    names: ['Neon Shark', 'Spade Hunter', 'Chip Mage', 'Deep Reader', 'Cold Sniper', 'Aurora Player', 'Hidden Fox', 'Sidepot Engineer', 'Heart Drifter', 'Night Dealer', 'River Poet', 'Stack Viper', 'Felt Marshal', 'Cinder Blade', 'Mirror Count', 'Storm Rider'],
  },
  'midnight-syndicate': {
    title: 'Midnight Syndicate',
    eyebrow: 'Night Pack',
    description: 'A darker, lounge-driven AI roster for after-hours tables.',
    names: ['Night Cipher', 'Grey Hall Scout', 'River Host', 'Curtain Cutter', 'Deep Stack Count', 'Blue Flame Watcher', 'Neon Wall Runner', 'Dark Pool Operator', 'Taillight Hound', 'Echo Bettor', 'Split Curtain Knight', 'Fog Harbor Analyst', 'Cold Street Clerk', 'Night Glow Claimant', 'Tower Supervisor', 'Pendulum Bluff'],
  },
  'jade-circuit': {
    title: 'Jade Circuit',
    eyebrow: 'Eastern Line',
    description: 'A finer eastern-inspired naming line for jade and traditional table sets.',
    names: ['Jade Lamp', 'Balance Caller', 'Pine Shadow', 'Silver Bell', 'Bamboo Screen', 'Glass Turn', 'Crane Wing', 'Ink Fan', 'Long Street', 'Gold Thread', 'Mirror Lake', 'Clear Moon', 'Rain Listener', 'Wild Goose', 'Jade Terrace', 'Brocade Watcher'],
  },
  'sunset-raiders': {
    title: 'Sunset Raiders',
    eyebrow: 'Arcade Pack',
    description: 'A louder arcade-flavored roster tuned for bright tables and bold skins.',
    names: ['Orange Surge', 'Taillight Dash', 'Slipstream Blind', 'Crosswind Loader', 'Heatwave Pot', 'Neon Breaker', 'Highwall Press', 'Late Shift Ignition', 'Rail Chaser', 'Red Frequency', 'Shatterline', 'Curve Thief', 'Highbridge Rush', 'Hot Arc', 'Duel River', 'Glare Blind'],
  },
  'royal-opera': {
    title: 'Royal Opera',
    eyebrow: 'Signature',
    description: 'A gilded high-room roster with formal silhouettes and a court-stage tone.',
    names: ['Gold Eaves Count', 'Crimson Curtain', 'White Hall Clerk', 'Amber Caller', 'Opera Pressure', 'Curtain Steward', 'Crown Reader', 'Gilded Glide', 'Crystal Check', 'Night Banquet', 'Moon Deck Host', 'Velvet Breaker', 'Palace Ledger', 'Royal Potter', 'Mirror Hall', 'Long Table Clerk'],
  },
  'signal-run': {
    title: 'Signal Run',
    eyebrow: 'Collector',
    description: 'A top-tier neon-tech roster with sharper silhouettes and relay-line energy.',
    names: ['Signal Lead', 'Vector Cut', 'Zero Blind', 'Flicker River', 'Cold Boot', 'Circuit Press', 'Neon Relay', 'Pulse Watcher', 'Shardscreen', 'Fast Lane', 'Bridge Chaser', 'Code Raiser', 'Wave Hunter', 'Track Seam', 'Matrix Host', 'Half-Second'],
  },
};

function localizeAiPack(option: AIPackOption, language?: AppLanguage): AIPackOption {
  if (!language || language === 'zh-CN') {
    return option;
  }
  return {
    ...option,
    ...AI_PACK_LOCALIZATION[option.key],
  };
}

export function getAiPackOptions(language?: AppLanguage): AIPackOption[] {
  return AI_PACK_OPTIONS.map((option) => localizeAiPack(option, language));
}

export function getAiPackOption(key: AIPackKey, language?: AppLanguage): AIPackOption {
  return localizeAiPack(AI_PACK_OPTIONS.find((option) => option.key === key) ?? AI_PACK_OPTIONS[0], language);
}

export function isStarterAiPack(key: AIPackKey): boolean {
  return (STARTER_AI_PACK_KEYS as readonly AIPackKey[]).includes(key);
}
