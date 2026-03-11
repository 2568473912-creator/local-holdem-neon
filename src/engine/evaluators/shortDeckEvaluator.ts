import type { Card } from '../../types/cards';
import type { EvaluatedHand } from './shared';
import { compareEvaluatedHands, evaluateBestOfSeven } from './shared';
import type { ShortDeckRulePreset } from './shortDeckRules';
import { defaultShortDeckPreset } from './shortDeckRules';

export function evaluateShortDeckHoldem(
  cards: Card[],
  preset: ShortDeckRulePreset = defaultShortDeckPreset,
): EvaluatedHand {
  return evaluateBestOfSeven(cards, {
    categoryOrder: preset.categoryOrder,
    allowA2345Straight: preset.allowA2345Straight,
    allowA6789Straight: preset.allowA6789Straight,
    categoryLabel: {
      straight_flush: '同花顺',
      four_kind: '四条',
      full_house: '葫芦',
      flush: '同花',
      straight: '顺子',
      three_kind: '三条',
      two_pair: '两对',
      pair: '一对',
      high_card: '高牌',
    },
  });
}

export function compareShortDeckHands(a: EvaluatedHand, b: EvaluatedHand): number {
  return compareEvaluatedHands(a, b);
}
