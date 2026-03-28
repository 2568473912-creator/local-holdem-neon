import { useEffect, useId, useMemo, useState } from 'react';
import type { AppLanguage } from '../../i18n';
import { PlayerPortrait } from './PlayerPortrait';
import { DouDizhuCard } from './DouDizhuCard';
import { IpadInfoSheet } from './IpadInfoSheet';
import { PortraitSpotlightCard } from './PortraitSpotlightCard';
import { useIpadCardSweepSelection } from '../hooks/useIpadCardSweepSelection';
import type { CardSkinKey } from '../../types/cardSkin';
import type { EffectSkinKey } from '../../types/effectSkin';
import type { AIDifficulty } from '../../types/game';
import type { DdzRoundRuntime, DdzSessionStats, DdzPlayerState, DdzPattern, DdzMultiplierEvent, DdzRoundSummary } from '../../doudizhu/types';
import type { DdzTrusteeMode } from '../../state/useDouDizhuController';
import { analyzePattern, canBeat } from '../../doudizhu/rules';

interface DouDizhuTableProps {
  language: AppLanguage;
  runtime: DdzRoundRuntime;
  history: DdzRoundSummary[];
  stats: DdzSessionStats;
  paused: boolean;
  cardSkinKey: CardSkinKey;
  effectSkinKey: EffectSkinKey;
  trusteeMode: DdzTrusteeMode;
  historyViewerOpen: boolean;
  historyViewerRound: number | null;
  onBack: () => void;
  onRestart: () => void;
  onNextRound: () => void;
  onPause: () => void;
  onOpenHistoryViewer: (round?: number) => void;
  onCloseHistoryViewer: () => void;
  onSelectHistoryViewerRound: (round: number) => void;
  onSetTrusteeMode: (mode: DdzTrusteeMode) => void;
  onBid: (bid: number) => void;
  onToggleCard: (cardId: string) => void;
  onSelectPattern: (cardIds: string[]) => void;
  onClearSelection: () => void;
  onHint: () => void;
  onPlay: () => void;
  onPass: () => void;
  canPass: boolean;
  legalPatternCount: number;
  legalPatterns: DdzPattern[];
  onChangeAIDifficulty: (level: AIDifficulty) => void;
}

function phaseLabel(phase: DdzRoundRuntime['phase'], language: AppLanguage): string {
  if (phase === 'bidding') return language === 'zh-CN' ? '叫分阶段' : 'Bidding';
  if (phase === 'playing') return language === 'zh-CN' ? '出牌阶段' : 'Play';
  return language === 'zh-CN' ? '结算阶段' : 'Settlement';
}

function roleLabel(role: DdzPlayerState['role'], language: AppLanguage): string {
  if (role === 'landlord') return language === 'zh-CN' ? '地主' : 'Landlord';
  if (role === 'farmer') return language === 'zh-CN' ? '农民' : 'Farmer';
  return language === 'zh-CN' ? '待定' : 'Pending';
}

function actionMood(player: DdzPlayerState, active: boolean) {
  if (player.lastAction.includes('本局获胜')) return 'winner' as const;
  if (player.lastAction.includes('不出')) return 'checking' as const;
  if (player.lastAction.includes('炸弹') || player.lastAction.includes('王炸')) return 'all-in' as const;
  if (player.lastAction.includes('叫') || player.lastAction.includes('三带') || player.lastAction.includes('飞机')) return 'raising' as const;
  if (player.lastAction.includes('单牌') || player.lastAction.includes('对子') || player.lastAction.includes('顺子')) return 'calling' as const;
  if (active) return 'thinking' as const;
  return 'calm' as const;
}

function playerRoleClass(player: DdzPlayerState): string {
  if (player.role === 'landlord') return 'landlord';
  if (player.role === 'farmer') return 'farmer';
  return 'neutral';
}

function multiplierEventTone(kind: DdzMultiplierEvent['kind']): string {
  if (kind === 'spring') return 'spring';
  if (kind === 'rocket') return 'rocket';
  if (kind === 'bomb') return 'bomb';
  return 'bid';
}

function quickPlayPriority(pattern: DdzPattern): number {
  const explosivePenalty = pattern.type === 'rocket' ? -10 : pattern.type === 'bomb' ? -6 : 0;
  const comboBonus =
    pattern.type === 'airplane' || pattern.type === 'airplaneSingles' || pattern.type === 'airplanePairs'
      ? 4
      : pattern.type === 'straight' || pattern.type === 'pairStraight'
        ? 3
        : pattern.type === 'fourWithTwoSingles' || pattern.type === 'fourWithTwoPairs'
          ? 2
          : pattern.type === 'triplePair' || pattern.type === 'tripleSingle'
            ? 1
            : 0;
  return pattern.cardCount * 10 + pattern.sequenceLength * 4 + comboBonus + explosivePenalty;
}

function patternIdentity(pattern: DdzPattern): string {
  return `${pattern.type}:${pattern.mainRank}:${pattern.sequenceLength}:${pattern.cardCount}`;
}

function formatDdzPattern(pattern: DdzPattern | null | undefined, language: AppLanguage): string {
  if (!pattern) {
    return language === 'zh-CN' ? '还没有人出牌' : 'No play yet';
  }
  const rank = pattern.cards[0]?.shortLabel ?? '';
  if (language === 'zh-CN') return pattern.description;
  if (pattern.type === 'single') return `Single ${rank}`;
  if (pattern.type === 'pair') return `Pair ${rank}`;
  if (pattern.type === 'triple') return `Trips ${rank}`;
  if (pattern.type === 'tripleSingle') return `Trips + single ${rank}`;
  if (pattern.type === 'triplePair') return `Trips + pair ${rank}`;
  if (pattern.type === 'straight') return `Straight from ${rank}`;
  if (pattern.type === 'pairStraight') return `Consecutive pairs from ${rank}`;
  if (pattern.type === 'airplane') return `Airplane from ${rank}`;
  if (pattern.type === 'airplaneSingles') return `Airplane + singles from ${rank}`;
  if (pattern.type === 'airplanePairs') return `Airplane + pairs from ${rank}`;
  if (pattern.type === 'fourWithTwoSingles') return `Four + two singles ${rank}`;
  if (pattern.type === 'fourWithTwoPairs') return `Four + two pairs ${rank}`;
  if (pattern.type === 'bomb') return `Bomb ${rank}`;
  if (pattern.type === 'rocket') return 'Rocket';
  return pattern.description;
}

function translateDdzText(text: string, language: AppLanguage): string {
  if (language === 'zh-CN') return text;
  return text
    .replace(/^等待$/, 'Waiting')
    .replace(/^等待出牌$/, 'Waiting to play')
    .replace(/^叫分开始$/, 'Bidding starts')
    .replace(/^不叫$/, 'Pass')
    .replace(/^不出$/, 'Pass')
    .replace(/^本局获胜$/, 'Wins the round')
    .replace(/^无人叫分，重新发牌$/, 'No bid. Redealing.')
    .replace(/^第 (\d+) 局开始，准备叫分。$/, 'Round $1 starts. Ready for bidding.')
    .replace(/^提示：(.+)$/, 'Hint: $1')
    .replace(/^叫 (\d) 分$/, 'Bid $1')
    .replace(/^抢地主 (\d) 分$/, 'Takes landlord at $1')
    .replace(/^(.+) 不叫$/, '$1 passes')
    .replace(/^(.+) 叫 (\d) 分$/, '$1 bids $2')
    .replace(/^(.+) 不出$/, '$1 passes')
    .replace(/^(.+) 成为地主，开始出牌$/, '$1 becomes Landlord. Play starts.')
    .replace(/^(.+) 拿下地主，底牌加入手牌。$/, '$1 takes Landlord and picks up the bottom cards.')
    .replace(/^(.+) 赢下本局，春天翻倍！$/, '$1 wins the round. Spring doubles the result!')
    .replace(/^(.+) 赢下本局$/, '$1 wins the round')
    .replace(/春天/g, 'Spring')
    .replace(/反春/g, 'Counter-Spring')
    .replace(/王炸/g, 'Rocket')
    .replace(/炸弹/g, 'Bomb')
    .replace(/叫分 /g, 'Bid ');
}

function roundWinnerLabel(entry: DdzRoundSummary, language: AppLanguage): string {
  return entry.winningTeam === 'landlord' ? (language === 'zh-CN' ? '地主胜' : 'Landlord wins') : language === 'zh-CN' ? '农民胜' : 'Farmers win';
}

function heroDeltaLabel(entry: DdzRoundSummary, language: AppLanguage): string {
  const label = language === 'zh-CN' ? '你' : 'You';
  return entry.heroDelta >= 0 ? `${label} +${entry.heroDelta}` : `${label} ${entry.heroDelta}`;
}

function settlementLeadLabel(entry: DdzRoundSummary, language: AppLanguage): string {
  if (entry.winnerId === 'P0') {
    return language === 'zh-CN' ? '你收下本局' : 'You take the round';
  }
  return entry.winningTeam === 'landlord' ? (language === 'zh-CN' ? '地主方收下本局' : 'Landlord side takes the round') : language === 'zh-CN' ? '农民方收下本局' : 'Farmer side takes the round';
}

function formatRoundTimestamp(timestamp: number, language: AppLanguage): string {
  return new Intl.DateTimeFormat(language === 'zh-CN' ? 'zh-CN' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    month: '2-digit',
    day: '2-digit',
  }).format(timestamp);
}

function handDensityClass(cardCount: number): string {
  if (cardCount >= 26) return 'hand-density-fanned';
  if (cardCount >= 20) return 'hand-density-spread';
  return 'hand-density-standard';
}

export function DouDizhuTable({
  language,
  runtime,
  history,
  stats,
  paused,
  cardSkinKey,
  effectSkinKey,
  trusteeMode,
  historyViewerOpen,
  historyViewerRound,
  onBack,
  onRestart,
  onNextRound,
  onPause,
  onOpenHistoryViewer,
  onCloseHistoryViewer,
  onSelectHistoryViewerRound,
  onSetTrusteeMode,
  onBid,
  onToggleCard,
  onSelectPattern,
  onClearSelection,
  onHint,
  onPlay,
  onPass,
  canPass,
  legalPatternCount,
  legalPatterns,
  onChangeAIDifficulty,
}: DouDizhuTableProps) {
  const isIpadLike = typeof document !== 'undefined' && document.documentElement.dataset.ipadLike === 'true';
  const infoSheetId = useId();
  const [infoOpen, setInfoOpen] = useState(false);
  const trusteeEnabled = trusteeMode !== 'off';
  const human = runtime.players.find((player) => player.isHuman) ?? runtime.players[0];
  const humanHandDensityClass = handDensityClass(human.hand.length);
  const opponents = runtime.players.filter((player) => !player.isHuman);
  const selectedIds = new Set(runtime.selectedCardIds);
  const highestBid = runtime.bidding.highestBid;
  const currentPlayer = runtime.players.find((player) => player.id === runtime.currentPlayerId) ?? runtime.players[0];
  const selectedCards = human.hand.filter((card) => selectedIds.has(card.id));
  const selectedPattern = selectedCards.length > 0 ? analyzePattern(selectedCards) : null;
  const leadController =
    runtime.lead.playerId ? runtime.players.find((player) => player.id === runtime.lead.playerId) ?? null : null;
  const activeBidder = runtime.bidding.turnOrder[runtime.bidding.currentIndex] ?? null;
  const activeBidPlayer = activeBidder ? runtime.players.find((player) => player.id === activeBidder) ?? null : null;
  const canBeatLead = runtime.lead.pattern ? Boolean(selectedPattern && runtime.lead.playerId !== human.id && canBeat(selectedPattern, runtime.lead.pattern)) : Boolean(selectedPattern);
  const humanBidTurn = runtime.phase === 'bidding' && runtime.currentPlayerId === human.id && !paused;
  const selectionStatus =
    selectedCards.length === 0
      ? language === 'zh-CN'
        ? '未选择手牌'
        : 'No cards selected'
      : selectedPattern
        ? runtime.lead.pattern && runtime.lead.playerId !== human.id
          ? canBeatLead
            ? language === 'zh-CN'
              ? `可压过当前牌型：${formatDdzPattern(selectedPattern, language)}`
              : `Can beat: ${formatDdzPattern(selectedPattern, language)}`
            : language === 'zh-CN'
              ? `已组成 ${formatDdzPattern(selectedPattern, language)}`
              : `Built: ${formatDdzPattern(selectedPattern, language)}`
          : language === 'zh-CN'
            ? `可打出：${formatDdzPattern(selectedPattern, language)}`
            : `Playable: ${formatDdzPattern(selectedPattern, language)}`
        : language === 'zh-CN'
          ? '当前选择不是合法牌型'
          : 'Current selection is not legal';
  const suggestedPatterns = useMemo(() => {
    const seen = new Set<string>();
    return legalPatterns
      .slice()
      .sort((left, right) => quickPlayPriority(right) - quickPlayPriority(left) || left.mainRank - right.mainRank)
      .filter((pattern) => {
        const key = patternIdentity(pattern);
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      })
      .slice(0, 6);
  }, [legalPatterns]);
  const recentHistory = history.slice(0, 6);
  const recentActionSummary =
    runtime.log.length > 0
      ? runtime.log
          .slice(0, 3)
          .map((entry) => translateDdzText(entry.text, language))
          .join(' · ')
      : language === 'zh-CN'
        ? '等待首轮叫分。'
        : 'Waiting for the opening bid.';
  const playTargetLabel = runtime.lead.pattern ? formatDdzPattern(runtime.lead.pattern, language) : language === 'zh-CN' ? '自由领出' : 'Free lead';
  const trusteeTitle =
    trusteeMode === 'turn'
      ? language === 'zh-CN'
        ? '托管正在接管本回合'
        : 'Auto-play is handling this turn'
      : language === 'zh-CN'
        ? '托管正在接管整局'
        : 'Auto-play is handling the round';
  const trusteeNote =
    trusteeMode === 'turn'
      ? language === 'zh-CN'
        ? '系统会自动完成你当前这次操作；动作结束后立即恢复手动控制。'
        : 'The system will complete only this turn and then return control to you.'
      : language === 'zh-CN'
        ? '系统会自动叫分、自动选牌并持续推进到本局结算；关闭托管后恢复手动操作。'
        : 'The system will bid, choose plays, and continue to settlement until auto-play is disabled.';

  const settlementDeltas = useMemo(
    () =>
      runtime.phase === 'settlement' && runtime.landlordId
        ? runtime.players.map((player) => {
            let delta = 0;
            if (runtime.winningTeam === 'landlord') {
              delta = player.id === runtime.landlordId ? runtime.baseBid * runtime.multiplier * 2 : -(runtime.baseBid * runtime.multiplier);
            } else if (runtime.winningTeam === 'farmer') {
              delta = player.id === runtime.landlordId ? -(runtime.baseBid * runtime.multiplier * 2) : runtime.baseBid * runtime.multiplier;
            }
            return {
              id: player.id,
              name: player.name,
              role: roleLabel(player.role, language),
              delta,
              score: player.score,
            };
          })
        : [],
    [language, runtime.baseBid, runtime.landlordId, runtime.multiplier, runtime.phase, runtime.players, runtime.winningTeam],
  );
  const humanSettlementDelta = settlementDeltas.find((entry) => entry.id === 'P0')?.delta ?? 0;
  const multiplierSummary = runtime.multiplierBreakdown.events
    .map((event) => `${event.label}${event.kind === 'bid' ? '' : ` ×${event.factor}`}`)
    .join(' · ');
  const multiplierFxClass = runtime.multiplierBreakdown.springApplied
    ? 'spring'
    : runtime.multiplierBreakdown.rocketCount > 0
      ? 'rocket'
      : runtime.multiplierBreakdown.bombCount > 0
        ? 'bomb'
        : 'bid';
  const specialMultiplierEvents = runtime.multiplierBreakdown.events.filter((event) => event.kind !== 'bid');
  const settlementHeadline =
    multiplierFxClass === 'spring'
      ? language === 'zh-CN'
        ? '春天触发'
        : language === 'ja'
          ? 'スプリング発動'
          : language === 'fr'
            ? 'Spring déclenché'
            : language === 'de'
              ? 'Spring ausgelöst'
              : 'Spring Triggered'
      : multiplierFxClass === 'rocket'
        ? language === 'zh-CN'
          ? '王炸引爆'
          : language === 'ja'
            ? 'ロケット炸裂'
            : language === 'fr'
              ? 'Rocket déclenchée'
              : language === 'de'
                ? 'Rocket gezündet'
                : 'Rocket Ignites'
        : multiplierFxClass === 'bomb'
          ? language === 'zh-CN'
            ? '炸弹加倍'
            : language === 'ja'
              ? '爆弾で倍化'
              : language === 'fr'
                ? 'Bombe doublée'
                : language === 'de'
                  ? 'Bombe verdoppelt'
                  : 'Bomb Doubles'
          : language === 'zh-CN'
            ? '平稳结算'
            : language === 'ja'
              ? '通常精算'
              : language === 'fr'
                ? 'Règlement standard'
                : language === 'de'
                  ? 'Normale Abrechnung'
                  : 'Standard Settlement';
  const settlementSubline =
    multiplierFxClass === 'spring'
      ? language === 'zh-CN'
        ? '一口气翻倍收官，整局收益被强制拉满。'
        : language === 'ja'
          ? '一気に倍化して決着。ラウンド収支が最大まで跳ね上がりました。'
          : language === 'fr'
            ? 'La manche se termine sur un doublement complet du gain.'
            : language === 'de'
              ? 'Die Runde endet mit einer vollen Verdopplung des Ergebnisses.'
              : 'The round closes with a full doubled finish.'
      : multiplierFxClass === 'rocket'
        ? language === 'zh-CN'
          ? '王炸强行改写倍率，结算直接进入高亮档。'
          : language === 'ja'
            ? 'ロケットで倍率が塗り替わり、決着が一段上の演出に入りました。'
            : language === 'fr'
              ? 'La rocket réécrit le multiplicateur et propulse le résultat au maximum.'
              : language === 'de'
                ? 'Die Rocket schreibt den Multiplikator neu und hebt das Ergebnis sofort an.'
                : 'The rocket rewrites the multiplier and pushes settlement into highlight mode.'
        : multiplierFxClass === 'bomb'
          ? language === 'zh-CN'
            ? '炸弹触发翻倍，结算面板进入爆裂态。'
            : language === 'ja'
              ? '爆弾で倍率が上がり、決着パネルも高熱状態に入りました。'
              : language === 'fr'
                ? 'La bombe déclenche un doublement et allume le panneau de résultat.'
                : language === 'de'
                  ? 'Die Bombe verdoppelt das Ergebnis und zündet die Abrechnung an.'
                  : 'The bomb doubles the stakes and lights up the settlement panel.'
          : language === 'zh-CN'
            ? '本局按叫分倍率直接结算。'
            : language === 'ja'
              ? 'この局は入札倍率のみで精算されました。'
              : language === 'fr'
                ? 'Cette manche est réglée uniquement sur l’enchère.'
                : language === 'de'
                  ? 'Diese Runde wurde nur über das Gebot abgerechnet.'
                  : 'This round settled directly from the bid.';
  const settlementPortraits = useMemo(
    () =>
      settlementDeltas.map((entry) => {
        const player = runtime.players.find((item) => item.id === entry.id);
        const winner = runtime.winnerId === entry.id;
        return {
          key: entry.id,
          eyebrow: winner
            ? language === 'zh-CN'
              ? '本局赢家'
              : language === 'ja'
                ? 'ラウンド勝者'
                : language === 'fr'
                  ? 'Gagnant'
                  : language === 'de'
                    ? 'Sieger'
                    : 'Round Winner'
            : entry.role,
          detail:
            language === 'zh-CN'
              ? `${entry.role} · ${entry.delta >= 0 ? '+' : ''}${entry.delta}`
              : language === 'ja'
                ? `${entry.role} · ${entry.delta >= 0 ? '+' : ''}${entry.delta}`
                : language === 'fr'
                  ? `${entry.role} · ${entry.delta >= 0 ? '+' : ''}${entry.delta}`
                  : language === 'de'
                    ? `${entry.role} · ${entry.delta >= 0 ? '+' : ''}${entry.delta}`
                    : `${entry.role} · ${entry.delta >= 0 ? '+' : ''}${entry.delta}`,
          note:
            language === 'zh-CN'
              ? `总分 ${entry.score >= 0 ? '+' : ''}${entry.score}`
              : language === 'ja'
                ? `合計 ${entry.score >= 0 ? '+' : ''}${entry.score}`
                : language === 'fr'
                  ? `Total ${entry.score >= 0 ? '+' : ''}${entry.score}`
                  : language === 'de'
                    ? `Gesamt ${entry.score >= 0 ? '+' : ''}${entry.score}`
                    : `Total ${entry.score >= 0 ? '+' : ''}${entry.score}`,
          value: `${entry.delta >= 0 ? '+' : ''}${entry.delta}`,
          mood: winner ? ('winner' as const) : runtime.currentPlayerId === entry.id ? ('focused' as const) : ('calm' as const),
          player: {
            id: entry.id,
            name: entry.name,
            style: player?.style ?? 'balanced',
            isHuman: player?.isHuman ?? false,
            portraitKey: player?.portraitKey,
          },
        };
      }),
    [language, runtime.currentPlayerId, runtime.players, runtime.winnerId, settlementDeltas],
  );
  const settlementMetaItems = useMemo(
    () => [
      {
        label: language === 'zh-CN' ? '局数' : language === 'ja' ? '局数' : language === 'fr' ? 'Manche' : language === 'de' ? 'Runde' : 'Round',
        value: `#${runtime.round}`,
      },
      {
        label: language === 'zh-CN' ? '叫分' : language === 'ja' ? '入札' : language === 'fr' ? 'Enchère' : language === 'de' ? 'Gebot' : 'Bid',
        value: `${runtime.baseBid}`,
      },
      {
        label: language === 'zh-CN' ? '倍率' : language === 'ja' ? '倍率' : language === 'fr' ? 'Multiplicateur' : language === 'de' ? 'Multiplikator' : 'Multiplier',
        value: `x${runtime.multiplier}`,
      },
      {
        label: language === 'zh-CN' ? '地主' : language === 'ja' ? '地主' : language === 'fr' ? 'Landlord' : language === 'de' ? 'Landlord' : 'Landlord',
        value: runtime.players.find((player) => player.id === runtime.landlordId)?.name ?? '-',
      },
      {
        label: language === 'zh-CN' ? '胜方' : language === 'ja' ? '勝者側' : language === 'fr' ? 'Camp gagnant' : language === 'de' ? 'Siegerseite' : 'Winning Side',
        value: runtime.winningTeam === 'landlord' ? (language === 'zh-CN' ? '地主' : 'Landlord') : language === 'zh-CN' ? '农民' : language === 'ja' ? '農民' : language === 'fr' ? 'Fermiers' : language === 'de' ? 'Farmer' : 'Farmers',
      },
      {
        label: language === 'zh-CN' ? '你本局' : language === 'ja' ? 'あなた' : language === 'fr' ? 'Vous' : language === 'de' ? 'Du' : 'You',
        value: `${humanSettlementDelta >= 0 ? '+' : ''}${humanSettlementDelta}`,
      },
    ],
    [humanSettlementDelta, language, runtime.baseBid, runtime.landlordId, runtime.multiplier, runtime.players, runtime.round, runtime.winningTeam],
  );
  const latestSpecialEvent = useMemo(() => [...runtime.multiplierBreakdown.events].reverse().find((event) => event.kind !== 'bid') ?? null, [runtime.multiplierBreakdown.events]);
  const burstKey = latestSpecialEvent ? `${latestSpecialEvent.kind}-${runtime.multiplierBreakdown.events.length}-${runtime.round}` : null;
  const selectedHistoryEntry = useMemo(
    () => (historyViewerRound !== null ? history.find((entry) => entry.round === historyViewerRound) : null) ?? history[0] ?? null,
    [history, historyViewerRound],
  );
  const historySessionDelta = useMemo(() => history.reduce((sum, entry) => sum + entry.heroDelta, 0), [history]);
  const showHumanHand = runtime.phase === 'bidding' || runtime.phase === 'playing';
  const handInteractionEnabled = runtime.phase === 'playing' && runtime.currentPlayerId === human.id && !paused && !trusteeEnabled;
  const sweepSelectionHandlers = useIpadCardSweepSelection({
    enabled: isIpadLike && handInteractionEnabled,
    selectedIds,
    onToggleCard,
  });

  useEffect(() => {
    if (!historyViewerOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseHistoryViewer();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [historyViewerOpen, onCloseHistoryViewer]);

  return (
    <main className="ddz-table-screen">
      <div className="ddz-table-backdrop" />
      {latestSpecialEvent && runtime.phase !== 'settlement' ? (
        <div key={burstKey ?? undefined} className={`ddz-fx-burst fx-style-${effectSkinKey} tone-${multiplierEventTone(latestSpecialEvent.kind)}`}>
          <strong>{latestSpecialEvent.label}</strong>
          <span>
            {latestSpecialEvent.kind === 'rocket'
              ? '火力翻倍，局势直接重排。'
              : latestSpecialEvent.kind === 'bomb'
                ? '炸弹落桌，倍率即时翻倍。'
                : '春天成立，收益再翻一档。'}
          </span>
        </div>
      ) : null}
      <section className="ddz-topbar glass-panel">
        <div className="ddz-topbar-copy">
          <strong>{language === 'zh-CN' ? '霓虹斗地主' : 'Neon Fight the Landlord'}</strong>
          <span>
            {language === 'zh-CN' ? '第' : 'Round'} {runtime.round} {language === 'zh-CN' ? '局' : ''} · {phaseLabel(runtime.phase, language)} · {language === 'zh-CN' ? '当前玩家' : 'Current player'} {currentPlayer.name}
          </span>
          {isIpadLike ? (
            <div className="ipad-mode-summary">
              <span>第 {runtime.round} 局</span>
              <span>{language === 'zh-CN' ? '轮到' : 'Turn'} {currentPlayer.name}</span>
              <span>{runtime.landlordId ? `${language === 'zh-CN' ? '地主' : 'Landlord'} ${runtime.players.find((player) => player.id === runtime.landlordId)?.name}` : language === 'zh-CN' ? '地主待定' : 'Landlord pending'}</span>
            </div>
          ) : null}
        </div>
        <div className="ddz-topbar-stats">
          <span>{language === 'zh-CN' ? '叫分' : 'Bid'} {runtime.baseBid}</span>
          <span>{language === 'zh-CN' ? '倍率' : 'Multiplier'} x{runtime.multiplier}</span>
          <span>{language === 'zh-CN' ? '地主' : 'Landlord'} {runtime.landlordId ? runtime.players.find((player) => player.id === runtime.landlordId)?.name : language === 'zh-CN' ? '待定' : 'Pending'}</span>
        </div>
        <div className="ddz-topbar-actions">
          {isIpadLike ? (
            <button
              className={`btn mini ${infoOpen ? 'primary' : ''}`}
              type="button"
              onClick={() => setInfoOpen((current) => !current)}
              aria-haspopup="dialog"
              aria-expanded={infoOpen}
              aria-controls={infoSheetId}
            >
              {language === 'zh-CN' ? '更多' : 'More'}
            </button>
          ) : null}
          <select
            value={runtime.config.aiDifficulty}
            aria-label={language === 'zh-CN' ? 'AI 难度' : 'AI difficulty'}
            onChange={(event) => onChangeAIDifficulty(event.target.value as AIDifficulty)}
          >
            <option value="conservative">{language === 'zh-CN' ? 'AI 保守' : 'AI Conservative'}</option>
            <option value="standard">{language === 'zh-CN' ? 'AI 标准' : 'AI Standard'}</option>
            <option value="aggressive">{language === 'zh-CN' ? 'AI 激进' : 'AI Aggressive'}</option>
          </select>
          <button className={`btn mini ${trusteeMode === 'turn' ? 'primary' : ''}`} type="button" onClick={() => onSetTrusteeMode(trusteeMode === 'turn' ? 'off' : 'turn')}>
            {isIpadLike ? (trusteeMode === 'turn' ? '关单托' : '单托') : trusteeMode === 'turn' ? '关闭单回合托管' : '托管一回合'}
          </button>
          <button className={`btn mini ${trusteeMode === 'round' ? 'primary' : ''}`} type="button" onClick={() => onSetTrusteeMode(trusteeMode === 'round' ? 'off' : 'round')}>
            {isIpadLike ? (trusteeMode === 'round' ? '关整托' : '整托') : trusteeMode === 'round' ? '关闭整局托管' : '托管到结算'}
          </button>
          <button className="btn mini" type="button" onClick={onPause}>
            {paused ? (language === 'zh-CN' ? '继续' : 'Resume') : language === 'zh-CN' ? '暂停' : 'Pause'}
          </button>
          <button className="btn mini" type="button" onClick={onRestart}>
            {isIpadLike ? (language === 'zh-CN' ? '重开' : 'Restart') : language === 'zh-CN' ? '重新开局' : 'Restart Session'}
          </button>
          <button className="btn mini" type="button" onClick={onBack}>
            {isIpadLike ? (language === 'zh-CN' ? '大厅' : 'Hub') : language === 'zh-CN' ? '返回大厅' : 'Back to Hub'}
          </button>
        </div>
        {isIpadLike && infoOpen ? (
          <IpadInfoSheet
            sheetId={infoSheetId}
            title={language === 'zh-CN' ? '本局信息' : 'Round info'}
            summary={`${language === 'zh-CN' ? '第' : 'Round'} ${runtime.round} ${language === 'zh-CN' ? '局' : ''} · ${language === 'zh-CN' ? '倍率' : 'Multiplier'} x${runtime.multiplier}`}
            onClose={() => setInfoOpen(false)}
          >
            <div className="ipad-info-grid">
              <div className="ipad-info-card">
                <span>{language === 'zh-CN' ? '当前阶段' : 'Phase'}</span>
                <strong>{phaseLabel(runtime.phase, language)}</strong>
              </div>
              <div className="ipad-info-card">
                <span>{language === 'zh-CN' ? '当前玩家' : 'Current player'}</span>
                <strong>{currentPlayer.name}</strong>
              </div>
              <div className="ipad-info-card">
                <span>{language === 'zh-CN' ? '地主' : 'Landlord'}</span>
                <strong>{runtime.landlordId ? runtime.players.find((player) => player.id === runtime.landlordId)?.name : language === 'zh-CN' ? '待定' : 'Pending'}</strong>
              </div>
              <div className="ipad-info-card">
                <span>{language === 'zh-CN' ? '当前叫分' : 'Current bid'}</span>
                <strong>{runtime.phase === 'bidding' ? `${highestBid} 分` : `${runtime.baseBid} 分`}</strong>
              </div>
              <div className="ipad-info-card">
                <span>{language === 'zh-CN' ? '当前倍率' : 'Multiplier'}</span>
                <strong>x{runtime.multiplier}</strong>
              </div>
              <div className="ipad-info-card">
                <span>{language === 'zh-CN' ? '牌权' : 'Lead'}</span>
                <strong>{leadController ? leadController.name : language === 'zh-CN' ? '等待领出' : 'Waiting for a lead'}</strong>
              </div>
              <div className="ipad-info-card">
                <span>{language === 'zh-CN' ? '当前可出解数' : 'Legal plays'}</span>
                <strong>{legalPatternCount}</strong>
              </div>
              <div className="ipad-info-card">
                <span>{language === 'zh-CN' ? '托管状态' : 'Auto-play'}</span>
                <strong>{trusteeMode === 'off' ? (language === 'zh-CN' ? '关闭' : 'Off') : trusteeMode === 'turn' ? (language === 'zh-CN' ? '单回合托管' : 'Turn auto-play') : language === 'zh-CN' ? '整局托管' : 'Round auto-play'}</strong>
              </div>
              {activeBidPlayer ? (
                <div className="ipad-info-card">
                <span>{language === 'zh-CN' ? '正在叫分' : 'Bidding now'}</span>
                  <strong>{activeBidPlayer.name}</strong>
                </div>
              ) : null}
              <div className="ipad-info-card">
                <span>{language === 'zh-CN' ? '已完成局数' : 'Rounds played'}</span>
                <strong>{stats.rounds}</strong>
              </div>
              <div className="ipad-info-card">
                <span>{language === 'zh-CN' ? '你已赢局数' : 'Rounds won'}</span>
                <strong>{stats.humanWins}</strong>
              </div>
              <div className="ipad-info-card">
                <span>{language === 'zh-CN' ? '最佳单局波动' : 'Best swing'}</span>
                <strong>{stats.bestSwing}</strong>
              </div>
              <div className="ipad-info-card wide">
                <span>{language === 'zh-CN' ? '最近行动' : 'Recent actions'}</span>
                <strong>{recentActionSummary}</strong>
              </div>
              <div className="ipad-info-card wide">
                <span>{language === 'zh-CN' ? '倍率来源' : 'Multiplier source'}</span>
                <strong>{language === 'zh-CN' ? multiplierSummary || '当前仅按叫分结算。' : translateDdzText(multiplierSummary || 'Bid only', language)}</strong>
              </div>
            </div>
            <div className="ipad-info-actions">
              <button className="btn mini" type="button" onClick={() => onOpenHistoryViewer()} disabled={history.length === 0}>
                {language === 'zh-CN' ? '查看局史' : 'Open history'}
              </button>
            </div>
          </IpadInfoSheet>
        ) : null}
      </section>

      {!isIpadLike ? (
        <section className="ddz-banner glass-panel">
          <strong>{translateDdzText(runtime.banner, language)}</strong>
          <span>
            {language === 'zh-CN' ? '历史战绩' : 'Session'}：{stats.rounds} {language === 'zh-CN' ? '局' : 'rounds'} · {language === 'zh-CN' ? '你赢了' : 'You won'} {stats.humanWins} {language === 'zh-CN' ? '局' : 'rounds'} · {language === 'zh-CN' ? '最佳单局波动' : 'Best swing'} {stats.bestSwing}
            {trusteeMode === 'turn' ? (language === 'zh-CN' ? ' · 单回合托管中' : ' · Turn auto-play active') : trusteeMode === 'round' ? (language === 'zh-CN' ? ' · 整局托管中' : ' · Round auto-play active') : ''}
          </span>
        </section>
      ) : null}

      <section className="ddz-table-layout">
        <div className="ddz-opponents-row">
          {opponents.map((player) => {
            const active = runtime.currentPlayerId === player.id && runtime.phase !== 'settlement';
            const isDisplayOwner = runtime.tableDisplay.playerId === player.id;
            return (
              <article key={player.id} className={`ddz-seat-card ddz-seat-${playerRoleClass(player)} ${active ? 'active' : ''}`}>
                <div className="ddz-seat-main">
                  <div className="ddz-seat-head">
                    <PlayerPortrait player={player} active={active} mood={actionMood(player, active)} size="focus" variant="panel" />
                    <div>
                      <strong>{player.name}</strong>
                      <span>{roleLabel(player.role, language)}</span>
                    </div>
                  </div>
                  <div className="ddz-seat-meta">
                    <span>{language === 'zh-CN' ? '手牌' : 'Hand'} {player.hand.length}</span>
                    <span>{language === 'zh-CN' ? '分数' : 'Score'} {player.score >= 0 ? `+${player.score}` : player.score}</span>
                  </div>
                  <div className="ddz-seat-action">{translateDdzText(player.lastAction, language)}</div>
                </div>
                <div className={`ddz-seat-played ${isDisplayOwner && runtime.tableDisplay.cards.length > 0 ? 'revealed' : 'hidden-stack'}`}>
                  {isDisplayOwner && runtime.tableDisplay.cards.length > 0 ? (
                    runtime.tableDisplay.cards.map((card) => (
                      <DouDizhuCard key={`${player.id}-${card.id}`} card={card} compact showSuitLabel cardSkinKey={cardSkinKey} />
                    ))
                  ) : (
                    <div className="ddz-card-count-stack">
                      {Array.from({ length: Math.min(3, player.hand.length) }).map((_, index) => (
                        <DouDizhuCard key={`back-${player.id}-${index}`} card={player.hand[0] ?? runtime.bottomCards[0]} compact hidden cardSkinKey={cardSkinKey} />
                      ))}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <div className="ddz-center-zone glass-panel">
          <div className="ddz-status-strip">
            <div>
              <span>{language === 'zh-CN' ? '牌权' : 'Lead'}</span>
              <strong>{leadController ? (language === 'zh-CN' ? `${leadController.name} 持牌权` : `${leadController.name} leads`) : language === 'zh-CN' ? '等待领出' : 'Waiting for a lead'}</strong>
            </div>
            <div>
              <span>{language === 'zh-CN' ? '轮到谁' : 'Turn'}</span>
              <strong>{currentPlayer.name}</strong>
            </div>
            <div>
              <span>{language === 'zh-CN' ? '可出解数' : 'Legal plays'}</span>
              <strong>{legalPatternCount}</strong>
            </div>
            <div>
              <span>{language === 'zh-CN' ? '当前叫分' : 'Current bid'}</span>
              <strong>{runtime.phase === 'bidding' ? `${highestBid} 分` : `${runtime.baseBid} 分`}</strong>
            </div>
          </div>
          <div className="ddz-bottom-cards">
            <span>{language === 'zh-CN' ? '底牌' : 'Bottom cards'}</span>
            <div>
              {runtime.landlordId
                ? runtime.bottomCards.map((card) => <DouDizhuCard key={card.id} card={card} compact cardSkinKey={cardSkinKey} />)
                : runtime.bottomCards.map((card) => <DouDizhuCard key={card.id} card={card} compact hidden cardSkinKey={cardSkinKey} />)}
            </div>
          </div>
          {runtime.phase === 'bidding' && (
            <div className="ddz-bid-track">
              {runtime.players.map((player) => {
                const bid = runtime.bidding.bids[player.id];
                const isActive = activeBidPlayer?.id === player.id;
                return (
                  <div key={`bid-${player.id}`} className={`ddz-bid-track-item ${isActive ? 'active' : ''}`}>
                    <span>{player.name}</span>
                    <strong>{bid === null ? (language === 'zh-CN' ? '待叫' : 'Pending') : bid === 0 ? (language === 'zh-CN' ? '不叫' : 'Pass') : `${bid} ${language === 'zh-CN' ? '分' : ''}`}</strong>
                  </div>
                );
              })}
            </div>
          )}
          <div className="ddz-current-play">
            <div className="ddz-current-play-head">
              <strong>{runtime.tableDisplay.playerId ? `${runtime.players.find((player) => player.id === runtime.tableDisplay.playerId)?.name}${language === 'zh-CN' ? ' 的牌' : "'s play"}` : language === 'zh-CN' ? '等待领出' : 'Waiting for a lead'}</strong>
              <span>{formatDdzPattern(runtime.tableDisplay.pattern, language)}</span>
            </div>
            <div className="ddz-current-play-cards">
              {runtime.tableDisplay.cards.length > 0 ? runtime.tableDisplay.cards.map((card) => <DouDizhuCard key={`center-${card.id}`} card={card} showSuitLabel cardSkinKey={cardSkinKey} />) : <em>{language === 'zh-CN' ? '新一轮牌权等待开启' : 'Waiting for the next lead'}</em>}
            </div>
          </div>
          {!isIpadLike ? (
            <div className="ddz-session-panel">
              <div>
                <span>{language === 'zh-CN' ? '地主胜局' : 'Landlord wins'}</span>
                <strong>{stats.landlordWins}</strong>
              </div>
              <div>
                <span>{language === 'zh-CN' ? '农民胜局' : 'Farmer wins'}</span>
                <strong>{stats.farmerWins}</strong>
              </div>
              <div>
                <span>{language === 'zh-CN' ? '春天' : 'Spring'}</span>
                <strong>{runtime.springTriggered ? (language === 'zh-CN' ? '已触发' : 'Triggered') : language === 'zh-CN' ? '未触发' : 'Not triggered'}</strong>
              </div>
            </div>
          ) : null}
          <div className={`ddz-multiplier-panel ddz-multiplier-panel-${multiplierFxClass}`}>
            <div className="ddz-multiplier-head">
              <strong>{language === 'zh-CN' ? '倍率来源' : 'Multiplier source'}</strong>
              <span>
                {language === 'zh-CN' ? '当前' : 'Now'} x{runtime.multiplierBreakdown.finalMultiplier}
                {runtime.phase === 'settlement' ? (language === 'zh-CN' ? ' · 已结算' : ' · Settled') : ''}
              </span>
            </div>
            <div className="ddz-multiplier-chip-row">
              {runtime.multiplierBreakdown.events.length > 0 ? (
                runtime.multiplierBreakdown.events.map((event, index) => (
                  <span key={`multiplier-event-${event.kind}-${index}`} className={`ddz-multiplier-chip kind-${multiplierEventTone(event.kind)}`}>
                    <b>{translateDdzText(event.label, language)}</b>
                    <em>{event.kind === 'bid' ? `${language === 'zh-CN' ? '底分' : 'Base'} ${event.factor}` : `×${event.factor}`}</em>
                  </span>
                ))
              ) : (
                <span className="ddz-multiplier-chip kind-bid">
                  <b>{language === 'zh-CN' ? '尚未定地主' : 'Landlord pending'}</b>
                  <em>{language === 'zh-CN' ? '等待叫分' : 'Waiting for bids'}</em>
                </span>
              )}
            </div>
            <div className="ddz-multiplier-formula">
              <span>{language === 'zh-CN' ? multiplierSummary || '等待叫分形成倍率链' : translateDdzText(multiplierSummary || 'Waiting for the multiplier chain', language)}</span>
              <strong>x{runtime.multiplierBreakdown.finalMultiplier}</strong>
            </div>
          </div>
        </div>

        {!isIpadLike ? (
          <aside className="ddz-log-panel glass-panel">
            <div className="ddz-log-head">
              <strong>{language === 'zh-CN' ? '行动时间线' : 'Action timeline'}</strong>
              <span>{language === 'zh-CN' ? '最近' : 'Latest'} {runtime.log.length} {language === 'zh-CN' ? '条' : 'items'}</span>
            </div>
            <ul>
              {runtime.log.map((entry) => (
                <li key={entry.id} className={`tone-${entry.tone ?? 'neutral'}`}>
                  {translateDdzText(entry.text, language)}
                </li>
              ))}
            </ul>
            <div className="ddz-history-head">
              <strong>{language === 'zh-CN' ? '最近战报' : 'Recent results'}</strong>
              <div className="ddz-history-actions">
                <span>{language === 'zh-CN' ? '本地保留' : 'Stored locally'} {recentHistory.length} {language === 'zh-CN' ? '局' : 'rounds'}</span>
                <button className="btn mini" type="button" onClick={() => onOpenHistoryViewer()} disabled={history.length === 0}>
                  {language === 'zh-CN' ? '查看完整局史' : 'Open full history'}
                </button>
              </div>
            </div>
            <div className="ddz-history-list">
              {recentHistory.length > 0 ? (
                recentHistory.map((entry) => {
                  const roundSpecials = entry.multiplierBreakdown.events.filter((event) => event.kind !== 'bid');
                  return (
                    <button
                      key={`history-round-${entry.round}-${entry.timestamp}`}
                      className={`ddz-history-card ddz-history-card-button tone-${entry.winningTeam === 'landlord' ? 'landlord' : 'farmer'}`}
                      type="button"
                      onClick={() => onOpenHistoryViewer(entry.round)}
                    >
                      <div className="ddz-history-card-head">
                        <strong>{language === 'zh-CN' ? '第' : 'Round'} {entry.round} {language === 'zh-CN' ? '局' : ''}</strong>
                        <span>{roundWinnerLabel(entry, language)} · x{entry.multiplier}</span>
                      </div>
                      <div className="ddz-history-card-main">
                        <span>{settlementLeadLabel(entry, language)}</span>
                        <strong>{heroDeltaLabel(entry, language)}</strong>
                      </div>
                      <div className="ddz-history-card-tags">
                        <span className="ddz-history-tag kind-bid">{language === 'zh-CN' ? '叫分' : 'Bid'} {entry.baseBid}</span>
                        {roundSpecials.length > 0
                          ? roundSpecials.map((event, index) => (
                              <span key={`history-special-${entry.round}-${event.kind}-${index}`} className={`ddz-history-tag kind-${multiplierEventTone(event.kind)}`}>
                                {translateDdzText(event.label, language)}
                              </span>
                            ))
                          : null}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="ddz-history-empty">{language === 'zh-CN' ? '还没有完成对局，打完一局后这里会保留倍率与胜负摘要。' : 'No completed rounds yet. Once you finish a round, the multiplier and result summary will appear here.'}</div>
              )}
            </div>
          </aside>
        ) : null}
      </section>

      <section className={`ddz-human-area glass-panel phase-${runtime.phase} ${runtime.phase === 'settlement' ? 'settlement' : ''}`}>
        <div className="ddz-human-header">
          <div className="ddz-human-seat-head">
            <PlayerPortrait player={human} active={runtime.currentPlayerId === human.id && runtime.phase !== 'settlement'} mood={actionMood(human, runtime.currentPlayerId === human.id)} size="hero" variant="panel" />
            <div>
              <strong>{human.name}</strong>
              <span>
                {roleLabel(human.role, language)} · {language === 'zh-CN' ? '分数' : 'Score'} {human.score >= 0 ? `+${human.score}` : human.score}
              </span>
              {trusteeEnabled ? <em className="ddz-trustee-badge">{trusteeMode === 'turn' ? (language === 'zh-CN' ? '单回合托管' : 'Turn auto-play') : language === 'zh-CN' ? '整局托管' : 'Round auto-play'}</em> : null}
            </div>
          </div>
          <div className="ddz-human-last-action">{translateDdzText(human.lastAction, language)}</div>
        </div>

        {(runtime.phase === 'bidding' || runtime.phase === 'playing') && (
          <div className={`ddz-human-action-shell phase-${runtime.phase}`}>
        {runtime.phase === 'bidding' && (
          <>
          <div className="ddz-bid-actions">
            <button className={`btn ${trusteeMode === 'turn' ? 'primary' : ''}`} type="button" onClick={() => onSetTrusteeMode(trusteeMode === 'turn' ? 'off' : 'turn')}>
              {trusteeMode === 'turn' ? '关闭单回合托管' : '托管一回合'}
            </button>
            <button className={`btn ${trusteeMode === 'round' ? 'primary' : ''}`} type="button" onClick={() => onSetTrusteeMode(trusteeMode === 'round' ? 'off' : 'round')}>
              {trusteeMode === 'round' ? '关闭整局托管' : '托管整局'}
            </button>
            <button className="btn" type="button" onClick={() => onBid(0)} disabled={!humanBidTurn || trusteeEnabled}>
              {language === 'zh-CN' ? '不叫' : 'Pass'}
            </button>
            {[1, 2, 3].map((value) => (
              <button key={`bid-${value}`} className="btn primary" data-bid={value} type="button" disabled={!humanBidTurn || trusteeEnabled || value <= highestBid} onClick={() => onBid(value)}>
                {language === 'zh-CN' ? `叫 ${value} 分` : `Bid ${value}`}
              </button>
            ))}
          </div>

          <div className="ddz-human-selection-strip ddz-human-bid-strip">
            <div>
              <span>{language === 'zh-CN' ? '叫分提示' : 'Bidding tip'}</span>
              <strong>{language === 'zh-CN' ? '叫分前可先看完整手牌' : 'You can inspect the full hand before bidding.'}</strong>
            </div>
            <div>
              <span>{language === 'zh-CN' ? '当前最高' : 'Highest bid'}</span>
              <strong>{highestBid > 0 ? `${highestBid} ${language === 'zh-CN' ? '分' : ''}` : language === 'zh-CN' ? '暂未叫分' : 'No bid yet'}</strong>
            </div>
            <div>
              <span>{language === 'zh-CN' ? '你的手牌' : 'Your hand'}</span>
              <strong>{human.hand.length} {language === 'zh-CN' ? '张' : 'cards'}</strong>
            </div>
          </div>
          </>
        )}

        {runtime.phase === 'playing' && (
          <>
            <div className="ddz-play-toolbar">
              <div className="ddz-play-summary">
                <div className="ddz-play-summary-card">
                  <span>{language === 'zh-CN' ? '选牌' : 'Selection'}</span>
                  <strong>{selectionStatus}</strong>
                </div>
                <div className="ddz-play-summary-card">
                  <span>{language === 'zh-CN' ? '目标' : 'Target'}</span>
                  <strong>
                    {playTargetLabel} · {selectedCards.length}
                    {language === 'zh-CN' ? '张' : ''}
                  </strong>
                </div>
              </div>

              {suggestedPatterns.length > 0 ? (
                <div className="ddz-suggestion-list compact">
                  {suggestedPatterns.map((pattern, index) => (
                    <button
                      key={`suggestion-${pattern.type}-${pattern.mainRank}-${pattern.cardCount}-${index}`}
                      className={`ddz-suggestion-pill ${
                        selectedPattern &&
                        selectedPattern.type === pattern.type &&
                        selectedPattern.mainRank === pattern.mainRank &&
                        selectedPattern.cardCount === pattern.cardCount
                          ? 'active'
                          : ''
                      }`}
                      type="button"
                      onClick={() => onSelectPattern(pattern.cards.map((card) => card.id))}
                      disabled={paused || trusteeEnabled || runtime.currentPlayerId !== human.id}
                    >
                      {formatDdzPattern(pattern, language)}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="ddz-human-controls compact">
                <button className="btn" type="button" onClick={onHint} disabled={paused || trusteeEnabled || runtime.currentPlayerId !== human.id}>
                  {language === 'zh-CN' ? '提示' : 'Hint'}
                </button>
                <button className={`btn ${trusteeMode === 'turn' ? 'primary' : ''}`} type="button" onClick={() => onSetTrusteeMode(trusteeMode === 'turn' ? 'off' : 'turn')}>
                  {language === 'zh-CN' ? (trusteeMode === 'turn' ? '关单托' : '单托') : trusteeMode === 'turn' ? 'Turn On' : 'Turn Auto'}
                </button>
                <button className={`btn ${trusteeMode === 'round' ? 'primary' : ''}`} type="button" onClick={() => onSetTrusteeMode(trusteeMode === 'round' ? 'off' : 'round')}>
                  {language === 'zh-CN' ? (trusteeMode === 'round' ? '关整托' : '整托') : trusteeMode === 'round' ? 'Round On' : 'Round Auto'}
                </button>
                <button className="btn" type="button" onClick={onClearSelection} disabled={paused || trusteeEnabled || runtime.selectedCardIds.length === 0}>
                  {language === 'zh-CN' ? '重选' : 'Clear'}
                </button>
                <button className="btn" type="button" onClick={onPass} disabled={paused || trusteeEnabled || runtime.currentPlayerId !== human.id || !canPass}>
                  {language === 'zh-CN' ? '不出' : 'Pass'}
                </button>
                <button className="btn primary" type="button" onClick={onPlay} disabled={paused || trusteeEnabled || runtime.currentPlayerId !== human.id}>
                  {language === 'zh-CN' ? '出牌' : 'Play'}
                </button>
              </div>
            </div>

            <div className={`ddz-trustee-strip ${trusteeEnabled ? '' : 'placeholder'}`} aria-hidden={!trusteeEnabled}>
              <strong>{trusteeEnabled ? trusteeTitle : ' '}</strong>
              <span>{trusteeEnabled ? trusteeNote : ' '}</span>
            </div>
          </>
        )}
          </div>
        )}

        {showHumanHand && (
          <div
            className={`ddz-hand-row ${humanHandDensityClass} ${runtime.phase === 'bidding' ? 'bidding-view' : ''} ${
              isIpadLike && handInteractionEnabled ? 'sweep-enabled' : ''
            }`}
            {...(isIpadLike && handInteractionEnabled ? sweepSelectionHandlers : {})}
          >
            {human.hand.map((card) => (
              <DouDizhuCard
                key={card.id}
                card={card}
                cardId={card.id}
                cardSkinKey={cardSkinKey}
                selected={runtime.phase === 'playing' && selectedIds.has(card.id)}
                onClick={!isIpadLike && handInteractionEnabled ? () => onToggleCard(card.id) : undefined}
              />
            ))}
          </div>
        )}

      </section>

      {runtime.phase === 'settlement' && (
        <div className="ddz-settlement-overlay" role="presentation">
          <div className="ddz-settlement-backdrop" />
          <div className="ddz-settlement-shell">
            <div className={`ddz-settlement-panel fx-${multiplierFxClass}`}>
              <div className="ddz-settlement-headline">
                <div>
                  <strong>{runtime.players.find((player) => player.id === runtime.winnerId)?.name} {language === 'zh-CN' ? '胜出' : language === 'ja' ? '勝利' : language === 'fr' ? 'gagne' : language === 'de' ? 'gewinnt' : 'wins'}</strong>
                  <span>
                    {runtime.winningTeam === 'landlord'
                      ? language === 'zh-CN'
                        ? '地主获胜'
                        : language === 'ja'
                          ? '地主勝利'
                          : language === 'fr'
                            ? 'Victoire du landlord'
                            : language === 'de'
                              ? 'Landlord gewinnt'
                              : 'Landlord wins'
                      : language === 'zh-CN'
                        ? '农民获胜'
                        : language === 'ja'
                          ? '農民勝利'
                          : language === 'fr'
                            ? 'Victoire des fermiers'
                            : language === 'de'
                              ? 'Farmer gewinnen'
                              : 'Farmers win'} · {language === 'zh-CN' ? '倍率' : language === 'ja' ? '倍率' : language === 'fr' ? 'Multiplicateur' : language === 'de' ? 'Multiplikator' : 'Multiplier'} x{runtime.multiplier}
                  </span>
                </div>
                <button className="btn primary" type="button" onClick={onNextRound}>
                  {language === 'zh-CN' ? '确认继续' : language === 'ja' ? '確認して続行' : language === 'fr' ? 'Confirmer et continuer' : language === 'de' ? 'Bestätigen und weiter' : 'Confirm & Continue'}
                </button>
              </div>
              <div className="ddz-settlement-result-bar">
                <span>{runtime.winnerId === 'P0' ? (language === 'zh-CN' ? '你收下本局' : language === 'ja' ? 'あなたがこの局を獲得' : language === 'fr' ? 'Vous prenez cette manche' : language === 'de' ? 'Du holst diese Runde' : 'You take the round') : runtime.winningTeam === 'landlord' ? (language === 'zh-CN' ? '地主方拿下本局' : language === 'ja' ? '地主側が勝利' : language === 'fr' ? 'Le camp landlord prend la manche' : language === 'de' ? 'Die Landlord-Seite gewinnt' : 'Landlord side takes the round') : language === 'zh-CN' ? '农民方拿下本局' : language === 'ja' ? '農民側が勝利' : language === 'fr' ? 'Le camp fermier prend la manche' : language === 'de' ? 'Die Farmer-Seite gewinnt' : 'Farmer side takes the round'}</span>
                <strong>{humanSettlementDelta >= 0 ? `${language === 'zh-CN' ? '你' : language === 'fr' ? 'Vous' : language === 'de' ? 'Du' : 'You'} +${humanSettlementDelta}` : `${language === 'zh-CN' ? '你' : language === 'fr' ? 'Vous' : language === 'de' ? 'Du' : 'You'} ${humanSettlementDelta}`}</strong>
              </div>
              <div className={`ddz-settlement-spotlight tone-${multiplierFxClass}`}>
                <div className="ddz-settlement-spotlight-copy">
                  <strong>{settlementHeadline}</strong>
                  <span>{settlementSubline}</span>
                </div>
                {specialMultiplierEvents.length > 0 ? (
                  <div className="ddz-settlement-specials">
                    {specialMultiplierEvents.map((event, index) => (
                      <span key={`special-event-${event.kind}-${index}`} className={`ddz-settlement-special kind-${multiplierEventTone(event.kind)}`}>
                        {translateDdzText(event.label, language)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="ddz-settlement-special kind-bid">{language === 'zh-CN' ? '按叫分直接结算' : language === 'ja' ? '入札倍率で精算' : language === 'fr' ? 'Réglé sur la seule enchère' : language === 'de' ? 'Nur nach Gebot abgerechnet' : 'Settled from the bid only'}</span>
                )}
              </div>
              <div className="ddz-settlement-portrait-strip">
                {settlementPortraits.map((entry) => (
                  <PortraitSpotlightCard
                    key={`ddz-settlement-portrait-${entry.key}`}
                    player={entry.player}
                    mood={entry.mood}
                    eyebrow={entry.eyebrow}
                    detail={entry.detail}
                    note={entry.note}
                    value={entry.value}
                    compact={settlementPortraits.length > 2}
                    featured
                  />
                ))}
              </div>
              <div className="ddz-settlement-meta-grid">
                {settlementMetaItems.map((entry) => (
                  <div key={`ddz-settlement-meta-${entry.label}`}>
                    <span>{entry.label}</span>
                    <strong>{entry.value}</strong>
                  </div>
                ))}
              </div>
              <div className="ddz-settlement-breakdown">
                <div className="ddz-settlement-breakdown-head">
                  <strong>{language === 'zh-CN' ? '倍率明细' : language === 'ja' ? '倍率内訳' : language === 'fr' ? 'Détail des multiplicateurs' : language === 'de' ? 'Multiplikator-Details' : 'Multiplier breakdown'}</strong>
                  <span>{language === 'zh-CN' ? multiplierSummary : translateDdzText(multiplierSummary, language)}</span>
                </div>
                <div className="ddz-multiplier-chip-row settlement">
                  {runtime.multiplierBreakdown.events.map((event, index) => (
                    <span key={`settlement-event-${event.kind}-${index}`} className={`ddz-multiplier-chip large kind-${multiplierEventTone(event.kind)}`}>
                      <b>{translateDdzText(event.label, language)}</b>
                      <em>{event.kind === 'bid' ? `${language === 'zh-CN' ? '底分' : language === 'ja' ? '基本点' : language === 'fr' ? 'Base' : language === 'de' ? 'Basis' : 'Base'} ${event.factor}` : `×${event.factor}`}</em>
                    </span>
                  ))}
                  <span className="ddz-settlement-total-multiplier">{language === 'zh-CN' ? '最终' : language === 'ja' ? '最終' : language === 'fr' ? 'Final' : language === 'de' ? 'Final' : 'Final'} x{runtime.multiplierBreakdown.finalMultiplier}</span>
                </div>
              </div>
              <div className="ddz-settlement-grid">
                {settlementDeltas.map((entry) => (
                  <div key={`settle-${entry.id}`}>
                    <span>
                      {entry.name} · {entry.role}
                    </span>
                    <strong>{entry.delta >= 0 ? `+${entry.delta}` : entry.delta}</strong>
                    <em>{language === 'zh-CN' ? '总分' : language === 'ja' ? '合計' : language === 'fr' ? 'Total' : language === 'de' ? 'Gesamt' : 'Total'} {entry.score >= 0 ? `+${entry.score}` : entry.score}</em>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {historyViewerOpen ? (
        <div className="ddz-history-overlay" role="presentation" onClick={onCloseHistoryViewer}>
          <section className="ddz-history-sheet glass-panel" role="dialog" aria-modal="true" aria-label={language === 'zh-CN' ? '斗地主完整局史' : 'Full Dou Dizhu history'} onClick={(event) => event.stopPropagation()}>
            <header className="ddz-history-sheet-head">
              <div>
                <strong>{language === 'zh-CN' ? '完整局史' : 'Full history'}</strong>
                <span>
                  {language === 'zh-CN' ? '共' : 'Total'} {history.length} {language === 'zh-CN' ? '局' : 'rounds'} · {language === 'zh-CN' ? '你赢' : 'You won'} {stats.humanWins} {language === 'zh-CN' ? '局' : 'rounds'} · {language === 'zh-CN' ? '总盈亏' : 'Net result'} {historySessionDelta >= 0 ? `+${historySessionDelta}` : historySessionDelta}
                </span>
              </div>
              <div className="ddz-history-sheet-actions">
                <span>{language === 'zh-CN' ? '按 `Esc` 可关闭' : 'Press Esc to close'}</span>
                <button className="btn mini" type="button" onClick={onCloseHistoryViewer}>
                  {language === 'zh-CN' ? '关闭' : 'Close'}
                </button>
              </div>
            </header>

            <div className="ddz-history-sheet-body">
              <aside className="ddz-history-drawer">
                <div className="ddz-history-session-summary">
                  <article>
                    <span>总局数</span>
                    <strong>{stats.rounds}</strong>
                  </article>
                  <article>
                    <span>你胜局</span>
                    <strong>{stats.humanWins}</strong>
                  </article>
                  <article>
                    <span>最佳单局波动</span>
                    <strong>{stats.bestSwing}</strong>
                  </article>
                  <article>
                    <span>当前总盈亏</span>
                    <strong>{historySessionDelta >= 0 ? `+${historySessionDelta}` : historySessionDelta}</strong>
                  </article>
                </div>

                <div className="ddz-history-drawer-list">
                  {history.map((entry) => {
                    const roundSpecials = entry.multiplierBreakdown.events.filter((event) => event.kind !== 'bid');
                    return (
                      <button
                        key={`history-drawer-${entry.round}-${entry.timestamp}`}
                        className={`ddz-history-card ddz-history-card-button ${selectedHistoryEntry?.round === entry.round ? 'selected' : ''} tone-${entry.winningTeam === 'landlord' ? 'landlord' : 'farmer'}`}
                        type="button"
                        onClick={() => onSelectHistoryViewerRound(entry.round)}
                      >
                        <div className="ddz-history-card-head">
                          <strong>{language === 'zh-CN' ? '第' : 'Round'} {entry.round} {language === 'zh-CN' ? '局' : ''}</strong>
                          <span>{formatRoundTimestamp(entry.timestamp, language)}</span>
                        </div>
                        <div className="ddz-history-card-main">
                          <span>
                            {roundWinnerLabel(entry, language)} · {language === 'zh-CN' ? '地主' : 'Landlord'} {entry.landlordName}
                          </span>
                          <strong>{heroDeltaLabel(entry, language)}</strong>
                        </div>
                        <div className="ddz-history-card-tags">
                          <span className="ddz-history-tag kind-bid">x{entry.multiplier}</span>
                          {roundSpecials.slice(0, 3).map((event, index) => (
                            <span key={`history-drawer-tag-${entry.round}-${event.kind}-${index}`} className={`ddz-history-tag kind-${multiplierEventTone(event.kind)}`}>
                              {translateDdzText(event.label, language)}
                            </span>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </aside>

              <div className="ddz-history-detail">
                {selectedHistoryEntry ? (
                  <>
                    <div className="ddz-history-detail-head">
                      <div>
                        <strong>{language === 'zh-CN' ? '第' : 'Round'} {selectedHistoryEntry.round} {language === 'zh-CN' ? '局' : ''}</strong>
                        <span>
                          {roundWinnerLabel(selectedHistoryEntry, language)} · {formatRoundTimestamp(selectedHistoryEntry.timestamp, language)}
                        </span>
                      </div>
                      <div className={`ddz-history-detail-result tone-${selectedHistoryEntry.winningTeam === 'landlord' ? 'landlord' : 'farmer'}`}>
                        <span>{settlementLeadLabel(selectedHistoryEntry, language)}</span>
                        <strong>{heroDeltaLabel(selectedHistoryEntry, language)}</strong>
                      </div>
                    </div>

                    <div className="ddz-history-detail-grid">
                      <article>
                        <span>地主</span>
                        <strong>{selectedHistoryEntry.landlordName}</strong>
                      </article>
                      <article>
                        <span>赢家</span>
                        <strong>{selectedHistoryEntry.winnerName}</strong>
                      </article>
                      <article>
                        <span>叫分</span>
                        <strong>{selectedHistoryEntry.baseBid} 分</strong>
                      </article>
                      <article>
                        <span>最终倍率</span>
                        <strong>x{selectedHistoryEntry.multiplier}</strong>
                      </article>
                      <article>
                        <span>{language === 'zh-CN' ? '发牌种子' : 'Deal seed'}</span>
                        <strong>#{selectedHistoryEntry.dealSeed}</strong>
                      </article>
                    </div>

                    <section className="ddz-history-detail-section">
                      <div className="ddz-history-detail-section-head">
                        <strong>{language === 'zh-CN' ? '倍率记录' : 'Multiplier Log'}</strong>
                      </div>
                      <div className="ddz-history-timeline">
                        {selectedHistoryEntry.multiplierBreakdown.events.map((event, index) => (
                          <article key={`history-event-${selectedHistoryEntry.round}-${event.kind}-${index}`} className={`ddz-history-timeline-item tone-${multiplierEventTone(event.kind)}`}>
                            <span>{index + 1}</span>
                            <div>
                              <strong>{event.label}</strong>
                              <em>{event.kind === 'bid' ? `底分 ${event.factor}` : `倍率 ×${event.factor}`}</em>
                            </div>
                            <b>x{event.totalMultiplier}</b>
                          </article>
                        ))}
                      </div>
                    </section>

                    <section className="ddz-history-detail-section">
                      <div className="ddz-history-detail-section-head">
                        <strong>{language === 'zh-CN' ? '结算' : 'Settlement'}</strong>
                      </div>
                      <div className="ddz-history-player-grid">
                        {selectedHistoryEntry.players.map((player) => (
                          <article
                            key={`history-player-${selectedHistoryEntry.round}-${player.id}`}
                            className={`ddz-history-player-card ${player.winner ? 'winner' : ''} ${player.role === 'landlord' ? 'landlord' : 'farmer'}`}
                          >
                            <div className="ddz-history-player-card-head">
                              <strong>
                                {player.name}
                                {player.isHuman ? '（你）' : ''}
                              </strong>
                              <span>{roleLabel(player.role, language)}</span>
                            </div>
                            <div className="ddz-history-player-card-values">
                              <strong>{player.delta >= 0 ? `+${player.delta}` : player.delta}</strong>
                              <span>总分 {player.score >= 0 ? `+${player.score}` : player.score}</span>
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>
                  </>
                ) : (
                  <div className="ddz-history-empty-state">
                    <strong>{language === 'zh-CN' ? '暂无局史' : 'No history yet'}</strong>
                    <span>{language === 'zh-CN' ? '完成一局后显示。' : 'Complete a round to see it here.'}</span>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
