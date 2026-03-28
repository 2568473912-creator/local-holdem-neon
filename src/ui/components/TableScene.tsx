import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import type { ActionOption, AutoActionPreset, PlayerAction, TableState } from '../../types/game';
import type { CardSkinKey } from '../../types/cardSkin';
import type { EffectSkinKey } from '../../types/effectSkin';
import type { HumanPortraitKey } from '../../types/portrait';
import type { HandHistoryRecord, ReplayEvent } from '../../types/replay';
import { getTournamentPrizeForRank, getTournamentPrizeLines } from '../../engine/tournamentPrize';
import { getTournamentStructure } from '../../engine/tournamentStructure';
import { describeAutoActionPreset } from '../../state/autoAction';
import { getTournamentPointReward } from '../../state/careerProfile';
import type { MotionLevel } from '../../state/motionPreferences';
import { t } from '../../i18n';
import { useLanguage } from '../../i18n/languageContext';
import { translateHoldemText } from '../holdemText';
import { getUiMotionProfile } from '../motionProfile';
import { CardView } from './CardView';
import { ControlsPanel } from './ControlsPanel';
import { SeatPanel } from './SeatPanel';
import { ActionLogPanel } from './ActionLogPanel';
import { PortraitSpotlightCard } from './PortraitSpotlightCard';
import { SessionInsightsPanel } from './SessionInsightsPanel';
import { TournamentInfoPanel } from './TournamentInfoPanel';
import { TableEffectsLayer } from './TableEffectsLayer';
import { getSeatDensity, getSeatPositions } from '../seatLayout';
import {
  formatHoldemHumanHint,
  getHoldemAutoChip,
  getHoldemBoardCopy,
  getHoldemDockMoveLabel,
  getHoldemFocusToggleLabel,
  getHoldemModeLabel,
  getHoldemStageLabel,
  getHoldemTurnChip,
  translateHandCategory,
  translateWinnerDescription,
} from '../holdemDisplayText';

interface TableSceneProps {
  table: TableState;
  humanPortraitKey: HumanPortraitKey;
  cardSkinKey: CardSkinKey;
  effectSkinKey: EffectSkinKey;
  motionLevel: MotionLevel;
  paused: boolean;
  humanOptions: ActionOption[];
  autoAction: AutoActionPreset | null;
  onAction: (action: PlayerAction) => void;
  onSetAutoAction: (preset: AutoActionPreset | null) => void;
  events: ReplayEvent[];
  history: HandHistoryRecord[];
  onNextHand: () => void;
  onBackToMenu: () => void;
}

interface LayoutPrefs {
  timeline: number;
  insights: number;
}

const DEFAULT_LAYOUT: LayoutPrefs = {
  timeline: 248,
  insights: 228,
};

const LAYOUT_STORAGE_KEY = 'neon.holdem.layout.v3';
const FOCUS_MODE_STORAGE_KEY = 'neon.holdem.focus-mode.v1';
const FOCUS_DOCK_STORAGE_KEY = 'neon.holdem.focus-dock.v1';
const LEFT_MIN_WIDTH = 500;
const TIMELINE_MIN_WIDTH = 220;
const INSIGHTS_MIN_WIDTH = 204;
const RESIZER_WIDTH = 12;
const RESIZER_GAP = 8;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function handStageLabel(stage: TableState['stage'], mode: TableState['mode'], language: ReturnType<typeof useLanguage>): string {
  return getHoldemStageLabel(language, stage, mode);
}

function getHumanHint(table: TableState, language: ReturnType<typeof useLanguage>): string {
  return formatHoldemHumanHint(language, table);
}

function getActionDisabledReason(options: ActionOption[]): string {
  const blocked = options.filter((opt) => opt.enabled === false && opt.reason);
  if (blocked.length === 0) {
    return '';
  }
  return blocked[0].reason ?? '';
}

export function TableScene({
  table,
  humanPortraitKey,
  cardSkinKey,
  effectSkinKey,
  motionLevel,
  paused,
  humanOptions,
  autoAction,
  onAction,
  onSetAutoAction,
  events,
  history,
  onNextHand,
  onBackToMenu,
}: TableSceneProps) {
  const language = useLanguage();
  const boardCopy = getHoldemBoardCopy(language, table.mode);
  const settlementText = {
    winnerEyebrow: {
      'zh-CN': '胜者揭晓',
      en: 'Winner Spotlight',
      ja: '勝者スポット',
      fr: 'Spotlight gagnant',
      de: 'Sieger-Spotlight',
    }[language],
    splitEyebrow: {
      'zh-CN': '分池结算',
      en: 'Split Pot',
      ja: '分割ポット',
      fr: 'Pot partagé',
      de: 'Geteilter Pot',
    }[language],
    handWinner: {
      'zh-CN': '本手赢家',
      en: 'Hand Winner',
      ja: 'ハンド勝者',
      fr: 'Vainqueur',
      de: 'Hand-Sieger',
    }[language],
    splitWinner: {
      'zh-CN': '分池赢家',
      en: 'Split Winner',
      ja: '分割勝者',
      fr: 'Vainqueur partagé',
      de: 'Split-Sieger',
    }[language],
    championSpotlight: {
      'zh-CN': '冠军聚光',
      en: 'Champion Spotlight',
      ja: '優勝スポット',
      fr: 'Spotlight champion',
      de: 'Champion-Spotlight',
    }[language],
    tournamentSummary: {
      'zh-CN': '锦标赛总结',
      en: 'Tournament Wrap',
      ja: 'トーナメント総括',
      fr: 'Résumé du tournoi',
      de: 'Turnier-Fazit',
    }[language],
    yourFinish: {
      'zh-CN': '你的成绩',
      en: 'Your Finish',
      ja: 'あなたの結果',
      fr: 'Votre résultat',
      de: 'Dein Ergebnis',
    }[language],
    championFigure: {
      'zh-CN': '冠军人物',
      en: 'Champion',
      ja: '優勝者',
      fr: 'Champion',
      de: 'Champion',
    }[language],
    format: {
      'zh-CN': '赛制',
      en: 'Format',
      ja: '形式',
      fr: 'Format',
      de: 'Format',
    }[language],
    reward: {
      'zh-CN': '奖励结果',
      en: 'Reward',
      ja: '報酬',
      fr: 'Récompense',
      de: 'Preis',
    }[language],
    field: {
      'zh-CN': '参赛人数',
      en: 'Field',
      ja: '参加人数',
      fr: 'Participants',
      de: 'Teilnehmer',
    }[language],
    finalRanking: {
      'zh-CN': '最终排名',
      en: 'Final Standings',
      ja: '最終順位',
      fr: 'Classement final',
      de: 'Endstand',
    }[language],
    topFive: {
      'zh-CN': '前 5 名',
      en: 'Top 5',
      ja: '上位 5 名',
      fr: 'Top 5',
      de: 'Top 5',
    }[language],
    prizeStructure: {
      'zh-CN': '奖励结构',
      en: 'Payouts',
      ja: '賞金配分',
      fr: 'Structure des gains',
      de: 'Preisstruktur',
    }[language],
    byFieldSize: {
      'zh-CN': '按当前参赛人数',
      en: 'By current field size',
      ja: '現在の参加人数基準',
      fr: 'Selon le field actuel',
      de: 'Nach aktuellem Feld',
    }[language],
    totalHands: {
      'zh-CN': '总手数',
      en: 'Hands',
      ja: '総ハンド数',
      fr: 'Mains',
      de: 'Hände',
    }[language],
    endingLevel: {
      'zh-CN': '结束级别',
      en: 'End Level',
      ja: '終了レベル',
      fr: 'Niveau final',
      de: 'Endlevel',
    }[language],
    finalBlinds: {
      'zh-CN': '最终盲注',
      en: 'Final Blinds',
      ja: '最終ブラインド',
      fr: 'Blindes finales',
      de: 'Finale Blinds',
    }[language],
    noPrize: {
      'zh-CN': '未进入奖励圈',
      en: 'Outside the money',
      ja: '入賞圏外',
      fr: 'Hors des places payées',
      de: 'Nicht im Geld',
    }[language],
    noReward: {
      'zh-CN': '未奖励',
      en: 'No prize',
      ja: '賞金なし',
      fr: 'Sans gain',
      de: 'Kein Preis',
    }[language],
    championSettlement: {
      'zh-CN': '冠军结算',
      en: 'Champion result',
      ja: '優勝精算',
      fr: 'Résultat champion',
      de: 'Champion-Ergebnis',
    }[language],
    continueTip: {
      'zh-CN': '确认后进入下一手。',
      en: 'Confirm to continue to the next hand.',
      ja: '確認して次のハンドへ進みます。',
      fr: 'Confirmez pour passer à la main suivante.',
      de: 'Bestätigen, um zur nächsten Hand zu gehen.',
    }[language],
    fastModeTip: {
      'zh-CN': '快速节奏已启用，确认后会立即进入下一手。',
      en: 'Quick pace is on. Confirm to move straight into the next hand.',
      ja: '高速テンポ中です。確認するとすぐ次のハンドへ進みます。',
      fr: 'Le rythme rapide est actif. Confirmez pour enchaîner immédiatement.',
      de: 'Schnelles Tempo ist aktiv. Nach der Bestätigung geht es direkt weiter.',
    }[language],
  };
  const isIpadLike = typeof document !== 'undefined' && document.documentElement.dataset.ipadLike === 'true';
  const disabled = paused || table.stage === 'complete' || table.activePlayerId !== 'P0';
  const disabledReason = getActionDisabledReason(humanOptions);
  const heroTurnActive = table.activePlayerId === 'P0' && !paused && table.stage !== 'complete';
  const bottomRowRef = useRef<HTMLElement | null>(null);
  const heroTurnRef = useRef(false);
  const dragRef = useRef<{
    target: 'timeline' | 'insights';
    startX: number;
    timeline: number;
    insights: number;
  } | null>(null);
  const [layout, setLayout] = useState<LayoutPrefs>(() => {
    if (typeof window === 'undefined') {
      return DEFAULT_LAYOUT;
    }
    try {
      const raw = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
      if (!raw) {
        return DEFAULT_LAYOUT;
      }
      const parsed = JSON.parse(raw) as Partial<LayoutPrefs>;
      return {
        timeline: clamp(parsed.timeline ?? DEFAULT_LAYOUT.timeline, TIMELINE_MIN_WIDTH, 460),
        insights: clamp(parsed.insights ?? DEFAULT_LAYOUT.insights, INSIGHTS_MIN_WIDTH, 440),
      };
    } catch {
      return DEFAULT_LAYOUT;
    }
  });
  const [draggingTarget, setDraggingTarget] = useState<'timeline' | 'insights' | null>(null);
  const [focusMode, setFocusMode] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.localStorage.getItem(FOCUS_MODE_STORAGE_KEY) === '1';
  });
  const [focusDock, setFocusDock] = useState<'left' | 'right'>(() => {
    if (typeof window === 'undefined') {
      return 'right';
    }
    return window.localStorage.getItem(FOCUS_DOCK_STORAGE_KEY) === 'left' ? 'left' : 'right';
  });
  const [focusPanel, setFocusPanel] = useState<'controls' | 'timeline' | 'insights' | null>(null);
  const [showTournamentPanel, setShowTournamentPanel] = useState(false);
  const tableFocusMode = isIpadLike ? false : focusMode;
  const seatVisualMode = tableFocusMode ? 'focus' : 'table';
  const ipadCharacterCards = isIpadLike && !tableFocusMode;
  const crowdedIpadTable = isIpadLike && table.players.length >= 9;
  const seatLayoutMode = tableFocusMode || (ipadCharacterCards && table.players.length >= 9) ? 'focus' : 'table';
  const seatDensity = getSeatDensity(table.players.length, { mode: ipadCharacterCards ? 'focus' : seatVisualMode });
  const seatPositions = useMemo(
    () => getSeatPositions(table.players.length, { mode: seatLayoutMode, profile: isIpadLike ? 'ipad' : 'default' }),
    [isIpadLike, seatLayoutMode, table.players.length],
  );

  const clampLayout = useMemo(
    () => (next: LayoutPrefs): LayoutPrefs => {
      const width = bottomRowRef.current?.clientWidth ?? 1360;
      const fixedSpacing = RESIZER_WIDTH * 2 + RESIZER_GAP * 4;
      const timelineMax = Math.max(TIMELINE_MIN_WIDTH, width - LEFT_MIN_WIDTH - next.insights - fixedSpacing);
      const timeline = clamp(next.timeline, TIMELINE_MIN_WIDTH, timelineMax);
      const insightsMax = Math.max(INSIGHTS_MIN_WIDTH, width - LEFT_MIN_WIDTH - timeline - fixedSpacing);
      const insights = clamp(next.insights, INSIGHTS_MIN_WIDTH, insightsMax);
      return { timeline, insights };
    },
    [],
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  }, [layout]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(FOCUS_MODE_STORAGE_KEY, focusMode ? '1' : '0');
  }, [focusMode]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(FOCUS_DOCK_STORAGE_KEY, focusDock);
  }, [focusDock]);

  useEffect(() => {
    const onResize = () => setLayout((prev) => clampLayout(prev));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [clampLayout]);

  useEffect(() => {
    if (!showTournamentPanel) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowTournamentPanel(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showTournamentPanel]);

  useEffect(() => {
    if (!isIpadLike) {
      heroTurnRef.current = heroTurnActive;
      return;
    }

    let frame = 0;
    if (!heroTurnRef.current && heroTurnActive && focusPanel === null) {
      frame = window.requestAnimationFrame(() => {
        setFocusPanel((current) => current ?? 'controls');
      });
    }

    heroTurnRef.current = heroTurnActive;
    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [focusPanel, heroTurnActive, isIpadLike]);

  const stageRef = useRef(table.stage);
  useEffect(() => {
    if (!isIpadLike) {
      stageRef.current = table.stage;
      return;
    }

    let frame = 0;
    const previousStage = stageRef.current;
    if (previousStage !== table.stage) {
      if (table.stage === 'complete' && focusPanel === null) {
        frame = window.requestAnimationFrame(() => {
          setFocusPanel((current) => current ?? 'controls');
        });
      } else if (previousStage === 'complete' && table.stage === 'preflop') {
        frame = window.requestAnimationFrame(() => {
          setFocusPanel('controls');
        });
      }
    }

    stageRef.current = table.stage;
    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [focusPanel, isIpadLike, table.stage]);

  const startDrag = (target: 'timeline' | 'insights', clientX: number) => {
    dragRef.current = {
      target,
      startX: clientX,
      timeline: layout.timeline,
      insights: layout.insights,
    };
    setDraggingTarget(target);
    document.body.classList.add('resizing-columns');
  };

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = event.clientX - dragRef.current.startX;
      const base = dragRef.current;

      if (base.target === 'timeline') {
        const next = clampLayout({
          timeline: base.timeline - dx,
          insights: base.insights,
        });
        setLayout(next);
      } else {
        const next = clampLayout({
          timeline: base.timeline,
          insights: base.insights - dx,
        });
        setLayout(next);
      }
    };

    const onUp = () => {
      dragRef.current = null;
      setDraggingTarget(null);
      document.body.classList.remove('resizing-columns');
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setDraggingTarget(null);
      document.body.classList.remove('resizing-columns');
    };
  }, [clampLayout]);

  const onResizeHandlePointerDown = (target: 'timeline' | 'insights') => (event: ReactPointerEvent<HTMLDivElement>) => {
    startDrag(target, event.clientX);
  };

  const bottomLayoutStyle = {
    '--timeline-width': `${layout.timeline}px`,
    '--insights-width': `${layout.insights}px`,
  } as CSSProperties;
  const toggleFocusMode = () => {
    setFocusMode((prev) => {
      const next = !prev;
      if (!next) {
        setFocusPanel(null);
      }
      return next;
    });
  };
  const toggleFocusDock = () => {
    setFocusDock((prev) => (prev === 'right' ? 'left' : 'right'));
  };
  const payoutTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const payout of table.payouts) {
      map.set(payout.playerId, (map.get(payout.playerId) ?? 0) + payout.amount);
    }
    return map;
  }, [table.payouts]);
  const winnerSummaries = useMemo(
    () =>
      table.winners.map((winnerId) => {
        const player = table.players.find((entry) => entry.id === winnerId);
        const hand = table.showdownHands.find((entry) => entry.playerId === winnerId);
        return {
          id: winnerId,
          name: player?.name ?? winnerId,
          amount: payoutTotals.get(winnerId) ?? 0,
          description: hand?.description ?? (table.showdownHands.length === 0 ? '其余玩家弃牌，直接收下底池' : '平分底池'),
          category: hand?.category ?? (table.showdownHands.length === 0 ? '未摊牌' : '分池'),
        };
      }),
    [payoutTotals, table.players, table.showdownHands, table.winners],
  );
  const totalWon = useMemo(() => [...payoutTotals.values()].reduce((sum, amount) => sum + amount, 0), [payoutTotals]);
  const settlementSpotlights = useMemo(() => {
    const cards = winnerSummaries.slice(0, 3).map((item) => {
      const player = table.players.find((entry) => entry.id === item.id);
      return {
        key: item.id,
        eyebrow: winnerSummaries.length > 1 ? settlementText.splitWinner : settlementText.handWinner,
        value: `+${item.amount}`,
        detail: translateWinnerDescription(language, item.description),
        note:
          item.category === '未摊牌'
            ? {
                'zh-CN': '未摊牌',
                en: 'No showdown',
                ja: '非ショーダウン',
                fr: 'Sans showdown',
                de: 'Ohne Showdown',
              }[language]
            : item.category === '分池'
              ? {
                  'zh-CN': '分池',
                  en: 'Split pot',
                  ja: '分割ポット',
                  fr: 'Pot partagé',
                  de: 'Geteilter Pot',
                }[language]
              : translateHandCategory(language, item.category),
        player: {
          id: item.id,
          name: item.name,
          isHuman: player?.isHuman ?? false,
          style: player?.style ?? 'balanced',
          portraitKey: player?.portraitKey ?? (player?.isHuman ? humanPortraitKey : undefined),
        },
      };
    });

    const hero = table.players.find((player) => player.isHuman);
    if (hero && !cards.some((item) => item.player.id === hero.id)) {
      const heroHand = table.showdownHands.find((entry) => entry.playerId === hero.id);
      cards.push({
        key: `hero-${hero.id}`,
        eyebrow: {
          'zh-CN': '你的卡面',
          en: 'Your Seat',
          ja: 'あなたの席',
          fr: 'Votre siège',
          de: 'Dein Platz',
        }[language],
        value: `${
          {
            'zh-CN': '剩余',
            en: 'Stack',
            ja: '残り',
            fr: 'Tapis',
            de: 'Stack',
          }[language]
        } ${hero.stack}`,
        detail: heroHand ? translateWinnerDescription(language, heroHand.description) : t(language, 'seat.folded'),
        note: heroHand ? translateHandCategory(language, heroHand.category) : t(language, 'seat.folded'),
        player: {
          id: hero.id,
          name: hero.name,
          isHuman: true,
          style: hero.style,
          portraitKey: hero.portraitKey ?? humanPortraitKey,
        },
      });
    }

    return cards.slice(0, 3);
  }, [humanPortraitKey, language, settlementText.handWinner, settlementText.splitWinner, table.players, table.showdownHands, winnerSummaries]);
  const settlementMetaItems = useMemo(
    () => [
      {
        label: {
          'zh-CN': '手牌',
          en: 'Hand',
          ja: 'ハンド',
          fr: 'Main',
          de: 'Hand',
        }[language],
        value: `#${table.handId}`,
      },
      {
        label: {
          'zh-CN': '底池',
          en: 'Pot',
          ja: 'ポット',
          fr: 'Pot',
          de: 'Pot',
        }[language],
        value: `${totalWon}`,
      },
      {
        label: {
          'zh-CN': '盲注',
          en: 'Blinds',
          ja: 'ブラインド',
          fr: 'Blindes',
          de: 'Blinds',
        }[language],
        value: `${table.config.smallBlind}/${table.config.bigBlind}`,
      },
      {
        label: boardCopy.title,
        value: table.mode === 'stud' ? boardCopy.tip ?? '-' : `${table.board.length}/5`,
      },
      {
        label: {
          'zh-CN': '入摊人数',
          en: 'Showdown',
          ja: 'ショーダウン',
          fr: 'Showdown',
          de: 'Showdown',
        }[language],
        value: `${table.showdownHands.length || 0}`,
      },
      {
        label: {
          'zh-CN': '赢家数',
          en: 'Winners',
          ja: '勝者数',
          fr: 'Gagnants',
          de: 'Sieger',
        }[language],
        value: `${winnerSummaries.length}`,
      },
    ],
    [boardCopy.tip, boardCopy.title, language, table.board.length, table.config.bigBlind, table.config.smallBlind, table.handId, table.mode, table.showdownHands.length, totalWon, winnerSummaries.length],
  );
  const eliminationByPlayer = useMemo(() => {
    const map = new Map<string, { handId: number; ts: number }>();
    const chronological = [...history].reverse();

    for (const hand of chronological) {
      for (const event of hand.events) {
        if (event.type !== 'elimination') continue;
        if (map.has(event.actorId)) continue;
        map.set(event.actorId, { handId: hand.handId, ts: hand.timestamp });
      }
    }

    return map;
  }, [history]);
  const isTournamentFinished = table.config.sessionMode === 'tournament' && table.stage === 'complete' && table.players.filter((player) => !player.eliminated).length <= 1;
  const finalStandings = useMemo(() => {
    if (!isTournamentFinished) {
      return [];
    }

    return [...table.players]
      .sort((a, b) => {
        if (a.eliminated !== b.eliminated) {
          return a.eliminated ? 1 : -1;
        }
        if (!a.eliminated && !b.eliminated && b.stack !== a.stack) {
          return b.stack - a.stack;
        }
        if (a.eliminated && b.eliminated) {
          const aHand = eliminationByPlayer.get(a.id)?.handId ?? -1;
          const bHand = eliminationByPlayer.get(b.id)?.handId ?? -1;
          if (aHand !== bHand) {
            return bHand - aHand;
          }
        }
        return a.seat - b.seat;
      })
      .map((player, index) => ({
        id: player.id,
        name: player.name,
        isHuman: player.isHuman,
        rank: index + 1,
        stack: player.stack,
      }));
  }, [eliminationByPlayer, isTournamentFinished, table.players]);
  const heroFinish = finalStandings.find((entry) => entry.isHuman)?.rank ?? null;
  const podium = finalStandings.slice(0, 3);
  const topFinishers = finalStandings.slice(0, 5);
  const tournamentPrizeLines = useMemo(() => getTournamentPrizeLines(table.players.length), [table.players.length]);
  const heroPrize = useMemo(() => (heroFinish ? getTournamentPrizeForRank(table.players.length, heroFinish) : null), [heroFinish, table.players.length]);
  const championPrize = useMemo(
    () => (isTournamentFinished && finalStandings[0] ? getTournamentPrizeForRank(table.players.length, finalStandings[0].rank) : null),
    [finalStandings, isTournamentFinished, table.players.length],
  );
  const tournamentSpotlights = useMemo(() => {
    if (!isTournamentFinished || finalStandings.length === 0) {
      return [];
    }

    const champion = finalStandings[0];
    const championPlayer = table.players.find((player) => player.id === champion.id);
    const championPrize = getTournamentPrizeForRank(table.players.length, champion.rank);
    const championCard: {
      key: string;
      className: string;
      eyebrow: string;
      value: string;
      mood: 'winner' | 'focused';
      detail: string;
      note: string;
      player: {
        id: string;
        name: string;
        isHuman: boolean;
        style: 'tight' | 'loose' | 'aggressive' | 'balanced';
        portraitKey?: HumanPortraitKey;
      };
    } = {
      key: champion.id,
      className: 'champion',
      eyebrow: settlementText.championFigure,
      value:
        championPrize?.percentage
          ? `${championPrize.percentage}%`
          : {
              'zh-CN': '冠军',
              en: 'Champion',
              ja: '優勝',
              fr: 'Champion',
              de: 'Champion',
            }[language],
      mood: 'winner' as const,
      detail: champion.isHuman
        ? {
            'zh-CN': '你完成了整场锦标赛的最终收口。',
            en: 'You closed out the tournament.',
            ja: 'あなたがトーナメントを締め切りました。',
            fr: 'Vous avez bouclé le tournoi.',
            de: 'Du hast das Turnier gewonnen.',
          }[language]
        : {
            'zh-CN': `${champion.name} 在终局中保留了最多筹码并拿下冠军。`,
            en: `${champion.name} held the chip lead at the end and won the title.`,
            ja: `${champion.name} が最後までチップリードを守り切りました。`,
            fr: `${champion.name} a conservé le chip lead et a remporté le titre.`,
            de: `${champion.name} hielt am Ende den Chiplead und gewann das Turnier.`,
          }[language],
      note: `${
        {
          'zh-CN': '最终筹码',
          en: 'Final stack',
          ja: '最終スタック',
          fr: 'Tapis final',
          de: 'Endstack',
        }[language]
      } ${champion.stack} · ${championPrize ? `${championPrize.buyInMultiplier}BI` : settlementText.championSettlement}`,
      player: {
        id: champion.id,
        name: champion.name,
        isHuman: championPlayer?.isHuman ?? false,
        style: championPlayer?.style ?? 'balanced',
        portraitKey: championPlayer?.portraitKey ?? (championPlayer?.isHuman ? humanPortraitKey : undefined),
      },
    };

    const cards = [championCard];
    const heroEntry = finalStandings.find((entry) => entry.isHuman);
    if (heroEntry && heroEntry.id !== champion.id) {
      const heroPlayer = table.players.find((player) => player.id === heroEntry.id);
      cards.push({
        key: heroEntry.id,
        className: 'hero-result',
        eyebrow: settlementText.yourFinish,
        value: `#${heroEntry.rank}`,
        mood: heroEntry.rank <= 3 ? ('winner' as const) : ('focused' as const),
        detail: heroPrize
          ? {
              'zh-CN': `你进入奖励圈，结算占比 ${heroPrize.percentage}% 。`,
              en: `You finished in the money for ${heroPrize.percentage}%.`,
              ja: `${heroPrize.percentage}% の入賞圏でフィニッシュしました。`,
              fr: `Vous terminez payé pour ${heroPrize.percentage}%.`,
              de: `Du landest im Geld für ${heroPrize.percentage}%.`,
            }[language]
          : {
              'zh-CN': '本次未进入奖励圈，可继续从短码阶段和泡沫压力处复盘。',
              en: 'No payout this time. Review the short-stack and bubble spots.',
              ja: '今回は入賞外でした。ショートとバブルの場面を見直せます。',
              fr: 'Pas de gain cette fois. Revoyez les spots short stack et bulle.',
              de: 'Kein Preis diesmal. Prüfe die Short-Stack- und Bubble-Spots.',
            }[language],
        note: `${
          {
            'zh-CN': '最终筹码',
            en: 'Final stack',
            ja: '最終スタック',
            fr: 'Tapis final',
            de: 'Endstack',
          }[language]
        } ${heroEntry.stack} · ${heroPrize ? `${heroPrize.buyInMultiplier}BI` : settlementText.noReward}`,
        player: {
          id: heroEntry.id,
          name: heroEntry.name,
          isHuman: heroPlayer?.isHuman ?? true,
          style: heroPlayer?.style ?? 'balanced',
          portraitKey: heroPlayer?.portraitKey ?? humanPortraitKey,
        },
      });
    }

    return cards;
  }, [finalStandings, heroPrize, humanPortraitKey, isTournamentFinished, language, settlementText.championFigure, settlementText.championSettlement, settlementText.noReward, settlementText.yourFinish, table.players]);
  const championSpotlight = tournamentSpotlights[0] ?? null;
  const secondaryTournamentSpotlights = tournamentSpotlights.slice(1);
  const heroTournamentPoints = useMemo(() => {
    if (!isTournamentFinished || heroFinish === null) {
      return 0;
    }

    return getTournamentPointReward({
      sessionMode: table.config.sessionMode,
      aiDifficulty: table.config.aiDifficulty,
      fieldSize: table.players.length,
      handsPlayed: Math.max(history.length, table.handId),
      finalRank: heroFinish,
      inMoney: Boolean(heroPrize),
      champion: heroFinish === 1,
    });
  }, [heroFinish, heroPrize, history.length, isTournamentFinished, table.config.aiDifficulty, table.config.sessionMode, table.handId, table.players.length]);
  const championSummaryItems = useMemo(() => {
    if (!isTournamentFinished || !championSpotlight) {
      return [];
    }

    return [
      {
        key: 'prize',
        label: {
          'zh-CN': '冠军奖励',
          en: 'Champion Prize',
          ja: '優勝報酬',
          fr: 'Gain champion',
          de: 'Champion-Prämie',
        }[language],
        value: championPrize ? `${championPrize.percentage}% · ${championPrize.buyInMultiplier}BI` : settlementText.championSettlement,
      },
      {
        key: 'field',
        label: settlementText.field,
        value: `${table.players.length} ${
          {
            'zh-CN': '人',
            en: 'players',
            ja: '人',
            fr: 'joueurs',
            de: 'Spieler',
          }[language]
        }`,
      },
      {
        key: 'hands',
        label: settlementText.totalHands,
        value: `${Math.max(history.length, table.handId)} ${
          {
            'zh-CN': '手牌',
            en: 'hands',
            ja: 'ハンド',
            fr: 'mains',
            de: 'Hände',
          }[language]
        }`,
      },
      {
        key: 'blinds',
        label: settlementText.finalBlinds,
        value: `${table.config.smallBlind}/${table.config.bigBlind}`,
      },
      {
        key: 'points',
        label: {
          'zh-CN': '本局积分',
          en: 'Points',
          ja: 'ポイント',
          fr: 'Points',
          de: 'Punkte',
        }[language],
        value: `+${heroTournamentPoints}`,
      },
    ];
  }, [championPrize, championSpotlight, heroTournamentPoints, history.length, isTournamentFinished, language, settlementText.championSettlement, settlementText.field, settlementText.finalBlinds, settlementText.totalHands, table.config.bigBlind, table.config.smallBlind, table.handId, table.players.length]);
  const structureLabel = useMemo(
    () => (table.config.sessionMode === 'tournament' ? getTournamentStructure(table.config.tournamentStructureId ?? 'standard').label : ''),
    [table.config.sessionMode, table.config.tournamentStructureId],
  );
  const tournamentPanelVisible = showTournamentPanel && table.config.sessionMode === 'tournament';
  const motionProfile = getUiMotionProfile(motionLevel, isIpadLike);
  const {
    reducedMotion,
    settlementFadeDuration,
    settlementPanelDuration,
    surfaceDuration: surfaceMotionDuration,
    surfaceAccentDuration,
    panelSlideOffset,
    championStaggerChildren,
    championDelayChildren,
    championBannerDuration,
    championChipDuration,
    championTrailDuration,
    championSparkDuration,
  } = motionProfile;
  const panelMotion = {
    initial: { opacity: 0, y: panelSlideOffset },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: panelSlideOffset },
    transition: { duration: surfaceMotionDuration, ease: 'easeOut' as const },
  };
  const compactBottomDock = isIpadLike;
  const showFocusInlineDock = tableFocusMode && !isIpadLike;
  const seatScaleMultiplier = isIpadLike
    ? tableFocusMode
      ? table.players.length >= 8
        ? 0.98
        : 1.02
      : crowdedIpadTable
        ? 1
        : table.players.length >= 8
          ? 0.97
          : 1.03
    : 1;
  const tableCharacterCards = !tableFocusMode;
  const controlsNeedsAttention = isIpadLike && heroTurnActive && focusPanel !== 'controls';
  const statusWarning =
    disabled && disabledReason
      ? translateHoldemText(disabledReason, language)
      : '';
  const boardCardSize = isIpadLike ? 'seat-balanced' : 'board';
  const bottomSeatVerticalNudge = isIpadLike ? (table.players.length >= 7 ? 14 : 12) : 0;
  const compactControlsStack = (
    <div className="focus-controls-shell glass-panel compact-mode stable-layout">
      <div className="focus-controls-head">
        <div className="focus-controls-head-copy">
          <strong>{tableFocusMode ? t(language, 'panel.betBox') : t(language, 'panel.operationPanel')}</strong>
        </div>
        <div className="focus-controls-head-actions">
          {tableFocusMode && !isIpadLike ? (
            <button className="btn mini ghost focus-dock-toggle" type="button" onClick={toggleFocusDock}>
              {getHoldemDockMoveLabel(language, focusDock)}
            </button>
          ) : null}
          <em>{handStageLabel(table.stage, table.mode, language)}</em>
        </div>
      </div>
      {isIpadLike ? (
        <div className="focus-controls-status-inline">
          <span>{getHumanHint(table, language)}</span>
          {statusWarning ? <em>{statusWarning}</em> : null}
        </div>
      ) : (
        <div className="focus-controls-status">
          <div className="hint-box glass-panel">{getHumanHint(table, language)}</div>
          <div className={`hint-box warning ${statusWarning ? '' : 'placeholder'}`} aria-hidden={!statusWarning}>
            {statusWarning || ' '}
          </div>
        </div>
      )}
      {heroTurnActive || isIpadLike ? (
        <ControlsPanel
          table={table}
          options={humanOptions}
          disabled={disabled}
          autoAction={autoAction}
          condensedIpad={isIpadLike}
          onAction={onAction}
          onSetAutoAction={onSetAutoAction}
        />
      ) : (
        <div className="compact-waiting-panel">
          <div>
            <span>{t(language, 'panel.currentTurn')}</span>
            <strong>
              {table.players.find((player) => player.id === table.activePlayerId)?.name ??
                {
                  'zh-CN': '自动推进中',
                  en: 'Auto-running',
                  ja: '自動進行中',
                  fr: 'Lecture auto',
                  de: 'Auto läuft',
                }[language]}
            </strong>
          </div>
          <div>
            <span>{t(language, 'panel.status')}</span>
            <strong>{paused ? t(language, 'panel.paused') : table.stage === 'complete' ? t(language, 'panel.handComplete') : t(language, 'panel.waitingForHero')}</strong>
          </div>
          <div className={autoAction ? '' : 'placeholder'} aria-hidden={!autoAction}>
            <span>{t(language, 'panel.autoQueued')}</span>
            <strong>{autoAction ? describeAutoActionPreset(autoAction, language) : ' '}</strong>
          </div>
        </div>
      )}
    </div>
  );
  const focusControlsStack = (
    compactControlsStack
  );

  return (
    <main className="table-scene">
      <section className="table-stage glass-panel">
        <div className="stage-label stage-phase">{handStageLabel(table.stage, table.mode, language)}</div>
        <div className="stage-label stage-mode">{getHoldemModeLabel(language, table.mode, true)}</div>
        <div className="stage-label stage-actor">{getHoldemTurnChip(language, table.players.find((p) => p.id === table.activePlayerId)?.name)}</div>
        {autoAction && (
          <div className="stage-label stage-auto accent">{getHoldemAutoChip(language, describeAutoActionPreset(autoAction, language))}</div>
        )}
        {table.config.sessionMode === 'tournament' && (
          <button
            className={`stage-chip-button ${showTournamentPanel ? 'active' : ''}`}
            type="button"
            onClick={() => setShowTournamentPanel((prev) => !prev)}
          >
            {showTournamentPanel ? t(language, 'common.close') : t(language, 'common.details')}
          </button>
        )}
        {!isIpadLike ? (
          <button className={`stage-chip-button ${tableFocusMode ? 'active' : ''}`} type="button" onClick={toggleFocusMode}>
            {getHoldemFocusToggleLabel(language, tableFocusMode)}
          </button>
        ) : null}
      </section>

      <section
        className={`table-wrap ${tableFocusMode ? 'focus-mode' : ''} ${ipadCharacterCards ? 'ipad-character-cards' : ''} ${isIpadLike ? 'ipad-holdem-compact' : ''} ${
          crowdedIpadTable ? 'ipad-holdem-dense-table' : ''
        } ${
          isIpadLike && focusPanel !== null ? 'ipad-panel-open' : ''
        } ${
          showFocusInlineDock && focusPanel === 'controls' ? 'focus-controls-open' : ''
        } ${
          showFocusInlineDock && focusPanel === 'controls' ? `focus-controls-${focusDock}` : ''
        } ${isIpadLike ? `holdem-player-count-${table.players.length}` : ''}`}
      >
        <AnimatePresence>
          {tournamentPanelVisible && (
            <motion.div
              key="tournament-panel"
              initial={{ opacity: 0, y: panelSlideOffset + 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: panelSlideOffset + 2 }}
              transition={{ duration: surfaceAccentDuration, ease: 'easeOut' }}
            >
              <TournamentInfoPanel table={table} onClose={() => setShowTournamentPanel(false)} />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="table-felt">
        <TableEffectsLayer
          language={language}
          handId={table.handId}
          boardCount={table.board.length}
          totalPot={table.totalPot}
          stage={table.stage}
          winnerCount={winnerSummaries.length}
          motionLevel={motionLevel}
          effectSkinKey={effectSkinKey}
          stabilized={!tableFocusMode}
        />
          <div className="board-area">
            {table.mode === 'stud' ? (
              <>
                <div className="board-title">{boardCopy.title}</div>
                <div className="board-empty-tip">{boardCopy.tip}</div>
              </>
            ) : (
              <>
                <div className="board-title">{boardCopy.title}</div>
                  <div className="board-cards">
                    {[0, 1, 2, 3, 4].map((idx) => {
                      const card = table.board[idx];
                      return (
                        <CardView
                          key={`board-${idx}-${card?.code ?? 'empty'}`}
                          card={card}
                          hidden={!card}
                          highlighted={idx === table.board.length - 1}
                          delay={idx * 0.06}
                          size={boardCardSize}
                          cardSkinKey={cardSkinKey}
                        />
                      );
                    })}
                  </div>
                </>
            )}
          </div>

          {tableFocusMode ? (
            <motion.div
              key={`pot-${table.totalPot}`}
              className="pot-display"
              initial={{ scale: 0.95, opacity: 0.6 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: surfaceAccentDuration, ease: 'easeOut' }}
            >
              <span>{t(language, 'common.pot')}</span>
              <strong>{table.totalPot}</strong>
            </motion.div>
          ) : (
            <div className="pot-display stable">
              <span>{t(language, 'common.pot')}</span>
              <strong>{table.totalPot}</strong>
            </div>
          )}

          {table.pots.length > 1 && (
            <div className="side-pot-list">
              {table.pots.slice(1).map((pot) => (
                <div key={pot.id} className="side-pot-item">
                  <span>{pot.id}</span>
                  <strong>{pot.amount}</strong>
                </div>
              ))}
            </div>
          )}

          {typeof document !== 'undefined'
            ? createPortal(
                <AnimatePresence>
            {table.stage === 'complete' && winnerSummaries.length > 0 && (
              <>
                <motion.div
                  key={`settlement-backdrop-${table.handId}`}
                  className="settlement-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: settlementFadeDuration, ease: 'easeOut' }}
                />
                <div className="settlement-shell">
                <motion.div
                  key={`settlement-${table.handId}`}
                  className={`settlement-spotlight ${isTournamentFinished ? 'tournament-finished' : ''}`}
                  initial={{ opacity: 0, y: 14, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.985 }}
                  transition={{ duration: settlementPanelDuration, ease: 'easeOut' }}
                >
                  <div className="settlement-eyebrow">{winnerSummaries.length > 1 ? settlementText.splitEyebrow : settlementText.winnerEyebrow}</div>
                  <h3>{winnerSummaries.map((item) => item.name).join(' / ')}</h3>
                  <p>
                    {winnerSummaries.length > 1
                      ? {
                          'zh-CN': `本手合计分配 ${totalWon}`,
                          en: `Total distributed ${totalWon}`,
                          ja: `配分合計 ${totalWon}`,
                          fr: `Distribué au total : ${totalWon}`,
                          de: `Gesamt verteilt: ${totalWon}`,
                        }[language]
                      : {
                          'zh-CN': `赢得 ${totalWon} 筹码`,
                          en: `Won ${totalWon} chips`,
                          ja: `${totalWon} チップ獲得`,
                          fr: `${totalWon} jetons gagnés`,
                          de: `${totalWon} Chips gewonnen`,
                        }[language]}
                  </p>
                  <div className="settlement-portrait-strip">
                    {settlementSpotlights.map((item) => (
                      <PortraitSpotlightCard
                        key={`winner-spotlight-${item.key}`}
                        player={item.player}
                        mood={table.winners.includes(item.player.id) ? 'winner' : 'focused'}
                        eyebrow={item.eyebrow}
                        detail={item.detail}
                        note={item.note}
                        value={item.value}
                        compact={settlementSpotlights.length > 2}
                        featured
                      />
                    ))}
                  </div>
                  {table.mode !== 'stud' ? (
                    <div className="settlement-board-strip">
                      <span>{boardCopy.title}</span>
                      <div className="settlement-board-cards">
                        {table.board.map((card, index) => (
                          <CardView key={`settlement-board-${card.code}-${index}`} card={card} size="seat-balanced" cardSkinKey={cardSkinKey} animated={false} />
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="settlement-meta-grid">
                    {settlementMetaItems.map((item) => (
                      <div key={`settlement-meta-${item.label}`}>
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="settlement-grid">
                    {winnerSummaries.map((item) => (
                      <div key={`winner-${item.id}`} className="settlement-card">
                        <strong>{item.name}</strong>
                        <span>
                          {item.category === '未摊牌'
                            ? {
                                'zh-CN': '未摊牌',
                                en: 'No showdown',
                                ja: '非ショーダウン',
                                fr: 'Sans showdown',
                                de: 'Ohne Showdown',
                              }[language]
                            : item.category === '分池'
                              ? {
                                  'zh-CN': '分池',
                                  en: 'Split pot',
                                  ja: '分割ポット',
                                  fr: 'Pot partagé',
                                  de: 'Geteilter Pot',
                                }[language]
                              : translateHandCategory(language, item.category)}
                        </span>
                        <em>{translateWinnerDescription(language, item.description)}</em>
                        <b>+{item.amount}</b>
                      </div>
                    ))}
                  </div>
                  {isTournamentFinished && (
                    <div className="tournament-finale">
                      <div className="tournament-finale-head">
                        <strong>{settlementText.tournamentSummary}</strong>
                        <span>
                          {heroFinish === 1
                            ? {
                                'zh-CN': '你已夺冠',
                                en: 'You are the champion',
                                ja: 'あなたが優勝',
                                fr: 'Vous êtes champion',
                                de: 'Du bist Champion',
                              }[language]
                            : {
                                'zh-CN': `你获得第 ${heroFinish ?? '-'} 名`,
                                en: `You finished #${heroFinish ?? '-'}`,
                                ja: `${heroFinish ?? '-'} 位で終了`,
                                fr: `Vous terminez #${heroFinish ?? '-'}`,
                                de: `Du beendest auf Platz ${heroFinish ?? '-'}`,
                              }[language]}
                        </span>
                      </div>

                      {championSpotlight && (
                        <motion.div
                          className="tournament-champion-banner"
                          initial={{ opacity: 0, y: 10, scale: 0.985 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ duration: championBannerDuration, ease: 'easeOut' }}
                        >
                          <div className="tournament-champion-rays" aria-hidden="true">
                            <span />
                            <span />
                            <span />
                          </div>
                          <div className="tournament-champion-badge">{settlementText.championSpotlight}</div>
                          <PortraitSpotlightCard
                            key={`tournament-spotlight-${championSpotlight.key}`}
                            player={championSpotlight.player}
                            mood={championSpotlight.mood}
                            eyebrow={championSpotlight.eyebrow}
                            detail={championSpotlight.detail}
                            note={championSpotlight.note}
                            value={championSpotlight.value}
                            featured
                            className={`${championSpotlight.className} champion-banner-card`}
                          />
                          <motion.div
                            className="tournament-champion-summary"
                            initial="hidden"
                            animate="visible"
                            variants={{
                              hidden: {},
                              visible: {
                                transition: {
                                  staggerChildren: championStaggerChildren,
                                  delayChildren: championDelayChildren,
                                },
                              },
                            }}
                          >
                            {championSummaryItems.map((item, index) => (
                              <motion.div
                                key={`champion-summary-${item.key}`}
                                className="tournament-champion-chip"
                                variants={{
                                  hidden: {
                                    opacity: 0,
                                    x: `${(1.5 - index) * 78}px`,
                                    y: 96,
                                    scale: 0.74,
                                    rotate: (index - 1.5) * 5,
                                    filter: 'blur(6px)',
                                  },
                                  visible: {
                                    opacity: 1,
                                    x: 0,
                                    y: 0,
                                    scale: 1,
                                    rotate: 0,
                                    filter: 'blur(0px)',
                                  },
                                }}
                                transition={{ duration: championChipDuration, ease: 'easeOut' }}
                                style={{ '--chip-order': index } as CSSProperties}
                              >
                                {!reducedMotion && (
                                  <>
                                    <motion.span
                                      aria-hidden="true"
                                      className="tournament-champion-chip-trail"
                                      variants={{
                                        hidden: {
                                          opacity: 0,
                                          x: `${(index - 1.5) * -26}px`,
                                          scaleX: 0.42,
                                          scaleY: 0.82,
                                        },
                                        visible: {
                                          opacity: 0.72,
                                          x: 0,
                                          scaleX: 1,
                                          scaleY: 1,
                                        },
                                      }}
                                      transition={{ duration: championTrailDuration, ease: 'easeOut' }}
                                    />
                                    <motion.span
                                      aria-hidden="true"
                                      className="tournament-champion-chip-spark"
                                      variants={{
                                        hidden: {
                                          opacity: 0,
                                          scale: 0.32,
                                        },
                                        visible: {
                                          opacity: 0.9,
                                          scale: 1,
                                        },
                                      }}
                                      transition={{ duration: championSparkDuration, ease: 'easeOut', delay: championDelayChildren }}
                                    />
                                    <span aria-hidden="true" className="tournament-champion-chip-scatter">
                                      <span />
                                      <span />
                                      <span />
                                    </span>
                                  </>
                                )}
                                <span>{item.label}</span>
                                <strong>{item.value}</strong>
                              </motion.div>
                            ))}
                          </motion.div>
                        </motion.div>
                      )}

                      {secondaryTournamentSpotlights.length > 0 && (
                        <div className="tournament-finale-spotlights">
                          {secondaryTournamentSpotlights.map((entry) => (
                            <PortraitSpotlightCard
                              key={`tournament-spotlight-${entry.key}`}
                              player={entry.player}
                              mood={entry.mood}
                              eyebrow={entry.eyebrow}
                              detail={entry.detail}
                              note={entry.note}
                              value={entry.value}
                              compact={secondaryTournamentSpotlights.length > 1}
                              featured
                              className={entry.className}
                            />
                          ))}
                        </div>
                      )}

                      <div className="tournament-finale-banner">
                        <div>
                          <span>{settlementText.format}</span>
                          <strong>{structureLabel}</strong>
                        </div>
                        <div>
                          <span>{settlementText.reward}</span>
                          <strong>
                            {heroPrize
                              ? `${heroPrize.percentage}% · ${heroPrize.buyInMultiplier} ${
                                  {
                                    'zh-CN': '份买入',
                                    en: 'buy-ins',
                                    ja: 'バイイン',
                                    fr: 'buy-ins',
                                    de: 'Buy-ins',
                                  }[language]
                                }`
                              : settlementText.noPrize}
                          </strong>
                        </div>
                        <div>
                          <span>{settlementText.field}</span>
                          <strong>
                            {table.players.length} {
                              {
                                'zh-CN': '人',
                                en: 'players',
                                ja: '人',
                                fr: 'joueurs',
                                de: 'Spieler',
                              }[language]
                            }
                          </strong>
                        </div>
                      </div>

                      <div className="tournament-finale-podium">
                        {podium.map((entry) => {
                          const prize = getTournamentPrizeForRank(table.players.length, entry.rank);
                          return (
                            <div key={`podium-${entry.id}`} className={`tournament-podium-card ${entry.isHuman ? 'human' : ''}`}>
                              <span>#{entry.rank}</span>
                              <strong>{entry.name}</strong>
                              <em>
                                {entry.stack} {
                                  {
                                    'zh-CN': '筹码',
                                    en: 'chips',
                                    ja: 'チップ',
                                    fr: 'jetons',
                                    de: 'Chips',
                                  }[language]
                                }
                              </em>
                              <b>{prize ? `${prize.percentage}%` : settlementText.noReward}</b>
                            </div>
                          );
                        })}
                      </div>

                      <div className="tournament-finale-grid">
                        <div className="tournament-finale-panel">
                          <div className="tournament-finale-panel-head">
                            <strong>{settlementText.finalRanking}</strong>
                            <span>{settlementText.topFive}</span>
                          </div>
                          <div className="tournament-finale-list">
                            {topFinishers.map((entry) => {
                              const prize = getTournamentPrizeForRank(table.players.length, entry.rank);
                              return (
                                <div key={`finish-${entry.id}`} className={`tournament-finish-row ${entry.isHuman ? 'human' : ''}`}>
                                  <span>
                                    #{entry.rank} {entry.name}
                                  </span>
                                  <strong>{prize ? `${prize.percentage}%` : '-'}</strong>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="tournament-finale-panel">
                          <div className="tournament-finale-panel-head">
                            <strong>{settlementText.prizeStructure}</strong>
                            <span>{settlementText.byFieldSize}</span>
                          </div>
                          <div className="tournament-finale-list">
                            {tournamentPrizeLines.map((line) => (
                              <div key={`payout-${line.place}`} className={`tournament-finish-row ${heroFinish === line.place ? 'human' : ''}`}>
                                <span>{line.label}</span>
                                <strong>
                                  {line.percentage}% · {line.buyInMultiplier}BI
                                </strong>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="tournament-finale-meta">
                        <span>{settlementText.totalHands} {Math.max(history.length, table.handId)}</span>
                        <span>{settlementText.endingLevel} L{table.config.blindLevel}</span>
                        <span>
                          {settlementText.finalBlinds} {table.config.smallBlind}/{table.config.bigBlind}
                        </span>
                      </div>
                    </div>
                  )}
                  <div className="settlement-tip">{table.config.fastMode ? settlementText.fastModeTip : settlementText.continueTip}</div>
                  <div className="settlement-actions">
                    <button className="btn primary" type="button" onClick={isTournamentFinished ? onBackToMenu : onNextHand}>
                      {isTournamentFinished ? t(language, 'common.confirm') : t(language, 'common.confirmContinue')}
                    </button>
                    {!isTournamentFinished ? (
                      <button className="btn" type="button" onClick={onBackToMenu}>
                        {t(language, 'common.backToMenu')}
                      </button>
                    ) : null}
                  </div>
                </motion.div>
                </div>
              </>
            )}
                </AnimatePresence>,
                document.body,
              )
            : null}

          {table.players.map((player, idx) => {
            const pos = seatPositions[idx];
            const isWinner = table.stage === 'complete' && table.winners.includes(player.id);
            const seatMarginTop = pos.y >= 82 ? bottomSeatVerticalNudge : 0;
            return (
              <div
                key={player.id}
                className={`seat-anchor ${isWinner ? 'winner' : ''} ${table.activePlayerId === player.id ? 'active' : ''}`}
                style={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  marginTop: seatMarginTop ? `${seatMarginTop}px` : undefined,
                  transform: `translate(-50%, -50%) scale(${pos.scale * seatScaleMultiplier})`,
                }}
              >
                <SeatPanel
                  player={player}
                  isDealer={player.seat === table.dealerSeat}
                  isSmallBlind={player.seat === table.smallBlindSeat}
                  isBigBlind={player.seat === table.bigBlindSeat}
                  isStraddle={table.straddleSeat !== undefined && player.seat === table.straddleSeat}
                  isActive={table.activePlayerId === player.id}
                  isWinner={isWinner}
                  showHoleCards={player.isHuman || player.revealed || table.stage === 'showdown' || table.stage === 'complete'}
                  density={seatDensity}
                  context={seatVisualMode}
                  characterCardMode={tableCharacterCards}
                  crowdedTableMode={crowdedIpadTable}
                  humanPortraitKeyOverride={humanPortraitKey}
                  cardSkinKey={cardSkinKey}
                />
              </div>
            );
          })}
        </div>

        {showFocusInlineDock && (
          <>
            <div className="focus-dock glass-panel">
              <button className={`btn mini ${focusPanel === 'controls' ? 'primary' : ''}`} type="button" onClick={() => setFocusPanel((prev) => (prev === 'controls' ? null : 'controls'))}>
                {t(language, 'panel.operationPanel')}
              </button>
              <button className={`btn mini ${focusPanel === 'timeline' ? 'primary' : ''}`} type="button" onClick={() => setFocusPanel((prev) => (prev === 'timeline' ? null : 'timeline'))}>
                {t(language, 'panel.actionTimeline')}
              </button>
              <button className={`btn mini ${focusPanel === 'insights' ? 'primary' : ''}`} type="button" onClick={() => setFocusPanel((prev) => (prev === 'insights' ? null : 'insights'))}>
                {t(language, 'panel.tableState')}
              </button>
            </div>

            <AnimatePresence>
              {focusPanel === 'controls' && (
                <motion.div
                  className={`focus-overlay focus-overlay-controls focus-docked-${focusDock}`}
                  {...panelMotion}
                >
                  {focusControlsStack}
                </motion.div>
              )}

              {focusPanel === 'timeline' && (
                <motion.div className="focus-overlay" {...panelMotion}>
                  <ActionLogPanel events={events} maxItems={24} style={{ width: 'min(520px, 92vw)' }} />
                </motion.div>
              )}

              {focusPanel === 'insights' && (
                <motion.div className="focus-overlay" {...panelMotion}>
                  <SessionInsightsPanel table={table} history={history} style={{ width: 'min(460px, 92vw)' }} />
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </section>

      {compactBottomDock && (
        <section className="ipad-bottom-stack">
          <div className="focus-dock glass-panel ipad-dock">
            <button
              className={`btn mini ${focusPanel === 'controls' ? 'primary' : ''} ${controlsNeedsAttention ? 'attention' : ''}`}
              type="button"
              onClick={() => setFocusPanel((prev) => (prev === 'controls' ? null : 'controls'))}
            >
              {t(language, 'panel.operationPanel')}
            </button>
            <button className={`btn mini ${focusPanel === 'timeline' ? 'primary' : ''}`} type="button" onClick={() => setFocusPanel((prev) => (prev === 'timeline' ? null : 'timeline'))}>
              {t(language, 'panel.actionTimeline')}
            </button>
            <button className={`btn mini ${focusPanel === 'insights' ? 'primary' : ''}`} type="button" onClick={() => setFocusPanel((prev) => (prev === 'insights' ? null : 'insights'))}>
              {t(language, 'panel.tableState')}
            </button>
          </div>
          <AnimatePresence>
            {focusPanel === 'controls' && (
              <motion.div className="ipad-compact-panel ipad-compact-panel-controls" {...panelMotion}>
                {compactControlsStack}
              </motion.div>
            )}
            {focusPanel === 'timeline' && (
              <motion.div className="ipad-compact-panel" {...panelMotion}>
                <ActionLogPanel events={events} maxItems={24} style={{ width: '100%' }} />
              </motion.div>
            )}
            {focusPanel === 'insights' && (
              <motion.div className="ipad-compact-panel" {...panelMotion}>
                <SessionInsightsPanel table={table} history={history} style={{ width: '100%' }} />
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}

      {!tableFocusMode && !compactBottomDock && (
        <section className="bottom-row" style={bottomLayoutStyle} ref={bottomRowRef}>
          <div className="left-stack compact-bottom-stack">{compactControlsStack}</div>

          <div
            className={`column-resizer ${draggingTarget === 'timeline' ? 'active' : ''}`}
            onPointerDown={onResizeHandlePointerDown('timeline')}
            role="separator"
            aria-label="调整行动时间线宽度"
          />
          <ActionLogPanel events={events} maxItems={10} style={{ width: `${layout.timeline}px` }} />
          <div
            className={`column-resizer ${draggingTarget === 'insights' ? 'active' : ''}`}
            onPointerDown={onResizeHandlePointerDown('insights')}
            role="separator"
            aria-label="调整牌桌态势宽度"
          />
          <SessionInsightsPanel table={table} history={history} style={{ width: `${layout.insights}px` }} />
        </section>
      )}
    </main>
  );
}
