import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ActionOption, PlayerAction, TableState } from '../../types/game';

interface ControlsPanelProps {
  table: TableState;
  options: ActionOption[];
  disabled: boolean;
  onAction: (action: PlayerAction) => void;
}

function findOption(options: ActionOption[], type: ActionOption['type']): ActionOption | undefined {
  return options.find((opt) => opt.type === type);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function ControlsPanel({ table, options, disabled, onAction }: ControlsPanelProps) {
  const [raiseAmount, setRaiseAmount] = useState(0);

  const actor = useMemo(
    () => table.players.find((p) => p.isHuman) ?? table.players.find((p) => p.id === table.activePlayerId),
    [table.activePlayerId, table.players],
  );
  const raiseOpt = useMemo(() => findOption(options, 'raise') ?? findOption(options, 'bet'), [options]);

  const normalizedRaiseAmount = useMemo(() => {
    if (!raiseOpt?.enabled) {
      return 0;
    }
    const min = raiseOpt.minAmount ?? 0;
    const max = raiseOpt.maxAmount ?? min;
    if (raiseAmount < min || raiseAmount > max) {
      return raiseOpt.suggestedAmount ?? min;
    }
    return raiseAmount;
  }, [raiseOpt, raiseAmount]);

  const foldOpt = findOption(options, 'fold');
  const checkOpt = findOption(options, 'check');
  const callOpt = findOption(options, 'call');
  const allInOpt = findOption(options, 'all-in');
  const callTo = callOpt?.callAmount ?? 0;
  const inHandOpponents = useMemo(() => {
    if (!actor) return [];
    return table.players.filter((p) => p.id !== actor.id && !p.eliminated && !p.folded);
  }, [actor, table.players]);

  const strategy = useMemo(() => {
    if (!actor) {
      return {
        effectiveStack: 0,
        spr: 0,
        potOddsPercent: 0,
        recommendation: '等待当前手牌数据',
        recommendedRaise: 0,
      };
    }

    const effectiveStack = inHandOpponents.length > 0 ? Math.min(actor.stack, ...inHandOpponents.map((p) => p.stack)) : actor.stack;
    const potForDecision = Math.max(1, table.totalPot + callTo);
    const potOddsPercent = callTo > 0 ? Math.round((callTo / potForDecision) * 100) : 0;
    const spr = Number((effectiveStack / potForDecision).toFixed(2));

    let recommendation = '等待轮到你行动';
    if (!disabled) {
      if (callTo === 0) {
        recommendation = raiseOpt?.enabled ? '可免费过牌；若主动争夺建议中等尺度下注（约 1/2~2/3 池）。' : '当前可免费过牌。';
      } else if (potOddsPercent <= 18) {
        recommendation = '底池赔率较好，可适度放宽跟注范围。';
      } else if (potOddsPercent >= 36 && spr < 1.2) {
        recommendation = '压力偏大且 SPR 偏低，建议谨慎跟注，避免边缘投入。';
      } else {
        recommendation = '结合牌力与听牌权益决定：中等强度偏向跟注，弱牌可弃牌。';
      }
    }

    let recommendedRaise = 0;
    if (raiseOpt?.enabled) {
      const min = raiseOpt.minAmount ?? 0;
      const max = raiseOpt.maxAmount ?? min;
      const baseMultiplier = table.stage === 'preflop' ? 0.62 : table.stage === 'flop' ? 0.66 : table.stage === 'turn' ? 0.72 : 0.8;
      const target = actor.currentBet + callTo + Math.round((table.totalPot + callTo) * baseMultiplier);
      recommendedRaise = clamp(target, min, max);
    }

    return {
      effectiveStack,
      spr,
      potOddsPercent,
      recommendation,
      recommendedRaise,
    };
  }, [actor, callTo, disabled, inHandOpponents, raiseOpt, table.stage, table.totalPot]);

  const setPresetSize = useCallback(
    (potMultiplier: number) => {
      if (!raiseOpt?.enabled || !actor) return;
      const min = raiseOpt.minAmount ?? 0;
      const max = raiseOpt.maxAmount ?? min;
      const potForSizing = table.totalPot + callTo;
      const target = actor.currentBet + callTo + Math.round(potForSizing * potMultiplier);
      const clamped = Math.max(min, Math.min(max, target));
      setRaiseAmount(clamped);
    },
    [actor, callTo, raiseOpt, table.totalPot],
  );

  const onRaiseCommit = useCallback(() => {
    if (!raiseOpt || !raiseOpt.enabled) return;
    onAction({
      type: raiseOpt.type,
      amount: normalizedRaiseAmount,
    });
  }, [normalizedRaiseAmount, onAction, raiseOpt]);

  const runShortcut = useCallback(
    (type: ActionOption['type']) => {
      if (disabled) return;
      const option = findOption(options, type);
      if (!option?.enabled) return;

      if (type === 'bet' || type === 'raise') {
        onRaiseCommit();
        return;
      }
      onAction({ type });
    },
    [disabled, onAction, onRaiseCommit, options],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === 'f') {
        runShortcut('fold');
      } else if (key === 'q') {
        runShortcut('check');
      } else if (key === 'c') {
        runShortcut('call');
      } else if (key === 'a') {
        runShortcut('all-in');
      } else if (key === 'r') {
        runShortcut(raiseOpt?.type ?? 'raise');
      } else if (key === '1') {
        setPresetSize(0.5);
      } else if (key === '2') {
        setPresetSize(0.66);
      } else if (key === '3') {
        setPresetSize(1);
      } else if (key === '4') {
        setPresetSize(2);
      } else {
        return;
      }

      event.preventDefault();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [raiseOpt?.type, runShortcut, setPresetSize]);

  return (
    <section className="controls-panel">
      <div className="controls-row">
        <button
          className="btn action fold"
          disabled={disabled || !foldOpt?.enabled}
          title={foldOpt?.reason}
          onClick={() => onAction({ type: 'fold' })}
        >
          弃牌
        </button>

        <button
          className="btn action"
          disabled={disabled || !checkOpt?.enabled}
          title={checkOpt?.reason}
          onClick={() => onAction({ type: 'check' })}
        >
          过牌
        </button>

        <button
          className="btn action"
          disabled={disabled || !callOpt?.enabled}
          title={callOpt?.reason}
          onClick={() => onAction({ type: 'call' })}
        >
          {callOpt?.label ?? '跟注'}
        </button>

        <button
          className="btn action allin"
          disabled={disabled || !allInOpt?.enabled}
          title={allInOpt?.reason}
          onClick={() => onAction({ type: 'all-in' })}
        >
          全下
        </button>
      </div>

      <div className="controls-row raise-row">
        <div className="raise-control">
          <label>{raiseOpt?.type === 'bet' ? '下注金额' : '加注到'}</label>
          <div className="raise-presets">
            <button className="btn mini" disabled={disabled || !raiseOpt?.enabled} onClick={() => setPresetSize(0.5)}>
              1/2 池
            </button>
            <button className="btn mini" disabled={disabled || !raiseOpt?.enabled} onClick={() => setPresetSize(0.66)}>
              2/3 池
            </button>
            <button className="btn mini" disabled={disabled || !raiseOpt?.enabled} onClick={() => setPresetSize(1)}>
              底池
            </button>
            <button className="btn mini" disabled={disabled || !raiseOpt?.enabled} onClick={() => setPresetSize(2)}>
              2x 底池
            </button>
          </div>
          <input
            type="range"
            min={raiseOpt?.minAmount ?? 0}
            max={raiseOpt?.maxAmount ?? 0}
            value={normalizedRaiseAmount}
            disabled={disabled || !raiseOpt?.enabled}
            onChange={(event) => setRaiseAmount(Number(event.target.value))}
          />
          <div className="raise-values">
            <span>最小 {raiseOpt?.minAmount ?? '-'}</span>
            <strong>{normalizedRaiseAmount || '-'}</strong>
            <span>最大 {raiseOpt?.maxAmount ?? '-'}</span>
          </div>
        </div>

        <button
          className="btn action primary"
          disabled={disabled || !raiseOpt?.enabled}
          title={raiseOpt?.reason}
          onClick={onRaiseCommit}
        >
          {raiseOpt?.type === 'bet' ? '下注' : '加注'}
        </button>
      </div>

      <div className="strategy-card">
        <div className="strategy-grid">
          <div>
            <span>底池赔率</span>
            <strong>{callTo > 0 ? `${strategy.potOddsPercent}%` : '-'}</strong>
          </div>
          <div>
            <span>SPR</span>
            <strong>{strategy.spr.toFixed(2)}</strong>
          </div>
          <div>
            <span>有效筹码</span>
            <strong>{strategy.effectiveStack}</strong>
          </div>
          <div>
            <span>建议加注到</span>
            <strong>{strategy.recommendedRaise > 0 ? strategy.recommendedRaise : '-'}</strong>
          </div>
        </div>
        <p>{strategy.recommendation}</p>
      </div>

      <div className="controls-footnote">
        当前阶段：
        {table.stage === 'preflop'
          ? '翻前'
          : table.stage === 'flop'
          ? '翻牌'
          : table.stage === 'turn'
          ? '转牌'
          : table.stage === 'river'
          ? '河牌'
          : table.stage === 'showdown'
          ? '摊牌'
          : '结算'}
        {' · 快捷键 F 弃牌 / Q 过牌 / C 跟注 / A 全下 / R 下注或加注 / 1~4 下注档位'}
      </div>
    </section>
  );
}
