import type { Card } from '../types/cards';
import type {
  ActionOption,
  AggressionTracker,
  GameConfig,
  PlayerAction,
  PlayerState,
  TableState,
} from '../types/game';
import type { HumanPortraitKey } from '../types/portrait';
import type { HandHistoryRecord } from '../types/replay';
import { getActionOptions, validateAction } from './actionValidation';
import { inferActionTeachingMeta } from './actionTeaching';
import { applyBettingAction, buildPostflopQueue, buildPreflopQueue, postAnte, postBlind, resetStreetBets } from './bettingRound';
import { createDeck, drawCards, shuffleDeck } from './cards';
import { buildPotSegments, settlePots } from './potSettlement';
import { getAlivePlayers, nextAliveSeat, seatOrderFrom } from './tableUtils';
import { getTournamentLevel } from './tournamentStructure';
import { getAiPackOption } from '../content/aiPacks';
import { buildHoldemAiNames } from '../content/randomNames';
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

const STYLE_ROTATION: PlayerState['style'][] = ['balanced', 'tight', 'aggressive', 'loose'];

function buildAiRoster(
  config: GameConfig,
  totalAi: number,
): Array<{ name: string; portraitKey?: HumanPortraitKey; style: PlayerState['style'] }> {
  const pack = getAiPackOption(config.aiPackKey ?? 'club-core', config.language);
  const names = pack.names;
  const seed = `${config.mode}:${config.aiDifficulty}:${config.sessionMode}:${config.startingChips}:${config.smallBlind}:${config.bigBlind}:${config.humanPortraitKey ?? 'host'}:${Date.now()}`;
  const shuffledNames = buildHoldemAiNames(names, totalAi, seed);
  return shuffledNames.map((name, index) => ({
    name,
    portraitKey: pack.portraitKeys[index % pack.portraitKeys.length],
    style: pack.stylePlan[index % pack.stylePlan.length] ?? STYLE_ROTATION[index % STYLE_ROTATION.length],
  }));
}

function clonePlayers(players: PlayerState[]): PlayerState[] {
  return players.map((p) => ({
    ...p,
    holeCards: [...p.holeCards],
  }));
}

function createPlayer(
  id: string,
  seat: number,
  name: string,
  isHuman: boolean,
  style: PlayerState['style'],
  stack: number,
  portraitKey?: HumanPortraitKey,
): PlayerState {
  return {
    id,
    seat,
    name,
    isHuman,
    portraitKey,
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

function determineStraddleSeat(players: PlayerState[], bigBlindSeat: number): number | undefined {
  const alive = getAlivePlayers(players);
  if (alive.length < 3) {
    return undefined;
  }
  return nextAliveSeat(players, bigBlindSeat);
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

function getInitialHoleCardCount(mode: TableState['mode']): number {
  if (mode === 'omaha' || mode === 'plo') {
    return 4;
  }
  return 2;
}

function isStudMode(mode: TableState['mode']): boolean {
  return mode === 'stud';
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
  return getTournamentLevel(config).ante;
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
    straddleSeat: undefined,
    straddleAmount: 0,
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
    const studMode = isStudMode(table.mode);
    const revealCount = studMode ? 0 : getStreetRevealCount(fromStreet);
    let nextDeck = table.deck;
    let boardAfter = table.board;
    let playersAfterDeal = table.players;
    let revealedCards: Card[] = [];

    if (studMode) {
      const dealingOrder = seatOrderFrom(
        table.players.filter((player) => !player.eliminated && !player.folded),
        table.dealerSeat,
      );
      playersAfterDeal = clonePlayers(table.players);

      for (const target of dealingOrder) {
        const draw = drawCards(nextDeck, 1);
        nextDeck = draw.deck;
        const card = draw.cards[0];
        const player = playersAfterDeal.find((candidate) => candidate.id === target.id);
        if (!player || !card) {
          continue;
        }
        player.holeCards.push(card);
        addReplayEvent(replayBuilder, {
          type: 'deal_hole',
          stage: nextStreet,
          actorId: player.id,
          note: `${player.name} 获得第 ${player.holeCards.length} 张牌`,
          cards: [...player.holeCards],
        });
      }
    } else {
      const draw = drawCards(nextDeck, revealCount);
      nextDeck = draw.deck;
      revealedCards = draw.cards;
      boardAfter = [...table.board, ...draw.cards];
    }

    const resetPlayers = resetStreetBets(playersAfterDeal);
    const nextQueue = buildPostflopQueue(resetPlayers, table.dealerSeat);

    table = {
      ...table,
      deck: nextDeck,
      board: boardAfter,
      boardRevealOrder: studMode ? table.boardRevealOrder : [...table.boardRevealOrder, ...revealedCards],
      stage: nextStreet,
      players: resetPlayers,
      betting: {
        currentBet: 0,
        minRaise: table.config.bigBlind,
        actionQueue: nextQueue,
      },
      statusText:
        studMode
          ? nextStreet === 'flop'
            ? '第二轮发牌'
            : nextStreet === 'turn'
              ? '第三轮发牌'
              : '第四轮发牌'
          : nextStreet === 'flop'
            ? '翻牌圈'
            : nextStreet === 'turn'
              ? '转牌圈'
              : nextStreet === 'river'
                ? '河牌圈'
                : table.statusText,
    };

    addReplayEvent(replayBuilder, {
      type: 'street_transition',
      stage: nextStreet,
      note: studMode
        ? `进入${nextStreet === 'flop' ? '第二轮下注' : nextStreet === 'turn' ? '第三轮下注' : '第四轮下注'}`
        : `进入${nextStreet === 'flop' ? '翻牌圈' : nextStreet === 'turn' ? '转牌圈' : '河牌圈'}`,
      from: fromStreet,
      to: nextStreet,
      resetBets: true,
      activePlayerId: nextQueue[0],
    });

    if (!studMode) {
      addReplayEvent(replayBuilder, {
        type: 'reveal_board',
        stage: nextStreet,
        note: nextStreet === 'flop' ? '发出翻牌' : nextStreet === 'turn' ? '发出转牌' : '发出河牌',
        cards: revealedCards,
        boardAfter,
      });
    }

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

function dealHoleCards(players: PlayerState[], deck: Card[], dealerSeat: number, rounds = 2): { players: PlayerState[]; deck: Card[] } {
  const nextPlayers = clonePlayers(players);
  let nextDeck = [...deck];

  const alive = nextPlayers.filter((p) => !p.eliminated);
  const order = seatOrderFrom(alive, dealerSeat);

  for (let round = 0; round < rounds; round += 1) {
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
  const aiRoster = buildAiRoster(config, config.aiCount);
  const humanName =
    config.language === 'ja'
      ? 'あなた'
      : config.language === 'fr'
        ? 'Vous'
        : config.language === 'de'
          ? 'Du'
          : config.language === 'en'
            ? 'You'
            : '你';

  players.push(createPlayer('P0', 0, humanName, true, 'balanced', config.startingChips, config.humanPortraitKey));

  for (let i = 1; i < total; i += 1) {
    players.push(
      createPlayer(
        `P${i}`,
        i,
        aiRoster[i - 1].name,
        false,
        aiRoster[i - 1].style,
        config.startingChips,
        aiRoster[i - 1].portraitKey,
      ),
    );
  }

  return players;
}

export function isSessionOver(players: PlayerState[]): boolean {
  return players.filter((p) => !p.eliminated).length <= 1;
}

export function startHand(config: GameConfig, sourcePlayers: PlayerState[], handId: number, previousDealerSeat: number, sessionId = 'session-unknown'): HandRuntime {
  let players = resetForNewHand(clonePlayers(sourcePlayers));
  const alive = getAlivePlayers(players);

  if (alive.length <= 1) {
    const terminalTable = createBaseTable(config, players, handId, previousDealerSeat >= 0 ? previousDealerSeat : 0);
    terminalTable.stage = 'complete';
    terminalTable.statusText = '比赛结束';
    const replayBuilder = createHandReplayBuilder({
      sessionId,
      handId,
      timestamp: Date.now(),
      gameMode: config.mode,
      sessionMode: config.sessionMode,
      aiDifficulty: config.aiDifficulty,
      blindInfo: { smallBlind: config.smallBlind, bigBlind: config.bigBlind },
      participants: players.map((p) => ({ id: p.id, name: p.name, seat: p.seat, style: p.style, portraitKey: p.portraitKey })),
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
    sessionId,
    handId,
    timestamp: Date.now(),
    gameMode: config.mode,
    sessionMode: config.sessionMode,
    aiDifficulty: config.aiDifficulty,
    blindInfo: { smallBlind: config.smallBlind, bigBlind: config.bigBlind },
    participants: players.map((p) => ({ id: p.id, name: p.name, seat: p.seat, style: p.style, portraitKey: p.portraitKey })),
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
  const dealt = dealHoleCards(players, freshDeck, dealerSeat, getInitialHoleCardCount(config.mode));
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

  let straddleSeat: number | undefined;
  let straddleAmount = 0;
  if (config.sessionMode === 'cash' && config.straddleMode === 'utg' && !isStudMode(config.mode)) {
    const candidateSeat = determineStraddleSeat(players, bbSeat);
    if (candidateSeat !== undefined) {
      const straddlePlayer = players.find((p) => p.seat === candidateSeat);
      if (straddlePlayer && !straddlePlayer.eliminated && straddlePlayer.stack > 0) {
        const forcedStraddle = config.bigBlind * 2;
        const straddlePosted = postBlind(players, straddlePlayer.id, forcedStraddle);
        players = straddlePosted.players;
        straddleSeat = candidateSeat;
        straddleAmount = straddlePosted.posted;
        totalPot = totalPotFromPlayers(players);
        addReplayEvent(replayBuilder, {
          type: 'post_blind',
          stage: 'preflop',
          actorId: straddlePlayer.id,
          note: `${straddlePlayer.name} 投入跨注 ${straddlePosted.posted}`,
          blindType: 'straddle',
          amount: straddlePosted.posted,
          stackAfter: players.find((p) => p.id === straddlePlayer.id)?.stack ?? 0,
          potAfter: totalPot,
        });
      }
    }
  }

  const forcedOpenSeat = straddleSeat ?? bbSeat;
  const actionQueue = buildPreflopQueue(players, forcedOpenSeat);
  const currentBet = players.reduce((max, player) => Math.max(max, player.currentBet), 0);
  const currentBbBet = players.find((p) => p.id === bbPlayer.id)?.currentBet ?? 0;
  const straddlePlayerId =
    straddleSeat !== undefined ? players.find((p) => p.seat === straddleSeat && !p.eliminated)?.id : undefined;
  const straddleBet = straddlePlayerId ? players.find((p) => p.id === straddlePlayerId)?.currentBet ?? 0 : 0;
  const lastForcedAggressorId = straddlePlayerId && straddleBet > currentBbBet ? straddlePlayerId : bbPlayer.id;

  table.players = players;
  table.deck = deck;
  table.totalPot = totalPot;
  table.straddleSeat = straddleSeat;
  table.straddleAmount = straddleAmount;
  table.betting = {
    currentBet,
    minRaise: config.bigBlind,
    actionQueue,
    lastAggressorId: lastForcedAggressorId,
  };
  table.activePlayerId = actionQueue[0];
  table.statusText = isStudMode(config.mode)
    ? '第一轮下注'
    : straddleSeat !== undefined
      ? '翻前行动（跨注生效）'
      : '翻前行动';
  replayBuilder.initialSnapshot.activePlayerId = actionQueue[0];

  return {
    table,
    replayBuilder,
  };
}

export function createInitialHand(config: GameConfig, sessionId = 'session-unknown'): HandRuntime {
  const players = createPlayers(config);
  return startHand(config, players, 1, -1, sessionId);
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
