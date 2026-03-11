import type { Card } from '../types/cards';
import type {
  ActionOption,
  AggressionTracker,
  GameConfig,
  PlayerAction,
  PlayerState,
  TableState,
} from '../types/game';
import type { HandHistoryRecord } from '../types/replay';
import { getActionOptions, validateAction } from './actionValidation';
import { inferActionTeachingMeta } from './actionTeaching';
import { applyBettingAction, buildPostflopQueue, buildPreflopQueue, postAnte, postBlind, resetStreetBets } from './bettingRound';
import { createDeck, drawCards, shuffleDeck } from './cards';
import { buildPotSegments, settlePots } from './potSettlement';
import { getAlivePlayers, nextAliveSeat, seatOrderFrom } from './tableUtils';
import {
  addReplayEvent,
  createHandReplayBuilder,
  finalizeHandReplay,
  type HandReplayBuilderState,
} from '../replay/replayBuilder';

export interface HandRuntime {
  table: TableState;
  replayBuilder: HandReplayBuilderState;
}

export interface EngineStepResult {
  runtime: HandRuntime;
  handCompleted: boolean;
  handRecord?: HandHistoryRecord;
  error?: string;
}

const AI_NAMES = ['霓虹鲨鱼', '黑桃猎手', '筹码法师', '深蓝读牌者', '冷面狙击手', '极光玩家', '隐身猎狐', '边池工程师', '红心流浪者', '夜店庄家'];
const STYLE_ROTATION: PlayerState['style'][] = ['balanced', 'tight', 'aggressive', 'loose'];

function clonePlayers(players: PlayerState[]): PlayerState[] {
  return players.map((p) => ({
    ...p,
    holeCards: [...p.holeCards],
  }));
}

function createPlayer(id: string, seat: number, name: string, isHuman: boolean, style: PlayerState['style'], stack: number): PlayerState {
  return {
    id,
    seat,
    name,
    isHuman,
    style,
    stack,
    holeCards: [],
    folded: false,
    allIn: false,
    eliminated: false,
    currentBet: 0,
    committed: 0,
    actedThisStreet: false,
    lastAction: '等待',
    revealed: isHuman,
  };
}

function resetForNewHand(players: PlayerState[]): PlayerState[] {
  return players.map((p) => ({
    ...p,
    holeCards: [],
    folded: false,
    allIn: false,
    currentBet: 0,
    committed: 0,
    actedThisStreet: false,
    lastAction: p.eliminated ? '淘汰' : '等待',
    revealed: p.isHuman,
    eliminated: p.stack <= 0,
  }));
}

function determineBlindSeats(players: PlayerState[], dealerSeat: number): { sbSeat: number; bbSeat: number } {
  const alive = getAlivePlayers(players);
  if (alive.length === 2) {
    const bbSeat = nextAliveSeat(players, dealerSeat);
    return {
      sbSeat: dealerSeat,
      bbSeat,
    };
  }

  const sbSeat = nextAliveSeat(players, dealerSeat);
  const bbSeat = nextAliveSeat(players, sbSeat);
  return { sbSeat, bbSeat };
}

function resetBettingQueue(table: TableState): TableState {
  const activePlayerId = table.betting.actionQueue[0];
  return {
    ...table,
    activePlayerId,
  };
}

function getStreetRevealCount(stage: TableState['stage']): number {
  if (stage === 'preflop') return 3;
  if (stage === 'flop') return 1;
  if (stage === 'turn') return 1;
  return 0;
}

function getNextStreet(stage: TableState['stage']): TableState['stage'] {
  if (stage === 'preflop') return 'flop';
  if (stage === 'flop') return 'turn';
  if (stage === 'turn') return 'river';
  return stage;
}

function collectHoleCards(players: PlayerState[]): Record<string, Card[]> {
  const result: Record<string, Card[]> = {};
  for (const player of players) {
    result[player.id] = [...player.holeCards];
  }
  return result;
}

function totalPotFromPlayers(players: PlayerState[]): number {
  return players.reduce((sum, p) => sum + p.committed, 0);
}

function getTournamentAnte(config: GameConfig): number {
  if (config.sessionMode !== 'tournament') {
    return 0;
  }
  return Math.max(1, Math.round(config.bigBlind * 0.1));
}

function createAggressionTracker(players: PlayerState[]): AggressionTracker {
  const raiseCountByPlayer: Record<string, number> = {};
  const voluntaryActionsByPlayer: Record<string, number> = {};
  const foldedToAggressionByPlayer: Record<string, number> = {};

  for (const player of players) {
    raiseCountByPlayer[player.id] = 0;
    voluntaryActionsByPlayer[player.id] = 0;
    foldedToAggressionByPlayer[player.id] = 0;
  }

  return {
    streetAggressors: {},
    lastAggressorId: undefined,
    raiseCountByPlayer,
    voluntaryActionsByPlayer,
    foldedToAggressionByPlayer,
  };
}

function cloneAggressionTracker(tracker: AggressionTracker): AggressionTracker {
  return {
    streetAggressors: { ...tracker.streetAggressors },
    lastAggressorId: tracker.lastAggressorId,
    raiseCountByPlayer: { ...tracker.raiseCountByPlayer },
    voluntaryActionsByPlayer: { ...tracker.voluntaryActionsByPlayer },
    foldedToAggressionByPlayer: { ...tracker.foldedToAggressionByPlayer },
  };
}

function incrementCounter(counter: Record<string, number>, playerId: string, by = 1): void {
  counter[playerId] = (counter[playerId] ?? 0) + by;
}

function updateAggressionFromAction(
  table: TableState,
  playerId: string,
  action: PlayerAction,
  applied: ReturnType<typeof applyBettingAction>,
): AggressionTracker {
  const tracker = cloneAggressionTracker(table.aggression);
  incrementCounter(tracker.voluntaryActionsByPlayer, playerId);

  const stage = table.stage;
  const onBettingStreet = stage === 'preflop' || stage === 'flop' || stage === 'turn' || stage === 'river';
  const wasAggressive =
    action.type === 'bet' ||
    action.type === 'raise' ||
    (action.type === 'all-in' && applied.betAfter > table.betting.currentBet);

  if (onBettingStreet && wasAggressive) {
    tracker.streetAggressors[stage] = playerId;
    tracker.lastAggressorId = playerId;
    incrementCounter(tracker.raiseCountByPlayer, playerId);
  }

  if (action.type === 'fold' && applied.toCallBefore > 0) {
    const stageAggressor = onBettingStreet ? tracker.streetAggressors[stage] : undefined;
    const aggressorId = stageAggressor ?? table.betting.lastAggressorId ?? tracker.lastAggressorId;
    if (aggressorId && aggressorId !== playerId) {
      incrementCounter(tracker.foldedToAggressionByPlayer, playerId);
    }
  }

  return tracker;
}

function createBaseTable(config: GameConfig, players: PlayerState[], handId: number, dealerSeat: number): TableState {
  return {
    handId,
    mode: config.mode,
    stage: 'preflop',
    config,
    players,
    deck: [],
    board: [],
    boardRevealOrder: [],
    dealerSeat,
    smallBlindSeat: dealerSeat,
    bigBlindSeat: dealerSeat,
    betting: {
      currentBet: 0,
      minRaise: config.bigBlind,
      actionQueue: [],
    },
    aggression: createAggressionTracker(players),
    activePlayerId: undefined,
    pots: [],
    totalPot: 0,
    payouts: [],
    showdownHands: [],
    winners: [],
    statusText: '准备发牌',
    handStartedAt: Date.now(),
  };
}

function finishHand(runtime: HandRuntime, withShowdown: boolean): EngineStepResult {
  const { table, replayBuilder } = runtime;
  const eliminatedBefore = new Set(
    table.players
      .filter((player) => player.eliminated || player.stack <= 0)
      .map((player) => player.id),
  );

  const sidePots = buildPotSegments(table.players);
  sidePots.forEach((pot, idx) => {
    if (idx >= 1) {
      addReplayEvent(replayBuilder, {
        type: 'side_pot',
        stage: 'settlement',
        note: `创建边池 ${pot.id}（${pot.amount}）`,
        pot,
      });
    }
  });

  const settlement = settlePots(table.mode, table.players, table.board, table.dealerSeat);

  if (withShowdown) {
    addReplayEvent(replayBuilder, {
      type: 'showdown',
      stage: 'showdown',
      note: '进入摊牌',
      evaluatedHands: settlement.showdownHands,
    });
  }

  for (const payout of settlement.payouts) {
    addReplayEvent(replayBuilder, {
      type: 'payout',
      stage: 'settlement',
      note: `${payout.playerId} 赢得 ${payout.amount}`,
      payout,
    });
  }

  const players = settlement.players.map((p) => ({
    ...p,
    eliminated: p.stack <= 0,
    lastAction: p.stack <= 0 ? '淘汰' : p.lastAction,
    revealed: withShowdown ? !p.folded : p.isHuman,
  }));

  for (const player of players) {
    if (player.eliminated && !eliminatedBefore.has(player.id)) {
      addReplayEvent(replayBuilder, {
        type: 'elimination',
        stage: 'settlement',
        actorId: player.id,
        note: `${player.name} 被淘汰`,
      });
    }
  }

  addReplayEvent(replayBuilder, {
    type: 'hand_end',
    stage: 'complete',
    note: '本局结束',
    winners: settlement.winners,
    totalPot: settlement.payouts.reduce((sum, item) => sum + item.amount, 0),
  });

  const finalTable: TableState = {
    ...table,
    players,
    stage: 'complete',
    activePlayerId: undefined,
    pots: settlement.pots,
    payouts: settlement.payouts,
    winners: settlement.winners,
    showdownHands: settlement.showdownHands,
    statusText: settlement.statusText,
    totalPot: 0,
  };

  const handRecord = finalizeHandReplay(replayBuilder, {
    players,
    holeCards: collectHoleCards(players),
    communityCardsRevealOrder: finalTable.boardRevealOrder,
    showdownHands: settlement.showdownHands,
    winners: settlement.winners,
    payoutBreakdown: settlement.payouts,
    potBreakdown: settlement.pots,
  });

  return {
    runtime: {
      table: finalTable,
      replayBuilder,
    },
    handCompleted: true,
    handRecord,
  };
}

function progressTable(runtime: HandRuntime): EngineStepResult {
  let { table } = runtime;
  const { replayBuilder } = runtime;

  while (true) {
    const inHand = table.players.filter((p) => !p.eliminated && !p.folded);

    if (inHand.length <= 1) {
      return finishHand({ table, replayBuilder }, false);
    }

    if (table.betting.actionQueue.length > 0) {
      table = {
        ...table,
        activePlayerId: table.betting.actionQueue[0],
      };
      return {
        runtime: { table, replayBuilder },
        handCompleted: false,
      };
    }

    if (table.stage === 'river') {
      table = {
        ...table,
        stage: 'showdown',
        activePlayerId: undefined,
      };
      return finishHand({ table, replayBuilder }, true);
    }

    const fromStreet = table.stage;
    const nextStreet = getNextStreet(fromStreet);
    const revealCount = getStreetRevealCount(fromStreet);

    const draw = drawCards(table.deck, revealCount);
    const boardAfter = [...table.board, ...draw.cards];
    const resetPlayers = resetStreetBets(table.players);
    const nextQueue = buildPostflopQueue(resetPlayers, table.dealerSeat);

    table = {
      ...table,
      deck: draw.deck,
      board: boardAfter,
      boardRevealOrder: [...table.boardRevealOrder, ...draw.cards],
      stage: nextStreet,
      players: resetPlayers,
      betting: {
        currentBet: 0,
        minRaise: table.config.bigBlind,
        actionQueue: nextQueue,
      },
      statusText:
        nextStreet === 'flop' ? '翻牌圈' : nextStreet === 'turn' ? '转牌圈' : nextStreet === 'river' ? '河牌圈' : table.statusText,
    };

    addReplayEvent(replayBuilder, {
      type: 'street_transition',
      stage: nextStreet,
      note: `进入${nextStreet === 'flop' ? '翻牌圈' : nextStreet === 'turn' ? '转牌圈' : '河牌圈'}`,
      from: fromStreet,
      to: nextStreet,
      resetBets: true,
      activePlayerId: nextQueue[0],
    });

    addReplayEvent(replayBuilder, {
      type: 'reveal_board',
      stage: nextStreet,
      note: nextStreet === 'flop' ? '发出翻牌' : nextStreet === 'turn' ? '发出转牌' : '发出河牌',
      cards: draw.cards,
      boardAfter,
    });

    const actionableCount = table.players.filter((p) => !p.eliminated && !p.folded && !p.allIn).length;

    if (actionableCount <= 1 && table.stage !== 'river') {
      table = {
        ...table,
        betting: {
          ...table.betting,
          actionQueue: [],
        },
        activePlayerId: undefined,
      };
    }

    if (table.betting.actionQueue.length > 0) {
      table = resetBettingQueue(table);
      return {
        runtime: {
          table,
          replayBuilder,
        },
        handCompleted: false,
      };
    }

    if (table.stage === 'river') {
      table = {
        ...table,
        stage: 'showdown',
      };
      return finishHand({ table, replayBuilder }, true);
    }
  }
}

function dealHoleCards(players: PlayerState[], deck: Card[], dealerSeat: number): { players: PlayerState[]; deck: Card[] } {
  const nextPlayers = clonePlayers(players);
  let nextDeck = [...deck];

  const alive = nextPlayers.filter((p) => !p.eliminated);
  const order = seatOrderFrom(alive, dealerSeat);

  for (let round = 0; round < 2; round += 1) {
    for (const player of order) {
      const draw = drawCards(nextDeck, 1);
      nextDeck = draw.deck;
      const target = nextPlayers.find((p) => p.id === player.id);
      if (target) {
        target.holeCards.push(draw.cards[0]);
      }
    }
  }

  return {
    players: nextPlayers,
    deck: nextDeck,
  };
}

export function createPlayers(config: GameConfig): PlayerState[] {
  const total = config.aiCount + 1;
  const players: PlayerState[] = [];

  players.push(createPlayer('P0', 0, '你', true, 'balanced', config.startingChips));

  for (let i = 1; i < total; i += 1) {
    players.push(
      createPlayer(
        `P${i}`,
        i,
        AI_NAMES[(i - 1) % AI_NAMES.length],
        false,
        STYLE_ROTATION[(i - 1) % STYLE_ROTATION.length],
        config.startingChips,
      ),
    );
  }

  return players;
}

export function isSessionOver(players: PlayerState[]): boolean {
  return players.filter((p) => !p.eliminated).length <= 1;
}

export function startHand(config: GameConfig, sourcePlayers: PlayerState[], handId: number, previousDealerSeat: number): HandRuntime {
  let players = resetForNewHand(clonePlayers(sourcePlayers));
  const alive = getAlivePlayers(players);

  if (alive.length <= 1) {
    const terminalTable = createBaseTable(config, players, handId, previousDealerSeat >= 0 ? previousDealerSeat : 0);
    terminalTable.stage = 'complete';
    terminalTable.statusText = '比赛结束';
    const replayBuilder = createHandReplayBuilder({
      handId,
      timestamp: Date.now(),
      gameMode: config.mode,
      sessionMode: config.sessionMode,
      aiDifficulty: config.aiDifficulty,
      blindInfo: { smallBlind: config.smallBlind, bigBlind: config.bigBlind },
      participants: players.map((p) => ({ id: p.id, name: p.name, seat: p.seat, style: p.style })),
      dealerSeat: terminalTable.dealerSeat,
      smallBlindSeat: terminalTable.dealerSeat,
      bigBlindSeat: terminalTable.dealerSeat,
      startingChips: Object.fromEntries(players.map((p) => [p.id, p.stack])),
      players,
    });

    return {
      table: terminalTable,
      replayBuilder,
    };
  }

  const dealerSeat = previousDealerSeat < 0 ? alive[0].seat : nextAliveSeat(players, previousDealerSeat);
  const { sbSeat, bbSeat } = determineBlindSeats(players, dealerSeat);

  const table = createBaseTable(config, players, handId, dealerSeat);
  table.smallBlindSeat = sbSeat;
  table.bigBlindSeat = bbSeat;

  const startingChips = Object.fromEntries(players.map((p) => [p.id, p.stack]));

  const replayBuilder = createHandReplayBuilder({
    handId,
    timestamp: Date.now(),
    gameMode: config.mode,
    sessionMode: config.sessionMode,
    aiDifficulty: config.aiDifficulty,
    blindInfo: { smallBlind: config.smallBlind, bigBlind: config.bigBlind },
    participants: players.map((p) => ({ id: p.id, name: p.name, seat: p.seat, style: p.style })),
    dealerSeat,
    smallBlindSeat: sbSeat,
    bigBlindSeat: bbSeat,
    startingChips,
    players,
  });

  addReplayEvent(replayBuilder, {
    type: 'hand_start',
    stage: 'preflop',
    note: `第 ${handId} 手开始`,
    dealerSeat,
    sbSeat,
    bbSeat,
  });

  const freshDeck = shuffleDeck(createDeck(config.mode));
  const dealt = dealHoleCards(players, freshDeck, dealerSeat);
  players = dealt.players;
  const deck = dealt.deck;

  for (const player of players.filter((p) => !p.eliminated)) {
    addReplayEvent(replayBuilder, {
      type: 'deal_hole',
      stage: 'preflop',
      actorId: player.id,
      note: `${player.name} 获得底牌`,
      cards: [...player.holeCards],
    });
  }

  const sbPlayer = players.find((p) => p.seat === sbSeat);
  const bbPlayer = players.find((p) => p.seat === bbSeat);

  if (!sbPlayer || !bbPlayer) {
    throw new Error('Blind seats invalid');
  }

  const anteAmount = getTournamentAnte(config);
  if (anteAmount > 0) {
    const anteOrder = [...players.filter((p) => !p.eliminated)].sort((a, b) => a.seat - b.seat);
    for (const antePlayer of anteOrder) {
      const antePosted = postAnte(players, antePlayer.id, anteAmount);
      players = antePosted.players;

      const totalPot = totalPotFromPlayers(players);
      addReplayEvent(replayBuilder, {
        type: 'post_blind',
        stage: 'preflop',
        actorId: antePlayer.id,
        note: `${antePlayer.name} 投入前注 ${antePosted.posted}`,
        blindType: 'ante',
        amount: antePosted.posted,
        stackAfter: players.find((p) => p.id === antePlayer.id)?.stack ?? 0,
        potAfter: totalPot,
      });
    }
  }

  const sbPosted = postBlind(players, sbPlayer.id, config.smallBlind);
  players = sbPosted.players;

  let totalPot = totalPotFromPlayers(players);
  addReplayEvent(replayBuilder, {
    type: 'post_blind',
    stage: 'preflop',
    actorId: sbPlayer.id,
    note: `${sbPlayer.name} 投入小盲 ${sbPosted.posted}`,
    blindType: 'sb',
    amount: sbPosted.posted,
    stackAfter: players.find((p) => p.id === sbPlayer.id)?.stack ?? 0,
    potAfter: totalPot,
  });

  const bbPosted = postBlind(players, bbPlayer.id, config.bigBlind);
  players = bbPosted.players;

  totalPot = totalPotFromPlayers(players);
  addReplayEvent(replayBuilder, {
    type: 'post_blind',
    stage: 'preflop',
    actorId: bbPlayer.id,
    note: `${bbPlayer.name} 投入大盲 ${bbPosted.posted}`,
    blindType: 'bb',
    amount: bbPosted.posted,
    stackAfter: players.find((p) => p.id === bbPlayer.id)?.stack ?? 0,
    potAfter: totalPot,
  });

  const actionQueue = buildPreflopQueue(players, bbSeat);

  table.players = players;
  table.deck = deck;
  table.totalPot = totalPot;
  table.betting = {
    currentBet: Math.max(
      players.find((p) => p.id === bbPlayer.id)?.currentBet ?? 0,
      players.find((p) => p.id === sbPlayer.id)?.currentBet ?? 0,
    ),
    minRaise: config.bigBlind,
    actionQueue,
    lastAggressorId: bbPlayer.id,
  };
  table.activePlayerId = actionQueue[0];
  table.statusText = '翻前行动';
  replayBuilder.initialSnapshot.activePlayerId = actionQueue[0];

  return {
    table,
    replayBuilder,
  };
}

export function createInitialHand(config: GameConfig): HandRuntime {
  const players = createPlayers(config);
  return startHand(config, players, 1, -1);
}

export function getCurrentPlayer(table: TableState): PlayerState | undefined {
  if (!table.activePlayerId) {
    return undefined;
  }
  return table.players.find((p) => p.id === table.activePlayerId);
}

export function getHumanPlayer(table: TableState): PlayerState | undefined {
  return table.players.find((p) => p.isHuman);
}

export function getHumanActionOptions(table: TableState): ActionOption[] {
  const human = getHumanPlayer(table);
  if (!human) {
    return [];
  }
  return getActionOptions(table, human.id);
}

export function applyAction(runtime: HandRuntime, playerId: string, action: PlayerAction): EngineStepResult {
  const { table, replayBuilder } = runtime;

  if (table.stage === 'complete') {
    return {
      runtime,
      handCompleted: true,
      error: '当前手牌已结束',
    };
  }

  const validation = validateAction(table, playerId, action);
  if (!validation.valid) {
    return {
      runtime,
      handCompleted: false,
      error: validation.reason,
    };
  }

  const playerBeforeAction = table.players.find((p) => p.id === playerId);
  const applied = applyBettingAction(table, playerId, action);
  const teachingMeta = playerBeforeAction ? inferActionTeachingMeta(table, playerBeforeAction, action, applied) : undefined;

  const updatedTable: TableState = {
    ...table,
    players: applied.players,
    betting: applied.betting,
    aggression: updateAggressionFromAction(table, playerId, action, applied),
    totalPot: totalPotFromPlayers(applied.players),
    statusText: applied.note,
  };

  addReplayEvent(replayBuilder, {
    type: 'action',
    stage: table.stage,
    actorId: playerId,
    note: `${updatedTable.players.find((p) => p.id === playerId)?.name ?? playerId} ${applied.note}`,
    actionType: applied.actionType,
    amount: applied.amountPut,
    toCall: applied.toCallBefore,
    stackAfter: applied.stackAfter,
    betAfter: applied.betAfter,
    potAfter: updatedTable.totalPot,
    isAllIn: applied.isAllIn,
    isFold: applied.isFold,
    isFullRaise: applied.isFullRaise,
    activePlayerAfter: updatedTable.betting.actionQueue[0],
    teachingTag: teachingMeta?.tag,
    teachingLabel: teachingMeta?.label,
    teachingNote: teachingMeta?.note,
  });

  return progressTable({
    table: updatedTable,
    replayBuilder,
  });
}
