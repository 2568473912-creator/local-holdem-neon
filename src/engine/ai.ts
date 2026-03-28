import type { Card, GameMode } from '../types/cards';
import type { AIDifficulty, PlayerAction, PlayerState, TableState } from '../types/game';
import { getActionContext, getActionOptions } from './actionValidation';
import { evaluatePlayerByMode } from './evaluators';
import { seatOrderFrom } from './tableUtils';

interface StyleProfile {
  tightness: number;
  aggression: number;
  bluff: number;
  trap: number;
}

interface DifficultyTuning {
  tightnessShift: number;
  aggressionShift: number;
  bluffShift: number;
  offenseBiasShift: number;
  cautionShift: number;
  foldThresholdShift: number;
  jamThresholdShift: number;
  initiativeShift: number;
  cbetBiasShift: number;
}

type HandClass = 'air' | 'marginal' | 'medium' | 'strong' | 'monster';
type BetIntent = 'value' | 'protection' | 'semi_bluff' | 'bluff' | 'probe';
type BettingStreet = 'preflop' | 'flop' | 'turn' | 'river';

interface DrawProfile {
  flushDraw: boolean;
  straightDraw: boolean;
  openEnded: boolean;
  comboDraw: boolean;
  overcards: number;
  drawStrength: number;
}

interface BoardTexture {
  flushPressure: number;
  straightPressure: number;
  paired: boolean;
  highCard: number;
  wetness: number;
}

interface HandProfile {
  madeScore: number;
  handClass: HandClass;
  topPairLike: boolean;
  overPair: boolean;
  setOrBetter: boolean;
  draw: DrawProfile;
}

interface AggressionSignal {
  currentStreet: BettingStreet;
  previousStreet?: BettingStreet;
  currentAggressorId?: string;
  previousAggressorId?: string;
  hasInitiative: boolean;
  facingAggressor: boolean;
  sameAggressorChain: boolean;
  lineStrength: number;
  bluffLikelihood: number;
  pressure: number;
}

const STYLE_PROFILE: Record<PlayerState['style'], StyleProfile> = {
  tight: { tightness: 0.84, aggression: 0.46, bluff: 0.06, trap: 0.2 },
  loose: { tightness: 0.38, aggression: 0.6, bluff: 0.24, trap: 0.08 },
  aggressive: { tightness: 0.5, aggression: 0.88, bluff: 0.28, trap: 0.06 },
  balanced: { tightness: 0.62, aggression: 0.64, bluff: 0.14, trap: 0.12 },
};

const DIFFICULTY_TUNING: Record<AIDifficulty, DifficultyTuning> = {
  conservative: {
    tightnessShift: 0.08,
    aggressionShift: -0.1,
    bluffShift: -0.07,
    offenseBiasShift: -0.08,
    cautionShift: 0.08,
    foldThresholdShift: 0.07,
    jamThresholdShift: 0.08,
    initiativeShift: -0.02,
    cbetBiasShift: 0.08,
  },
  standard: {
    tightnessShift: 0,
    aggressionShift: 0,
    bluffShift: 0,
    offenseBiasShift: 0,
    cautionShift: 0,
    foldThresholdShift: 0,
    jamThresholdShift: 0,
    initiativeShift: 0,
    cbetBiasShift: 0,
  },
  aggressive: {
    tightnessShift: -0.07,
    aggressionShift: 0.11,
    bluffShift: 0.08,
    offenseBiasShift: 0.08,
    cautionShift: -0.07,
    foldThresholdShift: -0.06,
    jamThresholdShift: -0.07,
    initiativeShift: 0.03,
    cbetBiasShift: -0.07,
  },
};

const EMPTY_DRAW: DrawProfile = {
  flushDraw: false,
  straightDraw: false,
  openEnded: false,
  comboDraw: false,
  overcards: 0,
  drawStrength: 0,
};

const STANDARD_STRAIGHT_PATTERNS = buildStraightPatterns('standard');
const SHORT_DECK_STRAIGHT_PATTERNS = buildStraightPatterns('shortDeck');

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function tuneStyleProfile(base: StyleProfile, tuning: DifficultyTuning): StyleProfile {
  return {
    tightness: clamp(base.tightness + tuning.tightnessShift, 0.25, 0.95),
    aggression: clamp(base.aggression + tuning.aggressionShift, 0.2, 0.98),
    bluff: clamp(base.bluff + tuning.bluffShift, 0.02, 0.42),
    trap: base.trap,
  };
}

function seededNoise(handId: number, playerId: string, salt = 0): number {
  const hash = `${handId}-${playerId}-${salt}`.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return (Math.sin(hash) + 1) / 2;
}

function normalizeRank(rank: number, mode: GameMode): number {
  return mode === 'shortDeck' ? (rank - 5) / 9 : (rank - 1) / 13;
}

function getStraightPatterns(mode: GameMode): number[][] {
  return mode === 'shortDeck' ? SHORT_DECK_STRAIGHT_PATTERNS : STANDARD_STRAIGHT_PATTERNS;
}

function buildStraightPatterns(mode: GameMode): number[][] {
  const patterns: number[][] = [];

  if (mode === 'shortDeck') {
    for (let high = 14; high >= 10; high -= 1) {
      patterns.push([high, high - 1, high - 2, high - 3, high - 4]);
    }
    patterns.push([14, 9, 8, 7, 6]);
    return patterns;
  }

  for (let high = 14; high >= 6; high -= 1) {
    patterns.push([high, high - 1, high - 2, high - 3, high - 4]);
  }
  patterns.push([14, 5, 4, 3, 2]);

  return patterns;
}

function effectiveGap(a: number, b: number, mode: GameMode): number {
  const high = Math.max(a, b);
  const low = Math.min(a, b);
  const direct = high - low;

  if (mode !== 'shortDeck' || high !== 14 || low > 9) {
    return direct;
  }

  // In short deck, A-9 can connect through A-9-8-7-6 straight.
  const shortWheelPath = 9 - low;
  return Math.min(direct, shortWheelPath);
}

function scorePreflopTwoCardCombo(a: Card, b: Card, mode: GameMode): number {
  const high = a.rank >= b.rank ? a : b;
  const low = a.rank >= b.rank ? b : a;
  const isPair = high.rank === low.rank;
  const suited = high.suit === low.suit;
  const gap = effectiveGap(high.rank, low.rank, mode);
  const highNorm = normalizeRank(high.rank, mode);
  const lowNorm = normalizeRank(low.rank, mode);

  let score = 0;

  if (isPair) {
    score = 0.57 + highNorm * 0.42;
    if (mode === 'shortDeck') {
      score += 0.06;
    }
  } else {
    score = highNorm * 0.5 + lowNorm * 0.31;

    if (suited) {
      score += mode === 'shortDeck' ? 0.11 : 0.08;
    }

    if (gap === 0) {
      score += 0.09;
    } else if (gap === 1) {
      score += 0.06;
    } else if (gap === 2) {
      score += 0.03;
    } else if (gap >= 4) {
      score -= 0.08;
    }

    if (high.rank >= 12 && low.rank >= 10) {
      score += 0.08;
    }

    if (high.rank >= 13 && low.rank >= 12) {
      score += 0.04;
    }

    if (mode === 'shortDeck') {
      if (gap <= 2) {
        score += 0.05;
      }
      if (Math.min(high.rank, low.rank) >= 9) {
        score += 0.04;
      }
    }
  }

  return clamp(score, 0, 1);
}

function estimatePreflopStrength(player: PlayerState, mode: GameMode): number {
  if (player.holeCards.length < 2) {
    return 0;
  }

  let best = 0;
  for (let i = 0; i < player.holeCards.length - 1; i += 1) {
    for (let j = i + 1; j < player.holeCards.length; j += 1) {
      const score = scorePreflopTwoCardCombo(player.holeCards[i], player.holeCards[j], mode);
      if (score > best) {
        best = score;
      }
    }
  }

  return best;
}

function analyzeBoardTexture(board: Card[], mode: GameMode): BoardTexture {
  if (board.length === 0) {
    return {
      flushPressure: 0,
      straightPressure: 0,
      paired: false,
      highCard: 0,
      wetness: 0,
    };
  }

  const suitCount = new Map<Card['suit'], number>();
  for (const card of board) {
    suitCount.set(card.suit, (suitCount.get(card.suit) ?? 0) + 1);
  }

  const maxSuitCount = Math.max(...suitCount.values());
  const flushPressure = board.length >= 3 ? clamp((maxSuitCount - 2) * 0.55 + (board.length >= 4 ? 0.12 : 0), 0, 1) : 0;

  const rankSet = new Set(board.map((card) => card.rank));
  let straightPressure = 0;
  for (const pattern of getStraightPatterns(mode)) {
    const hits = pattern.reduce((count, rank) => count + (rankSet.has(rank) ? 1 : 0), 0);
    if (hits >= 4) {
      straightPressure = Math.max(straightPressure, 0.88);
    } else if (hits === 3) {
      straightPressure = Math.max(straightPressure, 0.54);
    }
  }

  const uniqueRankCount = rankSet.size;
  const paired = uniqueRankCount < board.length;
  const highCard = normalizeRank(Math.max(...board.map((card) => card.rank)), mode);

  const wetness = clamp(
    flushPressure * 0.42 + straightPressure * 0.4 + (paired ? 0.12 : 0) + (board.length >= 4 ? 0.08 : 0),
    0,
    1,
  );

  return {
    flushPressure,
    straightPressure,
    paired,
    highCard,
    wetness,
  };
}

function analyzeDrawProfile(player: PlayerState, board: Card[], mode: GameMode): DrawProfile {
  if (board.length === 0) {
    return EMPTY_DRAW;
  }

  const cards = [...player.holeCards, ...board];
  const suitMap = new Map<Card['suit'], number>();
  for (const card of cards) {
    suitMap.set(card.suit, (suitMap.get(card.suit) ?? 0) + 1);
  }

  let flushDraw = false;
  let nutFlushDraw = false;

  for (const [suit, count] of suitMap.entries()) {
    if (count >= 4 && player.holeCards.some((card) => card.suit === suit)) {
      flushDraw = true;
      nutFlushDraw = player.holeCards.some((card) => card.suit === suit && card.rank === 14);
      break;
    }
  }

  const rankSet = new Set(cards.map((card) => card.rank));
  let openEnded = false;
  let gutshot = false;

  for (const pattern of getStraightPatterns(mode)) {
    const hits = pattern.reduce((count, rank) => count + (rankSet.has(rank) ? 1 : 0), 0);
    if (hits !== 4) {
      continue;
    }

    const missing = pattern.find((rank) => !rankSet.has(rank));
    if (!missing) {
      continue;
    }

    const edgeMissing = missing === pattern[0] || missing === pattern[pattern.length - 1];
    const standardWheelPattern = mode !== 'shortDeck' && pattern[0] === 14 && pattern[1] === 5;
    const shortDeckWheelPattern = mode === 'shortDeck' && pattern[0] === 14 && pattern[1] === 9;

    if (edgeMissing && !standardWheelPattern && !shortDeckWheelPattern) {
      openEnded = true;
    } else {
      gutshot = true;
    }
  }

  const straightDraw = openEnded || gutshot;
  const boardHigh = Math.max(...board.map((card) => card.rank));
  const overcards = player.holeCards.filter((card) => card.rank > boardHigh).length;

  let drawStrength = 0;
  if (flushDraw) {
    drawStrength += nutFlushDraw ? 0.24 : 0.17;
  }

  if (openEnded) {
    drawStrength += 0.16;
  } else if (gutshot) {
    drawStrength += 0.09;
  }

  if (overcards === 2) {
    drawStrength += 0.06;
  } else if (overcards === 1) {
    drawStrength += 0.03;
  }

  if (mode === 'shortDeck' && straightDraw) {
    drawStrength += 0.03;
  }

  const comboDraw = flushDraw && straightDraw;
  if (comboDraw) {
    drawStrength += 0.08;
  }

  return {
    flushDraw,
    straightDraw,
    openEnded,
    comboDraw,
    overcards,
    drawStrength: clamp(drawStrength, 0, 0.52),
  };
}

function analyzePairContext(player: PlayerState, board: Card[]): { topPairLike: boolean; overPair: boolean; setOrBetter: boolean } {
  if (board.length === 0) {
    return {
      topPairLike: false,
      overPair: false,
      setOrBetter: false,
    };
  }

  const boardHigh = Math.max(...board.map((card) => card.rank));
  const pocketPair = player.holeCards.length >= 2 && player.holeCards[0].rank === player.holeCards[1].rank;

  const topPairLike = player.holeCards.some((card) => card.rank === boardHigh);
  const overPair = pocketPair && player.holeCards[0].rank > boardHigh;

  const boardRankCount = new Map<number, number>();
  for (const card of board) {
    boardRankCount.set(card.rank, (boardRankCount.get(card.rank) ?? 0) + 1);
  }

  const holeRankCount = new Map<number, number>();
  for (const card of player.holeCards) {
    holeRankCount.set(card.rank, (holeRankCount.get(card.rank) ?? 0) + 1);
  }

  const setOrBetter = [...holeRankCount.entries()].some(([rank, holeCount]) => {
    const boardCount = boardRankCount.get(rank) ?? 0;
    return boardCount + holeCount >= 3;
  });

  return {
    topPairLike,
    overPair,
    setOrBetter,
  };
}

function classifyHand(category: ReturnType<typeof evaluatePlayerByMode>['category'], pairContext: ReturnType<typeof analyzePairContext>, mode: GameMode): HandClass {
  if (category === 'straight_flush' || category === 'four_kind' || category === 'full_house') {
    return 'monster';
  }

  if (category === 'flush') {
    return mode === 'shortDeck' ? 'monster' : 'strong';
  }

  if (category === 'straight' || category === 'three_kind') {
    return mode === 'shortDeck' && category === 'straight' ? 'medium' : 'strong';
  }

  if (category === 'two_pair') {
    return 'medium';
  }

  if (category === 'pair') {
    if (pairContext.overPair || pairContext.topPairLike) {
      return 'medium';
    }
    return 'marginal';
  }

  return 'air';
}

function buildPostflopProfile(table: TableState, player: PlayerState): HandProfile {
  const cards = [...player.holeCards, ...table.board];
  if (cards.length < 5) {
    const madeScore = estimatePreflopStrength(player, table.mode);
    const handClass: HandClass =
      madeScore >= 0.8 ? 'monster' : madeScore >= 0.66 ? 'strong' : madeScore >= 0.5 ? 'medium' : madeScore >= 0.36 ? 'marginal' : 'air';
    return {
      madeScore,
      handClass,
      topPairLike: false,
      overPair: false,
      setOrBetter: false,
      draw: EMPTY_DRAW,
    };
  }

  const evaluated = evaluatePlayerByMode(table.mode, player.holeCards, table.board);
  const pairContext = analyzePairContext(player, table.board);
  const draw = analyzeDrawProfile(player, table.board, table.mode);

  let madeScore = evaluated.categoryStrength / 9;

  if (pairContext.overPair) {
    madeScore += 0.1;
  }

  if (pairContext.topPairLike) {
    madeScore += 0.06;
  }

  if (pairContext.setOrBetter) {
    madeScore += 0.12;
  }

  if (evaluated.category === 'pair' && !pairContext.topPairLike && !pairContext.overPair) {
    madeScore -= 0.05;
  }

  madeScore = clamp(madeScore, 0, 1);

  return {
    madeScore,
    handClass: classifyHand(evaluated.category, pairContext, table.mode),
    topPairLike: pairContext.topPairLike,
    overPair: pairContext.overPair,
    setOrBetter: pairContext.setOrBetter,
    draw,
  };
}

function getPositionFactor(table: TableState, player: PlayerState): number {
  const inHand = table.players.filter((p) => !p.eliminated && !p.folded);

  if (inHand.length <= 2) {
    return 0.62;
  }

  const order = seatOrderFrom(inHand, table.dealerSeat);
  const index = order.findIndex((candidate) => candidate.id === player.id);
  if (index < 0) {
    return 0.5;
  }

  const relative = index / Math.max(1, order.length - 1);
  return 0.35 + relative * 0.45;
}

function resolveStreet(table: TableState): BettingStreet {
  if (table.stage === 'preflop' || table.stage === 'flop' || table.stage === 'turn' || table.stage === 'river') {
    return table.stage;
  }
  if (table.board.length >= 5) return 'river';
  if (table.board.length === 4) return 'turn';
  if (table.board.length === 3) return 'flop';
  return 'preflop';
}

function previousStreet(street: BettingStreet): BettingStreet | undefined {
  if (street === 'river') return 'turn';
  if (street === 'turn') return 'flop';
  if (street === 'flop') return 'preflop';
  return undefined;
}

function analyzeAggressionSignal(table: TableState, player: PlayerState, toCall: number): AggressionSignal {
  const currentStreet = resolveStreet(table);
  const prevStreet = previousStreet(currentStreet);
  const currentAggressorId = table.aggression.streetAggressors[currentStreet] ?? table.betting.lastAggressorId;
  const previousAggressorId = prevStreet ? table.aggression.streetAggressors[prevStreet] : undefined;
  const sameAggressorChain = Boolean(currentAggressorId && previousAggressorId && currentAggressorId === previousAggressorId);
  const hasInitiative = previousAggressorId === player.id || currentAggressorId === player.id;
  const facingAggressor = toCall > 0 && Boolean(currentAggressorId) && currentAggressorId !== player.id;

  let bluffLikelihood = 0.3;
  let lineStrength = 0.42;

  if (currentAggressorId) {
    const aggressor = table.players.find((p) => p.id === currentAggressorId);
    const observedRaises = table.aggression.raiseCountByPlayer[currentAggressorId] ?? 0;
    const observedActions = table.aggression.voluntaryActionsByPlayer[currentAggressorId] ?? 1;
    const observedFolds = table.aggression.foldedToAggressionByPlayer[currentAggressorId] ?? 0;
    const aggressionRate = clamp(observedRaises / Math.max(1, observedActions), 0, 1);
    const stickiness = 1 - clamp(observedFolds / Math.max(1, observedActions), 0, 1);
    const styleAgg = aggressor ? STYLE_PROFILE[aggressor.style].aggression : 0.6;
    const styleBluff = aggressor ? STYLE_PROFILE[aggressor.style].bluff : 0.14;
    const pricePressure = toCall / Math.max(1, table.totalPot + toCall);

    bluffLikelihood = clamp(styleBluff * 0.56 + aggressionRate * 0.32 + (1 - stickiness) * 0.12, 0.08, 0.82);
    lineStrength = clamp(
      0.32 +
        pricePressure * 0.46 +
        (sameAggressorChain ? 0.18 : 0) +
        (styleAgg < 0.55 ? 0.08 : 0) -
        bluffLikelihood * 0.14,
      0.16,
      0.96,
    );
  }

  const pressure = facingAggressor ? clamp(lineStrength + toCall / Math.max(1, table.totalPot + toCall) * 0.22 - bluffLikelihood * 0.2, 0, 1) : 0;

  return {
    currentStreet,
    previousStreet: prevStreet,
    currentAggressorId,
    previousAggressorId,
    hasInitiative,
    facingAggressor,
    sameAggressorChain,
    lineStrength,
    bluffLikelihood,
    pressure,
  };
}

interface AmountContext {
  table: TableState;
  player: PlayerState;
  toCall: number;
  minTotal: number;
  maxTotal: number;
  profile: StyleProfile;
  intent: BetIntent;
  confidence: number;
  boardTexture: BoardTexture;
}

function chooseAggressiveAmount(context: AmountContext): number {
  const { table, player, toCall, minTotal, maxTotal, profile, intent, confidence, boardTexture } = context;

  const street = resolveStreet(table);

  let multiplier = 0.55;

  if (intent === 'value') {
    multiplier = street === 'river' ? 0.92 : street === 'turn' ? 0.8 : street === 'preflop' ? 0.84 : 0.7;
  } else if (intent === 'protection') {
    multiplier = street === 'river' ? 0.66 : 0.62;
  } else if (intent === 'semi_bluff') {
    multiplier = street === 'preflop' ? 0.75 : 0.58;
  } else if (intent === 'bluff') {
    multiplier = street === 'river' ? 0.8 : 0.52;
  } else {
    multiplier = 0.36;
  }

  multiplier += profile.aggression * 0.12;
  multiplier += boardTexture.wetness * (intent === 'value' || intent === 'protection' ? 0.17 : 0.09);
  multiplier += (confidence - 0.5) * 0.18;
  if (table.mode === 'shortDeck') {
    multiplier += 0.06;
  }

  multiplier = clamp(multiplier, 0.28, 1.45);

  const potBase = Math.max(table.totalPot + toCall, table.config.bigBlind * 3);
  const target = player.currentBet + toCall + Math.round(potBase * multiplier);

  return clamp(target, minTotal, maxTotal);
}

function shouldJam(
  handClass: HandClass,
  draw: DrawProfile,
  confidence: number,
  profile: StyleProfile,
  spr: number,
  stackDepthBb: number,
): boolean {
  const emergencyStack = stackDepthBb <= 4 && confidence > 0.42;
  const valueJam = (handClass === 'monster' || handClass === 'strong') && confidence > 0.66 - profile.aggression * 0.08 && spr < 1.5;
  const drawJam = draw.comboDraw && confidence > 0.58 && spr < 1.25;
  return emergencyStack || valueJam || drawJam;
}

function normalizeAiAction(table: TableState, player: PlayerState, desired: PlayerAction): PlayerAction {
  const options = getActionOptions(table, player.id);
  const byType = new Map(options.map((opt) => [opt.type, opt]));
  const enabled = (type: PlayerAction['type']) => Boolean(byType.get(type)?.enabled);

  if (desired.type === 'bet' || desired.type === 'raise') {
    const opt = byType.get(desired.type);
    if (opt?.enabled) {
      const min = opt.minAmount ?? desired.amount ?? 0;
      const max = opt.maxAmount ?? desired.amount ?? min;
      const amount = clamp(Math.floor(desired.amount ?? min), min, max);
      return { type: desired.type, amount };
    }
  } else if (enabled(desired.type)) {
    return desired;
  }

  if (enabled('call')) return { type: 'call' };
  if (enabled('check')) return { type: 'check' };
  if (enabled('all-in')) return { type: 'all-in' };
  return { type: 'fold' };
}

export function decideAiAction(table: TableState, player: PlayerState): PlayerAction {
  const difficulty = table.config.aiDifficulty ?? 'standard';
  const difficultyTuning = DIFFICULTY_TUNING[difficulty];
  const aiProfile = tuneStyleProfile(STYLE_PROFILE[player.style], difficultyTuning);
  const { toCall, maxTotalBet, minOpenBet, minRaiseTo, raiseLocked } = getActionContext(table, player);

  const boardTexture = analyzeBoardTexture(table.board, table.mode);
  const positionFactor = getPositionFactor(table, player);
  const inHandCount = table.players.filter((p) => !p.eliminated && !p.folded).length;
  const opponents = Math.max(1, inHandCount - 1);

  const pressure = toCall / Math.max(1, player.stack + toCall);
  const potOdds = toCall > 0 ? toCall / Math.max(1, table.totalPot + toCall) : 0;
  const stackDepthBb = player.stack / Math.max(1, table.config.bigBlind);
  const spr = player.stack / Math.max(1, table.totalPot + toCall);
  const aggressionSignal = analyzeAggressionSignal(table, player, toCall);

  const preflop = table.stage === 'preflop';

  let handClass: HandClass;
  let madeScore: number;
  let draw: DrawProfile;

  if (preflop) {
    madeScore = estimatePreflopStrength(player, table.mode);
    draw = EMPTY_DRAW;

    if (madeScore >= 0.8) handClass = 'monster';
    else if (madeScore >= 0.66) handClass = 'strong';
    else if (madeScore >= 0.5) handClass = 'medium';
    else if (madeScore >= 0.36) handClass = 'marginal';
    else handClass = 'air';
  } else {
    const postflopProfile = buildPostflopProfile(table, player);
    handClass = postflopProfile.handClass;
    madeScore = postflopProfile.madeScore;
    draw = postflopProfile.draw;
  }

  const modeAggressionBoost = table.mode === 'shortDeck' ? 0.05 : 0;
  const noise = seededNoise(table.handId, player.id, table.board.length) * 0.08 - 0.04;
  const initiativeBoost = aggressionSignal.hasInitiative && !preflop ? 0.06 + difficultyTuning.initiativeShift : 0;

  const offensiveBias =
    aiProfile.aggression * 0.22 +
    positionFactor * 0.14 +
    modeAggressionBoost +
    initiativeBoost +
    difficultyTuning.offenseBiasShift;
  const caution =
    aiProfile.tightness * 0.2 +
    pressure * 0.26 +
    boardTexture.wetness * 0.08 +
    (opponents - 1) * 0.04 +
    Math.max(0, boardTexture.highCard - 0.65) * 0.06 +
    aggressionSignal.pressure * 0.22 +
    (aggressionSignal.sameAggressorChain ? 0.08 : 0) -
    aggressionSignal.bluffLikelihood * 0.06 +
    difficultyTuning.cautionShift;

  const drawLift = draw.drawStrength * (preflop ? 0.2 : table.board.length < 5 ? 0.92 : 0.3);
  const confidence = clamp(
    madeScore * 0.68 +
      drawLift * 0.42 +
      offensiveBias -
      caution +
      (aggressionSignal.bluffLikelihood - aggressionSignal.lineStrength) * 0.06 +
      noise,
    0,
    1,
  );

  const canRaise = !raiseLocked && (table.betting.currentBet === 0 ? maxTotalBet >= minOpenBet : maxTotalBet >= minRaiseTo);
  const aggressiveActionType: PlayerAction['type'] = table.betting.currentBet === 0 ? 'bet' : 'raise';
  const minAggressiveTotal = table.betting.currentBet === 0 ? minOpenBet : minRaiseTo;

  const jamCandidate = shouldJam(handClass, draw, confidence, aiProfile, spr, stackDepthBb);

  if (toCall === 0) {
    const trapRoll = seededNoise(table.handId, player.id, 11);
    if (!preflop && handClass === 'monster' && aggressionSignal.hasInitiative && boardTexture.wetness < 0.55 && trapRoll < aiProfile.trap * 0.45) {
      return normalizeAiAction(table, player, { type: 'check' });
    }

    if (jamCandidate && player.stack <= table.config.bigBlind * 8 && confidence > 0.6 + difficultyTuning.jamThresholdShift * 0.35) {
      return normalizeAiAction(table, player, { type: 'all-in' });
    }

    if (canRaise) {
      if (confidence > 0.72 || handClass === 'monster') {
        const amount = chooseAggressiveAmount({
          table,
          player,
          toCall,
          minTotal: minAggressiveTotal,
          maxTotal: maxTotalBet,
          profile: aiProfile,
          intent: 'value',
          confidence,
          boardTexture,
        });
        return normalizeAiAction(table, player, { type: aggressiveActionType, amount });
      }

      if ((handClass === 'strong' || handClass === 'medium') && confidence > 0.56 && boardTexture.wetness > 0.42) {
        const amount = chooseAggressiveAmount({
          table,
          player,
          toCall,
          minTotal: minAggressiveTotal,
          maxTotal: maxTotalBet,
          profile: aiProfile,
          intent: 'protection',
          confidence,
          boardTexture,
        });
        return normalizeAiAction(table, player, { type: aggressiveActionType, amount });
      }

      if (!preflop && draw.drawStrength > 0.24 && aiProfile.aggression + aiProfile.bluff * 0.6 + noise > 0.6) {
        const amount = chooseAggressiveAmount({
          table,
          player,
          toCall,
          minTotal: minAggressiveTotal,
          maxTotal: maxTotalBet,
          profile: aiProfile,
          intent: 'semi_bluff',
          confidence,
          boardTexture,
        });
        return normalizeAiAction(table, player, { type: aggressiveActionType, amount });
      }

      if (preflop && confidence > 0.5 + difficultyTuning.foldThresholdShift * 0.2 && (positionFactor > 0.56 || aiProfile.aggression > 0.74)) {
        const amount = chooseAggressiveAmount({
          table,
          player,
          toCall,
          minTotal: minAggressiveTotal,
          maxTotal: maxTotalBet,
          profile: aiProfile,
          intent: 'probe',
          confidence,
          boardTexture,
        });
        return normalizeAiAction(table, player, { type: aggressiveActionType, amount });
      }

      if (
        !preflop &&
        aggressionSignal.hasInitiative &&
        confidence > 0.4 + difficultyTuning.foldThresholdShift * 0.25 &&
        (handClass !== 'air' || draw.drawStrength > 0.2 || opponents <= 2) &&
        (aiProfile.aggression + noise > 0.44 + difficultyTuning.cbetBiasShift || handClass === 'medium' || handClass === 'strong')
      ) {
        const intent: BetIntent =
          handClass === 'air' ? (opponents <= 2 ? 'bluff' : 'probe') : draw.drawStrength > 0.22 ? 'semi_bluff' : 'probe';
        const amount = chooseAggressiveAmount({
          table,
          player,
          toCall,
          minTotal: minAggressiveTotal,
          maxTotal: maxTotalBet,
          profile: aiProfile,
          intent,
          confidence,
          boardTexture,
        });
        return normalizeAiAction(table, player, { type: aggressiveActionType, amount });
      }
    }

    return normalizeAiAction(table, player, { type: 'check' });
  }

  if (player.stack <= toCall) {
    const shoveThreshold = Math.max(
      0.33 + difficultyTuning.jamThresholdShift * 0.45,
      potOdds + 0.09 + aggressionSignal.lineStrength * 0.04 - aggressionSignal.bluffLikelihood * 0.08 - draw.drawStrength * 0.08,
    );
    return normalizeAiAction(table, player, confidence >= shoveThreshold ? { type: 'all-in' } : { type: 'fold' });
  }

  if (jamCandidate && confidence > 0.56 - aggressionSignal.bluffLikelihood * 0.06 + difficultyTuning.jamThresholdShift * 0.6) {
    return normalizeAiAction(table, player, { type: 'all-in' });
  }

  const rangeCompression = aggressionSignal.facingAggressor
    ? clamp(aggressionSignal.lineStrength - aggressionSignal.bluffLikelihood * 0.5, 0, 1)
    : 0;
  const foldThreshold = clamp(
    potOdds +
      0.08 +
      aiProfile.tightness * 0.11 +
      pressure * 0.08 +
      rangeCompression * 0.18 +
      (aggressionSignal.sameAggressorChain ? 0.06 : 0) -
      draw.drawStrength * 0.2 -
      positionFactor * 0.05 -
      aggressionSignal.bluffLikelihood * 0.08 -
      (aggressionSignal.hasInitiative ? 0.03 : 0) +
      difficultyTuning.foldThresholdShift,
    0.16,
    0.82,
  );
  const callThreshold = Math.max(0.16, foldThreshold - (0.14 + aggressionSignal.bluffLikelihood * 0.05 + difficultyTuning.offenseBiasShift * 0.2));

  if (canRaise) {
    const valueRaise =
      confidence > 0.74 ||
      handClass === 'monster' ||
      (handClass === 'strong' && pressure < 0.35 && confidence > 0.64) ||
      (aggressionSignal.facingAggressor && handClass === 'strong' && aggressionSignal.lineStrength < 0.75);
    const semiBluffRaise =
      (draw.comboDraw && confidence > 0.5 && aiProfile.aggression > 0.56) ||
      (draw.drawStrength > 0.22 && aiProfile.aggression > 0.74 && opponents <= 2 && pressure < 0.3) ||
      (draw.drawStrength > 0.26 && aggressionSignal.facingAggressor && aggressionSignal.bluffLikelihood > 0.32 && pressure < 0.35);

    const bluffRaise =
      !preflop &&
      draw.drawStrength < 0.16 &&
      confidence > foldThreshold + 0.07 &&
      opponents === 1 &&
      boardTexture.wetness < 0.45 &&
      aiProfile.bluff > 0.2 &&
      pressure < 0.22 &&
      aggressionSignal.lineStrength < 0.63;

    if (valueRaise || semiBluffRaise || bluffRaise) {
      const intent: BetIntent = valueRaise ? 'value' : semiBluffRaise ? 'semi_bluff' : 'bluff';
      const amount = chooseAggressiveAmount({
        table,
        player,
        toCall,
        minTotal: minAggressiveTotal,
        maxTotal: maxTotalBet,
        profile: aiProfile,
        intent,
        confidence,
        boardTexture,
      });
      return normalizeAiAction(table, player, { type: aggressiveActionType, amount });
    }
  }

  const cheapCall = toCall <= table.config.bigBlind * 1.5;
  if (
    confidence >= callThreshold ||
    draw.drawStrength >= potOdds + 0.05 ||
    (cheapCall && confidence > foldThreshold - 0.06) ||
    (aggressionSignal.bluffLikelihood > 0.56 && confidence > foldThreshold - 0.1)
  ) {
    return normalizeAiAction(table, player, { type: 'call' });
  }

  if (!preflop && toCall <= table.config.bigBlind && aiProfile.bluff > 0.18 && positionFactor > 0.56 && confidence > foldThreshold - 0.08) {
    return normalizeAiAction(table, player, { type: 'call' });
  }

  return normalizeAiAction(table, player, { type: 'fold' });
}
