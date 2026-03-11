import { describe, expect, it } from 'vitest';
import type { Card, GameMode } from '../src/types/cards';
import type { PlayerState, TableState } from '../src/types/game';
import { validateAction } from '../src/engine/actionValidation';
import { decideAiAction } from '../src/engine/ai';

function makeCard(rank: number, suit: Card['suit']): Card {
  return { rank, suit, code: `${rank}-${suit[0]}` };
}

function makePlayer(overrides: Partial<PlayerState>): PlayerState {
  return {
    id: overrides.id ?? 'P0',
    name: overrides.name ?? '玩家',
    seat: overrides.seat ?? 0,
    isHuman: overrides.isHuman ?? false,
    style: overrides.style ?? 'balanced',
    stack: overrides.stack ?? 1000,
    holeCards: overrides.holeCards ?? [makeCard(6, 'clubs'), makeCard(9, 'diamonds')],
    folded: overrides.folded ?? false,
    allIn: overrides.allIn ?? false,
    eliminated: overrides.eliminated ?? false,
    currentBet: overrides.currentBet ?? 0,
    committed: overrides.committed ?? overrides.currentBet ?? 0,
    actedThisStreet: overrides.actedThisStreet ?? false,
    lastAction: overrides.lastAction ?? '等待',
    revealed: overrides.revealed ?? false,
  };
}

function makeTable(overrides: Partial<TableState>): TableState {
  const mode: GameMode = overrides.mode ?? 'standard';
  const players = overrides.players ?? [makePlayer({ id: 'P0', isHuman: true }), makePlayer({ id: 'P1', seat: 1 })];

  return {
    handId: overrides.handId ?? 18,
    mode,
    stage: overrides.stage ?? 'preflop',
    config:
      overrides.config ?? {
        mode,
        sessionMode: 'cash',
        aiCount: players.length - 1,
        startingChips: 1000,
        smallBlind: 10,
        bigBlind: 20,
        blindLevel: 1,
        blindUpEveryHands: 5,
        fastMode: false,
        aiDifficulty: 'standard',
      },
    players,
    deck: overrides.deck ?? [],
    board: overrides.board ?? [],
    boardRevealOrder: overrides.boardRevealOrder ?? [],
    dealerSeat: overrides.dealerSeat ?? 0,
    smallBlindSeat: overrides.smallBlindSeat ?? 0,
    bigBlindSeat: overrides.bigBlindSeat ?? 1,
    betting:
      overrides.betting ?? {
        currentBet: 20,
        minRaise: 20,
        actionQueue: ['P1'],
      },
    aggression:
      overrides.aggression ?? {
        streetAggressors: {},
        lastAggressorId: undefined,
        raiseCountByPlayer: Object.fromEntries(players.map((p) => [p.id, 0])),
        voluntaryActionsByPlayer: Object.fromEntries(players.map((p) => [p.id, 0])),
        foldedToAggressionByPlayer: Object.fromEntries(players.map((p) => [p.id, 0])),
      },
    activePlayerId: overrides.activePlayerId ?? 'P1',
    pots: overrides.pots ?? [],
    totalPot: overrides.totalPot ?? 60,
    payouts: overrides.payouts ?? [],
    showdownHands: overrides.showdownHands ?? [],
    winners: overrides.winners ?? [],
    statusText: overrides.statusText ?? '',
    handStartedAt: overrides.handStartedAt ?? Date.now(),
  };
}

function decideAndValidate(table: TableState, actorId = 'P1') {
  const actor = table.players.find((p) => p.id === actorId);
  if (!actor) {
    throw new Error(`missing actor ${actorId}`);
  }

  const action = decideAiAction(table, actor);
  const validation = validateAction(table, actorId, action);
  expect(validation.valid, validation.reason).toBe(true);
  return action;
}

describe('AI street planning decisions', () => {
  it('plays premium preflop hands aggressively', () => {
    const actor = makePlayer({
      id: 'P1',
      seat: 1,
      style: 'aggressive',
      currentBet: 0,
      stack: 1200,
      holeCards: [makeCard(14, 'spades'), makeCard(14, 'hearts')],
    });

    const table = makeTable({
      handId: 31,
      players: [
        makePlayer({ id: 'P0', isHuman: true, currentBet: 20, seat: 0 }),
        actor,
        makePlayer({ id: 'P2', seat: 2, currentBet: 20 }),
      ],
      board: [],
      stage: 'preflop',
      betting: {
        currentBet: 20,
        minRaise: 20,
        actionQueue: ['P1'],
      },
      totalPot: 50,
      activePlayerId: 'P1',
    });

    const action = decideAndValidate(table);
    expect(['raise', 'all-in']).toContain(action.type);
  });

  it('folds weak air on river under heavy pressure', () => {
    const actor = makePlayer({
      id: 'P1',
      seat: 1,
      style: 'tight',
      currentBet: 0,
      stack: 760,
      holeCards: [makeCard(6, 'clubs'), makeCard(2, 'diamonds')],
    });

    const table = makeTable({
      handId: 47,
      players: [
        makePlayer({ id: 'P0', isHuman: true, currentBet: 320, seat: 0, stack: 640 }),
        actor,
      ],
      board: [makeCard(14, 'hearts'), makeCard(13, 'clubs'), makeCard(12, 'spades'), makeCard(9, 'diamonds'), makeCard(4, 'clubs')],
      stage: 'river',
      betting: {
        currentBet: 320,
        minRaise: 160,
        actionQueue: ['P1'],
      },
      totalPot: 420,
      activePlayerId: 'P1',
    });

    const action = decideAndValidate(table);
    expect(action.type).toBe('fold');
  });

  it('continues with strong combo draw on flop instead of overfolding', () => {
    const actor = makePlayer({
      id: 'P1',
      seat: 1,
      style: 'aggressive',
      currentBet: 0,
      stack: 980,
      holeCards: [makeCard(14, 'spades'), makeCard(11, 'spades')],
    });

    const table = makeTable({
      handId: 56,
      players: [
        makePlayer({ id: 'P0', isHuman: true, currentBet: 40, seat: 0, stack: 980 }),
        actor,
      ],
      board: [makeCard(13, 'spades'), makeCard(12, 'spades'), makeCard(2, 'diamonds')],
      stage: 'flop',
      betting: {
        currentBet: 40,
        minRaise: 40,
        actionQueue: ['P1'],
      },
      totalPot: 180,
      activePlayerId: 'P1',
    });

    const action = decideAndValidate(table);
    expect(['call', 'raise', 'all-in']).toContain(action.type);
  });

  it('stays legal when raise rights are locked after short all-in', () => {
    const actor = makePlayer({
      id: 'P1',
      seat: 1,
      style: 'aggressive',
      currentBet: 100,
      actedThisStreet: true,
      stack: 520,
      holeCards: [makeCard(14, 'spades'), makeCard(14, 'clubs')],
    });

    const table = makeTable({
      handId: 73,
      players: [
        makePlayer({ id: 'P0', isHuman: true, currentBet: 200, seat: 0, stack: 840 }),
        actor,
      ],
      board: [makeCard(10, 'hearts'), makeCard(7, 'clubs'), makeCard(2, 'spades')],
      stage: 'flop',
      betting: {
        currentBet: 200,
        minRaise: 100,
        actionQueue: ['P1'],
      },
      totalPot: 300,
      activePlayerId: 'P1',
    });

    const action = decideAndValidate(table);
    expect(['call', 'fold']).toContain(action.type);
  });

  it('respects short deck connectivity and avoids folding playable A9 suited preflop', () => {
    const actor = makePlayer({
      id: 'P1',
      seat: 1,
      style: 'loose',
      currentBet: 0,
      stack: 1000,
      holeCards: [makeCard(14, 'hearts'), makeCard(9, 'hearts')],
    });

    const table = makeTable({
      handId: 82,
      mode: 'shortDeck',
      config: {
        mode: 'shortDeck',
        sessionMode: 'cash',
        aiCount: 1,
        startingChips: 1000,
        smallBlind: 10,
        bigBlind: 20,
        blindLevel: 1,
        blindUpEveryHands: 5,
        fastMode: false,
        aiDifficulty: 'standard',
      },
      players: [
        makePlayer({ id: 'P0', isHuman: true, currentBet: 20, seat: 0 }),
        actor,
      ],
      board: [],
      stage: 'preflop',
      betting: {
        currentBet: 20,
        minRaise: 20,
        actionQueue: ['P1'],
      },
      totalPot: 40,
      activePlayerId: 'P1',
    });

    const action = decideAndValidate(table);
    expect(action.type).not.toBe('fold');
  });

  it('tightens calling range versus same aggressor barreling across streets', () => {
    const actor = makePlayer({
      id: 'P1',
      seat: 1,
      style: 'balanced',
      currentBet: 80,
      stack: 780,
      holeCards: [makeCard(10, 'clubs'), makeCard(8, 'diamonds')],
    });

    const table = makeTable({
      handId: 119,
      players: [
        makePlayer({
          id: 'P0',
          isHuman: true,
          seat: 0,
          style: 'tight',
          currentBet: 260,
          stack: 1140,
          holeCards: [makeCard(14, 'spades'), makeCard(12, 'spades')],
        }),
        actor,
      ],
      board: [makeCard(14, 'clubs'), makeCard(13, 'diamonds'), makeCard(7, 'spades'), makeCard(4, 'hearts')],
      stage: 'turn',
      betting: {
        currentBet: 260,
        minRaise: 120,
        actionQueue: ['P1'],
      },
      aggression: {
        streetAggressors: {
          preflop: 'P0',
          flop: 'P0',
          turn: 'P0',
        },
        lastAggressorId: 'P0',
        raiseCountByPlayer: { P0: 3, P1: 0 },
        voluntaryActionsByPlayer: { P0: 4, P1: 3 },
        foldedToAggressionByPlayer: { P0: 0, P1: 1 },
      },
      totalPot: 460,
      activePlayerId: 'P1',
    });

    const action = decideAndValidate(table);
    expect(action.type).toBe('fold');
  });

  it('uses initiative memory to continuation-bet on favorable flop texture', () => {
    const actor = makePlayer({
      id: 'P1',
      seat: 1,
      style: 'aggressive',
      currentBet: 0,
      stack: 920,
      holeCards: [makeCard(14, 'clubs'), makeCard(9, 'diamonds')],
    });

    const table = makeTable({
      handId: 127,
      players: [
        makePlayer({ id: 'P0', isHuman: true, seat: 0, currentBet: 0, stack: 960 }),
        actor,
      ],
      board: [makeCard(9, 'spades'), makeCard(4, 'hearts'), makeCard(2, 'clubs')],
      stage: 'flop',
      betting: {
        currentBet: 0,
        minRaise: 40,
        actionQueue: ['P1'],
      },
      aggression: {
        streetAggressors: {
          preflop: 'P1',
        },
        lastAggressorId: 'P1',
        raiseCountByPlayer: { P0: 0, P1: 1 },
        voluntaryActionsByPlayer: { P0: 1, P1: 1 },
        foldedToAggressionByPlayer: { P0: 0, P1: 0 },
      },
      totalPot: 120,
      activePlayerId: 'P1',
    });

    const action = decideAndValidate(table);
    expect(['bet', 'all-in']).toContain(action.type);
  });

  it('aggressive difficulty attacks more often in initiative c-bet spots', () => {
    const actor = makePlayer({
      id: 'P1',
      seat: 1,
      style: 'balanced',
      currentBet: 0,
      stack: 900,
      holeCards: [makeCard(13, 'clubs'), makeCard(11, 'diamonds')],
    });

    const shared = {
      handId: 141,
      players: [makePlayer({ id: 'P0', isHuman: true, seat: 0, currentBet: 0, stack: 940 }), actor],
      board: [makeCard(9, 'spades'), makeCard(4, 'hearts'), makeCard(2, 'clubs')],
      stage: 'flop' as const,
      betting: {
        currentBet: 0,
        minRaise: 40,
        actionQueue: ['P1'],
      },
      aggression: {
        streetAggressors: {
          preflop: 'P1' as const,
        },
        lastAggressorId: 'P1',
        raiseCountByPlayer: { P0: 0, P1: 1 },
        voluntaryActionsByPlayer: { P0: 1, P1: 1 },
        foldedToAggressionByPlayer: { P0: 0, P1: 0 },
      },
      totalPot: 120,
      activePlayerId: 'P1',
    };

    const aggressiveTable = makeTable({
      ...shared,
      config: {
        mode: 'standard',
        sessionMode: 'cash',
        aiCount: 1,
        startingChips: 1000,
        smallBlind: 10,
        bigBlind: 20,
        blindLevel: 1,
        blindUpEveryHands: 5,
        fastMode: false,
        aiDifficulty: 'aggressive',
      },
    });

    const conservativeTable = makeTable({
      ...shared,
      config: {
        mode: 'standard',
        sessionMode: 'cash',
        aiCount: 1,
        startingChips: 1000,
        smallBlind: 10,
        bigBlind: 20,
        blindLevel: 1,
        blindUpEveryHands: 5,
        fastMode: false,
        aiDifficulty: 'conservative',
      },
    });

    const aggressiveAction = decideAndValidate(aggressiveTable);
    const conservativeAction = decideAndValidate(conservativeTable);

    expect(['bet', 'all-in']).toContain(aggressiveAction.type);
    expect(['check', 'fold']).toContain(conservativeAction.type);
  });

  it('conservative difficulty folds more against turn pressure', () => {
    const actor = makePlayer({
      id: 'P1',
      seat: 1,
      style: 'balanced',
      currentBet: 100,
      stack: 760,
      holeCards: [makeCard(12, 'hearts'), makeCard(11, 'hearts')],
    });

    const shared = {
      handId: 149,
      players: [
        makePlayer({ id: 'P0', isHuman: true, seat: 0, currentBet: 260, stack: 980, style: 'tight' }),
        actor,
      ],
      board: [makeCard(14, 'hearts'), makeCard(10, 'hearts'), makeCard(6, 'clubs'), makeCard(3, 'diamonds')],
      stage: 'turn' as const,
      betting: {
        currentBet: 260,
        minRaise: 120,
        actionQueue: ['P1'],
      },
      aggression: {
        streetAggressors: {
          preflop: 'P0' as const,
          flop: 'P0' as const,
          turn: 'P0' as const,
        },
        lastAggressorId: 'P0',
        raiseCountByPlayer: { P0: 3, P1: 0 },
        voluntaryActionsByPlayer: { P0: 4, P1: 3 },
        foldedToAggressionByPlayer: { P0: 0, P1: 1 },
      },
      totalPot: 460,
      activePlayerId: 'P1',
    };

    const conservativeTable = makeTable({
      ...shared,
      config: {
        mode: 'standard',
        sessionMode: 'cash',
        aiCount: 1,
        startingChips: 1000,
        smallBlind: 10,
        bigBlind: 20,
        blindLevel: 1,
        blindUpEveryHands: 5,
        fastMode: false,
        aiDifficulty: 'conservative',
      },
    });

    const aggressiveTable = makeTable({
      ...shared,
      config: {
        mode: 'standard',
        sessionMode: 'cash',
        aiCount: 1,
        startingChips: 1000,
        smallBlind: 10,
        bigBlind: 20,
        blindLevel: 1,
        blindUpEveryHands: 5,
        fastMode: false,
        aiDifficulty: 'aggressive',
      },
    });

    const conservativeAction = decideAndValidate(conservativeTable);
    const aggressiveAction = decideAndValidate(aggressiveTable);

    expect(['call', 'fold']).toContain(conservativeAction.type);
    expect(['raise', 'all-in']).toContain(aggressiveAction.type);
  });
});
