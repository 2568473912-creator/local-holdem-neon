import type { HumanPortraitKey } from '../types/portrait';
import type { AppLanguage } from '../i18n';
import { buildDoudizhuAiNames } from '../content/randomNames';
import { createRandomSeed } from '../utils/random';
import { sortHand, createDeck, shuffleDeck } from './cards';
import { chooseAiPlay, chooseBid } from './ai';
import { analyzePattern, canBeat, enumerateLegalPatterns, enumeratePatterns } from './rules';
import type { DdzActionResult, DdzCard, DdzConfig, DdzLogEntry, DdzMultiplierBreakdown, DdzMultiplierEvent, DdzPattern, DdzPlayerState, DdzRole, DdzRoundRuntime, DdzRoundSummary, DdzSessionStats } from './types';

const AI_STYLES = ['aggressive', 'balanced', 'tight', 'loose', 'aggressive', 'balanced'] as const;

const LOG_LIMIT = 20;

function hashSeed(seed: number): number {
  let state = seed >>> 0;
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return state >>> 0;
}

function nextPlayerId(players: DdzPlayerState[], currentId: string): string {
  const index = players.findIndex((player) => player.id === currentId);
  const nextIndex = (index + 1) % players.length;
  return players[nextIndex]?.id ?? players[0].id;
}

function currentPlayer(runtime: DdzRoundRuntime): DdzPlayerState {
  return runtime.players.find((player) => player.id === runtime.currentPlayerId) ?? runtime.players[0];
}

function resetPlayersForRound(players: DdzPlayerState[]): DdzPlayerState[] {
  return players.map((player) => ({
    ...player,
    role: 'undecided',
    hand: [],
    bid: null,
    lastAction: '等待',
    lastPlayedCards: [],
    passed: false,
  }));
}

function heroName(language?: AppLanguage): string {
  return language === 'zh-CN' || !language ? '你' : 'You';
}

function createRoster(seed: number, humanPortraitKey?: HumanPortraitKey, language?: AppLanguage): DdzPlayerState[] {
  const hashed = hashSeed(seed);
  const names = buildDoudizhuAiNames(2, `${seed}:${Date.now()}:${humanPortraitKey ?? 'host'}`, language);
  const leftAi = { name: names[0], style: AI_STYLES[hashed % AI_STYLES.length] };
  const rightAi = { name: names[1], style: AI_STYLES[(hashed + 2) % AI_STYLES.length] };

  return [
    {
      id: 'P0',
      name: heroName(language),
      seat: 0,
      isHuman: true,
      portraitKey: humanPortraitKey,
      style: 'balanced',
      role: 'undecided',
      hand: [],
      score: 0,
      wins: 0,
      bid: null,
      lastAction: '等待',
      lastPlayedCards: [],
      passed: false,
    },
    {
      id: 'P1',
      name: leftAi.name,
      seat: 1,
      isHuman: false,
      style: leftAi.style,
      role: 'undecided',
      hand: [],
      score: 0,
      wins: 0,
      bid: null,
      lastAction: '等待',
      lastPlayedCards: [],
      passed: false,
    },
    {
      id: 'P2',
      name: rightAi.name,
      seat: 2,
      isHuman: false,
      style: rightAi.style,
      role: 'undecided',
      hand: [],
      score: 0,
      wins: 0,
      bid: null,
      lastAction: '等待',
      lastPlayedCards: [],
      passed: false,
    },
  ];
}

function appendLog(log: DdzLogEntry[], text: string, tone: DdzLogEntry['tone'] = 'neutral'): DdzLogEntry[] {
  return [{ id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text, tone }, ...log].slice(0, LOG_LIMIT);
}

function createInitialMultiplierBreakdown(): DdzMultiplierBreakdown {
  return {
    bid: 1,
    bombCount: 0,
    rocketCount: 0,
    springApplied: false,
    finalMultiplier: 1,
    events: [],
  };
}

function createBidMultiplierBreakdown(bid: number, actor: DdzPlayerState): DdzMultiplierBreakdown {
  const normalizedBid = Math.max(1, bid);
  return {
    bid: normalizedBid,
    bombCount: 0,
    rocketCount: 0,
    springApplied: false,
    finalMultiplier: normalizedBid,
    events: [
      {
        kind: 'bid',
        label: `叫分 ${normalizedBid}`,
        factor: normalizedBid,
        byPlayerId: actor.id,
        byPlayerName: actor.name,
        totalMultiplier: normalizedBid,
      },
    ],
  };
}

function appendMultiplierEvent(
  breakdown: DdzMultiplierBreakdown,
  event: Omit<DdzMultiplierEvent, 'totalMultiplier'> & { totalMultiplier?: number },
): DdzMultiplierBreakdown {
  const totalMultiplier = event.totalMultiplier ?? breakdown.finalMultiplier;
  return {
    ...breakdown,
    finalMultiplier: totalMultiplier,
    events: [
      ...breakdown.events,
      {
        ...event,
        totalMultiplier,
      },
    ],
  };
}

interface DdzRoundOptions {
  dealSeed?: number;
}

function dealRound(players: DdzPlayerState[], dealSeed: number): { players: DdzPlayerState[]; bottomCards: DdzCard[]; dealSeed: number } {
  const deck = shuffleDeck(createDeck(), hashSeed(dealSeed));
  const hands = [deck.slice(0, 17), deck.slice(17, 34), deck.slice(34, 51)];
  const bottomCards = deck.slice(51);
  return {
    players: players.map((player, index) => ({
      ...player,
      hand: sortHand(hands[index]),
    })),
    bottomCards,
    dealSeed,
  };
}

function createRound(players: DdzPlayerState[], config: DdzConfig, round: number, options: DdzRoundOptions = {}): DdzRoundRuntime {
  const resetPlayers = resetPlayersForRound(players);
  const dealt = dealRound(resetPlayers, options.dealSeed ?? createRandomSeed());
  const startIndex = (round - 1) % dealt.players.length;
  const turnOrder = dealt.players.slice(startIndex).concat(dealt.players.slice(0, startIndex)).map((player) => player.id);
  return {
    phase: 'bidding',
    round,
    dealSeed: dealt.dealSeed,
    config,
    players: dealt.players,
    bottomCards: dealt.bottomCards,
    landlordId: null,
    currentPlayerId: turnOrder[0],
    bidding: {
      highestBid: 0,
      highestBidderId: null,
      turnOrder,
      currentIndex: 0,
      bids: Object.fromEntries(dealt.players.map((player) => [player.id, null])),
    },
    lead: {
      pattern: null,
      playerId: null,
      passCount: 0,
    },
    tableDisplay: {
      playerId: null,
      pattern: null,
      cards: [],
    },
    selectedCardIds: [],
    pendingHintIndex: 0,
    baseBid: 1,
    multiplier: 1,
    multiplierBreakdown: createInitialMultiplierBreakdown(),
    springTriggered: false,
    landlordPlayCount: 0,
    farmerPlayCount: 0,
    winnerId: null,
    winningTeam: null,
    banner: '叫分开始',
    log: appendLog([], `第 ${round} 局开始，准备叫分。`),
  };
}

function finalizeLandlord(runtime: DdzRoundRuntime, landlordId: string): DdzRoundRuntime {
  const landlord = runtime.players.find((player) => player.id === landlordId);
  if (!landlord) {
    return runtime;
  }

  const players = runtime.players.map((player) => {
    const role: DdzRole = player.id === landlordId ? 'landlord' : 'farmer';
    const nextHand = player.id === landlordId ? sortHand([...player.hand, ...runtime.bottomCards]) : player.hand;
    return {
      ...player,
      role,
      hand: nextHand,
      lastAction: player.id === landlordId ? `抢地主 ${runtime.bidding.highestBid} 分` : '等待出牌',
      passed: false,
    };
  });

  return {
    ...runtime,
    phase: 'playing',
    players,
    landlordId,
    currentPlayerId: landlordId,
    bidding: {
      ...runtime.bidding,
      highestBidderId: landlordId,
    },
    baseBid: Math.max(1, runtime.bidding.highestBid),
    multiplier: Math.max(1, runtime.bidding.highestBid),
    multiplierBreakdown: createBidMultiplierBreakdown(Math.max(1, runtime.bidding.highestBid), landlord),
    banner: `${landlord.name} 成为地主，开始出牌`,
    log: appendLog(runtime.log, `${landlord.name} 拿下地主，底牌加入手牌。`, 'alert'),
  };
}

export function createDouDizhuSession(config: DdzConfig, options: DdzRoundOptions = {}): DdzRoundRuntime {
  return createRound(createRoster(Date.now(), config.humanPortraitKey, config.language), config, 1, options);
}

export function restartDouDizhuSession(runtime: DdzRoundRuntime, options: DdzRoundOptions = {}): DdzRoundRuntime {
  const resetScores = runtime.players.map((player) => ({ ...player, score: 0, wins: 0 }));
  return createRound(resetScores, runtime.config, 1, options);
}

export function nextDouDizhuRound(runtime: DdzRoundRuntime, options: DdzRoundOptions = {}): DdzRoundRuntime {
  return createRound(runtime.players, runtime.config, runtime.round + 1, options);
}

export function getSelectedCards(runtime: DdzRoundRuntime): DdzCard[] {
  const human = runtime.players.find((player) => player.isHuman);
  if (!human) {
    return [];
  }
  const selected = new Set(runtime.selectedCardIds);
  return human.hand.filter((card) => selected.has(card.id));
}

export function toggleSelectedCard(runtime: DdzRoundRuntime, cardId: string): DdzRoundRuntime {
  const selected = new Set(runtime.selectedCardIds);
  if (selected.has(cardId)) {
    selected.delete(cardId);
  } else {
    selected.add(cardId);
  }
  return {
    ...runtime,
    selectedCardIds: [...selected],
  };
}

export function clearSelectedCards(runtime: DdzRoundRuntime): DdzRoundRuntime {
  return {
    ...runtime,
    selectedCardIds: [],
    pendingHintIndex: 0,
  };
}

export function cycleHint(runtime: DdzRoundRuntime): DdzActionResult {
  const human = runtime.players.find((player) => player.isHuman);
  if (!human) {
    return { runtime, error: '未找到人类玩家。' };
  }
  const hintPriority = (pattern: DdzPattern): number => {
    const explosivePenalty = pattern.type === 'rocket' ? -10 : pattern.type === 'bomb' ? -6 : 0;
    const comboBonus =
      pattern.type === 'airplane' || pattern.type === 'airplaneSingles' || pattern.type === 'airplanePairs'
        ? 4
        : pattern.type === 'straight' || pattern.type === 'pairStraight'
          ? 3
          : pattern.type === 'fourWithTwoSingles' || pattern.type === 'fourWithTwoPairs'
            ? 2
            : pattern.type === 'triplePair' || pattern.type === 'tripleSingle'
              ? 1
              : 0;
    return pattern.cardCount * 10 + pattern.sequenceLength * 4 + comboBonus + explosivePenalty;
  };
  const hints = (runtime.lead.pattern ? enumerateLegalPatterns(human.hand, runtime.lead.pattern) : enumeratePatterns(human.hand)).sort(
    (left, right) => hintPriority(right) - hintPriority(left) || left.mainRank - right.mainRank,
  );
  if (hints.length === 0) {
    return { runtime, error: '当前没有可出的牌型。' };
  }
  const hint = hints[runtime.pendingHintIndex % hints.length];
  return {
    runtime: {
      ...runtime,
      selectedCardIds: hint.cards.map((card) => card.id),
      pendingHintIndex: runtime.pendingHintIndex + 1,
      banner: `提示：${hint.description}`,
    },
  };
}

export function applyBid(runtime: DdzRoundRuntime, playerId: string, bid: number): DdzActionResult {
  if (runtime.phase !== 'bidding') {
    return { runtime, error: '当前不是叫分阶段。' };
  }
  if (runtime.currentPlayerId !== playerId) {
    return { runtime, error: '还没轮到该玩家叫分。' };
  }
  if (bid !== 0 && bid <= runtime.bidding.highestBid) {
    return { runtime, error: '叫分必须高于当前最高分。' };
  }

  const actor = currentPlayer(runtime);
  const players = runtime.players.map((player) =>
    player.id === playerId
      ? {
          ...player,
          bid,
          lastAction: bid === 0 ? '不叫' : `叫 ${bid} 分`,
        }
      : player,
  );
  const bidding = {
    ...runtime.bidding,
    highestBid: bid > runtime.bidding.highestBid ? bid : runtime.bidding.highestBid,
    highestBidderId: bid > runtime.bidding.highestBid ? playerId : runtime.bidding.highestBidderId,
    currentIndex: runtime.bidding.currentIndex + 1,
    bids: {
      ...runtime.bidding.bids,
      [playerId]: bid,
    },
  };

  let nextRuntime: DdzRoundRuntime = {
    ...runtime,
    players,
    bidding,
    banner: bid === 0 ? `${actor.name} 不叫` : `${actor.name} 叫 ${bid} 分`,
    log: appendLog(runtime.log, bid === 0 ? `${actor.name} 不叫。` : `${actor.name} 叫 ${bid} 分。`, bid === 0 ? 'neutral' : 'alert'),
  };

  if (bid === 3) {
    return {
      runtime: finalizeLandlord(nextRuntime, playerId),
    };
  }

  const allBid = bidding.currentIndex >= bidding.turnOrder.length;
  if (allBid) {
    if (!bidding.highestBidderId) {
      const redealt = createRound(runtime.players, runtime.config, runtime.round + 1);
      return {
        runtime: {
          ...redealt,
          banner: '无人叫分，重新发牌',
          log: appendLog(redealt.log, '本局无人叫分，重新洗牌。', 'alert'),
        },
      };
    }
    return {
      runtime: finalizeLandlord(nextRuntime, bidding.highestBidderId),
    };
  }

  nextRuntime = {
    ...nextRuntime,
    currentPlayerId: bidding.turnOrder[bidding.currentIndex] ?? bidding.turnOrder[0],
  };
  return { runtime: nextRuntime };
}

function removeCards(hand: DdzCard[], cardIds: string[]): DdzCard[] {
  const removal = new Set(cardIds);
  return hand.filter((card) => !removal.has(card.id));
}

function settleRound(runtime: DdzRoundRuntime, winnerId: string): DdzActionResult {
  const winner = runtime.players.find((player) => player.id === winnerId);
  const landlordId = runtime.landlordId;
  const landlord = landlordId ? runtime.players.find((player) => player.id === landlordId) : null;
  if (!winner || !landlordId || !landlord) {
    return { runtime, error: '结算失败：地主信息丢失。' };
  }

  const winningTeam = winner.id === landlordId ? 'landlord' : 'farmer';
  const springTriggered = winningTeam === 'landlord' ? runtime.farmerPlayCount === 0 : runtime.landlordPlayCount <= 1;
  const finalMultiplier = runtime.multiplier * (springTriggered ? 2 : 1);
  const scoreSwing = runtime.baseBid * finalMultiplier;
  const multiplierBreakdown = springTriggered
    ? appendMultiplierEvent(
        {
          ...runtime.multiplierBreakdown,
          springApplied: true,
        },
        {
          kind: 'spring',
          label: winningTeam === 'landlord' ? '春天' : '反春',
          factor: 2,
          byPlayerId: winner.id,
          byPlayerName: winner.name,
          totalMultiplier: finalMultiplier,
        },
      )
    : {
        ...runtime.multiplierBreakdown,
        finalMultiplier,
      };
  const players = runtime.players.map((player) => {
    let delta = 0;
    if (winningTeam === 'landlord') {
      delta = player.id === landlordId ? scoreSwing * 2 : -scoreSwing;
    } else {
      delta = player.id === landlordId ? -scoreSwing * 2 : scoreSwing;
    }
    return {
      ...player,
      score: player.score + delta,
      wins: player.wins + (player.id === winnerId || (winningTeam === 'farmer' && player.role === 'farmer') ? 1 : 0),
      lastAction: player.id === winnerId ? '本局获胜' : player.lastAction,
    };
  });
  const playerSummaries = players.map((player) => ({
    id: player.id,
    name: player.name,
    role: player.role,
    score: player.score,
    delta:
      winningTeam === 'landlord'
        ? player.id === landlordId
          ? scoreSwing * 2
          : -scoreSwing
        : player.id === landlordId
          ? -(scoreSwing * 2)
          : scoreSwing,
    isHuman: player.isHuman,
    winner: player.id === winnerId || (winningTeam === 'farmer' && player.role === 'farmer'),
  }));
  const heroDelta = playerSummaries.find((player) => player.id === 'P0')?.delta ?? 0;

  const summary: DdzRoundSummary = {
    round: runtime.round,
    dealSeed: runtime.dealSeed,
    landlordId,
    landlordName: landlord.name,
    winnerId,
    winnerName: winner.name,
    winningTeam,
    baseBid: runtime.baseBid,
    multiplier: finalMultiplier,
    multiplierBreakdown,
    springTriggered,
    scoreSwing,
    heroDelta,
    players: playerSummaries,
    timestamp: Date.now(),
  };

  return {
    runtime: {
      ...runtime,
      phase: 'settlement',
      players,
      winnerId,
      winningTeam,
      springTriggered,
      multiplier: finalMultiplier,
      multiplierBreakdown,
      banner: springTriggered ? `${winner.name} 赢下本局，春天翻倍！` : `${winner.name} 赢下本局`,
      log: appendLog(runtime.log, springTriggered ? `${winner.name} 胜出，触发春天，倍率来到 x${finalMultiplier}。` : `${winner.name} 胜出，本局倍率 x${finalMultiplier}。`, 'success'),
    },
    roundCompleted: summary,
  };
}

function applyPattern(runtime: DdzRoundRuntime, playerId: string, pattern: DdzPattern): DdzActionResult {
  if (runtime.phase !== 'playing') {
    return { runtime, error: '当前不是出牌阶段。' };
  }
  if (runtime.currentPlayerId !== playerId) {
    return { runtime, error: '还没轮到该玩家出牌。' };
  }
  if (runtime.lead.pattern && runtime.lead.playerId !== playerId && !canBeat(pattern, runtime.lead.pattern)) {
    return { runtime, error: `当前牌型不能压过 ${runtime.lead.pattern.description}。` };
  }

  const actor = runtime.players.find((player) => player.id === playerId);
  if (!actor) {
    return { runtime, error: '未找到出牌玩家。' };
  }

  const nextMultiplier = pattern.type === 'bomb' || pattern.type === 'rocket' ? runtime.multiplier * 2 : runtime.multiplier;
  const nextMultiplierBreakdown =
    pattern.type === 'bomb' || pattern.type === 'rocket'
      ? appendMultiplierEvent(
          {
            ...runtime.multiplierBreakdown,
            bombCount: runtime.multiplierBreakdown.bombCount + (pattern.type === 'bomb' ? 1 : 0),
            rocketCount: runtime.multiplierBreakdown.rocketCount + (pattern.type === 'rocket' ? 1 : 0),
          },
          {
            kind: pattern.type,
            label: pattern.description,
            factor: 2,
            byPlayerId: actor.id,
            byPlayerName: actor.name,
            totalMultiplier: nextMultiplier,
          },
        )
      : runtime.multiplierBreakdown;
  const players = runtime.players.map((player) => {
    if (player.id !== playerId) {
      return {
        ...player,
        passed: false,
      };
    }
    const nextHand = removeCards(player.hand, pattern.cards.map((card) => card.id));
    return {
      ...player,
      hand: sortHand(nextHand),
      lastAction: pattern.description,
      lastPlayedCards: pattern.cards,
      passed: false,
    };
  });

  const nextRuntime: DdzRoundRuntime = {
    ...runtime,
    players,
    currentPlayerId: nextPlayerId(players, playerId),
    lead: {
      pattern,
      playerId,
      passCount: 0,
    },
    tableDisplay: {
      playerId,
      pattern,
      cards: pattern.cards,
    },
    selectedCardIds: [],
    pendingHintIndex: 0,
    multiplier: nextMultiplier,
    multiplierBreakdown: nextMultiplierBreakdown,
    landlordPlayCount: runtime.landlordPlayCount + (actor.role === 'landlord' ? 1 : 0),
    farmerPlayCount: runtime.farmerPlayCount + (actor.role === 'farmer' ? 1 : 0),
    banner: `${actor.name} 打出 ${pattern.description}`,
    log: appendLog(runtime.log, `${actor.name} 打出 ${pattern.description}。`, pattern.type === 'bomb' || pattern.type === 'rocket' ? 'alert' : 'neutral'),
  };

  const nextActor = nextRuntime.players.find((player) => player.id === playerId);
  if (nextActor && nextActor.hand.length === 0) {
    return settleRound(nextRuntime, playerId);
  }

  return { runtime: nextRuntime };
}

export function playSelectedCards(runtime: DdzRoundRuntime, playerId: string): DdzActionResult {
  const player = runtime.players.find((entry) => entry.id === playerId);
  if (!player) {
    return { runtime, error: '未找到出牌玩家。' };
  }

  const chosenCards = player.hand.filter((card) => runtime.selectedCardIds.includes(card.id));
  if (chosenCards.length === 0) {
    return { runtime, error: '请先选择要出的牌。' };
  }
  const pattern = analyzePattern(chosenCards);
  if (!pattern) {
    return { runtime, error: '当前选择不是合法的斗地主牌型。' };
  }
  return applyPattern(runtime, playerId, pattern);
}

export function passTurn(runtime: DdzRoundRuntime, playerId: string): DdzActionResult {
  if (runtime.phase !== 'playing') {
    return { runtime, error: '当前不是出牌阶段。' };
  }
  if (runtime.currentPlayerId !== playerId) {
    return { runtime, error: '还没轮到该玩家操作。' };
  }
  if (!runtime.lead.pattern || runtime.lead.playerId === playerId) {
    return { runtime, error: '当前轮到你领出，不能选择不出。' };
  }

  const actor = runtime.players.find((player) => player.id === playerId);
  if (!actor) {
    return { runtime, error: '未找到操作玩家。' };
  }

  const players = runtime.players.map((player) =>
    player.id === playerId
      ? {
          ...player,
          passed: true,
          lastAction: '不出',
        }
      : player,
  );
  const passCount = runtime.lead.passCount + 1;
  if (passCount >= 2) {
    const controller = runtime.players.find((player) => player.id === runtime.lead.playerId);
    const controllerName = controller?.name ?? '上家';
    return {
      runtime: {
        ...runtime,
        players: players.map((player) => ({ ...player, passed: false })),
        currentPlayerId: runtime.lead.playerId ?? nextPlayerId(players, playerId),
        lead: {
          pattern: null,
          playerId: null,
          passCount: 0,
        },
        selectedCardIds: [],
        pendingHintIndex: 0,
        banner: `${controllerName} 获得牌权，重新领出`,
        log: appendLog(runtime.log, `${actor.name} 不出，${controllerName} 重新领出。`, 'neutral'),
      },
    };
  }

  return {
    runtime: {
      ...runtime,
      players,
      currentPlayerId: nextPlayerId(players, playerId),
      lead: {
        ...runtime.lead,
        passCount,
      },
      selectedCardIds: [],
      pendingHintIndex: 0,
      banner: `${actor.name} 不出`,
      log: appendLog(runtime.log, `${actor.name} 不出。`, 'neutral'),
    },
  };
}

export function runAiAction(runtime: DdzRoundRuntime): DdzActionResult {
  const actor = currentPlayer(runtime);
  if (actor.isHuman) {
    return { runtime, error: '当前轮到人类玩家，不应自动执行 AI。' };
  }
  return runAutoPlayerAction(runtime, actor.id);
}

export function runAutoPlayerAction(runtime: DdzRoundRuntime, playerId: string): DdzActionResult {
  const actor = runtime.players.find((player) => player.id === playerId);
  if (!actor) {
    return { runtime, error: '未找到自动操作玩家。' };
  }
  if (runtime.currentPlayerId !== playerId) {
    return { runtime, error: '当前未轮到该玩家自动操作。' };
  }

  if (runtime.phase === 'bidding') {
    const desiredBid = chooseBid(actor, runtime.config.aiDifficulty);
    const normalizedBid = desiredBid > 3 ? 3 : desiredBid;
    if (normalizedBid <= runtime.bidding.highestBid) {
      return applyBid(runtime, actor.id, 0);
    }
    return applyBid(runtime, actor.id, normalizedBid);
  }

  if (runtime.phase !== 'playing') {
    return { runtime };
  }

  const play = chooseAiPlay(runtime, actor.id);
  if (!play) {
    return passTurn(runtime, actor.id);
  }
  return applyPattern(runtime, actor.id, play);
}

export function canPass(runtime: DdzRoundRuntime, playerId: string): boolean {
  return runtime.phase === 'playing' && runtime.currentPlayerId === playerId && Boolean(runtime.lead.pattern) && runtime.lead.playerId !== playerId;
}

export function legalPatternsForPlayer(runtime: DdzRoundRuntime, playerId: string): DdzPattern[] {
  const player = runtime.players.find((entry) => entry.id === playerId);
  if (!player) {
    return [];
  }
  return runtime.lead.pattern ? enumerateLegalPatterns(player.hand, runtime.lead.pattern) : enumeratePatterns(player.hand);
}

export function computeSessionStats(history: DdzRoundSummary[]): DdzSessionStats {
  return history.reduce<DdzSessionStats>(
    (acc, entry) => {
      acc.rounds += 1;
      if (entry.winnerId === 'P0') acc.humanWins += 1;
      if (entry.winningTeam === 'landlord') acc.landlordWins += 1;
      if (entry.winningTeam === 'farmer') acc.farmerWins += 1;
      acc.bestSwing = Math.max(acc.bestSwing, entry.scoreSwing * (entry.winnerId === 'P0' ? 2 : 1));
      return acc;
    },
    {
      rounds: 0,
      humanWins: 0,
      landlordWins: 0,
      farmerWins: 0,
      bestSwing: 0,
    },
  );
}
