import { useEffect, useMemo, useState } from 'react';
import { t } from '../../i18n';
import { useLanguage } from '../../i18n/languageContext';
import type { ActionOption, AutoActionPreset, PlayerAction, TableState } from '../../types/game';
import { describeAutoActionPreset } from '../../state/autoAction';
import { translateHoldemText } from '../holdemText';
import {
  formatStageShortcutFootnote,
  getControlsRecommendation,
  getHoldemStageLabel,
  getPresetSizeLabel,
} from '../holdemDisplayText';

type AutoActionSelectValue =
  | 'none'
  | 'checkFold'
  | 'checkOnly'
  | 'callAny'
  | 'callLimitThenFold2'
  | 'callLimit1'
  | 'callLimit2'
  | 'callLimit4';

interface ControlsPanelProps {
  table: TableState;
  options: ActionOption[];
  disabled: boolean;
  autoAction: AutoActionPreset | null;
  condensedIpad?: boolean;
  onAction: (action: PlayerAction) => void;
  onSetAutoAction: (preset: AutoActionPreset | null) => void;
}

interface InfoFact {
  key: string;
  label: string;
  value: string | number;
}

function findOption(options: ActionOption[], type: ActionOption['type']): ActionOption | undefined {
  return options.find((opt) => opt.type === type);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function serializeAutoAction(preset: AutoActionPreset | null): AutoActionSelectValue {
  if (!preset) return 'none';
  if (preset.mode === 'checkFold') return 'checkFold';
  if (preset.mode === 'checkOnly') return 'checkOnly';
  if (preset.mode === 'callAny') return 'callAny';
  if (preset.mode === 'callLimitThenFold') return 'callLimitThenFold2';
  if (preset.mode === 'callLimit' && preset.callLimitBb === 1) return 'callLimit1';
  if (preset.mode === 'callLimit' && preset.callLimitBb === 4) return 'callLimit4';
  return 'callLimit2';
}

function parseAutoAction(value: AutoActionSelectValue): AutoActionPreset | null {
  switch (value) {
    case 'checkFold':
      return { mode: 'checkFold' };
    case 'checkOnly':
      return { mode: 'checkOnly' };
    case 'callAny':
      return { mode: 'callAny' };
    case 'callLimitThenFold2':
      return { mode: 'callLimitThenFold', callLimitBb: 2 };
    case 'callLimit1':
      return { mode: 'callLimit', callLimitBb: 1 };
    case 'callLimit2':
      return { mode: 'callLimit', callLimitBb: 2 };
    case 'callLimit4':
      return { mode: 'callLimit', callLimitBb: 4 };
    default:
      return null;
  }
}

export function ControlsPanel({ table, options, disabled, autoAction, condensedIpad = false, onAction, onSetAutoAction }: ControlsPanelProps) {
  const language = useLanguage();
  const isIpadLike = typeof document !== 'undefined' && document.documentElement.dataset.ipadLike === 'true';
  const [raiseAmount, setRaiseAmount] = useState(0);
  const [showAutoActionSelect, setShowAutoActionSelect] = useState(false);

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

  const strategy = (() => {
    if (!actor) {
      return {
        effectiveStack: 0,
        spr: 0,
        potOddsPercent: 0,
        recommendation: getControlsRecommendation(language, 'noData'),
        recommendedRaise: 0,
      };
    }

    const effectiveStack = inHandOpponents.length > 0 ? Math.min(actor.stack, ...inHandOpponents.map((p) => p.stack)) : actor.stack;
    const potForDecision = Math.max(1, table.totalPot + callTo);
    const potOddsPercent = callTo > 0 ? Math.round((callTo / potForDecision) * 100) : 0;
    const spr = Number((effectiveStack / potForDecision).toFixed(2));

    let recommendation = getControlsRecommendation(language, 'wait');
    if (!disabled) {
      if (callTo === 0) {
        recommendation = raiseOpt?.enabled ? getControlsRecommendation(language, 'freeAggro') : getControlsRecommendation(language, 'free');
      } else if (potOddsPercent <= 18) {
        recommendation = getControlsRecommendation(language, 'goodOdds');
      } else if (potOddsPercent >= 36 && spr < 1.2) {
        recommendation = getControlsRecommendation(language, 'lowSpr');
      } else {
        recommendation = getControlsRecommendation(language, 'medium');
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
  })();
  const stageFootnote = formatStageShortcutFootnote(language, getHoldemStageLabel(language, table.stage, table.mode));
  const stageLabel = getHoldemStageLabel(language, table.stage, table.mode);
  const useCondensedIpadLayout = isIpadLike && condensedIpad;
  const showExpandedRaiseTools = raiseOpt?.enabled ? true : !useCondensedIpadLayout;
  const showAutoActionControls = !useCondensedIpadLayout || showAutoActionSelect;
  const autoActionValue = serializeAutoAction(autoAction);
  const autoActionSummary = describeAutoActionPreset(autoAction, language);
  const autoActionOptions = [
    { value: 'none' as const, label: t(language, 'common.clear') },
    { value: 'checkFold' as const, label: t(language, 'auto.checkFold') },
    { value: 'checkOnly' as const, label: t(language, 'auto.checkOnly') },
    { value: 'callAny' as const, label: t(language, 'auto.callAny') },
    { value: 'callLimitThenFold2' as const, label: t(language, 'auto.callLimitThenFold') },
    { value: 'callLimit1' as const, label: t(language, 'auto.callLimit', { bb: 1 }) },
    { value: 'callLimit2' as const, label: t(language, 'auto.callLimit', { bb: 2 }) },
    { value: 'callLimit4' as const, label: t(language, 'auto.callLimit', { bb: 4 }) },
  ];
  const checkLabel = t(language, 'action.check');
  const callLabel = callOpt?.label ? translateHoldemText(callOpt.label, language) : t(language, 'action.call');
  const raiseLabel = raiseOpt?.type === 'bet' ? t(language, 'action.bet') : t(language, 'action.raise');
  const primaryActionType: ActionOption['type'] | 'none' = disabled
    ? 'none'
    : callTo === 0 && raiseOpt?.enabled
      ? raiseOpt.type
      : callTo === 0 && checkOpt?.enabled
        ? 'check'
        : callTo > 0 && potOddsPercentAttractive(strategy.potOddsPercent) && callOpt?.enabled
          ? 'call'
          : strategy.spr < 1.2 && allInOpt?.enabled
            ? 'all-in'
            : raiseOpt?.enabled && callTo === 0
              ? raiseOpt.type
              : 'none';
  const immediateActionLabel =
    primaryActionType === 'check'
      ? checkLabel
      : primaryActionType === 'call'
        ? callLabel
        : primaryActionType === 'all-in'
          ? t(language, 'action.allIn')
          : primaryActionType === 'bet' || primaryActionType === 'raise'
            ? raiseLabel
            : callTo === 0
              ? checkLabel
              : callLabel;
  const immediateActionValue =
    primaryActionType === 'call'
      ? callTo
      : primaryActionType === 'bet' || primaryActionType === 'raise'
        ? strategy.recommendedRaise || normalizedRaiseAmount
        : primaryActionType === 'all-in'
          ? actor?.stack ?? 0
          : 0;
  const decisionTone =
    disabled ? 'muted' : primaryActionType === 'all-in' ? 'pressure' : primaryActionType === 'bet' || primaryActionType === 'raise' ? 'aggressive' : 'steady';
  const presetButtons = [
    { key: 'half', label: getPresetSizeLabel(language, 'half'), multiplier: 0.5 },
    { key: 'twoThird', label: getPresetSizeLabel(language, 'twoThird'), multiplier: 0.66 },
    { key: 'pot', label: getPresetSizeLabel(language, 'pot'), multiplier: 1 },
    { key: 'double', label: getPresetSizeLabel(language, 'double'), multiplier: 2 },
  ];
  const minRaiseAmount = raiseOpt?.minAmount ?? 0;
  const maxRaiseAmount = raiseOpt?.maxAmount ?? 0;
  const recommendedRaiseActive =
    raiseOpt?.enabled && strategy.recommendedRaise > 0 && strategy.recommendedRaise >= minRaiseAmount && strategy.recommendedRaise <= maxRaiseAmount;
  const decisionFacts: InfoFact[] = (() => {
    const actionFact: InfoFact = {
      key: 'action',
      label: immediateActionLabel,
      value: immediateActionValue > 0 ? immediateActionValue : '-',
    };
    const potFact: InfoFact = {
      key: 'pot',
      label: t(language, 'common.pot'),
      value: table.totalPot,
    };
    const potOddsFact: InfoFact = {
      key: 'pot-odds',
      label: t(language, 'panel.potOdds'),
      value: callTo > 0 ? `${strategy.potOddsPercent}%` : '-',
    };
    const effectiveStackFact: InfoFact = {
      key: 'effective-stack',
      label: t(language, 'panel.effectiveStack'),
      value: strategy.effectiveStack,
    };
    const recommendedRaiseFact: InfoFact = {
      key: 'recommended-raise',
      label: t(language, 'panel.recommendedRaise'),
      value: strategy.recommendedRaise > 0 ? strategy.recommendedRaise : '-',
    };

    if (table.stage === 'river') {
      return [actionFact, callTo > 0 ? potOddsFact : potFact, effectiveStackFact];
    }
    if (table.stage === 'turn') {
      return [actionFact, callTo > 0 ? potOddsFact : effectiveStackFact, raiseOpt?.enabled ? recommendedRaiseFact : potFact];
    }
    if (table.stage === 'flop') {
      return [actionFact, callTo > 0 ? potOddsFact : potFact, raiseOpt?.enabled ? recommendedRaiseFact : effectiveStackFact];
    }
    return [actionFact, potFact, recommendedRaiseFact];
  })();
  const miniStats: InfoFact[] = (() => {
    const stats: InfoFact[] = [
      {
        key: 'pot-odds',
        label: t(language, 'panel.potOdds'),
        value: callTo > 0 ? `${strategy.potOddsPercent}%` : '-',
      },
      {
        key: 'spr',
        label: 'SPR',
        value: strategy.spr.toFixed(2),
      },
      {
        key: 'effective-stack',
        label: t(language, 'panel.effectiveStack'),
        value: strategy.effectiveStack,
      },
    ];

    if (table.stage === 'preflop' || table.stage === 'flop') {
      stats.push({
        key: 'recommended-raise',
        label: t(language, 'panel.recommendedRaise'),
        value: strategy.recommendedRaise > 0 ? strategy.recommendedRaise : '-',
      });
    } else if (table.stage === 'turn') {
      stats.push({
        key: 'pot',
        label: t(language, 'common.pot'),
        value: table.totalPot,
      });
    }

    return stats;
  })();

  const setPresetSize = (potMultiplier: number) => {
    if (!raiseOpt?.enabled || !actor) return;
    const min = raiseOpt.minAmount ?? 0;
    const max = raiseOpt.maxAmount ?? min;
    const potForSizing = table.totalPot + callTo;
    const target = actor.currentBet + callTo + Math.round(potForSizing * potMultiplier);
    const clamped = Math.max(min, Math.min(max, target));
    setRaiseAmount(clamped);
  };

  const onRaiseCommit = () => {
    if (!raiseOpt || !raiseOpt.enabled) return;
    onAction({
      type: raiseOpt.type,
      amount: normalizedRaiseAmount,
    });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        return;
      }

      const key = event.key.toLowerCase();
      const applyPresetSize = (potMultiplier: number) => {
        if (!raiseOpt?.enabled || !actor) return;
        const min = raiseOpt.minAmount ?? 0;
        const max = raiseOpt.maxAmount ?? min;
        const potForSizing = table.totalPot + callTo;
        const target = actor.currentBet + callTo + Math.round(potForSizing * potMultiplier);
        const clamped = Math.max(min, Math.min(max, target));
        setRaiseAmount(clamped);
      };
      const commitRaise = () => {
        if (!raiseOpt || !raiseOpt.enabled) return;
        onAction({
          type: raiseOpt.type,
          amount: normalizedRaiseAmount,
        });
      };
      const runShortcut = (type: ActionOption['type']) => {
        if (disabled) return;
        const option = findOption(options, type);
        if (!option?.enabled) return;

        if (type === 'bet' || type === 'raise') {
          commitRaise();
          return;
        }
        onAction({ type });
      };
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
      } else if (key === 'x') {
        onSetAutoAction({ mode: 'checkFold' });
      } else if (key === 'v') {
        onSetAutoAction({ mode: 'checkOnly' });
      } else if (key === 'n') {
        onSetAutoAction({ mode: 'callAny' });
      } else if (key === 'g') {
        onSetAutoAction({ mode: 'callLimitThenFold', callLimitBb: 2 });
      } else if (key === 'b') {
        onSetAutoAction({ mode: 'callLimit', callLimitBb: 2 });
      } else if (key === 'escape') {
        onSetAutoAction(null);
      } else if (key === '1') {
        applyPresetSize(0.5);
      } else if (key === '2') {
        applyPresetSize(0.66);
      } else if (key === '3') {
        applyPresetSize(1);
      } else if (key === '4') {
        applyPresetSize(2);
      } else {
        return;
      }

      event.preventDefault();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [disabled, onAction, onSetAutoAction, options, raiseOpt?.type, actor, callTo, raiseOpt, table.totalPot, normalizedRaiseAmount]);

  return (
    <section className={`controls-panel ${isIpadLike ? 'controls-panel-ipad' : ''} ${useCondensedIpadLayout ? 'condensed' : ''}`}>
      <div className="controls-top-strip">
        <div className="controls-row action-strip">
          <button
            className={`btn action fold${primaryActionType === 'fold' ? ' is-suggested' : ''}`}
            disabled={disabled || !foldOpt?.enabled}
            title={foldOpt?.reason ? translateHoldemText(foldOpt.reason, language) : undefined}
            onClick={() => onAction({ type: 'fold' })}
          >
            {t(language, 'action.fold')}
          </button>

          <button
            className={`btn action${primaryActionType === 'check' ? ' is-suggested is-safe-primary' : ''}`}
            disabled={disabled || !checkOpt?.enabled}
            title={checkOpt?.reason ? translateHoldemText(checkOpt.reason, language) : undefined}
            onClick={() => onAction({ type: 'check' })}
          >
            {t(language, 'action.check')}
          </button>

          <button
            className={`btn action${primaryActionType === 'call' ? ' is-suggested is-safe-primary' : ''}`}
            disabled={disabled || !callOpt?.enabled}
            title={callOpt?.reason ? translateHoldemText(callOpt.reason, language) : undefined}
            onClick={() => onAction({ type: 'call' })}
          >
            {callLabel}
          </button>

          <button
            className={`btn action allin${primaryActionType === 'all-in' ? ' is-suggested' : ''}`}
            disabled={disabled || !allInOpt?.enabled}
            title={allInOpt?.reason ? translateHoldemText(allInOpt.reason, language) : undefined}
            onClick={() => onAction({ type: 'all-in' })}
          >
            {t(language, 'action.allIn')}
          </button>

          <button
            className={`btn action primary${primaryActionType === 'bet' || primaryActionType === 'raise' ? ' is-recommended' : ''}`}
            disabled={disabled || !raiseOpt?.enabled}
            title={raiseOpt?.reason ? translateHoldemText(raiseOpt.reason, language) : undefined}
            onClick={onRaiseCommit}
          >
            {raiseLabel}
          </button>
        </div>

        <div className={`auto-action-inline ${useCondensedIpadLayout ? 'compact' : ''}`}>
          <div className="auto-action-inline-head">
            <strong>{t(language, 'panel.autoAction')}</strong>
            <div className="auto-action-inline-head-actions">
              <span className={autoAction ? 'is-active' : ''}>{autoActionSummary}</span>
              {useCondensedIpadLayout ? (
                <button className={`btn mini ghost auto-action-toggle ${showAutoActionControls ? 'active' : ''}`} type="button" onClick={() => setShowAutoActionSelect((prev) => !prev)}>
                  {showAutoActionControls ? t(language, 'common.close') : t(language, 'common.details')}
                </button>
              ) : null}
              {autoAction ? (
                <button className="btn mini ghost auto-action-clear" type="button" onClick={() => onSetAutoAction(null)}>
                  {t(language, 'common.clear')}
                </button>
              ) : null}
            </div>
          </div>
          {showAutoActionControls ? (
            <select
              className="auto-action-select"
              value={autoActionValue}
              aria-label={t(language, 'panel.autoAction')}
              onChange={(event) => onSetAutoAction(parseAutoAction(event.target.value as AutoActionSelectValue))}
            >
              {autoActionOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </div>

      {isIpadLike ? (
        <div className={`controls-decision-brief tone-${decisionTone}`}>
          <div className="controls-decision-copy">
            <span>
              {t(language, 'panel.currentStage')} · {stageLabel}
            </span>
            <strong>{strategy.recommendation}</strong>
            <p>{disabled ? t(language, 'panel.waitingForHero') : immediateActionLabel}</p>
          </div>
          <div className="controls-decision-facts">
            {decisionFacts.map((fact) => (
              <div key={fact.key}>
                <span>{fact.label}</span>
                <strong>{fact.value}</strong>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className={`controls-row raise-row ${showExpandedRaiseTools ? '' : 'raise-row-collapsed'}`}>
        <div className="raise-control">
          <div className="raise-row-head">
            <label>{raiseOpt?.type === 'bet' ? t(language, 'action.betAmount') : t(language, 'action.raiseTo')}</label>
            {isIpadLike ? (
              <div className="raise-row-head-actions">
                <div className="raise-row-summary">
                  <strong>{normalizedRaiseAmount || '-'}</strong>
                  <span>
                    {t(language, 'action.min')} {raiseOpt?.minAmount ?? '-'} · {t(language, 'action.max')} {raiseOpt?.maxAmount ?? '-'}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
          {showExpandedRaiseTools ? (
            <>
              <div className="raise-presets">
                {recommendedRaiseActive ? (
                  <button
                    className={`btn mini recommend-raise${normalizedRaiseAmount === strategy.recommendedRaise ? ' active' : ''}`}
                    disabled={disabled || !raiseOpt?.enabled}
                    onClick={() => setRaiseAmount(strategy.recommendedRaise)}
                  >
                    {t(language, 'panel.recommendedRaise')} {strategy.recommendedRaise}
                  </button>
                ) : null}
                {presetButtons.map((preset) => (
                  <button
                    key={preset.key}
                    className="btn mini"
                    disabled={disabled || !raiseOpt?.enabled}
                    onClick={() => setPresetSize(preset.multiplier)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="raise-slider-shell">
                <input
                  type="range"
                  min={raiseOpt?.minAmount ?? 0}
                  max={raiseOpt?.maxAmount ?? 0}
                  value={normalizedRaiseAmount}
                  disabled={disabled || !raiseOpt?.enabled}
                  aria-label={raiseOpt?.type === 'bet' ? t(language, 'action.betAmount') : t(language, 'action.raiseTo')}
                  aria-valuetext={`${normalizedRaiseAmount || 0}`}
                  onChange={(event) => setRaiseAmount(Number(event.target.value))}
                />
                {isIpadLike ? (
                  <div className="raise-slider-scale" aria-hidden="true">
                    <span>{minRaiseAmount || '-'}</span>
                    <strong>{normalizedRaiseAmount || '-'}</strong>
                    <span>{maxRaiseAmount || '-'}</span>
                  </div>
                ) : null}
              </div>
              {!isIpadLike ? (
                <div className="raise-values">
                  <span>{t(language, 'action.min')} {minRaiseAmount || '-'}</span>
                  <strong>{normalizedRaiseAmount || '-'}</strong>
                  <span>{t(language, 'action.max')} {maxRaiseAmount || '-'}</span>
                </div>
              ) : null}
            </>
          ) : (
            <div className="raise-collapsed-summary">
              {recommendedRaiseActive ? (
                <span className="raise-summary-chip accent">
                  {t(language, 'panel.recommendedRaise')} {strategy.recommendedRaise}
                </span>
              ) : null}
              <span className="raise-summary-chip">
                {t(language, 'action.min')} {minRaiseAmount || '-'}
              </span>
              <span className="raise-summary-chip">
                {t(language, 'action.max')} {maxRaiseAmount || '-'}
              </span>
            </div>
          )}
        </div>
        {isIpadLike && (!useCondensedIpadLayout || showExpandedRaiseTools) ? (
          <div className="controls-mini-stats">
            {miniStats.map((fact) => (
              <div key={fact.key}>
                <span>{fact.label}</span>
                <strong>{fact.value}</strong>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {!isIpadLike ? (
        <div className="strategy-card compact">
          <div className="strategy-grid">
            <div>
              <span>{t(language, 'panel.potOdds')}</span>
              <strong>{callTo > 0 ? `${strategy.potOddsPercent}%` : '-'}</strong>
            </div>
            <div>
              <span>SPR</span>
              <strong>{strategy.spr.toFixed(2)}</strong>
            </div>
            <div>
              <span>{t(language, 'panel.effectiveStack')}</span>
              <strong>{strategy.effectiveStack}</strong>
            </div>
            <div>
              <span>{t(language, 'panel.recommendedRaise')}</span>
              <strong>{strategy.recommendedRaise > 0 ? strategy.recommendedRaise : '-'}</strong>
            </div>
          </div>
          <p>{strategy.recommendation}</p>
        </div>
      ) : null}

      {!isIpadLike ? <div className="controls-footnote">{stageFootnote}</div> : null}
    </section>
  );
}

function potOddsPercentAttractive(potOddsPercent: number): boolean {
  return potOddsPercent > 0 && potOddsPercent <= 18;
}
