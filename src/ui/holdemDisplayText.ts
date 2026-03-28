import { evaluatePlayerByMode } from '../engine/evaluators';
import { t, type AppLanguage } from '../i18n';
import type { GameMode } from '../types/cards';
import type { AutoActionPreset, HandStage, TableState } from '../types/game';

const HAND_CATEGORY_TRANSLATIONS: Record<string, Record<AppLanguage, string>> = {
  同花顺: {
    'zh-CN': '同花顺',
    en: 'Straight Flush',
    ja: 'ストレートフラッシュ',
    fr: 'Quinte flush',
    de: 'Straight Flush',
  },
  四条: {
    'zh-CN': '四条',
    en: 'Four of a Kind',
    ja: 'フォーカード',
    fr: 'Carré',
    de: 'Vierling',
  },
  葫芦: {
    'zh-CN': '葫芦',
    en: 'Full House',
    ja: 'フルハウス',
    fr: 'Full',
    de: 'Full House',
  },
  同花: {
    'zh-CN': '同花',
    en: 'Flush',
    ja: 'フラッシュ',
    fr: 'Couleur',
    de: 'Flush',
  },
  顺子: {
    'zh-CN': '顺子',
    en: 'Straight',
    ja: 'ストレート',
    fr: 'Suite',
    de: 'Straight',
  },
  三条: {
    'zh-CN': '三条',
    en: 'Three of a Kind',
    ja: 'スリーカード',
    fr: 'Brelan',
    de: 'Drilling',
  },
  两对: {
    'zh-CN': '两对',
    en: 'Two Pair',
    ja: 'ツーペア',
    fr: 'Deux paires',
    de: 'Zwei Paare',
  },
  一对: {
    'zh-CN': '一对',
    en: 'Pair',
    ja: 'ワンペア',
    fr: 'Paire',
    de: 'Ein Paar',
  },
  高牌: {
    'zh-CN': '高牌',
    en: 'High Card',
    ja: 'ハイカード',
    fr: 'Hauteur',
    de: 'Hohe Karte',
  },
};

type GenericLanguageText = Record<AppLanguage, string>;

const GENERIC_TEXT = {
  focusEnter: {
    'zh-CN': '专注牌桌',
    en: 'Focus Table',
    ja: '集中表示',
    fr: 'Mode focus',
    de: 'Fokusmodus',
  },
  focusExit: {
    'zh-CN': '退出专注',
    en: 'Exit Focus',
    ja: '集中解除',
    fr: 'Quitter focus',
    de: 'Fokus aus',
  },
  dockLeft: {
    'zh-CN': '靠左停靠',
    en: 'Dock Left',
    ja: '左に寄せる',
    fr: 'Ancrer à gauche',
    de: 'Links andocken',
  },
  dockRight: {
    'zh-CN': '靠右停靠',
    en: 'Dock Right',
    ja: '右に寄せる',
    fr: 'Ancrer à droite',
    de: 'Rechts andocken',
  },
  board: {
    'zh-CN': '公共牌',
    en: 'Board',
    ja: 'ボード',
    fr: 'Board',
    de: 'Board',
  },
  noBoard: {
    'zh-CN': '无公共牌',
    en: 'No Board',
    ja: 'ボードなし',
    fr: 'Pas de board',
    de: 'Kein Board',
  },
  studCompare: {
    'zh-CN': '梭哈直接比较各自成牌。',
    en: 'Stud compares completed hands directly.',
    ja: 'スタッドは完成ハンドを直接比較します。',
    fr: 'En stud, les mains complètes sont comparées directement.',
    de: 'Beim Stud werden die fertigen Hände direkt verglichen.',
  },
  turnFallback: {
    'zh-CN': '自动',
    en: 'Auto',
    ja: '自動',
    fr: 'Auto',
    de: 'Auto',
  },
  turnPrefix: {
    'zh-CN': '轮到',
    en: 'Turn',
    ja: '番',
    fr: 'Tour',
    de: 'Am Zug',
  },
  autoPrefix: {
    'zh-CN': '自动',
    en: 'Auto',
    ja: '自動',
    fr: 'Auto',
    de: 'Auto',
  },
  noPlayer: {
    'zh-CN': '无玩家',
    en: 'No player',
    ja: 'プレイヤーなし',
    fr: 'Aucun joueur',
    de: 'Kein Spieler',
  },
  bestHandPrefix: {
    'zh-CN': '当前最佳',
    en: 'Best hand',
    ja: '現在の最良役',
    fr: 'Meilleure main',
    de: 'Beste Hand',
  },
  bestHandNeedCards: {
    'zh-CN': '仍需 {count} 张牌',
    en: 'needs {count} cards',
    ja: 'あと {count} 枚必要',
    fr: 'encore {count} cartes requises',
    de: 'benötigt noch {count} Karten',
  },
  replayFocusAllIn: {
    'zh-CN': '全下聚焦',
    en: 'All-in Focus',
    ja: 'オールイン注目',
    fr: 'Focus all-in',
    de: 'All-in-Fokus',
  },
  replayFocusCurrent: {
    'zh-CN': '当前聚焦',
    en: 'Current Focus',
    ja: '現在の注目',
    fr: 'Focus actuel',
    de: 'Aktueller Fokus',
  },
  replayFocusWinner: {
    'zh-CN': '胜者聚焦',
    en: 'Winner Focus',
    ja: '勝者注目',
    fr: 'Focus vainqueur',
    de: 'Sieger-Fokus',
  },
  replayFocusShowdown: {
    'zh-CN': '摊牌聚焦',
    en: 'Showdown Focus',
    ja: 'ショーダウン注目',
    fr: 'Focus showdown',
    de: 'Showdown-Fokus',
  },
  replayFocusTable: {
    'zh-CN': '牌桌聚焦',
    en: 'Table Focus',
    ja: 'テーブル注目',
    fr: 'Focus table',
    de: 'Tisch-Fokus',
  },
  controlsNoData: {
    'zh-CN': '等待当前手牌数据',
    en: 'Waiting for live hand data',
    ja: '現在のハンド情報を待機中',
    fr: 'En attente des données de la main',
    de: 'Warte auf aktuelle Handdaten',
  },
  controlsWaitTurn: {
    'zh-CN': '等待轮到你行动',
    en: 'Waiting for your turn',
    ja: '自分の番を待機中',
    fr: 'En attente de votre tour',
    de: 'Warte auf deinen Zug',
  },
  controlsFreeCheckRaise: {
    'zh-CN': '可免费过牌；强牌可主动争夺底池。',
    en: 'Free check available; strong hands can start building the pot.',
    ja: '無料でチェック可能。強い手は自分からポットを作れます。',
    fr: 'Check gratuit possible ; les mains fortes peuvent commencer à construire le pot.',
    de: 'Check ist frei; starke Hände können den Pot aktiv aufbauen.',
  },
  controlsFreeCheck: {
    'zh-CN': '当前可免费过牌。',
    en: 'You may check for free.',
    ja: '無料でチェックできます。',
    fr: 'Vous pouvez checker gratuitement.',
    de: 'Du kannst kostenlos checken.',
  },
  controlsGoodOdds: {
    'zh-CN': '底池赔率不错，可适当放宽跟注范围。',
    en: 'Pot odds are favorable, so your calling range can widen slightly.',
    ja: 'ポットオッズが良く、コールレンジを少し広げられます。',
    fr: 'Les cotes du pot sont bonnes ; votre range de call peut s’élargir légèrement.',
    de: 'Die Pot Odds sind gut, daher darf die Calling-Range etwas weiter werden.',
  },
  controlsLowSpr: {
    'zh-CN': 'SPR 偏低且压力偏大，边缘牌谨慎投入。',
    en: 'Low SPR and real pressure: avoid investing with thin bluff-catchers.',
    ja: 'SPR が低く圧力も強いので、薄い受け手では慎重に。',
    fr: 'SPR faible et forte pression : évitez d’investir avec des bluff-catchers marginaux.',
    de: 'Niedriger SPR und hoher Druck: mit dünnen Bluff-Catchern vorsichtig sein.',
  },
  controlsMediumDecision: {
    'zh-CN': '结合牌力与听牌权益决定：中强牌更适合继续。',
    en: 'Let made-hand strength and draw equity guide the continue decision.',
    ja: '完成役の強さとドローの価値で続行判断をします。',
    fr: 'La décision de continuer dépend de la force faite et de l’équité du tirage.',
    de: 'Die Fortsetzung sollte von Made Hand und Draw Equity abhängen.',
  },
  presetHalfPot: {
    'zh-CN': '半池',
    en: '1/2 Pot',
    ja: '1/2 Pot',
    fr: '1/2 Pot',
    de: '1/2 Pot',
  },
  presetTwoThirdPot: {
    'zh-CN': '2/3 池',
    en: '2/3 Pot',
    ja: '2/3 Pot',
    fr: '2/3 Pot',
    de: '2/3 Pot',
  },
  presetPot: {
    'zh-CN': '满池',
    en: 'Pot',
    ja: 'Pot',
    fr: 'Pot',
    de: 'Pot',
  },
  presetDoublePot: {
    'zh-CN': '2 倍池',
    en: '2x Pot',
    ja: '2x Pot',
    fr: '2x Pot',
    de: '2x Pot',
  },
  tipOmaha: {
    'zh-CN': '奥马哈必须使用 2 张底牌 + 3 张公共牌。',
    en: 'In Omaha, you must use exactly 2 hole cards and 3 board cards.',
    ja: 'オマハでは必ずホールカード 2 枚とボード 3 枚を使います。',
    fr: 'En Omaha, vous devez utiliser exactement 2 cartes fermées et 3 cartes du board.',
    de: 'In Omaha musst du genau 2 Hole Cards und 3 Boardkarten verwenden.',
  },
  tipPlo: {
    'zh-CN': 'PLO 以底池尺度控池，避免无计划做大底池。',
    en: 'In PLO, use pot sizing to control growth and avoid bloating marginal pots.',
    ja: 'PLO はポットサイズを基準に、薄い場面でポットを膨らませすぎないこと。',
    fr: 'En PLO, utilisez le sizing pot pour contrôler la taille du pot.',
    de: 'Im PLO sollte Pot-Sizing die Potgröße kontrollieren.',
  },
  tipStud: {
    'zh-CN': '梭哈先看明牌结构，再决定是否继续压迫。',
    en: 'In stud, read the exposed upcards before committing to pressure.',
    ja: 'スタッドはまず見えているアップカードの構成を見ます。',
    fr: 'En stud, lisez d’abord les cartes visibles avant de mettre la pression.',
    de: 'Beim Stud zuerst die offenen Karten lesen, dann Druck ausüben.',
  },
  tipFreeCheck: {
    'zh-CN': '当前可免费过牌，强牌可考虑主动做池。',
    en: 'Checking is free here; strong hands can start building the pot.',
    ja: 'ここは無料でチェック可能。強い手は自分からポットを作れます。',
    fr: 'Le check est gratuit ; les mains fortes peuvent commencer à construire le pot.',
    de: 'Der Check ist frei; starke Hände können den Pot aufbauen.',
  },
  tipShortStack: {
    'zh-CN': '短码阶段少平跟，优先弃牌或全下。',
    en: 'On a short stack, call less often and prefer fold-or-jam decisions.',
    ja: 'ショートではコールを減らし、フォールドかオールインを優先します。',
    fr: 'Avec un tapis court, réduisez les calls et privilégiez fold ou tapis.',
    de: 'Mit kurzem Stack weniger callen und eher fold oder jam wählen.',
  },
} satisfies Record<string, GenericLanguageText>;

function text(language: AppLanguage, key: keyof typeof GENERIC_TEXT): string {
  return GENERIC_TEXT[key][language];
}

export function translateHandCategory(language: AppLanguage, label: string): string {
  const aliasMap: Record<string, string> = {
    straight_flush: '同花顺',
    four_kind: '四条',
    full_house: '葫芦',
    flush: '同花',
    straight: '顺子',
    three_kind: '三条',
    two_pair: '两对',
    pair: '一对',
    high_card: '高牌',
  };
  const normalized = aliasMap[label] ?? label;
  return HAND_CATEGORY_TRANSLATIONS[normalized]?.[language] ?? normalized;
}

export function translateWinnerDescription(language: AppLanguage, description: string): string {
  if (description === '其余玩家弃牌，直接收下底池') {
    return {
      'zh-CN': '其余玩家弃牌，直接收下底池',
      en: 'Everyone else folded, so the pot was won uncontested.',
      ja: '全員が降りたため、無競争でポット獲得。',
      fr: 'Tout le monde a passé, le pot est remporté sans contestation.',
      de: 'Alle anderen haben gefoldet, der Pot geht ohne Showdown an dich.',
    }[language];
  }
  if (description === '平分底池') {
    return {
      'zh-CN': '平分底池',
      en: 'Split pot',
      ja: 'ポット分割',
      fr: 'Pot partagé',
      de: 'Geteilter Pot',
    }[language];
  }
  return translateHandCategory(language, description);
}

export function getHoldemStageLabel(language: AppLanguage, stage: HandStage, mode: GameMode): string {
  if (mode !== 'stud') {
    return t(language, `stage.${stage}`);
  }

  const studStages: Record<HandStage, GenericLanguageText> = {
    preflop: {
      'zh-CN': '第一轮',
      en: '1st Street',
      ja: '第1ストリート',
      fr: '1re street',
      de: '1. Street',
    },
    flop: {
      'zh-CN': '第二轮',
      en: '2nd Street',
      ja: '第2ストリート',
      fr: '2e street',
      de: '2. Street',
    },
    turn: {
      'zh-CN': '第三轮',
      en: '3rd Street',
      ja: '第3ストリート',
      fr: '3e street',
      de: '3. Street',
    },
    river: {
      'zh-CN': '第四轮',
      en: '4th Street',
      ja: '第4ストリート',
      fr: '4e street',
      de: '4. Street',
    },
    showdown: {
      'zh-CN': '摊牌',
      en: 'Showdown',
      ja: 'ショーダウン',
      fr: 'Abattage',
      de: 'Showdown',
    },
    settlement: {
      'zh-CN': '结算',
      en: 'Settlement',
      ja: '精算',
      fr: 'Paiement',
      de: 'Auszahlung',
    },
    complete: {
      'zh-CN': '本手结束',
      en: 'Hand Complete',
      ja: 'ハンド終了',
      fr: 'Main terminée',
      de: 'Hand beendet',
    },
  };
  return studStages[stage][language];
}

export function getHoldemModeLabel(language: AppLanguage, mode: GameMode, short = false): string {
  return t(language, `${short ? 'modeShort' : 'mode'}.${mode}`);
}

export function getHoldemFocusToggleLabel(language: AppLanguage, focusMode: boolean): string {
  return focusMode ? text(language, 'focusExit') : text(language, 'focusEnter');
}

export function getHoldemDockMoveLabel(language: AppLanguage, dock: 'left' | 'right'): string {
  return dock === 'right' ? text(language, 'dockLeft') : text(language, 'dockRight');
}

export function getHoldemBoardCopy(language: AppLanguage, mode: GameMode): { title: string; tip?: string } {
  if (mode === 'stud') {
    return {
      title: text(language, 'noBoard'),
      tip: text(language, 'studCompare'),
    };
  }
  return {
    title: text(language, 'board'),
  };
}

export function getHoldemTurnChip(language: AppLanguage, actorName?: string): string {
  return `${text(language, 'turnPrefix')} ${actorName ?? text(language, 'turnFallback')}`;
}

export function getHoldemAutoChip(language: AppLanguage, presetLabel: string): string {
  return `${text(language, 'autoPrefix')} · ${presetLabel}`;
}

export function formatHoldemHumanHint(language: AppLanguage, table: TableState): string {
  const human = table.players.find((player) => player.isHuman);
  if (!human) {
    return text(language, 'noPlayer');
  }

  const requiredTotalCards = table.mode === 'omaha' || table.mode === 'plo' ? 7 : 5;
  const cards = [...human.holeCards, ...table.board];
  const label = text(language, 'bestHandPrefix');
  if (cards.length < requiredTotalCards) {
    return `${label} · ${text(language, 'bestHandNeedCards').replace('{count}', String(requiredTotalCards))}`;
  }

  const evaluated = evaluatePlayerByMode(table.mode, human.holeCards, table.board);
  return `${label} · ${translateHandCategory(language, evaluated.description)}`;
}

export function getReplayFocusLabel(
  language: AppLanguage,
  kind: 'all-in' | 'current' | 'winner' | 'showdown' | 'table',
): string {
  switch (kind) {
    case 'all-in':
      return text(language, 'replayFocusAllIn');
    case 'current':
      return text(language, 'replayFocusCurrent');
    case 'winner':
      return text(language, 'replayFocusWinner');
    case 'showdown':
      return text(language, 'replayFocusShowdown');
    default:
      return text(language, 'replayFocusTable');
  }
}

export function getPresetSizeLabel(language: AppLanguage, key: 'half' | 'twoThird' | 'pot' | 'double'): string {
  switch (key) {
    case 'half':
      return text(language, 'presetHalfPot');
    case 'twoThird':
      return text(language, 'presetTwoThirdPot');
    case 'pot':
      return text(language, 'presetPot');
    default:
      return text(language, 'presetDoublePot');
  }
}

export function getControlsRecommendation(language: AppLanguage, key: 'noData' | 'wait' | 'freeAggro' | 'free' | 'goodOdds' | 'lowSpr' | 'medium'): string {
  switch (key) {
    case 'noData':
      return text(language, 'controlsNoData');
    case 'wait':
      return text(language, 'controlsWaitTurn');
    case 'freeAggro':
      return text(language, 'controlsFreeCheckRaise');
    case 'free':
      return text(language, 'controlsFreeCheck');
    case 'goodOdds':
      return text(language, 'controlsGoodOdds');
    case 'lowSpr':
      return text(language, 'controlsLowSpr');
    default:
      return text(language, 'controlsMediumDecision');
  }
}

export function getSkillCoachTip(language: AppLanguage, key: 'omaha' | 'plo' | 'stud' | 'freeCheck' | 'shortStack'): string {
  switch (key) {
    case 'omaha':
      return text(language, 'tipOmaha');
    case 'plo':
      return text(language, 'tipPlo');
    case 'stud':
      return text(language, 'tipStud');
    case 'freeCheck':
      return text(language, 'tipFreeCheck');
    default:
      return text(language, 'tipShortStack');
  }
}

export function formatStageShortcutFootnote(language: AppLanguage, stageLabel: string): string {
  switch (language) {
    case 'zh-CN':
      return `${stageLabel} · F弃 / Q过 / C跟 / A全 / R加 / 1-4注 / X过弃 / Esc清`;
    case 'ja':
      return `${stageLabel} · Fフォールド / Qチェック / Cコール / Aオールイン / Rレイズ / 1-4サイズ / Esc解除`;
    case 'fr':
      return `${stageLabel} · F Fold / Q Check / C Call / A Tapis / R Relance / 1-4 Sizing / Esc Effacer`;
    case 'de':
      return `${stageLabel} · F Fold / Q Check / C Call / A All-in / R Raise / 1-4 Sizing / Esc Löschen`;
    default:
      return `${stageLabel} · F Fold / Q Check / C Call / A All-in / R Raise / 1-4 Size / Esc Clear`;
  }
}

export function describeAutoActionPresetText(language: AppLanguage, preset: AutoActionPreset | null): string {
  if (!preset) {
    return {
      'zh-CN': '未设置',
      en: 'Unset',
      ja: '未設定',
      fr: 'Aucune',
      de: 'Nicht gesetzt',
    }[language];
  }

  if (preset.mode === 'checkFold') {
    return {
      'zh-CN': '过牌或弃牌',
      en: 'Check or Fold',
      ja: 'チェックまたはフォールド',
      fr: 'Check ou fold',
      de: 'Check oder Fold',
    }[language];
  }
  if (preset.mode === 'checkOnly') {
    return {
      'zh-CN': '仅自动过牌',
      en: 'Check Only',
      ja: 'チェックのみ',
      fr: 'Check seulement',
      de: 'Nur Check',
    }[language];
  }
  if (preset.mode === 'callAny') {
    return {
      'zh-CN': '自动跟注或过牌',
      en: 'Call or Check',
      ja: 'コールまたはチェック',
      fr: 'Call ou check',
      de: 'Call oder Check',
    }[language];
  }
  if (preset.mode === 'callLimitThenFold') {
    switch (language) {
      case 'zh-CN':
        return `跟/过 <= ${preset.callLimitBb ?? 0}BB，否则弃牌`;
      case 'ja':
        return `${preset.callLimitBb ?? 0}BB までコール、それ以上はフォールド`;
      case 'fr':
        return `Call jusqu’à ${preset.callLimitBb ?? 0}BB, sinon fold`;
      case 'de':
        return `Call bis ${preset.callLimitBb ?? 0}BB, sonst Fold`;
      default:
        return `Call up to ${preset.callLimitBb ?? 0}BB, otherwise fold`;
    }
  }

  switch (language) {
    case 'zh-CN':
      return `自动跟注 <= ${preset.callLimitBb ?? 0}BB`;
    case 'ja':
      return `${preset.callLimitBb ?? 0}BB まで自動コール`;
    case 'fr':
      return `Auto-call jusqu’à ${preset.callLimitBb ?? 0}BB`;
    case 'de':
      return `Auto-Call bis ${preset.callLimitBb ?? 0}BB`;
    default:
      return `Auto-call up to ${preset.callLimitBb ?? 0}BB`;
  }
}
