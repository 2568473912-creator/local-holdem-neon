import type { BettingRoundState, PlayerAction, PlayerActionType, PlayerState, TableState } from '../types/game';
import { seatOrderFrom } from './tableUtils';

export interface BlindPostResult {
  players: PlayerState[];
  posted: number;
}

export interface AppliedBettingAction {
  players: PlayerState[];
  betting: BettingRoundState;
  actionType: PlayerActionType;
  amountPut: number;
  toCallBefore: number;
  isAllIn: boolean;
  isFold: boolean;
  isFullRaise: boolean;
  stackAfter: number;
  betAfter: number;
  note: string;
}

function clonePlayers(players: PlayerState[]): PlayerState[] {
  return players.map((p) => ({ ...p, holeCards: [...p.holeCards] }));
}

function actionableForQueue(player: PlayerState): boolean {
  return !player.eliminated && !player.folded && !player.allIn;
}

function makeQueueFromSeat(players: PlayerState[], startSeatExclusive: number, excludeId?: string): string[] {
  return seatOrderFrom(players, startSeatExclusive)
    .filter((p) => actionableForQueue(p) && p.id !== excludeId)
    .map((p) => p.id);
}

function makeQueueNeedingCall(
  players: PlayerState[],
  startSeatExclusive: number,
  currentBet: number,
  excludeId?: string,
): string[] {
  return seatOrderFrom(players, startSeatExclusive)
    .filter((p) => actionableForQueue(p) && p.id !== excludeId && p.currentBet < currentBet)
    .map((p) => p.id);
}

export function buildPreflopQueue(players: PlayerState[], forcedOpenSeat: number): string[] {
  const alive = players.filter((p) => !p.eliminated);
  if (alive.length <= 1) {
    return [];
  }

  // Default is BB, but straddle hands can start from the straddle seat.
  const startExclusiveSeat = forcedOpenSeat;
  return makeQueueFromSeat(players, startExclusiveSeat);
}

export function buildPostflopQueue(players: PlayerState[], dealerSeat: number): string[] {
  return makeQueueFromSeat(players, dealerSeat);
}

function postForcedChip(
  players: PlayerState[],
  playerId: string,
  amount: number,
  includeInCurrentBet: boolean,
  label: '盲注' | '前注',
): BlindPostResult {
  const next = clonePlayers(players);
  const player = next.find((p) => p.id === playerId);
  if (!player) {
    throw new Error(`postForcedChip: player ${playerId} not found`);
  }

  const posted = Math.min(amount, player.stack);
  player.stack -= posted;
  if (includeInCurrentBet) {
    player.currentBet += posted;
  }
  player.committed += posted;
  player.lastAction = posted < amount ? `${label}全下 ${posted}` : `${label} ${posted}`;
  if (player.stack === 0) {
    player.allIn = true;
  }

  return {
    players: next,
    posted,
  };
}

export function postBlind(players: PlayerState[], playerId: string, amount: number): BlindPostResult {
  return postForcedChip(players, playerId, amount, true, '盲注');
}

export function postAnte(players: PlayerState[], playerId: string, amount: number): BlindPostResult {
  return postForcedChip(players, playerId, amount, false, '前注');
}

function putChips(player: PlayerState, targetBet: number): number {
  const needed = Math.max(0, targetBet - player.currentBet);
  const put = Math.min(needed, player.stack);
  player.stack -= put;
  player.currentBet += put;
  player.committed += put;
  if (player.stack === 0) {
    player.allIn = true;
  }
  return put;
}

export function applyBettingAction(table: TableState, playerId: string, action: PlayerAction): AppliedBettingAction {
  const players = clonePlayers(table.players);
  const actor = players.find((p) => p.id === playerId);
  if (!actor) {
    throw new Error('applyBettingAction: actor not found');
  }

  const betting: BettingRoundState = {
    ...table.betting,
    actionQueue: [...table.betting.actionQueue],
  };

  const prevCurrentBet = betting.currentBet;
  const toCall = Math.max(0, prevCurrentBet - actor.currentBet);
  let amountPut = 0;
  let isFold = false;
  let isAllIn = false;
  let isFullRaise = false;
  let note = '';

  betting.actionQueue = betting.actionQueue.filter((id) => id !== actor.id);

  if (action.type === 'fold') {
    actor.folded = true;
    actor.lastAction = '弃牌';
    isFold = true;
    note = '弃牌';
  } else if (action.type === 'check') {
    actor.lastAction = '过牌';
    note = '过牌';
  } else if (action.type === 'call') {
    const target = actor.currentBet + toCall;
    amountPut = putChips(actor, target);
    actor.lastAction = actor.allIn ? `跟注全下 ${amountPut}` : `跟注 ${amountPut}`;
    isAllIn = actor.allIn;
    note = actor.allIn ? '全下跟注' : '跟注';
  } else {
    const targetBet =
      action.type === 'all-in'
        ? actor.currentBet + actor.stack
        : Math.max(actor.currentBet, Math.floor(action.amount ?? actor.currentBet));

    amountPut = putChips(actor, targetBet);
    isAllIn = actor.allIn;

    const newBet = actor.currentBet;

    if (prevCurrentBet === 0 && newBet > 0) {
      const openSize = newBet;
      isFullRaise = openSize >= table.config.bigBlind;
      betting.currentBet = newBet;
      if (isFullRaise) {
        betting.minRaise = openSize;
        for (const player of players) {
          if (player.id !== actor.id && actionableForQueue(player)) {
            player.actedThisStreet = false;
          }
        }
      }
      betting.lastAggressorId = actor.id;
      betting.actionQueue = makeQueueFromSeat(players, actor.seat, actor.id);
      note = action.type === 'all-in' ? `全下开池 ${newBet}` : `下注到 ${newBet}`;
    } else if (newBet > prevCurrentBet) {
      const raiseSize = newBet - prevCurrentBet;
      isFullRaise = raiseSize >= betting.minRaise;
      betting.currentBet = newBet;
      if (isFullRaise) {
        betting.minRaise = raiseSize;
        betting.lastAggressorId = actor.id;
        for (const player of players) {
          if (player.id !== actor.id && actionableForQueue(player)) {
            player.actedThisStreet = false;
          }
        }
        betting.actionQueue = makeQueueFromSeat(players, actor.seat, actor.id);
      } else {
        betting.actionQueue = makeQueueNeedingCall(players, actor.seat, newBet, actor.id);
      }
      note = action.type === 'all-in' ? `全下到 ${newBet}` : `加注到 ${newBet}`;
    } else {
      note = action.type === 'all-in' ? `全下跟注 ${amountPut}` : `跟注 ${amountPut}`;
    }

    if (action.type === 'all-in') {
      actor.lastAction = `全下 ${amountPut}`;
    } else if (action.type === 'bet') {
      actor.lastAction = `下注到 ${actor.currentBet}`;
    } else if (action.type === 'raise') {
      actor.lastAction = `加注到 ${actor.currentBet}`;
    }
  }

  betting.actionQueue = betting.actionQueue.filter((id) => {
    const p = players.find((it) => it.id === id);
    return Boolean(p && actionableForQueue(p));
  });

  actor.actedThisStreet = true;

  return {
    players,
    betting,
    actionType: action.type,
    amountPut,
    toCallBefore: toCall,
    isAllIn,
    isFold,
    isFullRaise,
    stackAfter: actor.stack,
    betAfter: actor.currentBet,
    note,
  };
}

export function resetStreetBets(players: PlayerState[]): PlayerState[] {
  return players.map((p) => ({
    ...p,
    currentBet: 0,
    actedThisStreet: false,
  }));
}
