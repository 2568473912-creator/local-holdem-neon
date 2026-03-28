import type { AIDifficulty } from '../types/game';
import type { AppLanguage } from '../i18n';
import { buildGuandanAiNames } from '../content/randomNames';
import { createRandomSeed } from '../utils/random';
import { chooseAiPattern } from './ai';
import { createDoubleDeck, levelLabel, nextLevelRank, shuffleDeck, sortHand } from './cards';
import { analyzePattern, legalPatternsForHand } from './rules';
import type {
  GdActionResult,
  GdCard,
  GdConfig,
  GdLogEntry,
  GdPattern,
  GdPlayerState,
  GdRoundRuntime,
  GdRoundSummary,
  GdSpecialEvent,
  GdSessionStats,
  GdTeam,
  GdTeamLevels,
  GdVictoryType,
} from './types';

const LOG_LIMIT = 24;
const SPECIAL_LIMIT = 12;

function appendLog(log: GdLogEntry[], text: string, tone: GdLogEntry['tone'] = 'neutral') {
  return [{ id: `gd-log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text, tone }, ...log].slice(0, LOG_LIMIT);
}

function makeSpecialEvent(kind: GdSpecialEvent['kind'], label: string, detail: string, playerId?: string | null): GdSpecialEvent {
  return {
    id: `gd-special-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind,
    label,
    detail,
    playerId,
  };
}

function appendSpecial(history: GdSpecialEvent[], event: GdSpecialEvent | null) {
  if (!event) return history;
  return [event, ...history].slice(0, SPECIAL_LIMIT);
}

function teamOfSeat(seat: number): GdTeam {
  return seat % 2 === 0 ? 'alpha' : 'beta';
}

function nextActivePlayerId(players: GdPlayerState[], fromPlayerId: string): string {
  const startIndex = players.findIndex((entry) => entry.id === fromPlayerId);
  for (let step = 1; step <= players.length; step += 1) {
    const candidate = players[(startIndex + step) % players.length];
    if (candidate.hand.length > 0) {
      return candidate.id;
    }
  }
  return fromPlayerId;
}

function heroName(language?: AppLanguage): string {
  return language === 'zh-CN' || !language ? '你' : 'You';
}

function createPlayers(hands: GdCard[][], config: GdConfig, teamLevels: GdTeamLevels): GdPlayerState[] {
  const aiNames = buildGuandanAiNames(3, `${config.aiDifficulty}:${config.humanPortraitKey ?? 'host'}:${Date.now()}`, config.language);
  return hands.map((hand, seat) => ({
    id: `P${seat}`,
    name: seat === 0 ? heroName(config.language) : aiNames[(seat - 1) % aiNames.length],
    seat,
    isHuman: seat === 0,
    portraitKey: seat === 0 ? config.humanPortraitKey : undefined,
    style: seat === 1 ? 'aggressive' : seat === 2 ? 'balanced' : 'tight',
    team: teamOfSeat(seat),
    hand: sortHand(hand, teamLevels[teamOfSeat(seat)]),
    score: 0,
    finishOrder: null,
    lastAction: '等待出牌',
    lastPlayedCards: [],
    passed: false,
  }));
}

function dealHands(seed = Date.now()): GdCard[][] {
  const deck = shuffleDeck(createDoubleDeck(), seed);
  return Array.from({ length: 4 }, (_, seat) => deck.slice(seat * 27, seat * 27 + 27));
}

interface GdRuntimeOptions {
  round?: number;
  teamLevels?: GdTeamLevels;
  scores?: Record<string, number>;
  starterId?: string;
  dealSeed?: number;
}

function determineStartingPlayer(players: GdPlayerState[]): string {
  const holder = players.find((player) => player.hand.some((card) => card.suit === 'spade' && card.rank === 2));
  return holder?.id ?? 'P0';
}

function victoryLabelForTeam(team: GdTeam, victoryType: GdVictoryType): string {
  const prefix = team === 'alpha' ? '我方' : '对家';
  if (victoryType === 'doubleDown') return `${prefix}双下`;
  if (victoryType === 'singleDown') return `${prefix}单下`;
  return `${prefix}险胜`;
}

function specialEventForPattern(player: GdPlayerState, pattern: GdPattern): GdSpecialEvent | null {
  if (pattern.type === 'jokerBomb') {
    return makeSpecialEvent('jokerBomb', `${player.name} 轰出天王炸弹`, '四王落桌，当前牌权直接进入最高强度压制。', player.id);
  }
  if (pattern.type === 'straightFlush') {
    return makeSpecialEvent('straightFlush', `${player.name} 亮出同花顺`, `${pattern.description} 直接切入高压牌型。`, player.id);
  }
  if (pattern.type === 'bomb') {
    return makeSpecialEvent('bomb', `${player.name} 打出炸弹`, `${pattern.description}，桌面节奏被强行改写。`, player.id);
  }
  return null;
}

function createRuntime(config: GdConfig, options: GdRuntimeOptions = {}): GdRoundRuntime {
  const round = options?.round ?? 1;
  const teamLevels = options?.teamLevels ?? { alpha: 2, beta: 2 };
  const dealSeed = options.dealSeed ?? createRandomSeed();
  const hands = dealHands(dealSeed);
  const players = createPlayers(hands, config, teamLevels).map((player) => ({
    ...player,
    score: options?.scores?.[player.id] ?? 0,
  }));
  const startingPlayerId = options?.starterId ?? determineStartingPlayer(players);
  return {
    phase: 'playing',
    round,
    dealSeed,
    config,
    players,
    currentPlayerId: startingPlayerId,
    startingPlayerId,
    selectedCardIds: [],
    pendingHintIndex: 0,
    teamLevels,
    trick: {
      pattern: null,
      playerId: null,
      passCount: 0,
    },
    tableDisplay: {
      playerId: null,
      pattern: null,
      cards: [],
    },
    finishOrder: [],
    winnerTeam: null,
    levelDelta: 0,
    victoryType: null,
    victoryLabel: null,
    specialBurst: null,
    specialHistory: [],
    banner: `${players.find((player) => player.id === startingPlayerId)?.name ?? '当前玩家'} 先手，当前级牌：我方 ${levelLabel(teamLevels, 'alpha')} / 对家 ${levelLabel(teamLevels, 'beta')}`,
    log: appendLog([], '掼蛋牌桌已准备，开始首轮领牌。'),
  };
}

export function createGuandanSession(config: GdConfig, options: GdRuntimeOptions = {}): GdRoundRuntime {
  return createRuntime(config, options);
}

export function restartGuandanSession(runtime: GdRoundRuntime, options: GdRuntimeOptions = {}): GdRoundRuntime {
  return createRuntime(runtime.config, options);
}

export function nextGuandanRound(runtime: GdRoundRuntime, options: GdRuntimeOptions = {}): GdRoundRuntime {
  const scores = Object.fromEntries(runtime.players.map((player) => [player.id, player.score]));
  const starterId = runtime.finishOrder[0] ?? runtime.startingPlayerId;
  return createRuntime(runtime.config, {
    ...options,
    round: runtime.round + 1,
    teamLevels: runtime.teamLevels,
    scores,
    starterId,
  });
}

export function setAIDifficulty(runtime: GdRoundRuntime, aiDifficulty: AIDifficulty): GdRoundRuntime {
  return {
    ...runtime,
    config: {
      ...runtime.config,
      aiDifficulty,
    },
    banner: `AI 难度已切换为 ${aiDifficulty === 'conservative' ? '保守' : aiDifficulty === 'aggressive' ? '激进' : '标准'}`,
  };
}

export function getSelectedCards(runtime: GdRoundRuntime): GdCard[] {
  const human = runtime.players.find((player) => player.isHuman);
  if (!human) return [];
  const selected = new Set(runtime.selectedCardIds);
  return human.hand.filter((card) => selected.has(card.id));
}

export function clearSelectedCards(runtime: GdRoundRuntime): GdRoundRuntime {
  return {
    ...runtime,
    selectedCardIds: [],
    pendingHintIndex: 0,
    banner: '已清空当前选牌。',
  };
}

export function toggleSelectedCard(runtime: GdRoundRuntime, cardId: string): GdRoundRuntime {
  const selected = new Set(runtime.selectedCardIds);
  if (selected.has(cardId)) selected.delete(cardId);
  else selected.add(cardId);
  return {
    ...runtime,
    selectedCardIds: [...selected],
    pendingHintIndex: 0,
  };
}

export function legalPatternsForPlayer(runtime: GdRoundRuntime, playerId: string): GdPattern[] {
  const player = runtime.players.find((entry) => entry.id === playerId);
  if (!player || player.hand.length === 0) return [];
  return legalPatternsForHand(player.hand, runtime.teamLevels[player.team], runtime.trick.pattern);
}

export function canPass(runtime: GdRoundRuntime, playerId: string): boolean {
  if (!runtime.trick.pattern || runtime.trick.playerId === playerId) return false;
  const player = runtime.players.find((entry) => entry.id === playerId);
  return Boolean(player && player.hand.length > 0);
}

export function cycleHint(runtime: GdRoundRuntime): GdActionResult {
  const legal = legalPatternsForPlayer(runtime, 'P0');
  if (legal.length === 0) {
    return { runtime: { ...runtime, banner: '当前没有可压制的牌型。' } };
  }
  const index = runtime.pendingHintIndex % legal.length;
  const target = legal[index];
  return {
    runtime: {
      ...runtime,
      selectedCardIds: target.cards.map((card) => card.id),
      pendingHintIndex: index + 1,
      banner: `提示：${target.description}`,
    },
  };
}

function levelDeltaFromFinishOrder(players: GdPlayerState[], finishOrder: string[]): number {
  const firstTeam = players.find((player) => player.id === finishOrder[0])?.team;
  if (!firstTeam) return 1;
  const secondTeam = players.find((player) => player.id === finishOrder[1])?.team;
  const thirdTeam = players.find((player) => player.id === finishOrder[2])?.team;
  if (secondTeam === firstTeam) return 3;
  if (thirdTeam === firstTeam) return 2;
  return 1;
}

function victoryTypeFromFinishOrder(players: GdPlayerState[], finishOrder: string[]): GdVictoryType {
  const firstTeam = players.find((player) => player.id === finishOrder[0])?.team;
  if (!firstTeam) return 'hardFought';
  const secondTeam = players.find((player) => player.id === finishOrder[1])?.team;
  const thirdTeam = players.find((player) => player.id === finishOrder[2])?.team;
  if (secondTeam === firstTeam) return 'doubleDown';
  if (thirdTeam === firstTeam) return 'singleDown';
  return 'hardFought';
}

function settleRound(runtime: GdRoundRuntime): GdActionResult {
  const finishOrder = [...runtime.finishOrder];
  const remaining = runtime.players.filter((player) => !finishOrder.includes(player.id)).map((player) => player.id);
  finishOrder.push(...remaining);
  const winningTeam = runtime.players.find((player) => player.id === finishOrder[0])?.team ?? 'alpha';
  const victoryType = victoryTypeFromFinishOrder(runtime.players, finishOrder);
  const levelDelta = levelDeltaFromFinishOrder(runtime.players, finishOrder);
  const victoryLabel = victoryLabelForTeam(winningTeam, victoryType);
  const teamLevelsAfter: GdTeamLevels = {
    ...runtime.teamLevels,
    [winningTeam]: nextLevelRank(runtime.teamLevels[winningTeam], levelDelta),
  };
  const players = runtime.players.map((player) => {
    const delta = player.team === winningTeam ? levelDelta : -levelDelta;
    return {
      ...player,
      score: player.score + delta,
      finishOrder: finishOrder.indexOf(player.id) + 1,
      lastAction:
        finishOrder[0] === player.id
          ? `${victoryLabel}头游`
          : player.hand.length === 0
            ? `本局第 ${finishOrder.indexOf(player.id) + 1} 名`
            : '本局结束',
    };
  });
  const victoryEvent = makeSpecialEvent(
    victoryType,
    victoryLabel,
    victoryType === 'doubleDown' ? '两位同队选手率先双下，整局直接跳三。' : victoryType === 'singleDown' ? '本队顶住节奏完成单下，整局升两级。' : '本队拿下头游但被对家缠住，仍然稳住 1 级。',
    finishOrder[0] ?? null,
  );
  const specials = appendSpecial(runtime.specialHistory, victoryEvent);
  const summary: GdRoundSummary = {
    round: runtime.round,
    dealSeed: runtime.dealSeed,
    winningTeam,
    levelDelta,
    victoryType,
    victoryLabel,
    teamLevelsBefore: runtime.teamLevels,
    teamLevelsAfter,
    finishOrder,
    specials,
    players: players.map((player) => ({
      id: player.id,
      name: player.name,
      team: player.team,
      finishOrder: player.finishOrder ?? 4,
      score: player.score,
      delta: player.team === winningTeam ? levelDelta : -levelDelta,
      isHuman: player.isHuman,
    })),
    timestamp: Date.now(),
  };

  return {
    runtime: {
      ...runtime,
      phase: 'settlement',
      players,
      finishOrder,
      winnerTeam: winningTeam,
      levelDelta,
      victoryType,
      victoryLabel,
      specialBurst: victoryEvent,
      specialHistory: specials,
      teamLevels: teamLevelsAfter,
      banner: `${victoryLabel}，级牌提升 ${levelDelta} 级。`,
      log: appendLog(runtime.log, `${victoryLabel}，级牌提升 ${levelDelta} 级。`, 'success'),
    },
    roundCompleted: summary,
  };
}

function activeHandCount(players: GdPlayerState[]): number {
  return players.filter((player) => player.hand.length > 0).length;
}

function resolveNextLeader(runtime: GdRoundRuntime): string {
  if (!runtime.trick.playerId) return runtime.currentPlayerId;
  const leadPlayer = runtime.players.find((player) => player.id === runtime.trick.playerId);
  if (leadPlayer && leadPlayer.hand.length > 0) return leadPlayer.id;
  return nextActivePlayerId(runtime.players, runtime.trick.playerId);
}

function applyPattern(runtime: GdRoundRuntime, playerId: string, pattern: GdPattern): GdActionResult {
  const player = runtime.players.find((entry) => entry.id === playerId);
  if (!player) return { runtime, error: '未找到当前玩家。' };
  if (runtime.currentPlayerId !== playerId || runtime.phase !== 'playing') return { runtime, error: '当前不能出牌。' };
  if (!legalPatternsForPlayer(runtime, playerId).some((entry) => entry.type === pattern.type && entry.cardCount === pattern.cardCount && entry.cards.map((card) => card.id).join(',') === pattern.cards.map((card) => card.id).join(','))) {
    return { runtime, error: '当前选择不是合法的掼蛋牌型。' };
  }

  const used = new Set(pattern.cards.map((card) => card.id));
  const nextPlayers = runtime.players.map((entry) => {
    if (entry.id !== playerId) {
      return { ...entry, passed: false };
    }
    const hand = sortHand(entry.hand.filter((card) => !used.has(card.id)), runtime.teamLevels[entry.team]);
    return {
      ...entry,
      hand,
      finishOrder: hand.length === 0 && entry.finishOrder === null ? runtime.finishOrder.length + 1 : entry.finishOrder,
      lastAction: pattern.description,
      lastPlayedCards: pattern.cards,
      passed: false,
    };
  });
  const specialEvent = specialEventForPattern(player, pattern);

  const nextFinishOrder = runtime.finishOrder.includes(playerId) || nextPlayers.find((entry) => entry.id === playerId)?.hand.length !== 0 ? runtime.finishOrder : [...runtime.finishOrder, playerId];
  const nextRuntime: GdRoundRuntime = {
    ...runtime,
    players: nextPlayers,
    selectedCardIds: [],
    pendingHintIndex: 0,
    trick: {
      pattern,
      playerId,
      passCount: 0,
    },
    tableDisplay: {
      playerId,
      pattern,
      cards: pattern.cards,
    },
    finishOrder: nextFinishOrder,
    specialBurst: specialEvent,
    specialHistory: appendSpecial(runtime.specialHistory, specialEvent),
    banner: `${player.name} 打出 ${pattern.description}`,
    log: appendLog(
      runtime.log,
      `${player.name} 打出 ${pattern.description}。`,
      pattern.type === 'bomb' || pattern.type === 'jokerBomb' || pattern.type === 'straightFlush' ? 'alert' : 'neutral',
    ),
  };

  if (activeHandCount(nextPlayers) <= 1) {
    return settleRound(nextRuntime);
  }

  return {
    runtime: {
      ...nextRuntime,
      currentPlayerId: nextActivePlayerId(nextPlayers, playerId),
    },
  };
}

export function playSelectedCards(runtime: GdRoundRuntime, playerId: string): GdActionResult {
  const player = runtime.players.find((entry) => entry.id === playerId);
  if (!player) return { runtime, error: '未找到当前玩家。' };
  const selected = player.hand.filter((card) => runtime.selectedCardIds.includes(card.id));
  const pattern = analyzePattern(selected, runtime.teamLevels[player.team]);
  if (!pattern) return { runtime, error: '当前选择不是合法的掼蛋牌型。' };
  return applyPattern(runtime, playerId, pattern);
}

export function passTurn(runtime: GdRoundRuntime, playerId: string): GdActionResult {
  if (!canPass(runtime, playerId)) {
    return { runtime, error: '当前不能过牌。' };
  }
  const player = runtime.players.find((entry) => entry.id === playerId);
  if (!player) return { runtime, error: '未找到当前玩家。' };
  const nextPlayers = runtime.players.map((entry) =>
    entry.id === playerId
      ? {
          ...entry,
          passed: true,
          lastAction: '过牌',
          lastPlayedCards: [],
        }
      : entry,
  );
  const activePlayers = nextPlayers.filter((entry) => entry.hand.length > 0);
  const nextPassCount = runtime.trick.passCount + 1;
  if (nextPassCount >= Math.max(1, activePlayers.length - 1)) {
    const nextLeaderId = resolveNextLeader({ ...runtime, players: nextPlayers });
    return {
      runtime: {
        ...runtime,
        players: nextPlayers.map((entry) => ({ ...entry, passed: false })),
        currentPlayerId: nextLeaderId,
        selectedCardIds: [],
        pendingHintIndex: 0,
        trick: {
          pattern: null,
          playerId: null,
          passCount: 0,
        },
        tableDisplay: {
          playerId: null,
          pattern: null,
          cards: [],
        },
        specialBurst: null,
        banner: `${nextPlayers.find((entry) => entry.id === nextLeaderId)?.name ?? '当前玩家'} 重新领牌。`,
        log: appendLog(runtime.log, `${player.name} 过牌，牌权回到新领牌阶段。`),
      },
    };
  }
  return {
    runtime: {
      ...runtime,
      players: nextPlayers,
      currentPlayerId: nextActivePlayerId(nextPlayers, playerId),
      trick: {
        ...runtime.trick,
        passCount: nextPassCount,
      },
      specialBurst: null,
      banner: `${player.name} 过牌`,
      log: appendLog(runtime.log, `${player.name} 过牌。`),
    },
  };
}

export function computeSessionStats(history: GdRoundSummary[]): GdSessionStats {
  return history.reduce<GdSessionStats>(
    (acc, entry) => {
      acc.rounds += 1;
      if (entry.winningTeam === 'alpha') {
        acc.humanTeamWins += 1;
        acc.alphaWins += 1;
      } else {
        acc.betaWins += 1;
      }
      const heroFinish = entry.players.find((player) => player.id === 'P0')?.finishOrder ?? 4;
      acc.bestFinish = Math.min(acc.bestFinish, heroFinish);
      return acc;
    },
    {
      rounds: 0,
      humanTeamWins: 0,
      alphaWins: 0,
      betaWins: 0,
      bestFinish: 4,
    },
  );
}

export function runAiAction(runtime: GdRoundRuntime): GdActionResult {
  const actor = runtime.players.find((entry) => entry.id === runtime.currentPlayerId);
  if (!actor || actor.isHuman) return { runtime, error: '当前不应由 AI 行动。' };
  const pattern = chooseAiPattern(runtime, actor.id);
  if (!pattern) {
    return passTurn(runtime, actor.id);
  }
  return applyPattern(runtime, actor.id, pattern);
}

export function runAutoPlayerAction(runtime: GdRoundRuntime, playerId: string): GdActionResult {
  const pattern = chooseAiPattern(runtime, playerId);
  if (!pattern) {
    return passTurn(runtime, playerId);
  }
  return applyPattern(runtime, playerId, pattern);
}
