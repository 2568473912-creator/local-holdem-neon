import type { GameMode } from '../types/cards';
import type { PlayerAction, PlayerState, TableState } from '../types/game';
import type { ActionTeachingTag } from '../types/replay';
import type { AppliedBettingAction } from './bettingRound';
import { evaluateByMode } from './evaluators';

export interface ActionTeachingMeta {
  tag: ActionTeachingTag;
  label: string;
  note: string;
}

interface DrawProfile {
  drawStrength: number;
  flushDraw: boolean;
  straightDraw: boolean;
}

interface HandSignals {
  madeScore: number;
  draw: DrawProfile;
  boardWetness: number;
  handCategory?: ReturnType<typeof evaluateByMode>['category'];
}

const STANDARD_STRAIGHT_PATTERNS = buildStraightPatterns('standard');
const SHORT_DECK_STRAIGHT_PATTERNS = buildStraightPatterns('shortDeck');

const TEACHING_LABEL: Record<ActionTeachingTag, string> = {
  value_bet: '价值下注',
  semi_bluff: '半诈唬',
  bluff_pressure: '诈唬施压',
  pot_control: '控池操作',
  pressure_fold: '压力弃牌',
  odds_call: '赔率跟注',
  defensive_call: '防守跟注',
  value_all_in: '价值全下',
  pressure_all_in: '施压全下',
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function normalizeRank(rank: number, mode: GameMode): number {
  return mode === 'shortDeck' ? (rank - 5) / 9 : (rank - 1) / 13;
}

function effectiveGap(a: number, b: number, mode: GameMode): number {
  const high = Math.max(a, b);
  const low = Math.min(a, b);
  const direct = high - low;

  if (mode !== 'shortDeck' || high !== 14 || low > 9) {
    return direct;
  }

  return Math.min(direct, 9 - low);
}

function estimatePreflopMadeScore(player: PlayerState, mode: GameMode): number {
  const [a, b] = [...player.holeCards].sort((x, y) => y.rank - x.rank);
  const isPair = a.rank === b.rank;
  const suited = a.suit === b.suit;
  const gap = effectiveGap(a.rank, b.rank, mode);

  let score = 0;

  if (isPair) {
    score = 0.56 + normalizeRank(a.rank, mode) * 0.42;
  } else {
    score = normalizeRank(a.rank, mode) * 0.52 + normalizeRank(b.rank, mode) * 0.3;
    if (suited) score += mode === 'shortDeck' ? 0.1 : 0.08;
    if (gap <= 1) score += 0.08;
    else if (gap === 2) score += 0.04;
    else if (gap >= 4) score -= 0.08;
  }

  if (mode === 'shortDeck' && suited) {
    score += 0.03;
  }

  return clamp(score, 0, 1);
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

function getStraightPatterns(mode: GameMode): number[][] {
  return mode === 'shortDeck' ? SHORT_DECK_STRAIGHT_PATTERNS : STANDARD_STRAIGHT_PATTERNS;
}

function analyzeDraw(player: PlayerState, board: TableState['board'], mode: GameMode): DrawProfile {
  if (board.length === 0) {
    return {
      drawStrength: 0,
      flushDraw: false,
      straightDraw: false,
    };
  }

  const cards = [...player.holeCards, ...board];
  const suitCount = new Map<string, number>();
  for (const card of cards) {
    suitCount.set(card.suit, (suitCount.get(card.suit) ?? 0) + 1);
  }

  let flushDraw = false;
  for (const [suit, count] of suitCount.entries()) {
    if (count >= 4 && player.holeCards.some((card) => card.suit === suit)) {
      flushDraw = true;
      break;
    }
  }

  const rankSet = new Set(cards.map((card) => card.rank));
  let straightDraw = false;
  let openEnded = false;

  for (const pattern of getStraightPatterns(mode)) {
    const hits = pattern.reduce((sum, rank) => sum + (rankSet.has(rank) ? 1 : 0), 0);
    if (hits !== 4) continue;

    straightDraw = true;
    const missing = pattern.find((rank) => !rankSet.has(rank));
    if (missing) {
      const edge = missing === pattern[0] || missing === pattern[pattern.length - 1];
      const wheelPattern =
        (mode === 'standard' && pattern[0] === 14 && pattern[1] === 5) ||
        (mode === 'shortDeck' && pattern[0] === 14 && pattern[1] === 9);
      if (edge && !wheelPattern) {
        openEnded = true;
      }
    }
  }

  let drawStrength = 0;
  if (flushDraw) drawStrength += 0.18;
  if (straightDraw) drawStrength += openEnded ? 0.16 : 0.1;

  return {
    drawStrength: clamp(drawStrength, 0, 0.5),
    flushDraw,
    straightDraw,
  };
}

function analyzeBoardWetness(board: TableState['board']): number {
  if (board.length < 3) {
    return 0;
  }

  const suitCount = new Map<string, number>();
  for (const card of board) {
    suitCount.set(card.suit, (suitCount.get(card.suit) ?? 0) + 1);
  }
  const maxSuit = Math.max(...suitCount.values());

  const ranks = [...new Set(board.map((card) => card.rank))].sort((a, b) => a - b);
  let connected = 0;
  for (let i = 1; i < ranks.length; i += 1) {
    if (ranks[i] - ranks[i - 1] <= 2) {
      connected += 1;
    }
  }

  return clamp((maxSuit - 2) * 0.38 + connected * 0.16 + (board.length >= 4 ? 0.08 : 0), 0, 1);
}

function evaluateSignals(table: TableState, player: PlayerState): HandSignals {
  const cards = [...player.holeCards, ...table.board];
  const evaluated = cards.length >= 5 ? evaluateByMode(table.mode, cards) : undefined;
  const madeScore = evaluated ? clamp(evaluated.categoryStrength / 9, 0, 1) : estimatePreflopMadeScore(player, table.mode);
  const draw = analyzeDraw(player, table.board, table.mode);
  const boardWetness = analyzeBoardWetness(table.board);

  return {
    madeScore,
    draw,
    boardWetness,
    handCategory: evaluated?.category,
  };
}

function makeMeta(tag: ActionTeachingTag, note: string): ActionTeachingMeta {
  return {
    tag,
    label: TEACHING_LABEL[tag],
    note,
  };
}

export function inferActionTeachingMeta(
  table: TableState,
  player: PlayerState,
  action: PlayerAction,
  applied: AppliedBettingAction,
): ActionTeachingMeta | undefined {
  if (player.isHuman) {
    return undefined;
  }

  const { madeScore, draw, boardWetness, handCategory } = evaluateSignals(table, player);
  const toCall = applied.toCallBefore;
  const potOdds = toCall > 0 ? toCall / Math.max(1, table.totalPot + toCall) : 0;
  const isAggressive =
    action.type === 'bet' ||
    action.type === 'raise' ||
    (action.type === 'all-in' && applied.betAfter > table.betting.currentBet);

  if (action.type === 'fold') {
    if (toCall > 0) {
      return makeMeta('pressure_fold', `面对压力放弃，需投入 ${toCall}，当前赔率 ${formatPercent(1 - potOdds)}`);
    }
    return makeMeta('pot_control', '在无投入压力下主动结束本手牌');
  }

  if (action.type === 'check') {
    if (madeScore >= 0.68) {
      return makeMeta('pot_control', `强度约 ${formatPercent(madeScore)}，选择控池观察后续街道`);
    }
    return makeMeta('pot_control', `牌力/听牌不足（强度 ${formatPercent(madeScore)}），过牌保留灵活性`);
  }

  if (action.type === 'call') {
    if (draw.drawStrength >= 0.2 && madeScore < 0.66) {
      return makeMeta('odds_call', `听牌强度 ${formatPercent(draw.drawStrength)}，按赔率继续`);
    }
    return makeMeta('defensive_call', `以中等以上牌力 ${formatPercent(madeScore)} 防守跟注`);
  }

  if (action.type === 'all-in' && !isAggressive) {
    return makeMeta('defensive_call', '短码被动全下，属于防守跟注线');
  }

  if (action.type === 'all-in' && isAggressive) {
    if (madeScore >= 0.68 && draw.drawStrength < 0.2) {
      return makeMeta('value_all_in', `牌力强度 ${formatPercent(madeScore)}，以价值全下争取最大收益`);
    }
    return makeMeta('pressure_all_in', `以施压全下逼迫对手，听牌强度 ${formatPercent(draw.drawStrength)}`);
  }

  if (isAggressive) {
    const clearValueCategory =
      handCategory === 'straight_flush' ||
      handCategory === 'four_kind' ||
      handCategory === 'full_house' ||
      handCategory === 'flush' ||
      handCategory === 'straight' ||
      handCategory === 'three_kind' ||
      handCategory === 'two_pair';

    if ((madeScore >= 0.7 || clearValueCategory) && draw.drawStrength < 0.24) {
      return makeMeta('value_bet', `牌力强度 ${formatPercent(madeScore)}，主动做大底池`);
    }
    if (draw.drawStrength >= 0.22 && madeScore < 0.72) {
      return makeMeta('semi_bluff', `具备听牌权益（${formatPercent(draw.drawStrength)}），通过下注拿弃牌率`);
    }
    if (madeScore >= 0.55 && boardWetness > 0.45) {
      return makeMeta('value_bet', `湿润牌面（${formatPercent(boardWetness)}）下偏保护性价值下注`);
    }
    return makeMeta('bluff_pressure', `当前牌力较弱（${formatPercent(madeScore)}），以主动施压争取弃牌`);
  }

  return undefined;
}
