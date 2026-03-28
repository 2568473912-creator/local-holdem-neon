import type { Card } from '../../types/cards';
import type { EvaluatedHand } from './shared';
import { compareEvaluatedHands, evaluateBestOfSeven } from './shared';

export const STANDARD_EVALUATOR_CONFIG = {
  categoryOrder: [
    'straight_flush',
    'four_kind',
    'full_house',
    'flush',
    'straight',
    'three_kind',
    'two_pair',
    'pair',
    'high_card',
  ] as const,
  allowA2345Straight: true,
  allowA6789Straight: false,
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
};

export function evaluateStandardHoldem(cards: Card[]): EvaluatedHand {
  return evaluateBestOfSeven(cards, STANDARD_EVALUATOR_CONFIG);
}

export function compareStandardHands(a: EvaluatedHand, b: EvaluatedHand): number {
  return compareEvaluatedHands(a, b);
}

export const STANDARD_RANKING_DESCRIPTION = [
  '标准德州牌型顺序：同花顺 > 四条 > 葫芦 > 同花 > 顺子 > 三条 > 两对 > 一对 > 高牌',
  '支持 A-2-3-4-5 作为最小顺子',
].join('；');
