import type { ActionOption, PlayerAction, PlayerState, TableState } from '../types/game';
import { getPlayerById } from './tableUtils';

export interface ActionContext {
  toCall: number;
  maxTotalBet: number;
  minOpenBet: number;
  minRaiseTo: number;
  raiseLocked: boolean;
}

export function getActionContext(table: TableState, player: PlayerState): ActionContext {
  const toCall = Math.max(0, table.betting.currentBet - player.currentBet);
  const maxTotalBet = player.currentBet + player.stack;
  const minOpenBet = table.config.bigBlind;
  const minRaiseTo = table.betting.currentBet + table.betting.minRaise;
  const raiseLocked = player.actedThisStreet && table.betting.currentBet > player.currentBet;
  return {
    toCall,
    maxTotalBet,
    minOpenBet,
    minRaiseTo,
    raiseLocked,
  };
}

function disabled(label: string, reason: string): ActionOption {
  return { type: 'check', enabled: false, label, reason };
}

export function getActionOptions(table: TableState, playerId: string): ActionOption[] {
  const player = getPlayerById(table.players, playerId);
  if (!player || player.eliminated || player.folded || player.allIn) {
    return [disabled('不可操作', '当前玩家不可行动')];
  }

  const isTurn = table.activePlayerId === playerId;
  if (!isTurn) {
    return [disabled('等待中', '尚未轮到你行动')];
  }

  const { toCall, maxTotalBet, minOpenBet, minRaiseTo, raiseLocked } = getActionContext(table, player);
  const canBet = table.betting.currentBet === 0;

  const options: ActionOption[] = [];

  options.push({
    type: 'fold',
    enabled: true,
    label: '弃牌',
    reason: toCall === 0 ? '无下注压力也可主动弃牌' : undefined,
  });

  options.push({
    type: 'check',
    enabled: toCall === 0,
    label: '过牌',
    reason: toCall > 0 ? '当前有待跟注金额，无法过牌' : undefined,
  });

  options.push({
    type: 'call',
    enabled: toCall > 0 && player.stack > 0,
    label: toCall > 0 ? `跟注 ${Math.min(toCall, player.stack)}` : '跟注',
    callAmount: toCall,
    reason: toCall === 0 ? '当前无需跟注' : undefined,
  });

  if (canBet) {
    options.push({
      type: 'bet',
      enabled: maxTotalBet >= minOpenBet,
      label: '下注',
      minAmount: minOpenBet,
      maxAmount: maxTotalBet,
      suggestedAmount: Math.min(maxTotalBet, minOpenBet * 2),
      reason: maxTotalBet < minOpenBet ? '筹码不足最小下注，使用全下' : undefined,
    });
  } else {
    options.push({
      type: 'raise',
      enabled: maxTotalBet >= minRaiseTo && !raiseLocked,
      label: '加注',
      minAmount: minRaiseTo,
      maxAmount: maxTotalBet,
      suggestedAmount: Math.min(maxTotalBet, minRaiseTo + table.betting.minRaise),
      reason:
        maxTotalBet < minRaiseTo
          ? '筹码不足最小加注，使用全下'
          : raiseLocked
          ? '此前加注未达到最小加注，不可再加注，只能跟注或弃牌'
          : undefined,
    });
  }

  const allInIsIllegalRaise = raiseLocked && maxTotalBet > table.betting.currentBet;
  options.push({
    type: 'all-in',
    enabled: player.stack > 0 && !allInIsIllegalRaise,
    label: `全下 ${player.stack}`,
    reason: allInIsIllegalRaise ? '当前不可重新加注，全下会构成非法加注' : undefined,
  });

  return options;
}

export function validateAction(table: TableState, playerId: string, action: PlayerAction): { valid: boolean; reason?: string } {
  const player = getPlayerById(table.players, playerId);
  if (!player) {
    return { valid: false, reason: '玩家不存在' };
  }

  if (table.activePlayerId !== playerId) {
    return { valid: false, reason: '未轮到该玩家行动' };
  }

  if (player.eliminated || player.folded || player.allIn) {
    return { valid: false, reason: '玩家当前不可操作' };
  }

  const { toCall, maxTotalBet, minOpenBet, minRaiseTo, raiseLocked } = getActionContext(table, player);

  switch (action.type) {
    case 'fold':
      return { valid: true };
    case 'check':
      return toCall === 0 ? { valid: true } : { valid: false, reason: '存在待跟注金额，不能过牌' };
    case 'call':
      return toCall > 0 ? { valid: true } : { valid: false, reason: '当前无需跟注' };
    case 'all-in':
      if (raiseLocked && maxTotalBet > table.betting.currentBet) {
        return { valid: false, reason: '当前不可重新加注，全下会构成非法加注' };
      }
      return player.stack > 0 ? { valid: true } : { valid: false, reason: '筹码为 0，无法全下' };
    case 'bet': {
      if (table.betting.currentBet > 0) {
        return { valid: false, reason: '当前已有下注，应使用加注' };
      }
      if (typeof action.amount !== 'number') {
        return { valid: false, reason: '下注金额缺失' };
      }
      if (action.amount > maxTotalBet) {
        return { valid: false, reason: '下注金额超过可用筹码' };
      }
      if (action.amount < minOpenBet) {
        return { valid: false, reason: '下注低于最小下注' };
      }
      return { valid: true };
    }
    case 'raise': {
      if (table.betting.currentBet === 0) {
        return { valid: false, reason: '当前无人下注，应使用下注' };
      }
      if (raiseLocked) {
        return { valid: false, reason: '此前加注不足最小加注，当前不可再加注' };
      }
      if (typeof action.amount !== 'number') {
        return { valid: false, reason: '加注金额缺失' };
      }
      if (action.amount > maxTotalBet) {
        return { valid: false, reason: '加注金额超过可用筹码' };
      }
      if (action.amount < minRaiseTo) {
        return { valid: false, reason: '加注低于最小加注门槛' };
      }
      return { valid: true };
    }
    default:
      return { valid: false, reason: '未知动作类型' };
  }
}
