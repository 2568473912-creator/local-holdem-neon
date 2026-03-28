import type { Card, GameMode } from '../../types/cards';
import type { EvaluatedHand } from './shared';
import { compareStandardHands, evaluateStandardHoldem } from './standardEvaluator';
import { compareShortDeckHands, evaluateShortDeckHoldem } from './shortDeckEvaluator';
import { compareOmahaHands, evaluateOmahaHoldem } from './omahaEvaluator';

export function evaluateByMode(mode: GameMode, cards: Card[]): EvaluatedHand {
  if (mode === 'shortDeck') {
    return evaluateShortDeckHoldem(cards);
  }
  if (mode === 'stud') {
    return evaluateStandardHoldem(cards);
  }
  return evaluateStandardHoldem(cards);
}

export function evaluatePlayerByMode(mode: GameMode, holeCards: Card[], boardCards: Card[]): EvaluatedHand {
  if (mode === 'shortDeck') {
    return evaluateShortDeckHoldem([...holeCards, ...boardCards]);
  }
  if (mode === 'omaha' || mode === 'plo') {
    return evaluateOmahaHoldem(holeCards, boardCards);
  }
  return evaluateStandardHoldem([...holeCards, ...boardCards]);
}

export function compareByMode(mode: GameMode, a: EvaluatedHand, b: EvaluatedHand): number {
  if (mode === 'shortDeck') {
    return compareShortDeckHands(a, b);
  }
  if (mode === 'omaha' || mode === 'plo') {
    return compareOmahaHands(a, b);
  }
  return compareStandardHands(a, b);
}

export type { EvaluatedHand, HandCategory } from './shared';
export { defaultShortDeckPreset } from './shortDeckRules';
export { STANDARD_RANKING_DESCRIPTION } from './standardEvaluator';
