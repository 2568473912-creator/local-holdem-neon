import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { t } from '../../i18n';
import { useLanguage } from '../../i18n/languageContext';
import type { HandHistoryRecord, ReplayViewerState } from '../../types/replay';
import type { CardSkinKey } from '../../types/cardSkin';
import type { HumanPortraitKey } from '../../types/portrait';
import type { MotionLevel } from '../../state/motionPreferences';
import type { TimelineFilterTag } from '../../replay/replayAnalysis';
import { buildReplayKeyMoments, detectSuspiciousBluffLines, filterReplayEvents } from '../../replay/replayAnalysis';
import { getUiMotionProfile } from '../motionProfile';
import { CardView } from './CardView';
import { PortraitSpotlightCard } from './PortraitSpotlightCard';
import { SeatPanel } from './SeatPanel';
import { getHoldemBoardCopy, getHoldemModeLabel, getReplayFocusLabel } from '../holdemDisplayText';
import { translateHoldemText } from '../holdemText';
import { getSeatDensity, getSeatPositions } from '../seatLayout';
import { resolvePlayerPortraitMood } from '../playerPortraits';

interface ReplayViewerProps {
  record: HandHistoryRecord;
  viewer: ReplayViewerState;
  humanPortraitKey: HumanPortraitKey;
  cardSkinKey: CardSkinKey;
  motionLevel: MotionLevel;
  onBack: () => void;
  onPrev: () => void;
  onNext: () => void;
  onToggleAutoplay: () => void;
  onSetStep: (step: number) => void;
  onJumpStage: (stage: 'preflop' | 'flop' | 'turn' | 'river' | 'showdown') => void;
}

function replayFocusTone(stage: HandHistoryRecord['snapshots'][number]['stage']): string {
  if (stage === 'preflop') return 'preflop';
  if (stage === 'flop') return 'flop';
  if (stage === 'turn') return 'turn';
  if (stage === 'river') return 'river';
  if (stage === 'showdown') return 'showdown';
  return 'settlement';
}

function translateReplayTeachingLabel(language: ReturnType<typeof useLanguage>, label?: string): string | undefined {
  if (!label) return undefined;
  const map: Record<string, Record<ReturnType<typeof useLanguage>, string>> = {
    价值下注: {
      'zh-CN': '价值下注',
      en: 'Value Bet',
      ja: 'バリューベット',
      fr: 'Mise de value',
      de: 'Value Bet',
    },
    半诈唬: {
      'zh-CN': '半诈唬',
      en: 'Semi-Bluff',
      ja: 'セミブラフ',
      fr: 'Semi-bluff',
      de: 'Semi-Bluff',
    },
    诈唬施压: {
      'zh-CN': '诈唬施压',
      en: 'Bluff Pressure',
      ja: 'ブラフ圧力',
      fr: 'Pression bluff',
      de: 'Bluff-Druck',
    },
    控池操作: {
      'zh-CN': '控池操作',
      en: 'Pot Control',
      ja: 'ポットコントロール',
      fr: 'Contrôle du pot',
      de: 'Pot Control',
    },
    压力弃牌: {
      'zh-CN': '压力弃牌',
      en: 'Pressure Fold',
      ja: 'プレッシャーフォールド',
      fr: 'Fold sous pression',
      de: 'Fold unter Druck',
    },
    赔率跟注: {
      'zh-CN': '赔率跟注',
      en: 'Odds Call',
      ja: 'オッズコール',
      fr: 'Call par cote',
      de: 'Odds Call',
    },
    防守跟注: {
      'zh-CN': '防守跟注',
      en: 'Defensive Call',
      ja: '守備コール',
      fr: 'Call défensif',
      de: 'Defensiver Call',
    },
    价值全下: {
      'zh-CN': '价值全下',
      en: 'Value Jam',
      ja: 'バリュージャム',
      fr: 'Tapis de value',
      de: 'Value Jam',
    },
    施压全下: {
      'zh-CN': '施压全下',
      en: 'Pressure Jam',
      ja: 'プレッシャージャム',
      fr: 'Tapis de pression',
      de: 'Pressure Jam',
    },
  };
  return map[label]?.[language] ?? label;
}

function translateReplayMomentLabel(language: ReturnType<typeof useLanguage>, label: string): string {
  if (label === '可疑诈唬线')
    return language === 'zh-CN' ? '可疑诈唬线' : language === 'ja' ? '疑わしいブラフ線' : language === 'fr' ? 'Ligne de bluff suspecte' : language === 'de' ? 'Verdächtige Bluff-Linie' : 'Suspicious bluff line';
  if (label === '全下节点')
    return language === 'zh-CN' ? '全下节点' : language === 'ja' ? 'オールイン局面' : language === 'fr' ? 'Spot all-in' : language === 'de' ? 'All-in-Moment' : 'All-in spot';
  if (label.startsWith('大额施压 '))
    return language === 'zh-CN'
      ? label
      : language === 'ja'
        ? label.replace('大额施压 ', '大きな圧力 ')
        : language === 'fr'
          ? label.replace('大额施压 ', 'Grosse pression ')
          : language === 'de'
            ? label.replace('大额施压 ', 'Großer Druck ')
            : label.replace('大额施压 ', 'Big pressure ');
  if (label === '关键弃牌')
    return language === 'zh-CN' ? '关键弃牌' : language === 'ja' ? '重要フォールド' : language === 'fr' ? 'Fold clé' : language === 'de' ? 'Wichtiger Fold' : 'Key fold';
  if (label === '边池创建')
    return language === 'zh-CN' ? '边池创建' : language === 'ja' ? 'サイドポット作成' : language === 'fr' ? 'Création de side pot' : language === 'de' ? 'Side Pot erstellt' : 'Side pot created';
  if (label === '玩家淘汰')
    return language === 'zh-CN' ? '玩家淘汰' : language === 'ja' ? 'プレイヤー脱落' : language === 'fr' ? 'Élimination' : language === 'de' ? 'Eliminierung' : 'Player eliminated';
  if (label === '进入摊牌')
    return language === 'zh-CN' ? '进入摊牌' : language === 'ja' ? 'ショーダウンへ' : language === 'fr' ? 'Vers le showdown' : language === 'de' ? 'Zum Showdown' : 'Enter showdown';
  if (label === '手牌结束')
    return language === 'zh-CN' ? '手牌结束' : language === 'ja' ? 'ハンド終了' : language === 'fr' ? 'Main terminée' : language === 'de' ? 'Hand beendet' : 'Hand complete';
  return label;
}

export function ReplayViewer({
  record,
  viewer,
  humanPortraitKey,
  cardSkinKey,
  motionLevel,
  onBack,
  onPrev,
  onNext,
  onToggleAutoplay,
  onSetStep,
  onJumpStage,
}: ReplayViewerProps) {
  const language = useLanguage();
  const isIpadLike = typeof document !== 'undefined' && document.documentElement.dataset.ipadLike === 'true';
  const boardCopy = getHoldemBoardCopy(language, record.gameMode);
  const [keyFilter, setKeyFilter] = useState<'all' | 'pressure' | 'bluff' | 'elimination' | 'settlement'>('all');
  const [pressureThresholdBB, setPressureThresholdBB] = useState(4);
  const [timelineFilters, setTimelineFilters] = useState<TimelineFilterTag[]>([]);
  const [showChipFlow, setShowChipFlow] = useState(() => !isIpadLike);
  const [showKeyMoments, setShowKeyMoments] = useState(() => !isIpadLike);
  const [showKeyMomentControls, setShowKeyMomentControls] = useState(() => !isIpadLike);
  const [showTimelineFilters, setShowTimelineFilters] = useState(() => !isIpadLike);
  const [sidebarMode, setSidebarMode] = useState<'timeline' | 'insights'>('timeline');
  const [insightLayer, setInsightLayer] = useState<'overview' | 'deep'>(() => (isIpadLike ? 'overview' : 'deep'));
  const snapshot = record.snapshots[viewer.step] ?? record.snapshots[0];
  const maxStep = Math.max(0, record.snapshots.length - 1);
  const seatDensity = getSeatDensity(snapshot.players.length, { mode: 'replay' });
  const seatPositions = getSeatPositions(snapshot.players.length, { mode: 'replay' });
  const straddleSeat = useMemo(() => {
    const straddleEvent = record.events.find((event) => event.type === 'post_blind' && event.blindType === 'straddle');
    if (!straddleEvent?.actorId) {
      return undefined;
    }
    return record.participants.find((item) => item.id === straddleEvent.actorId)?.seat;
  }, [record.events, record.participants]);

  const eventAtStep = record.events.find((event) => event.step === snapshot.step);
  const modeLabel = getHoldemModeLabel(language, record.gameMode);
  const difficultyLabel =
    record.aiDifficulty === 'conservative'
      ? t(language, 'common.conservative')
      : record.aiDifficulty === 'aggressive'
        ? t(language, 'common.aggressive')
        : t(language, 'common.standard');
  const suspiciousBluffLines = useMemo(() => detectSuspiciousBluffLines(record), [record]);
  const replayInsights = useMemo(() => {
    const aiActions = record.actions.filter((action) => action.actorId !== 'P0');
    const aggressive = aiActions.filter((action) => action.actionType === 'bet' || action.actionType === 'raise' || action.actionType === 'all-in').length;
    const tagCounter = new Map<string, number>();
    for (const action of aiActions) {
      if (!action.teachingLabel) continue;
      tagCounter.set(action.teachingLabel, (tagCounter.get(action.teachingLabel) ?? 0) + 1);
    }
    const topTags = [...tagCounter.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    return {
      aiActionCount: aiActions.length,
      aggressiveRate: aiActions.length > 0 ? Math.round((aggressive / aiActions.length) * 100) : 0,
      topTags,
      suspiciousBluffCount: suspiciousBluffLines.size,
    };
  }, [record.actions, suspiciousBluffLines.size]);
  const chipFlow = useMemo(() => {
    return record.participants
      .map((participant) => {
        const start = record.startingChips[participant.id] ?? 0;
        const end = record.endingChips[participant.id] ?? start;
        return {
          id: participant.id,
          name: participant.name,
          start,
          end,
          delta: end - start,
        };
      })
      .sort((a, b) => b.delta - a.delta);
  }, [record.endingChips, record.participants, record.startingChips]);
  const biggestWinner = chipFlow[0];
  const biggestLoser = chipFlow.length > 0 ? chipFlow[chipFlow.length - 1] : undefined;
  const keyMoments = useMemo(
    () => buildReplayKeyMoments(record, suspiciousBluffLines, pressureThresholdBB),
    [record, suspiciousBluffLines, pressureThresholdBB],
  );
  const filteredKeyMoments = useMemo(() => {
    if (keyFilter === 'all') {
      return keyMoments;
    }
    if (keyFilter === 'bluff') {
      return keyMoments.filter((moment) => moment.kind === 'bluff');
    }
    if (keyFilter === 'elimination') {
      return keyMoments.filter((moment) => moment.kind === 'elimination');
    }
    if (keyFilter === 'settlement') {
      return keyMoments.filter((moment) => moment.kind === 'settlement');
    }
    return keyMoments.filter((moment) => moment.kind === 'pressure');
  }, [keyFilter, keyMoments]);
  const timelineFilterSet = useMemo(() => new Set(timelineFilters), [timelineFilters]);
  const filteredTimelineEvents = useMemo(
    () => filterReplayEvents(record.events, timelineFilterSet, suspiciousBluffLines, record.blindInfo.bigBlind, pressureThresholdBB),
    [pressureThresholdBB, record.blindInfo.bigBlind, record.events, suspiciousBluffLines, timelineFilterSet],
  );
  const focusPlayerId = eventAtStep?.actorId ?? snapshot.activePlayerId ?? (snapshot.stage === 'showdown' || snapshot.stage === 'complete' ? record.winners[0] : undefined) ?? 'P0';
  const focusSnapshotPlayer = snapshot.players.find((player) => player.id === focusPlayerId) ?? snapshot.players.find((player) => player.id === 'P0') ?? snapshot.players[0];
  const focusParticipant = record.participants.find((participant) => participant.id === focusSnapshotPlayer?.id);
  const focusMood = focusSnapshotPlayer
    ? resolvePlayerPortraitMood(focusSnapshotPlayer, {
        active: snapshot.activePlayerId === focusSnapshotPlayer.id,
        winner: (snapshot.stage === 'showdown' || snapshot.stage === 'complete') && record.winners.includes(focusSnapshotPlayer.id),
      })
    : 'calm';
  const focusEyebrow =
    eventAtStep?.type === 'action' && eventAtStep.isAllIn
      ? getReplayFocusLabel(language, 'all-in')
      : eventAtStep?.actorId
        ? getReplayFocusLabel(language, 'current')
        : snapshot.stage === 'complete'
          ? getReplayFocusLabel(language, 'winner')
          : snapshot.stage === 'showdown'
            ? getReplayFocusLabel(language, 'showdown')
            : getReplayFocusLabel(language, 'table');
  const focusDetail = eventAtStep?.note ?? snapshot.note;
  const focusNote = focusSnapshotPlayer
    ? language === 'zh-CN'
      ? `筹码 ${focusSnapshotPlayer.stack} · 本轮下注 ${focusSnapshotPlayer.currentBet}`
      : language === 'ja'
        ? `スタック ${focusSnapshotPlayer.stack} · このラウンド ${focusSnapshotPlayer.currentBet}`
        : language === 'fr'
          ? `Tapis ${focusSnapshotPlayer.stack} · Misé ${focusSnapshotPlayer.currentBet}`
          : language === 'de'
            ? `Stack ${focusSnapshotPlayer.stack} · Einsatz ${focusSnapshotPlayer.currentBet}`
            : `Stack ${focusSnapshotPlayer.stack} · This round ${focusSnapshotPlayer.currentBet}`
    : undefined;
  const focusTone = replayFocusTone(eventAtStep?.stage ?? snapshot.stage);
  const {
    reducedMotion,
    replayWipeDuration,
    replayCardDuration,
    replayCardEnterOffset,
    replayCardExitOffset,
    replayCardEnterTilt,
    replayCardExitTilt,
    replayCardEnterBlur,
    replayCardExitBlur,
  } = getUiMotionProfile(motionLevel, isIpadLike);
  const showTimelinePane = !isIpadLike || sidebarMode === 'timeline';
  const showInsightsPane = !isIpadLike || sidebarMode === 'insights';
  const showInsightOverview = !isIpadLike || insightLayer === 'overview';
  const showInsightDeep = !isIpadLike || insightLayer === 'deep';
  const sidebarHeading = isIpadLike
    ? sidebarMode === 'timeline'
      ? t(language, 'panel.actionTimeline')
      : t(language, 'panel.tableState')
    : language === 'zh-CN'
      ? '牌桌态势与时间线'
      : language === 'ja'
        ? 'テーブル状況と履歴'
        : language === 'fr'
          ? 'Etat + chronologie'
          : language === 'de'
            ? 'Tischstatus + Verlauf'
            : 'Table State + Timeline';

  const toggleTimelineFilter = (tag: TimelineFilterTag) => {
    setTimelineFilters((prev) => (prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]));
  };
  const openDeepInsights = () => {
    setInsightLayer('deep');
    if (isIpadLike) {
      setShowChipFlow(true);
      setShowKeyMoments(true);
      setShowKeyMomentControls(false);
    }
  };
  const openChipFlowInsights = () => {
    setInsightLayer('deep');
    setShowChipFlow(true);
    if (isIpadLike) {
      setShowKeyMoments(false);
      setShowKeyMomentControls(false);
    }
  };
  const openKeyMomentInsights = () => {
    setInsightLayer('deep');
    setShowKeyMoments(true);
    if (isIpadLike) {
      setShowChipFlow(false);
      setShowKeyMomentControls(false);
    }
  };
  const jumpToTimelineFromInsight = (step: number, kind?: 'bluff' | 'pressure' | 'elimination' | 'settlement') => {
    onSetStep(step);
    if (!isIpadLike) {
      return;
    }
    setSidebarMode('timeline');
    setShowTimelineFilters(true);
    if (kind === 'bluff') {
      setTimelineFilters(['bluff']);
      return;
    }
    if (kind === 'pressure') {
      setTimelineFilters(['pressure']);
      return;
    }
    if (kind === 'elimination') {
      setTimelineFilters(['elimination']);
      return;
    }
    if (kind === 'settlement') {
      setTimelineFilters(['showdown']);
      return;
    }
    setTimelineFilters([]);
  };
  useEffect(() => {
    if (!isIpadLike || !showTimelinePane) {
      return;
    }
    const activeTimelineItem = document.querySelector<HTMLElement>('.replay-timeline-pane li.active');
    activeTimelineItem?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  }, [isIpadLike, showTimelinePane, snapshot.step, timelineFilters]);

  const chipFlowTitle =
    language === 'zh-CN' ? '筹码变化' : language === 'ja' ? 'チップ推移' : language === 'fr' ? 'Flux de jetons' : language === 'de' ? 'Chip-Verlauf' : 'Chip Flow';
  const insightOverviewSummary =
    biggestWinner && biggestLoser
      ? `${
          language === 'zh-CN' ? '领跑' : language === 'ja' ? '先行' : language === 'fr' ? 'Leader' : language === 'de' ? 'Führung' : 'Leader'
        } ${biggestWinner.name} ${biggestWinner.delta >= 0 ? '+' : ''}${biggestWinner.delta} · ${
          language === 'zh-CN' ? '回撤' : language === 'ja' ? '後退' : language === 'fr' ? 'Recul' : language === 'de' ? 'Rückgang' : 'Drop'
        } ${biggestLoser.name} ${biggestLoser.delta >= 0 ? '+' : ''}${biggestLoser.delta}`
      : undefined;
  const keyMomentSummary =
    language === 'zh-CN'
      ? `${filteredKeyMoments.length} 个关键节点`
      : language === 'ja'
        ? `${filteredKeyMoments.length} 件の重要局面`
        : language === 'fr'
          ? `${filteredKeyMoments.length} spots clés`
          : language === 'de'
            ? `${filteredKeyMoments.length} Schlüsselspots`
            : `${filteredKeyMoments.length} key spots`;
  const keyFilterPressureLabel =
    language === 'zh-CN' ? '高压' : language === 'ja' ? '高圧' : language === 'fr' ? 'Pression' : language === 'de' ? 'Druck' : 'Pressure';
  const keyFilterBluffLabel =
    language === 'zh-CN' ? '诈唬线' : language === 'ja' ? 'ブラフ線' : language === 'fr' ? 'Ligne bluff' : language === 'de' ? 'Bluff-Linie' : 'Bluff line';
  const keyFilterAllLabel =
    language === 'zh-CN' ? '全部' : language === 'ja' ? 'すべて' : language === 'fr' ? 'Tous' : language === 'de' ? 'Alle' : 'All';
  const keyFilterLabel =
    keyFilter === 'all'
      ? keyFilterAllLabel
      : keyFilter === 'pressure'
        ? keyFilterPressureLabel
        : keyFilter === 'bluff'
          ? keyFilterBluffLabel
          : keyFilter === 'elimination'
            ? t(language, 'replay.elimination')
            : t(language, 'stage.settlement');
  const keyMomentControlsSummary =
    language === 'zh-CN'
      ? `筛选 ${keyFilterLabel} · ${pressureThresholdBB}BB`
      : language === 'ja'
        ? `フィルター ${keyFilterLabel} · ${pressureThresholdBB}BB`
        : language === 'fr'
          ? `Filtre ${keyFilterLabel} · ${pressureThresholdBB}BB`
          : language === 'de'
            ? `Filter ${keyFilterLabel} · ${pressureThresholdBB}BB`
            : `Filter ${keyFilterLabel} · ${pressureThresholdBB}BB`;
  const advancedFiltersLabel = t(language, 'replay.advancedFilters');
  const applyKeyFilter = (nextFilter: 'all' | 'pressure' | 'bluff' | 'elimination' | 'settlement') => {
    setKeyFilter(nextFilter);
    if (!isIpadLike) {
      return;
    }
    if (nextFilter === 'elimination' || nextFilter === 'settlement') {
      setShowKeyMomentControls(true);
      return;
    }
    setShowKeyMomentControls(false);
  };

  return (
    <main className="replay-screen">
      <section className="replay-top glass-panel">
        <div className="replay-top-copy">
          <h2>{t(language, 'common.replay')} · {t(language, 'replay.handNumber', { handId: record.handId })}</h2>
          <div className="replay-top-meta">
            <span>{new Date(record.timestamp).toLocaleString(language, { hour12: false })}</span>
            <span>
              {t(language, 'common.mode')}：{modeLabel} · {t(language, 'top.aiDifficulty')}：{difficultyLabel}
            </span>
            {straddleSeat !== undefined ? <span>{language === 'zh-CN' ? '附加：UTG 跨注' : language === 'ja' ? '追加：UTG ストラドル' : language === 'fr' ? 'Bonus : straddle UTG' : language === 'de' ? 'Extra: UTG-Straddle' : 'Extra: UTG Straddle'}</span> : null}
          </div>
        </div>
        <div className="replay-head-actions">
          <button className="btn" onClick={onBack}>
            {language === 'zh-CN' ? '返回列表' : language === 'ja' ? '一覧へ戻る' : language === 'fr' ? 'Retour' : language === 'de' ? 'Zurück' : 'Back'}
          </button>
        </div>
      </section>

      <section className="replay-main">
        <div className="replay-table-panel glass-panel">
          <div className="replay-table-felt">
            <div className="board-area">
              {record.gameMode === 'stud' ? (
                <>
                  <div className="board-title">{boardCopy.title}</div>
                  <div className="board-empty-tip">{boardCopy.tip}</div>
                </>
              ) : (
                <>
                  <div className="board-title">{boardCopy.title}</div>
                  <div className="board-cards">
                    {[0, 1, 2, 3, 4].map((idx) => {
                      const card = snapshot.board[idx];
                      return <CardView key={`rp-board-${idx}-${card?.code ?? 'x'}`} card={card} hidden={!card} delay={idx * 0.04} cardSkinKey={cardSkinKey} />;
                    })}
                  </div>
                </>
              )}
            </div>

            <motion.div
              key={`replay-pot-${snapshot.totalPot}`}
              className="pot-display"
              initial={{ scale: 0.96, opacity: 0.55 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              <span>{t(language, 'common.pot')}</span>
              <strong>{snapshot.totalPot}</strong>
            </motion.div>

            {snapshot.players.map((player, idx) => {
              const pos = seatPositions[idx];
              const seatPlayer = record.participants.find((p) => p.id === player.id);
              return (
                <div
                  key={`replay-seat-${player.id}`}
                  className={`seat-anchor ${snapshot.activePlayerId === player.id ? 'active' : ''} ${
                    (snapshot.stage === 'showdown' || snapshot.stage === 'complete') && record.winners.includes(player.id) ? 'winner' : ''
                  }`}
                  style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: `translate(-50%, -50%) scale(${pos.scale})` }}
                >
                  <SeatPanel
                    player={{
                      ...player,
                      isHuman: player.id === 'P0',
                      style: seatPlayer?.style ?? 'balanced',
                      portraitKey: player.portraitKey ?? seatPlayer?.portraitKey,
                      committed: 0,
                      actedThisStreet: false,
                    }}
                    isDealer={record.dealerSeat === player.seat}
                    isSmallBlind={record.smallBlindSeat === player.seat}
                    isBigBlind={record.bigBlindSeat === player.seat}
                    isStraddle={straddleSeat !== undefined && player.seat === straddleSeat}
                    isActive={snapshot.activePlayerId === player.id}
                    isWinner={(snapshot.stage === 'showdown' || snapshot.stage === 'complete') && record.winners.includes(player.id)}
                    showHoleCards={player.id === 'P0' || player.revealed}
                    density={seatDensity}
                    context="replay"
                    humanPortraitKeyOverride={humanPortraitKey}
                    cardSkinKey={cardSkinKey}
                  />
                </div>
              );
            })}
          </div>

          <div className="replay-controls">
            <button className="btn" onClick={onPrev} disabled={viewer.step <= 0}>
              {language === 'zh-CN' ? '上一步' : language === 'ja' ? '前へ' : language === 'fr' ? 'Préc.' : language === 'de' ? 'Zurück' : 'Prev'}
            </button>
            <button className="btn" onClick={onToggleAutoplay}>
              {viewer.autoplay
                ? t(language, 'common.pause')
                : language === 'zh-CN'
                  ? '自动播放'
                  : language === 'ja'
                    ? '自動再生'
                    : language === 'fr'
                      ? 'Lecture auto'
                      : language === 'de'
                        ? 'Autoplay'
                        : 'Autoplay'}
            </button>
            <button className="btn" onClick={onNext} disabled={viewer.step >= maxStep}>
              {language === 'zh-CN' ? '下一步' : language === 'ja' ? '次へ' : language === 'fr' ? 'Suiv.' : language === 'de' ? 'Weiter' : 'Next'}
            </button>
            <div className="replay-stage-jumps">
              <button className="btn mini" onClick={() => onJumpStage('preflop')}>
                {t(language, 'stage.preflop')}
              </button>
              <button className="btn mini" onClick={() => onJumpStage('flop')}>
                {t(language, 'stage.flop')}
              </button>
              <button className="btn mini" onClick={() => onJumpStage('turn')}>
                {t(language, 'stage.turn')}
              </button>
              <button className="btn mini" onClick={() => onJumpStage('river')}>
                {t(language, 'stage.river')}
              </button>
              <button className="btn mini" onClick={() => onJumpStage('showdown')}>
                {t(language, 'stage.showdown')}
              </button>
            </div>
            <div className="replay-slider-row">
              <input
                type="range"
                min={0}
                max={maxStep}
                value={viewer.step}
                onChange={(event) => onSetStep(Number(event.target.value))}
              />
              <span>
                {language === 'zh-CN' ? '步骤' : language === 'ja' ? 'ステップ' : language === 'fr' ? 'Étape' : language === 'de' ? 'Schritt' : 'Step'} {viewer.step}/{maxStep}
              </span>
            </div>
          </div>
        </div>

        <aside className={`replay-timeline glass-panel tone-${focusTone} ${isIpadLike ? `mode-${sidebarMode}` : ''}`}>
          <div className="replay-sidebar-head">
            <div className="replay-sidebar-head-copy">
              <h3>{sidebarHeading}</h3>
              <p>{language === 'zh-CN' ? '当前' : language === 'ja' ? '現在' : language === 'fr' ? 'Actuel' : language === 'de' ? 'Jetzt' : 'Now'}：{translateHoldemText(snapshot.note, language)}</p>
              {eventAtStep && <p>{language === 'zh-CN' ? '事件' : language === 'ja' ? 'イベント' : language === 'fr' ? 'Événement' : language === 'de' ? 'Ereignis' : 'Event'}：{translateHoldemText(eventAtStep.note, language)}</p>}
            </div>
            {isIpadLike && (
              <div className="replay-view-switch" role="tablist" aria-label={t(language, 'common.replay')}>
                <button
                  className={`history-view-button ${sidebarMode === 'timeline' ? 'active' : ''}`}
                  type="button"
                  role="tab"
                  aria-selected={sidebarMode === 'timeline'}
                  aria-controls="replay-timeline-pane"
                  onClick={() => setSidebarMode('timeline')}
                >
                  {t(language, 'panel.actionTimeline')}
                </button>
                <button
                  className={`history-view-button ${sidebarMode === 'insights' ? 'active' : ''}`}
                  type="button"
                  role="tab"
                  aria-selected={sidebarMode === 'insights'}
                  aria-controls="replay-insight-pane"
                  onClick={() => setSidebarMode('insights')}
                >
                  {t(language, 'panel.tableState')}
                </button>
              </div>
            )}
          </div>
          {showInsightsPane && (
            <div className="replay-insight-pane" id="replay-insight-pane" role={isIpadLike ? 'tabpanel' : undefined}>
              {isIpadLike && (
                <div className="replay-insight-layer-switch" role="tablist" aria-label={t(language, 'panel.tableState')}>
                  <button
                    className={`history-view-button ${insightLayer === 'overview' ? 'active' : ''}`}
                    type="button"
                    role="tab"
                    aria-selected={insightLayer === 'overview'}
                    onClick={() => setInsightLayer('overview')}
                  >
                    {t(language, 'replay.insightViewOverview')}
                  </button>
                  <button
                    className={`history-view-button ${insightLayer === 'deep' ? 'active' : ''}`}
                    type="button"
                    role="tab"
                    aria-selected={insightLayer === 'deep'}
                    onClick={openDeepInsights}
                  >
                    {t(language, 'replay.insightViewDetails')}
                  </button>
                </div>
              )}
              {showInsightOverview && (
                <div className="replay-insight-overview-pane">
                  <div className={`replay-focus-card-shell tone-${focusTone}`}>
                    <AnimatePresence mode="wait" initial={false}>
                      {focusSnapshotPlayer && !reducedMotion && (
                        <motion.span
                          key={`wipe-${focusSnapshotPlayer.id}-${viewer.step}`}
                          className="replay-focus-card-wipe"
                          initial={{ x: '115%', opacity: 0 }}
                          animate={{ x: ['115%', '8%', '-110%'], opacity: [0, 0.9, 0] }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: replayWipeDuration, ease: 'easeInOut' }}
                        />
                      )}
                    </AnimatePresence>
                    <AnimatePresence mode="wait" initial={false}>
                      {focusSnapshotPlayer && (
                        <motion.div
                          key={`${focusSnapshotPlayer.id}-${focusEyebrow}-${focusMood}-${viewer.step}`}
                          className="replay-focus-card-content"
                          initial={{ opacity: 0, x: replayCardEnterOffset, rotateY: replayCardEnterTilt, scale: 0.93, filter: `blur(${replayCardEnterBlur}px)` }}
                          animate={{ opacity: 1, x: 0, rotateY: 0, scale: 1, filter: 'blur(0px)' }}
                          exit={{ opacity: 0, x: replayCardExitOffset, rotateY: replayCardExitTilt, scale: 0.98, filter: `blur(${replayCardExitBlur}px)` }}
                          transition={{ duration: replayCardDuration, ease: 'easeOut' }}
                        >
                          <PortraitSpotlightCard
                            player={{
                              id: focusSnapshotPlayer.id,
                              name: focusSnapshotPlayer.name,
                              isHuman: focusSnapshotPlayer.id === 'P0',
                              style: focusParticipant?.style ?? 'balanced',
                              portraitKey:
                                focusSnapshotPlayer.portraitKey ??
                                focusParticipant?.portraitKey ??
                                (focusSnapshotPlayer.id === 'P0' ? humanPortraitKey : undefined),
                            }}
                            mood={focusMood}
                            eyebrow={focusEyebrow}
                            detail={focusDetail ? translateHoldemText(focusDetail, language) : ''}
                            note={focusNote}
                            value={
                              record.winners.includes(focusSnapshotPlayer.id) && (snapshot.stage === 'showdown' || snapshot.stage === 'complete')
                                ? language === 'zh-CN'
                                  ? '胜者'
                                  : language === 'ja'
                                    ? '勝者'
                                    : language === 'fr'
                                      ? 'Vainqueur'
                                      : language === 'de'
                                        ? 'Sieger'
                                        : 'Winner'
                                : undefined
                            }
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <div className="replay-insights">
                    <div>
                      <span>{t(language, 'replay.aiActions')}</span>
                      <strong>{replayInsights.aiActionCount}</strong>
                    </div>
                    <div>
                      <span>{t(language, 'replay.aggressionRate')}</span>
                      <strong>{replayInsights.aggressiveRate}%</strong>
                    </div>
                    <div>
                      <span>{t(language, 'replay.topTeachingTags')}</span>
                      <strong>{replayInsights.topTags.map((item) => `${item[0]}(${item[1]})`).join(' / ') || t(language, 'replay.none')}</strong>
                    </div>
                    <div>
                      <span>{language === 'zh-CN' ? '可疑诈唬线' : language === 'ja' ? '疑わしいブラフ線' : language === 'fr' ? 'Bluffs suspects' : language === 'de' ? 'Verdächtige Bluffs' : 'Suspicious bluffs'}</span>
                      <strong>{replayInsights.suspiciousBluffCount}</strong>
                    </div>
                  </div>
                  {isIpadLike && (
                    <div className="replay-insight-summary-grid">
                      <button className="replay-insight-summary-card" type="button" onClick={openChipFlowInsights}>
                        <span>{chipFlowTitle}</span>
                        <strong>{insightOverviewSummary ?? t(language, 'replay.none')}</strong>
                        <em>{language === 'zh-CN' ? '查看筹码变化' : language === 'ja' ? 'チップ推移を見る' : language === 'fr' ? 'Voir le flux de jetons' : language === 'de' ? 'Chip-Verlauf ansehen' : 'Open chip flow'}</em>
                      </button>
                      <button className="replay-insight-summary-card" type="button" onClick={openKeyMomentInsights}>
                        <span>{t(language, 'replay.keyMoments')}</span>
                        <strong>{keyMomentSummary}</strong>
                        <em>{language === 'zh-CN' ? '查看关键节点' : language === 'ja' ? '重要局面を見る' : language === 'fr' ? 'Voir les moments clés' : language === 'de' ? 'Schlüsselmomente ansehen' : 'Open key moments'}</em>
                      </button>
                    </div>
                  )}
                  {eventAtStep?.type === 'action' && eventAtStep.teachingLabel && (
                    <p className="replay-teaching-current">
                      {t(language, 'replay.teaching')}：<strong>{translateReplayTeachingLabel(language, eventAtStep.teachingLabel)}</strong>
                      {eventAtStep.teachingNote ? ` · ${translateHoldemText(eventAtStep.teachingNote, language)}` : ''}
                    </p>
                  )}
                </div>
              )}
              {showInsightDeep && (
                <div className="replay-insight-deep-pane">
                  <div className={`replay-chip-flow ${showChipFlow ? 'expanded' : 'collapsed'}`}>
                    <div className="replay-section-head">
                      <h4>{chipFlowTitle}</h4>
                      {isIpadLike && (
                        <button className="btn mini ghost section-inline-toggle" type="button" onClick={() => setShowChipFlow((value) => !value)}>
                          {t(language, showChipFlow ? 'common.collapse' : 'common.expand')}
                        </button>
                      )}
                    </div>
                    {!showChipFlow && biggestWinner && biggestLoser ? (
                      <p className="replay-section-summary">{insightOverviewSummary}</p>
                    ) : (
                      <ul>
                        {chipFlow.map((item) => (
                          <li key={`flow-${item.id}`}>
                            <div>
                              <span>{item.name}</span>
                              <span>
                                {item.start} → {item.end}
                              </span>
                            </div>
                            <strong className={item.delta >= 0 ? 'up' : 'down'}>
                              {item.delta >= 0 ? '+' : ''}
                              {item.delta}
                            </strong>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className={`replay-key-events ${showKeyMoments ? 'expanded' : 'collapsed'}`}>
                    <div className="replay-key-head">
                      <div className="replay-section-head">
                        <h4>{t(language, 'replay.keyMoments')}</h4>
                        {isIpadLike && (
                          <button
                            className="btn mini ghost section-inline-toggle"
                            type="button"
                            onClick={() =>
                              setShowKeyMoments((value) => {
                                const nextValue = !value;
                                if (!nextValue) {
                                  setShowKeyMomentControls(false);
                                }
                                return nextValue;
                              })
                            }
                          >
                            {t(language, showKeyMoments ? 'common.collapse' : 'common.expand')}
                          </button>
                        )}
                      </div>
                      {showKeyMoments && !isIpadLike && (
                        <div className="replay-key-filter">
                          <button className={keyFilter === 'all' ? 'active' : ''} onClick={() => applyKeyFilter('all')} type="button">
                            {t(language, 'common.all')}
                          </button>
                          <button className={keyFilter === 'pressure' ? 'active' : ''} onClick={() => applyKeyFilter('pressure')} type="button">
                            {keyFilterPressureLabel}
                          </button>
                          <button className={keyFilter === 'bluff' ? 'active' : ''} onClick={() => applyKeyFilter('bluff')} type="button">
                            {keyFilterBluffLabel}
                          </button>
                          <button className={keyFilter === 'elimination' ? 'active' : ''} onClick={() => applyKeyFilter('elimination')} type="button">
                            {t(language, 'replay.elimination')}
                          </button>
                          <button className={keyFilter === 'settlement' ? 'active' : ''} onClick={() => applyKeyFilter('settlement')} type="button">
                            {t(language, 'stage.settlement')}
                          </button>
                        </div>
                      )}
                      {showKeyMoments && isIpadLike && (
                        <div className="replay-key-controls-compact">
                          <span>{keyMomentControlsSummary}</span>
                          <div className="replay-key-controls-actions">
                            <button className="btn mini ghost section-inline-toggle" type="button" onClick={() => setShowKeyMomentControls((value) => !value)}>
                              {showKeyMomentControls ? t(language, 'common.collapse') : advancedFiltersLabel}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    {!showKeyMoments ? (
                      <p className="replay-section-summary">{keyMomentSummary}</p>
                    ) : (
                      <>
                        {isIpadLike ? (
                          <div className="replay-key-controls-shell expanded ipad-shell">
                            <div className="replay-key-filter replay-key-filter-primary">
                              <button className={keyFilter === 'all' ? 'active' : ''} onClick={() => applyKeyFilter('all')} type="button">
                                {t(language, 'common.all')}
                              </button>
                              <button className={keyFilter === 'pressure' ? 'active' : ''} onClick={() => applyKeyFilter('pressure')} type="button">
                                {keyFilterPressureLabel}
                              </button>
                              <button className={keyFilter === 'bluff' ? 'active' : ''} onClick={() => applyKeyFilter('bluff')} type="button">
                                {keyFilterBluffLabel}
                              </button>
                            </div>
                            <div className={`replay-key-controls-advanced ${showKeyMomentControls ? 'expanded' : 'collapsed'}`}>
                              <div className="replay-key-filter replay-key-filter-secondary">
                                <button className={keyFilter === 'elimination' ? 'active' : ''} onClick={() => applyKeyFilter('elimination')} type="button">
                                  {t(language, 'replay.elimination')}
                                </button>
                                <button className={keyFilter === 'settlement' ? 'active' : ''} onClick={() => applyKeyFilter('settlement')} type="button">
                                  {t(language, 'stage.settlement')}
                                </button>
                              </div>
                              <div className="replay-threshold-row">
                                <span>{language === 'zh-CN' ? '高压阈值' : language === 'ja' ? '圧力閾値' : language === 'fr' ? 'Seuil de pression' : language === 'de' ? 'Druckschwelle' : 'Pressure'}</span>
                                <div className="replay-key-filter">
                                  {[2, 4, 6, 8, 10].map((bb) => (
                                    <button
                                      key={`bb-${bb}`}
                                      className={pressureThresholdBB === bb ? 'active' : ''}
                                      onClick={() => setPressureThresholdBB(bb)}
                                      type="button"
                                    >
                                      {bb}BB
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="replay-key-controls-shell expanded">
                            <div className="replay-threshold-row">
                              <span>{language === 'zh-CN' ? '高压阈值' : language === 'ja' ? '圧力閾値' : language === 'fr' ? 'Seuil de pression' : language === 'de' ? 'Druckschwelle' : 'Pressure'}</span>
                              <div className="replay-key-filter">
                                {[2, 4, 6, 8, 10].map((bb) => (
                                  <button
                                    key={`bb-${bb}`}
                                    className={pressureThresholdBB === bb ? 'active' : ''}
                                    onClick={() => setPressureThresholdBB(bb)}
                                    type="button"
                                  >
                                    {bb}BB
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="replay-key-filter replay-key-filter-primary">
                              <button className={keyFilter === 'all' ? 'active' : ''} onClick={() => applyKeyFilter('all')} type="button">
                                {t(language, 'common.all')}
                              </button>
                              <button className={keyFilter === 'pressure' ? 'active' : ''} onClick={() => applyKeyFilter('pressure')} type="button">
                                {keyFilterPressureLabel}
                              </button>
                              <button className={keyFilter === 'bluff' ? 'active' : ''} onClick={() => applyKeyFilter('bluff')} type="button">
                                {keyFilterBluffLabel}
                              </button>
                              <button className={keyFilter === 'elimination' ? 'active' : ''} onClick={() => applyKeyFilter('elimination')} type="button">
                                {t(language, 'replay.elimination')}
                              </button>
                              <button className={keyFilter === 'settlement' ? 'active' : ''} onClick={() => applyKeyFilter('settlement')} type="button">
                                {t(language, 'stage.settlement')}
                              </button>
                            </div>
                          </div>
                        )}
                        <div className="replay-key-list">
                          {filteredKeyMoments.length === 0 ? (
                            <span className="replay-key-empty">
                              {language === 'zh-CN' ? '本手暂无关键节点' : language === 'ja' ? 'このハンドに注目局面はありません。' : language === 'fr' ? 'Aucun spot clé sur cette main.' : language === 'de' ? 'In dieser Hand gibt es keine Schlüsselspots.' : 'No key spots in this hand'}
                            </span>
                          ) : (
                            filteredKeyMoments.map((moment) => (
                              <button
                                key={`km-${moment.step}-${moment.label}`}
                                className={moment.step === snapshot.step ? 'active' : ''}
                                onClick={() => jumpToTimelineFromInsight(moment.step, moment.kind)}
                              >
                                <span>#{moment.step} {translateReplayMomentLabel(language, moment.label)}</span>
                                <span>{translateHoldemText(moment.note, language)}</span>
                              </button>
                            ))
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          {showTimelinePane && (
            <div className="replay-timeline-pane" id="replay-timeline-pane" role={isIpadLike ? 'tabpanel' : undefined}>
              <div className={`replay-timeline-filters ${showTimelineFilters ? 'expanded' : 'collapsed'}`}>
                <div className="replay-section-head">
                  <span>{language === 'zh-CN' ? '时间线筛选' : language === 'ja' ? 'タイムライン絞り込み' : language === 'fr' ? 'Filtres timeline' : language === 'de' ? 'Timeline-Filter' : 'Timeline filters'}</span>
                  {isIpadLike && (
                    <button className="btn mini ghost section-inline-toggle" type="button" onClick={() => setShowTimelineFilters((value) => !value)}>
                      {t(language, showTimelineFilters ? 'common.collapse' : 'common.expand')}
                    </button>
                  )}
                </div>
                {showTimelineFilters && (
                  <div className="replay-key-filter">
                    <button className={timelineFilterSet.has('pressure') ? 'active' : ''} onClick={() => toggleTimelineFilter('pressure')} type="button">
                      {language === 'zh-CN' ? '高压' : language === 'ja' ? '高圧' : language === 'fr' ? 'Pression' : language === 'de' ? 'Druck' : 'Pressure'}
                    </button>
                    <button className={timelineFilterSet.has('bluff') ? 'active' : ''} onClick={() => toggleTimelineFilter('bluff')} type="button">
                      {language === 'zh-CN' ? '诈唬' : language === 'ja' ? 'ブラフ' : language === 'fr' ? 'Bluff' : language === 'de' ? 'Bluff' : 'Bluff'}
                    </button>
                    <button className={timelineFilterSet.has('elimination') ? 'active' : ''} onClick={() => toggleTimelineFilter('elimination')} type="button">
                      {t(language, 'replay.elimination')}
                    </button>
                    <button className={timelineFilterSet.has('teaching') ? 'active' : ''} onClick={() => toggleTimelineFilter('teaching')} type="button">
                      {t(language, 'replay.teaching')}
                    </button>
                    <button className={timelineFilterSet.has('showdown') ? 'active' : ''} onClick={() => toggleTimelineFilter('showdown')} type="button">
                      {t(language, 'replay.showdown')}
                    </button>
                  </div>
                )}
                <strong>
                  {language === 'zh-CN' ? '事件' : language === 'ja' ? 'イベント' : language === 'fr' ? 'Événements' : language === 'de' ? 'Ereignisse' : 'Events'} {filteredTimelineEvents.length}/{record.events.length}
                </strong>
              </div>
              {filteredTimelineEvents.length === 0 ? (
                <p className="replay-timeline-empty">
                  {language === 'zh-CN' ? '当前筛选下无事件' : language === 'ja' ? 'この条件ではイベントがありません。' : language === 'fr' ? 'Aucun événement pour ce filtre.' : language === 'de' ? 'Für diesen Filter gibt es keine Ereignisse.' : 'No events for this filter'}
                </p>
              ) : (
                <ul>
                  {filteredTimelineEvents.map((event) => (
                    <li key={event.id} className={event.step === snapshot.step ? 'active' : ''}>
                      <button onClick={() => onSetStep(event.step)}>
                        <span>#{event.step}</span>
                        <span className="timeline-event-main">{translateHoldemText(event.note, language)}</span>
                        {event.type === 'action' && event.teachingLabel && (
                          <span className={`timeline-teaching ${event.teachingTag ?? ''}`}>{translateReplayTeachingLabel(language, event.teachingLabel)}</span>
                        )}
                        {suspiciousBluffLines.has(event.step) && (
                          <span className="timeline-flag bluff">
                            {language === 'zh-CN' ? '可疑诈唬' : language === 'ja' ? '疑わしいブラフ' : language === 'fr' ? 'Bluff suspect' : language === 'de' ? 'Verdächtiger Bluff' : 'Suspicious bluff'}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}
