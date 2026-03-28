import type { ActionOption, TableState } from '../../types/game';
import { t } from '../../i18n';
import { useLanguage } from '../../i18n/languageContext';
import { getHoldemModeLabel, getHoldemStageLabel, getSkillCoachTip } from '../holdemDisplayText';

interface SkillCoachPanelProps {
  table: TableState;
  options: ActionOption[];
}

function findOption(options: ActionOption[], type: ActionOption['type']): ActionOption | undefined {
  return options.find((item) => item.type === type);
}

function stageLabel(table: TableState, language: ReturnType<typeof useLanguage>): string {
  return getHoldemStageLabel(language, table.stage, table.mode);
}

export function SkillCoachPanel({ table, options }: SkillCoachPanelProps) {
  const language = useLanguage();
  const human = table.players.find((player) => player.isHuman);
  const callOpt = findOption(options, 'call');
  const raiseOpt = findOption(options, 'raise') ?? findOption(options, 'bet');

  const tips = (() => {
    const result: string[] = [];
    const toCall = callOpt?.callAmount ?? 0;
    const potAfterCall = Math.max(1, table.totalPot + toCall);
    const potOdds = toCall > 0 ? Math.round((toCall / potAfterCall) * 100) : 0;

    const inHandOpponents = table.players.filter((player) => !player.isHuman && !player.eliminated && !player.folded);
    const effectiveStack = human ? Math.min(human.stack, ...(inHandOpponents.map((player) => player.stack).concat(human.stack))) : 0;
    const spr = potAfterCall > 0 ? Number((effectiveStack / potAfterCall).toFixed(2)) : 0;

    if (table.mode === 'omaha' || table.mode === 'plo') {
      result.push(getSkillCoachTip(language, 'omaha'));
    }

    if (table.mode === 'plo') {
      result.push(getSkillCoachTip(language, 'plo'));
    }

    if (table.mode === 'stud') {
      result.push(getSkillCoachTip(language, 'stud'));
    }

    if (toCall > 0) {
      result.push(
        language === 'zh-CN'
          ? `跟注 ${toCall}，底池赔率约 ${potOdds}%。`
          : language === 'ja'
            ? `コール ${toCall}、ポットオッズは約 ${potOdds}%。`
            : language === 'fr'
              ? `Call ${toCall}, cote du pot environ ${potOdds}%.`
              : language === 'de'
                ? `Call ${toCall}, Pot Odds etwa ${potOdds}%.`
                : `Call ${toCall}, pot odds about ${potOdds}%.`,
      );
    } else {
      result.push(getSkillCoachTip(language, 'freeCheck'));
    }

    if (spr <= 1.4) {
      result.push(
        language === 'zh-CN'
          ? `SPR ${spr}：低 SPR 以强牌施压。`
          : language === 'ja'
            ? `SPR ${spr}：低 SPR では強い手で圧力を。`
            : language === 'fr'
              ? `SPR ${spr} : à faible SPR, mettez la pression avec les mains fortes.`
              : language === 'de'
                ? `SPR ${spr}: Bei niedrigem SPR mit starken Händen Druck machen.`
                : `SPR ${spr}: low SPR favors pressure with strong hands.`,
      );
    } else if (spr >= 5.5) {
      result.push(
        language === 'zh-CN'
          ? `SPR ${spr}：深筹码保留后手。`
          : language === 'ja'
            ? `SPR ${spr}：ディープでは後続アクションの余地を残します。`
            : language === 'fr'
              ? `SPR ${spr} : en profondeur, gardez de la marge pour les streets suivantes.`
              : language === 'de'
                ? `SPR ${spr}: Deep Stacks geben Raum für spätere Streets.`
                : `SPR ${spr}: deep stacks reward leaving room for later streets.`,
      );
    }

    if (raiseOpt?.enabled && raiseOpt.minAmount && raiseOpt.maxAmount) {
      result.push(
        language === 'zh-CN'
          ? `加注区间 ${raiseOpt.minAmount}-${raiseOpt.maxAmount}。`
          : language === 'ja'
            ? `レイズ幅 ${raiseOpt.minAmount}-${raiseOpt.maxAmount}。`
            : language === 'fr'
              ? `Fourchette de relance ${raiseOpt.minAmount}-${raiseOpt.maxAmount}.`
              : language === 'de'
                ? `Raise-Spanne ${raiseOpt.minAmount}-${raiseOpt.maxAmount}.`
                : `Raise range ${raiseOpt.minAmount}-${raiseOpt.maxAmount}.`,
      );
    }

    if (human && human.stack <= table.config.bigBlind * 8) {
      result.push(getSkillCoachTip(language, 'shortStack'));
    }

    return result.slice(0, 3);
  })();

  return (
    <section className="skill-coach glass-panel">
      <div className="skill-coach-head">
        <h4>{t(language, 'panel.skillCoach')}</h4>
        <span>
          {stageLabel(table, language)} · {getHoldemModeLabel(language, table.mode)}
        </span>
      </div>
      <ul>
        {tips.map((tip, index) => (
          <li key={`coach-tip-${index}`}>{tip}</li>
        ))}
      </ul>
    </section>
  );
}
