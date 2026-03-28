import { describe, expect, it } from 'vitest';
import type { Card } from '../src/types/cards';
import type { PlayerState, TableState } from '../src/types/game';
import { getActionOptions, validateAction } from '../src/engine/actionValidation';
import { applyBettingAction } from '../src/engine/bettingRound';
import { applyAction, createInitialHand, startHand } from '../src/engine/handEngine';
import { buildPotSegments, settlePots } from '../src/engine/potSettlement';
import { getTournamentLevel, syncTournamentConfig } from '../src/engine/tournamentStructure';

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
    holeCards: overrides.holeCards ?? [makeCard(2, 'clubs'), makeCard(7, 'diamonds')],
    folded: overrides.folded ?? false,
    allIn: overrides.allIn ?? false,
    eliminated: overrides.eliminated ?? false,
    currentBet: overrides.currentBet ?? 0,
    committed: overrides.committed ?? 0,
    actedThisStreet: overrides.actedThisStreet ?? false,
    lastAction: overrides.lastAction ?? '等待',
    revealed: overrides.revealed ?? false,
  };
}

function makeTable(overrides: Partial<TableState>): TableState {
  const players = overrides.players ?? [makePlayer({ id: 'P0', isHuman: true }), makePlayer({ id: 'P1', seat: 1 })];
  const mode = overrides.mode ?? 'standard';
  return {
    handId: overrides.handId ?? 1,
    mode,
    stage: overrides.stage ?? 'preflop',
    config:
      overrides.config ??
      {
        mode,
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
    players,
    deck: overrides.deck ?? [],
    board: overrides.board ?? [],
    boardRevealOrder: overrides.boardRevealOrder ?? [],
    dealerSeat: overrides.dealerSeat ?? 0,
    smallBlindSeat: overrides.smallBlindSeat ?? 0,
    bigBlindSeat: overrides.bigBlindSeat ?? 1,
    straddleSeat: overrides.straddleSeat,
    straddleAmount: overrides.straddleAmount ?? 0,
    betting:
      overrides.betting ?? {
        currentBet: 0,
        minRaise: 20,
        actionQueue: [],
      },
    aggression:
      overrides.aggression ?? {
        streetAggressors: {},
        lastAggressorId: undefined,
        raiseCountByPlayer: Object.fromEntries(players.map((p) => [p.id, 0])),
        voluntaryActionsByPlayer: Object.fromEntries(players.map((p) => [p.id, 0])),
        foldedToAggressionByPlayer: Object.fromEntries(players.map((p) => [p.id, 0])),
      },
    activePlayerId: overrides.activePlayerId,
    pots: overrides.pots ?? [],
    totalPot: overrides.totalPot ?? 0,
    payouts: overrides.payouts ?? [],
    showdownHands: overrides.showdownHands ?? [],
    winners: overrides.winners ?? [],
    statusText: overrides.statusText ?? '',
    handStartedAt: overrides.handStartedAt ?? Date.now(),
  };
}

describe('pot settlement and side-pot logic', () => {
  it('builds multi-way side pots correctly with folded contributors', () => {
    const players = [
      makePlayer({ id: 'P0', seat: 0, committed: 100 }),
      makePlayer({ id: 'P1', seat: 1, committed: 200, folded: true }),
      makePlayer({ id: 'P2', seat: 2, committed: 500 }),
    ];

    const pots = buildPotSegments(players);
    expect(pots).toHaveLength(3);

    expect(pots[0]).toMatchObject({ amount: 300, eligiblePlayerIds: ['P0', 'P2'] });
    expect(pots[1]).toMatchObject({ amount: 200, eligiblePlayerIds: ['P2'] });
    expect(pots[2]).toMatchObject({ amount: 300, eligiblePlayerIds: ['P2'] });
  });

  it('splits tied pots and allocates odd chip by dealer position', () => {
    const players = [
      makePlayer({ id: 'P0', seat: 0, stack: 0, committed: 101, holeCards: [makeCard(2, 'clubs'), makeCard(3, 'diamonds')] }),
      makePlayer({ id: 'P1', seat: 1, stack: 0, committed: 101, holeCards: [makeCard(4, 'clubs'), makeCard(5, 'diamonds')] }),
      makePlayer({ id: 'P2', seat: 2, stack: 0, committed: 1, folded: true }),
    ];

    const board = [
      makeCard(10, 'spades'),
      makeCard(11, 'spades'),
      makeCard(12, 'spades'),
      makeCard(13, 'spades'),
      makeCard(14, 'spades'),
    ];

    const result = settlePots('standard', players, board, 0);
    const p0 = result.players.find((p) => p.id === 'P0');
    const p1 = result.players.find((p) => p.id === 'P1');

    expect(p0?.stack).toBe(101);
    expect(p1?.stack).toBe(102);
    expect(result.payouts.reduce((sum, it) => sum + it.amount, 0)).toBe(203);
    expect(new Set(result.winners)).toEqual(new Set(['P0', 'P1']));
  });
});

describe('action validation and short all-in behavior', () => {
  it('locks re-raise rights after a non-full raise when player already acted', () => {
    const player = makePlayer({ id: 'P0', isHuman: true, stack: 500, currentBet: 100, actedThisStreet: true });
    const villain = makePlayer({ id: 'P1', seat: 1, currentBet: 200 });

    const table = makeTable({
      players: [player, villain],
      activePlayerId: 'P0',
      betting: {
        currentBet: 200,
        minRaise: 100,
        actionQueue: ['P0'],
      },
    });

    const raiseCheck = validateAction(table, 'P0', { type: 'raise', amount: 300 });
    const allInCheck = validateAction(table, 'P0', { type: 'all-in' });
    const callCheck = validateAction(table, 'P0', { type: 'call' });
    const options = getActionOptions(table, 'P0');
    const raiseOption = options.find((opt) => opt.type === 'raise');

    expect(raiseCheck.valid).toBe(false);
    expect(allInCheck.valid).toBe(false);
    expect(callCheck.valid).toBe(true);
    expect(raiseOption?.enabled).toBe(false);
    expect(raiseOption?.reason).toContain('不可再加注');
  });

  it('does not reopen action after a short all-in raise', () => {
    const players = [
      makePlayer({ id: 'P0', seat: 0, stack: 50, currentBet: 100, committed: 100, actedThisStreet: false }),
      makePlayer({ id: 'P1', seat: 1, stack: 500, currentBet: 100, committed: 100, actedThisStreet: true }),
      makePlayer({ id: 'P2', seat: 2, stack: 500, currentBet: 100, committed: 100, actedThisStreet: true }),
    ];

    const table = makeTable({
      players,
      activePlayerId: 'P0',
      betting: {
        currentBet: 100,
        minRaise: 100,
        actionQueue: ['P0', 'P1', 'P2'],
      },
    });

    const result = applyBettingAction(table, 'P0', { type: 'all-in' });

    expect(result.isFullRaise).toBe(false);
    expect(result.betting.currentBet).toBe(150);
    expect(result.betting.actionQueue).toEqual(['P1', 'P2']);
    expect(result.players.find((p) => p.id === 'P1')?.actedThisStreet).toBe(true);
    expect(result.players.find((p) => p.id === 'P2')?.actedThisStreet).toBe(true);
  });
});

describe('tournament ante behavior', () => {
  it('posts ante into pot without changing preflop current bet baseline', () => {
    const runtime = createInitialHand(
      syncTournamentConfig({
      mode: 'standard',
      sessionMode: 'tournament',
      aiCount: 2,
      startingChips: 1000,
      smallBlind: 10,
      bigBlind: 20,
      blindLevel: 4,
      blindUpEveryHands: 5,
      fastMode: false,
      aiDifficulty: 'standard',
      tournamentStructureId: 'standard',
      }),
    );

    const table = runtime.table;
    const ante = getTournamentLevel(table.config).ante;

    expect(ante).toBe(10);
    expect(table.totalPot).toBe(ante * 3 + table.config.smallBlind + table.config.bigBlind);
    expect(table.betting.currentBet).toBe(table.config.bigBlind);

    const p0 = table.players.find((p) => p.id === 'P0');
    const p1 = table.players.find((p) => p.id === 'P1');
    const p2 = table.players.find((p) => p.id === 'P2');

    expect(p0?.currentBet).toBe(0);
    expect(p0?.committed).toBe(ante);
    expect(p1?.currentBet).toBe(table.config.smallBlind);
    expect(p1?.committed).toBe(ante + table.config.smallBlind);
    expect(p2?.currentBet).toBe(table.config.bigBlind);
    expect(p2?.committed).toBe(ante + table.config.bigBlind);

    const anteEvents = runtime.replayBuilder.events.filter((event) => event.type === 'post_blind' && event.blindType === 'ante');
    expect(anteEvents).toHaveLength(3);
  });
});

describe('replay elimination accuracy', () => {
  it('does not emit repeated elimination events for already busted players', () => {
    const config = {
      mode: 'standard' as const,
      sessionMode: 'cash' as const,
      aiCount: 2,
      startingChips: 1000,
      smallBlind: 10,
      bigBlind: 20,
      blindLevel: 1,
      blindUpEveryHands: 5,
      fastMode: false,
      aiDifficulty: 'standard' as const,
    };

    const players = [
      makePlayer({ id: 'P0', name: '你', seat: 0, isHuman: true, stack: 1000, eliminated: false }),
      makePlayer({ id: 'P1', name: '对手A', seat: 1, stack: 1000, eliminated: false }),
      makePlayer({ id: 'P2', name: '对手B', seat: 2, stack: 0, eliminated: true, lastAction: '淘汰' }),
    ];

    const runtime = startHand(config, players, 3, 2);
    const actorId = runtime.table.activePlayerId;
    expect(actorId).toBeDefined();

    const folded = applyAction(runtime, actorId ?? 'P0', { type: 'fold' });
    expect(folded.error).toBeUndefined();
    expect(folded.handCompleted).toBe(true);
    expect(folded.handRecord).toBeDefined();

    const eliminationIds = (folded.handRecord?.events ?? [])
      .filter((event) => event.type === 'elimination')
      .map((event) => event.actorId);

    expect(eliminationIds).not.toContain('P2');
  });
});

describe('new mode rules', () => {
  it('deals 4 hole cards in Omaha and PLO', () => {
    const omaha = createInitialHand({
      mode: 'omaha',
      sessionMode: 'cash',
      aiCount: 2,
      startingChips: 1000,
      smallBlind: 10,
      bigBlind: 20,
      blindLevel: 1,
      blindUpEveryHands: 5,
      fastMode: false,
      aiDifficulty: 'standard',
    });

    const plo = createInitialHand({
      mode: 'plo',
      sessionMode: 'cash',
      aiCount: 2,
      startingChips: 1000,
      smallBlind: 10,
      bigBlind: 20,
      blindLevel: 1,
      blindUpEveryHands: 5,
      fastMode: false,
      aiDifficulty: 'standard',
    });

    for (const player of omaha.table.players.filter((p) => !p.eliminated)) {
      expect(player.holeCards).toHaveLength(4);
    }
    for (const player of plo.table.players.filter((p) => !p.eliminated)) {
      expect(player.holeCards).toHaveLength(4);
    }
  });

  it('evaluates Omaha showdown with exactly two hole cards', () => {
    const players = [
      makePlayer({
        id: 'P0',
        seat: 0,
        stack: 0,
        committed: 100,
        holeCards: [makeCard(14, 'hearts'), makeCard(14, 'spades'), makeCard(13, 'clubs'), makeCard(12, 'clubs')],
      }),
      makePlayer({
        id: 'P1',
        seat: 1,
        stack: 0,
        committed: 100,
        holeCards: [makeCard(9, 'hearts'), makeCard(8, 'hearts'), makeCard(7, 'diamonds'), makeCard(6, 'diamonds')],
      }),
    ];

    const board = [makeCard(12, 'hearts'), makeCard(11, 'hearts'), makeCard(10, 'hearts'), makeCard(2, 'clubs'), makeCard(3, 'diamonds')];
    const result = settlePots('omaha', players, board, 0);

    expect(result.winners).toEqual(['P1']);
    const p1 = result.players.find((player) => player.id === 'P1');
    expect(p1?.stack).toBe(200);
  });

  it('caps PLO raise amount by pot-limit rule', () => {
    const actor = makePlayer({ id: 'P0', isHuman: true, seat: 0, currentBet: 40, stack: 1000, actedThisStreet: false });
    const villain = makePlayer({ id: 'P1', seat: 1, currentBet: 100, stack: 900, actedThisStreet: true });

    const table = makeTable({
      mode: 'plo',
      players: [actor, villain],
      activePlayerId: 'P0',
      totalPot: 180,
      betting: {
        currentBet: 100,
        minRaise: 100,
        actionQueue: ['P0'],
      },
    });

    const raiseOpt = getActionOptions(table, 'P0').find((option) => option.type === 'raise');
    expect(raiseOpt?.maxAmount).toBe(340);

    expect(validateAction(table, 'P0', { type: 'raise', amount: 340 }).valid).toBe(true);
    expect(validateAction(table, 'P0', { type: 'raise', amount: 350 }).valid).toBe(false);
  });

  it('deals stud cards street-by-street without community cards', () => {
    let runtime = createInitialHand({
      mode: 'stud',
      sessionMode: 'cash',
      aiCount: 2,
      startingChips: 1000,
      smallBlind: 10,
      bigBlind: 20,
      blindLevel: 1,
      blindUpEveryHands: 5,
      fastMode: false,
      aiDifficulty: 'standard',
    });

    expect(runtime.table.board).toHaveLength(0);
    for (const player of runtime.table.players.filter((p) => !p.eliminated)) {
      expect(player.holeCards).toHaveLength(2);
    }

    let guard = 0;
    while (runtime.table.stage === 'preflop' && guard < 24) {
      guard += 1;
      const actorId = runtime.table.activePlayerId;
      expect(actorId).toBeDefined();
      if (!actorId) break;

      const options = getActionOptions(runtime.table, actorId);
      const canCheck = options.some((option) => option.type === 'check' && option.enabled);
      const canCall = options.some((option) => option.type === 'call' && option.enabled);
      const action = canCheck ? { type: 'check' as const } : canCall ? { type: 'call' as const } : { type: 'fold' as const };
      const result = applyAction(runtime, actorId, action);
      expect(result.error).toBeUndefined();
      expect(result.handCompleted).toBe(false);
      runtime = result.runtime;
    }

    expect(runtime.table.stage).toBe('flop');
    expect(runtime.table.board).toHaveLength(0);
    for (const player of runtime.table.players.filter((p) => !p.eliminated && !p.folded)) {
      expect(player.holeCards).toHaveLength(3);
    }
  });
});
