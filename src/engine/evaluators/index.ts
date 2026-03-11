import type { Card, GameMode } from '../../types/cards';
import type { EvaluatedHand } from './shared';
import { compareStandardHands, evaluateStandardHoldem } from './standardEvaluator';
import { compareShortDeckHands, evaluateShortDeckHoldem } from './shortDeckEvaluator';

export function evaluateByMode(mode: GameMode, cards: Card[]): EvaluatedHand {
  if (mode === 'shortDeck') {
    return evaluateShortDeckHoldem(cards);
  }
  return evaluateStandardHoldem(cards);
}

export function compareByMode(mode: GameMode, a: EvaluatedHand, b: EvaluatedHand): number {
  if (mode === 'shortDeck') {
    return compareShortDeckHands(a, b);
  }
  return compareStandardHands(a, b);
}

export type { EvaluatedHand, HandCategory } from './shared';
export { defaultShortDeckPreset } from './shortDeckRules';
export { STANDARD_RANKING_DESCRIPTION } from './standardEvaluator';
