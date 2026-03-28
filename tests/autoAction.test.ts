import { describe, expect, it } from 'vitest';
import type { ActionOption, AutoActionPreset } from '../src/types/game';
import { describeAutoActionPreset, resolveAutoActionPreset } from '../src/state/autoAction';

function makeOption(overrides: Partial<ActionOption>): ActionOption {
  return {
    type: overrides.type ?? 'fold',
    enabled: overrides.enabled ?? true,
    label: overrides.label ?? '测试',
    reason: overrides.reason,
    minAmount: overrides.minAmount,
    maxAmount: overrides.maxAmount,
    suggestedAmount: overrides.suggestedAmount,
    callAmount: overrides.callAmount,
  };
}

describe('auto action presets', () => {
  it('describes presets in Chinese UI text', () => {
    const preset: AutoActionPreset = { mode: 'callLimit', callLimitBb: 2 };
    expect(describeAutoActionPreset(preset)).toBe('自动跟注 <= 2BB');
  });

  it('checks when check-fold meets a free option', () => {
    const result = resolveAutoActionPreset(
      { mode: 'checkFold' },
      [makeOption({ type: 'check', enabled: true })],
      40,
    );
    expect(result.action).toEqual({ type: 'check' });
  });

  it('folds when check-fold is facing a bet', () => {
    const result = resolveAutoActionPreset(
      { mode: 'checkFold' },
      [makeOption({ type: 'fold', enabled: true }), makeOption({ type: 'check', enabled: false })],
      40,
    );
    expect(result.action).toEqual({ type: 'fold' });
  });

  it('cancels check-only when checking is unavailable', () => {
    const result = resolveAutoActionPreset(
      { mode: 'checkOnly' },
      [makeOption({ type: 'check', enabled: false }), makeOption({ type: 'call', enabled: true, callAmount: 40 })],
      20,
    );
    expect(result.action).toBeNull();
    expect(result.reason).toContain('自动过牌');
  });

  it('uses check first for auto call-or-check', () => {
    const result = resolveAutoActionPreset(
      { mode: 'callAny' },
      [makeOption({ type: 'check', enabled: true }), makeOption({ type: 'call', enabled: true, callAmount: 80 })],
      20,
    );
    expect(result.action).toEqual({ type: 'check' });
  });

  it('calls when auto call-or-check is facing a bet', () => {
    const result = resolveAutoActionPreset(
      { mode: 'callAny' },
      [makeOption({ type: 'call', enabled: true, callAmount: 180 })],
      20,
    );
    expect(result.action).toEqual({ type: 'call' });
  });

  it('folds when call-check-fold threshold is exceeded', () => {
    const result = resolveAutoActionPreset(
      { mode: 'callLimitThenFold', callLimitBb: 2 },
      [makeOption({ type: 'call', enabled: true, callAmount: 140 }), makeOption({ type: 'fold', enabled: true })],
      40,
    );
    expect(result.action).toEqual({ type: 'fold' });
  });

  it('calls when call-check-fold threshold is still acceptable', () => {
    const result = resolveAutoActionPreset(
      { mode: 'callLimitThenFold', callLimitBb: 2 },
      [makeOption({ type: 'call', enabled: true, callAmount: 60 }), makeOption({ type: 'fold', enabled: true })],
      40,
    );
    expect(result.action).toEqual({ type: 'call' });
  });

  it('calls inside the configured BB threshold', () => {
    const result = resolveAutoActionPreset(
      { mode: 'callLimit', callLimitBb: 2 },
      [makeOption({ type: 'call', enabled: true, callAmount: 60 })],
      40,
    );
    expect(result.action).toEqual({ type: 'call' });
  });

  it('cancels auto call when the threshold is exceeded', () => {
    const result = resolveAutoActionPreset(
      { mode: 'callLimit', callLimitBb: 1 },
      [makeOption({ type: 'call', enabled: true, callAmount: 75 })],
      40,
    );
    expect(result.action).toBeNull();
    expect(result.reason).toContain('超出上限');
  });
});
