import type { Card } from '../../types/cards';
import type { EvaluatedHand } from './shared';
import { compareEvaluatedHands, evaluateFiveCardHand } from './shared';
import { STANDARD_EVALUATOR_CONFIG } from './standardEvaluator';

function chooseTwo(cards: Card[]): Card[][] {
  const result: Card[][] = [];
  for (let i = 0; i < cards.length - 1; i += 1) {
    for (let j = i + 1; j < cards.length; j += 1) {
      result.push([cards[i], cards[j]]);
    }
  }
  return result;
}

function chooseThree(cards: Card[]): Card[][] {
  const result: Card[][] = [];
  for (let i = 0; i < cards.length - 2; i += 1) {
    for (let j = i + 1; j < cards.length - 1; j += 1) {
      for (let k = j + 1; k < cards.length; k += 1) {
        result.push([cards[i], cards[j], cards[k]]);
      }
    }
  }
  return result;
}

export function evaluateOmahaHoldem(holeCards: Card[], boardCards: Card[]): EvaluatedHand {
  if (holeCards.length < 4) {
    throw new Error('evaluateOmahaHoldem expects at least 4 hole cards');
  }
  if (boardCards.length < 3) {
    throw new Error('evaluateOmahaHoldem expects at least 3 board cards');
  }

  const holeCombos = chooseTwo(holeCards);
  const boardCombos = chooseThree(boardCards);

  if (holeCombos.length === 0 || boardCombos.length === 0) {
    throw new Error('evaluateOmahaHoldem failed to build card combinations');
  }

  let best = evaluateFiveCardHand([...holeCombos[0], ...boardCombos[0]], STANDARD_EVALUATOR_CONFIG);

  for (const hole of holeCombos) {
    for (const board of boardCombos) {
      const candidate = evaluateFiveCardHand([...hole, ...board], STANDARD_EVALUATOR_CONFIG);
      if (compareEvaluatedHands(candidate, best) > 0) {
        best = candidate;
      }
    }
  }

  return best;
}

export function compareOmahaHands(a: EvaluatedHand, b: EvaluatedHand): number {
  return compareEvaluatedHands(a, b);
}
