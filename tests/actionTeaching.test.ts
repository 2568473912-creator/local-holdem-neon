import { describe, expect, it } from 'vitest';
import type { Card } from '../src/types/cards';
import type { PlayerState, TableState } from '../src/types/game';
import { inferActionTeachingMeta } from '../src/engine/actionTeaching';
import type { AppliedBettingAction } from '../src/engine/bettingRound';

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
    holeCards: overrides.holeCards ?? [makeCard(14, 'spades'), makeCard(13, 'spades')],
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
    stage: overrides.stage ?? 'flop',
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
    board: overrides.board ?? [makeCard(10, 'spades'), makeCard(9, 'spades'), makeCard(2, 'hearts')],
    boardRevealOrder: overrides.boardRevealOrder ?? [],
    dealerSeat: overrides.dealerSeat ?? 0,
    smallBlindSeat: overrides.smallBlindSeat ?? 0,
    bigBlindSeat: overrides.bigBlindSeat ?? 1,
    straddleSeat: overrides.straddleSeat,
    straddleAmount: overrides.straddleAmount ?? 0,
    betting:
      overrides.betting ?? {
        currentBet: 40,
        minRaise: 40,
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
    totalPot: overrides.totalPot ?? 180,
    payouts: overrides.payouts ?? [],
    showdownHands: overrides.showdownHands ?? [],
    winners: overrides.winners ?? [],
    statusText: overrides.statusText ?? '',
    handStartedAt: overrides.handStartedAt ?? Date.now(),
  };
}

function makeApplied(overrides: Partial<AppliedBettingAction>): AppliedBettingAction {
  return {
    players: overrides.players ?? [],
    betting:
      overrides.betting ?? {
        currentBet: 80,
        minRaise: 40,
        actionQueue: [],
      },
    actionType: overrides.actionType ?? 'raise',
    amountPut: overrides.amountPut ?? 80,
    toCallBefore: overrides.toCallBefore ?? 40,
    isAllIn: overrides.isAllIn ?? false,
    isFold: overrides.isFold ?? false,
    isFullRaise: overrides.isFullRaise ?? true,
    stackAfter: overrides.stackAfter ?? 920,
    betAfter: overrides.betAfter ?? 80,
    note: overrides.note ?? '加注到 80',
  };
}

describe('action teaching tags', () => {
  it('tags strong aggressive line as value bet', () => {
    const ai = makePlayer({
      id: 'P1',
      seat: 1,
      holeCards: [makeCard(14, 'spades'), makeCard(14, 'hearts')],
    });

    const table = makeTable({
      players: [makePlayer({ id: 'P0', isHuman: true, seat: 0 }), ai],
      board: [makeCard(14, 'clubs'), makeCard(9, 'diamonds'), makeCard(2, 'hearts')],
      betting: {
        currentBet: 40,
        minRaise: 40,
        actionQueue: ['P1'],
      },
      activePlayerId: 'P1',
    });

    const meta = inferActionTeachingMeta(table, ai, { type: 'raise', amount: 120 }, makeApplied({}));
    expect(meta?.tag).toBe('value_bet');
  });

  it('tags draw-driven aggression as semi bluff', () => {
    const ai = makePlayer({
      id: 'P1',
      seat: 1,
      holeCards: [makeCard(14, 'spades'), makeCard(11, 'spades')],
    });

    const table = makeTable({
      players: [makePlayer({ id: 'P0', isHuman: true, seat: 0 }), ai],
      board: [makeCard(13, 'spades'), makeCard(12, 'spades'), makeCard(2, 'diamonds')],
      betting: {
        currentBet: 40,
        minRaise: 40,
        actionQueue: ['P1'],
      },
    });

    const meta = inferActionTeachingMeta(table, ai, { type: 'raise', amount: 140 }, makeApplied({}));
    expect(meta?.tag).toBe('semi_bluff');
  });

  it('tags fold under pressure as pressure fold', () => {
    const ai = makePlayer({
      id: 'P1',
      seat: 1,
      holeCards: [makeCard(7, 'clubs'), makeCard(3, 'diamonds')],
    });

    const table = makeTable({
      players: [makePlayer({ id: 'P0', isHuman: true, seat: 0 }), ai],
      board: [makeCard(14, 'clubs'), makeCard(13, 'diamonds'), makeCard(9, 'hearts'), makeCard(4, 'spades')],
      stage: 'turn',
      betting: {
        currentBet: 220,
        minRaise: 120,
        actionQueue: ['P1'],
      },
      totalPot: 360,
      activePlayerId: 'P1',
    });

    const meta = inferActionTeachingMeta(
      table,
      ai,
      { type: 'fold' },
      makeApplied({ actionType: 'fold', isFold: true, toCallBefore: 220, amountPut: 0, betAfter: 0 }),
    );
    expect(meta?.tag).toBe('pressure_fold');
  });
});
