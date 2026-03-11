import type { HandCategory } from './shared';

export interface ShortDeckRulePreset {
  name: string;
  categoryOrder: HandCategory[];
  allowA6789Straight: boolean;
  allowA2345Straight: boolean;
  notes: string[];
}

/**
 * 默认短牌规则（6+ Hold'em）
 * - 牌堆移除 2~5
 * - A-6-7-8-9 计作顺子
 * - 同花大于葫芦
 * - 三条大于顺子（常见竞技短牌规则）
 */
export const defaultShortDeckPreset: ShortDeckRulePreset = {
  name: 'common_competitive',
  categoryOrder: [
    'straight_flush',
    'four_kind',
    'flush',
    'full_house',
    'three_kind',
    'straight',
    'two_pair',
    'pair',
    'high_card',
  ],
  allowA6789Straight: true,
  allowA2345Straight: false,
  notes: [
    '默认采用同花 > 葫芦',
    '默认采用 A-6-7-8-9 顺子',
    '默认采用三条 > 顺子',
    '可通过替换 preset.categoryOrder 调整短牌牌力顺序',
  ],
};
