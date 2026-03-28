import type { ActionOption, AutoActionPreset, PlayerAction } from '../types/game';
import type { AppLanguage } from '../i18n';
import { describeAutoActionPresetText } from '../ui/holdemDisplayText';

interface AutoActionResolution {
  action: PlayerAction | null;
  clear: boolean;
  reason?: string;
}

function findOption(options: ActionOption[], type: ActionOption['type']): ActionOption | undefined {
  return options.find((option) => option.type === type);
}

export function describeAutoActionPreset(preset: AutoActionPreset | null, language: AppLanguage = 'zh-CN'): string {
  return describeAutoActionPresetText(language, preset);
}

export function resolveAutoActionPreset(
  preset: AutoActionPreset,
  options: ActionOption[],
  bigBlind: number,
): AutoActionResolution {
  const foldOpt = findOption(options, 'fold');
  const checkOpt = findOption(options, 'check');
  const callOpt = findOption(options, 'call');

  if (preset.mode === 'checkFold') {
    if (checkOpt?.enabled) {
      return { action: { type: 'check' }, clear: true };
    }
    if (foldOpt?.enabled) {
      return { action: { type: 'fold' }, clear: true };
    }
    return { action: null, clear: true, reason: '已取消自动行动：当前不允许过牌或弃牌' };
  }

  if (preset.mode === 'checkOnly') {
    if (checkOpt?.enabled) {
      return { action: { type: 'check' }, clear: true };
    }
    return { action: null, clear: true, reason: '已取消自动过牌：当前需要投入筹码' };
  }

  if (preset.mode === 'callAny') {
    if (checkOpt?.enabled) {
      return { action: { type: 'check' }, clear: true };
    }
    if (callOpt?.enabled) {
      return { action: { type: 'call' }, clear: true };
    }
    return { action: null, clear: true, reason: '已取消自动跟注：当前无法跟注或过牌' };
  }

  if (preset.mode === 'callLimitThenFold') {
    if (checkOpt?.enabled) {
      return { action: { type: 'check' }, clear: true };
    }

    if (!callOpt?.enabled) {
      if (foldOpt?.enabled) {
        return { action: { type: 'fold' }, clear: true };
      }
      return { action: null, clear: true, reason: '已取消自动行动：当前既不能跟注也不能弃牌' };
    }

    const callAmount = callOpt.callAmount ?? 0;
    const limit = Math.max(1, preset.callLimitBb ?? 0) * Math.max(1, bigBlind);
    if (callAmount <= limit) {
      return { action: { type: 'call' }, clear: true };
    }

    if (foldOpt?.enabled) {
      return { action: { type: 'fold' }, clear: true };
    }

    return {
      action: null,
      clear: true,
      reason: `已取消自动行动：所需 ${callAmount} 超出上限 ${limit}，且当前无法弃牌`,
    };
  }

  if (checkOpt?.enabled) {
    return { action: { type: 'check' }, clear: true };
  }

  if (!callOpt?.enabled) {
    return { action: null, clear: true, reason: '已取消自动跟注：当前无法跟注' };
  }

  const callAmount = callOpt.callAmount ?? 0;
  const limit = Math.max(1, preset.callLimitBb ?? 0) * Math.max(1, bigBlind);
  if (callAmount <= limit) {
    return { action: { type: 'call' }, clear: true };
  }

  return {
    action: null,
    clear: true,
    reason: `已取消自动跟注：所需 ${callAmount} 超出上限 ${limit}`,
  };
}
