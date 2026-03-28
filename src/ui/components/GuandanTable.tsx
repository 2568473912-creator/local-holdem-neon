import { useId, useMemo, useState } from 'react';
import type { AppLanguage } from '../../i18n';
import type { CardSkinKey } from '../../types/cardSkin';
import type { EffectSkinKey } from '../../types/effectSkin';
import type { AIDifficulty } from '../../types/game';
import type { GdRoundRuntime, GdRoundSummary, GdSessionStats, GdPlayerState, GdSpecialEventKind } from '../../guandan/types';
import type { GuandanTrusteeMode } from '../../state/useGuandanController';
import { guandanRankLabel, levelLabel } from '../../guandan/cards';
import { analyzePattern } from '../../guandan/rules';
import { useIpadCardSweepSelection } from '../hooks/useIpadCardSweepSelection';
import { PlayerPortrait } from './PlayerPortrait';
import { DouDizhuCard } from './DouDizhuCard';
import { IpadInfoSheet } from './IpadInfoSheet';
import { PortraitSpotlightCard } from './PortraitSpotlightCard';

interface GuandanTableProps {
  language: AppLanguage;
  runtime: GdRoundRuntime;
  history: GdRoundSummary[];
  stats: GdSessionStats;
  paused: boolean;
  cardSkinKey: CardSkinKey;
  effectSkinKey: EffectSkinKey;
  trusteeMode: GuandanTrusteeMode;
  onBack: () => void;
  onRestart: () => void;
  onNextRound: () => void;
  onPause: () => void;
  onSetTrusteeMode: (mode: GuandanTrusteeMode) => void;
  onToggleCard: (cardId: string) => void;
  onClearSelection: () => void;
  onHint: () => void;
  onPlay: () => void;
  onPass: () => void;
  canPass: boolean;
  legalPatternCount: number;
  onChangeAIDifficulty: (level: AIDifficulty) => void;
}

function teamLabel(team: GdPlayerState['team'], language: AppLanguage) {
  return team === 'alpha' ? (language === 'zh-CN' ? '我方' : 'Our side') : language === 'zh-CN' ? '对家' : 'Opponents';
}

function specialToneClass(kind: GdSpecialEventKind) {
  if (kind === 'jokerBomb') return 'joker-bomb';
  if (kind === 'straightFlush') return 'straight-flush';
  if (kind === 'bomb') return 'bomb';
  if (kind === 'doubleDown') return 'double-down';
  if (kind === 'singleDown') return 'single-down';
  return 'hard-fought';
}

function actionMood(player: GdPlayerState, active: boolean) {
  if (player.finishOrder === 1) return 'winner' as const;
  if (player.lastAction.includes('炸弹') || player.lastAction.includes('同花顺')) return 'all-in' as const;
  if (player.lastAction.includes('过牌')) return 'checking' as const;
  if (active) return 'thinking' as const;
  if (player.lastAction.includes('顺子') || player.lastAction.includes('连对') || player.lastAction.includes('钢板')) return 'raising' as const;
  return 'calm' as const;
}

function handDensityClass(cardCount: number): string {
  if (cardCount >= 24) return 'hand-density-fanned';
  if (cardCount >= 18) return 'hand-density-spread';
  return 'hand-density-standard';
}

export function GuandanTable({
  language,
  runtime,
  history,
  stats,
  paused,
  cardSkinKey,
  effectSkinKey,
  trusteeMode,
  onBack,
  onRestart,
  onNextRound,
  onPause,
  onSetTrusteeMode,
  onToggleCard,
  onClearSelection,
  onHint,
  onPlay,
  onPass,
  canPass,
  legalPatternCount,
  onChangeAIDifficulty,
}: GuandanTableProps) {
  const isIpadLike = typeof document !== 'undefined' && document.documentElement.dataset.ipadLike === 'true';
  const infoSheetId = useId();
  const [infoOpen, setInfoOpen] = useState(false);
  const human = runtime.players.find((player) => player.isHuman) ?? runtime.players[0];
  const humanHandDensityClass = handDensityClass(human.hand.length);
  const currentPlayer = runtime.players.find((player) => player.id === runtime.currentPlayerId) ?? runtime.players[0];
  const selected = new Set(runtime.selectedCardIds);
  const selectedCards = human.hand.filter((card) => selected.has(card.id));
  const selectedPattern = selectedCards.length > 0 ? analyzePattern(selectedCards, runtime.teamLevels[human.team]) : null;
  const opponents = runtime.players.filter((player) => !player.isHuman);
  const recentHistory = history.slice(0, 5);
  const alphaLevel = levelLabel(runtime.teamLevels, 'alpha');
  const betaLevel = levelLabel(runtime.teamLevels, 'beta');
  const recentHistorySummary =
    recentHistory.length > 0
      ? recentHistory
          .slice(0, 2)
          .map((entry) => `${language === 'zh-CN' ? '第' : 'Round'} ${entry.round} · ${entry.victoryLabel}`)
          .join(' · ')
      : language === 'zh-CN'
        ? '完成一局后显示最近战报。'
        : 'Finish one round to unlock recent results.';
  const recentSpecialSummary =
    runtime.specialHistory.length > 0
      ? runtime.specialHistory
          .slice(0, 5)
          .map((entry) => entry.label)
          .join(' · ')
      : language === 'zh-CN'
        ? '本局还没有触发高能事件。'
        : 'No highlight events yet this round.';
  const showSpecialSummary = runtime.specialHistory.length > 0;
  const showRecentHistorySummary = recentHistory.length > 0;
  const specialStripEmptyLabel =
    runtime.specialHistory.length > 0
      ? null
      : isIpadLike
        ? language === 'zh-CN'
          ? '还没触发高能事件。'
          : 'No highlights yet.'
        : language === 'zh-CN'
          ? '还没有触发炸弹、同花顺或胜负层级事件。'
          : 'No bombs, straight flushes, or victory milestones yet.';
  const finishOrderNames = runtime.finishOrder.map((playerId) => runtime.players.find((player) => player.id === playerId)?.name ?? playerId);
  const selectionStatus =
    selectedCards.length === 0 ? (language === 'zh-CN' ? '未选择手牌' : 'No cards selected') : selectedPattern ? (language === 'zh-CN' ? `已组成 ${selectedPattern.description}` : `Built ${selectedPattern.description}`) : language === 'zh-CN' ? '当前选择不是合法牌型' : 'Current selection is not legal';
  const currentPlayPatternLabel =
    runtime.tableDisplay.pattern?.description ??
    (isIpadLike
      ? language === 'zh-CN'
        ? '等待领出'
        : 'Waiting for lead'
      : language === 'zh-CN'
        ? '还没有人出牌'
        : 'No play yet');
  const currentPlayEmptyLabel =
    runtime.tableDisplay.cards.length > 0
      ? null
      : isIpadLike
        ? language === 'zh-CN'
          ? '等待有人领牌'
          : 'Waiting for lead'
        : language === 'zh-CN'
          ? '本轮等待有人领出'
          : 'Waiting for the next lead';
  const specialBurst = runtime.phase === 'playing' ? runtime.specialBurst : null;
  const settlementSummary =
    runtime.victoryType === 'doubleDown'
      ? '双下直接抬三级，整轮压制最干脆。'
      : runtime.victoryType === 'singleDown'
        ? '单下稳住节奏，整轮抬两级。'
        : '对局被缠住，但头游仍然把局拿下。';
  const settlementHeroDelta = runtime.players.find((player) => player.id === human.id)?.score ?? 0;
  const settlementOrder = useMemo(
    () =>
      runtime.players
        .slice()
        .sort((left, right) => (left.finishOrder ?? 9) - (right.finishOrder ?? 9))
        .map((player) => ({
          player,
          eyebrow:
            player.finishOrder === 1
              ? language === 'zh-CN'
                ? '头游'
                : 'First out'
              : player.finishOrder === 2
                ? language === 'zh-CN'
                  ? '二游'
                  : 'Second out'
                : player.finishOrder === 3
                  ? language === 'zh-CN'
                    ? '三游'
                    : 'Third out'
                  : player.finishOrder === 4
                    ? language === 'zh-CN'
                      ? '末游'
                      : 'Fourth out'
                    : language === 'zh-CN'
                      ? '在手'
                      : 'Still holding',
          detail:
            language === 'zh-CN'
              ? `${teamLabel(player.team, language)} · ${player.finishOrder ? `第 ${player.finishOrder}` : '未出完'}`
              : `${teamLabel(player.team, language)} · ${player.finishOrder ? `#${player.finishOrder}` : 'Still in hand'}`,
          note:
            language === 'zh-CN'
              ? `总分 ${player.score >= 0 ? `+${player.score}` : player.score}`
              : `Total ${player.score >= 0 ? `+${player.score}` : player.score}`,
          value:
            player.team === runtime.winnerTeam
              ? player.finishOrder === 1
                ? language === 'zh-CN'
                  ? '胜方头游'
                  : 'Lead winner'
                : language === 'zh-CN'
                  ? '胜方'
                  : 'Winning side'
              : undefined,
          mood:
            player.finishOrder === 1
              ? ('winner' as const)
              : player.team === runtime.winnerTeam
                ? ('focused' as const)
                : ('calm' as const),
        })),
    [language, runtime.players, runtime.winnerTeam],
  );

  const partnerCard = useMemo(
    () => opponents.find((player) => player.team === human.team) ?? opponents[1] ?? opponents[0],
    [human.team, opponents],
  );
  const roundSummaryLabel = language === 'zh-CN' ? `第 ${runtime.round} 局` : `Round ${runtime.round}`;
  const turnSummaryLabel = `${language === 'zh-CN' ? '轮到' : 'Turn'} ${currentPlayer.name}`;
  const levelSummaryLabel = `${language === 'zh-CN' ? '级牌' : 'Levels'} ${alphaLevel} / ${betaLevel}`;
  const openingLeadName = runtime.players.find((player) => player.id === runtime.startingPlayerId)?.name;
  const infoSheetSummary = runtime.victoryLabel ? `${roundSummaryLabel} · ${runtime.victoryLabel}` : `${roundSummaryLabel} · ${turnSummaryLabel}`;
  const bestFinishLabel =
    stats.bestFinish === 4 ? (language === 'zh-CN' ? '未出结果' : 'No finish yet') : language === 'zh-CN' ? `第 ${stats.bestFinish} 名` : `#${stats.bestFinish}`;
  const handInteractionEnabled = runtime.currentPlayerId === human.id && !paused && trusteeMode === 'off';
  const sweepSelectionHandlers = useIpadCardSweepSelection({
    enabled: isIpadLike && runtime.phase === 'playing' && handInteractionEnabled,
    selectedIds: selected,
    onToggleCard,
  });
  const sessionProgressLabel =
    language === 'zh-CN'
      ? `已完成 ${stats.rounds} 局 · 我方 ${stats.humanTeamWins} 胜 · 最佳 ${bestFinishLabel}`
      : `Played ${stats.rounds} · Our wins ${stats.humanTeamWins} · Best ${bestFinishLabel}`;
  const aiDifficultyLabel =
    runtime.config.aiDifficulty === 'conservative'
      ? language === 'zh-CN'
        ? 'AI 保守'
        : 'AI Conservative'
      : runtime.config.aiDifficulty === 'aggressive'
        ? language === 'zh-CN'
          ? 'AI 激进'
          : 'AI Aggressive'
        : language === 'zh-CN'
          ? 'AI 标准'
          : 'AI Standard';
  const trusteeStatusLabel =
    trusteeMode === 'off'
      ? language === 'zh-CN'
        ? '关闭'
        : 'Off'
      : trusteeMode === 'turn'
        ? language === 'zh-CN'
          ? '单回合托管'
          : 'Turn auto-play'
        : language === 'zh-CN'
          ? '整局托管'
          : 'Round auto-play';
  const hiddenCardReference =
    runtime.players.flatMap((player) => player.hand).at(0) ??
    runtime.tableDisplay.cards[0] ??
    runtime.players.flatMap((player) => player.lastPlayedCards).at(0) ??
    null;

  return (
    <main className="gd-table-screen">
      <div className="ddz-table-backdrop" />
      {specialBurst ? (
        <div key={specialBurst.id} className={`gd-fx-burst fx-style-${effectSkinKey} tone-${specialToneClass(specialBurst.kind)}`}>
          <strong>{specialBurst.label}</strong>
          <span>{specialBurst.detail}</span>
        </div>
      ) : null}
      <section className="gd-topbar glass-panel">
        <div className="gd-topbar-copy">
          <strong>{language === 'zh-CN' ? '霓虹掼蛋' : 'Neon Guandan'}</strong>
          <span>
            {language === 'zh-CN' ? '第' : 'Round'} {runtime.round} {language === 'zh-CN' ? '局' : ''} · {language === 'zh-CN' ? '当前玩家' : 'Current player'} {currentPlayer.name} · {language === 'zh-CN' ? '先手' : 'Opening lead'} {openingLeadName}
          </span>
          {isIpadLike ? (
            <div className="ipad-mode-summary">
              <span>{roundSummaryLabel}</span>
              <span>{turnSummaryLabel}</span>
              <span>{levelSummaryLabel}</span>
            </div>
          ) : null}
        </div>
        <div className="gd-topbar-stats">
          <span>{language === 'zh-CN' ? '我方级牌' : 'Our level'} {alphaLevel}</span>
          <span>{language === 'zh-CN' ? '对家级牌' : 'Opp level'} {betaLevel}</span>
          <span>{language === 'zh-CN' ? '可出解数' : 'Legal plays'} {legalPatternCount}</span>
        </div>
        <div className="gd-topbar-actions">
          {isIpadLike ? (
            <>
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
              <button className="btn mini" type="button" onClick={onPause}>
                {paused ? (language === 'zh-CN' ? '继续' : 'Resume') : language === 'zh-CN' ? '暂停' : 'Pause'}
              </button>
              <button className="btn mini" type="button" onClick={onBack}>
                {language === 'zh-CN' ? '大厅' : 'Hub'}
              </button>
            </>
          ) : (
            <>
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
                {trusteeMode === 'turn' ? '关闭单回合托管' : '托管一回合'}
              </button>
              <button className={`btn mini ${trusteeMode === 'round' ? 'primary' : ''}`} type="button" onClick={() => onSetTrusteeMode(trusteeMode === 'round' ? 'off' : 'round')}>
                {trusteeMode === 'round' ? '关闭整局托管' : '托管整局'}
              </button>
              <button className="btn mini" type="button" onClick={onPause}>{paused ? (language === 'zh-CN' ? '继续' : 'Resume') : language === 'zh-CN' ? '暂停' : 'Pause'}</button>
              <button className="btn mini" type="button" onClick={onRestart}>{language === 'zh-CN' ? '重新开局' : 'Restart Session'}</button>
              <button className="btn mini" type="button" onClick={onBack}>{language === 'zh-CN' ? '返回大厅' : 'Back to Hub'}</button>
            </>
          )}
        </div>
        {isIpadLike && infoOpen ? (
          <IpadInfoSheet
            sheetId={infoSheetId}
            title={language === 'zh-CN' ? '本局信息' : 'Round info'}
            summary={infoSheetSummary}
            onClose={() => setInfoOpen(false)}
          >
            <div className="ipad-info-grid">
              <div className="ipad-info-card">
                <span>{language === 'zh-CN' ? '当前玩家' : 'Current player'}</span>
                <strong>{currentPlayer.name}</strong>
              </div>
              <div className="ipad-info-card">
                <span>{language === 'zh-CN' ? '先手位' : 'Opening lead'}</span>
                <strong>{openingLeadName}</strong>
              </div>
              <div className="ipad-info-card">
                <span>{language === 'zh-CN' ? '当前牌权' : 'Current lead'}</span>
                <strong>{runtime.trick.playerId ? runtime.players.find((player) => player.id === runtime.trick.playerId)?.name : language === 'zh-CN' ? '等待领牌' : 'Waiting for a lead'}</strong>
              </div>
              <div className="ipad-info-card">
                <span>{language === 'zh-CN' ? '可出解数' : 'Legal plays'}</span>
                <strong>{legalPatternCount}</strong>
              </div>
              <div className="ipad-info-card">
                <span>{language === 'zh-CN' ? '我方级牌' : 'Our level'}</span>
                <strong>{alphaLevel}</strong>
              </div>
              <div className="ipad-info-card">
                <span>{language === 'zh-CN' ? '对家级牌' : 'Opp level'}</span>
                <strong>{betaLevel}</strong>
              </div>
              <div className="ipad-info-card">
                <span>{language === 'zh-CN' ? '已过牌' : 'Passes'}</span>
                <strong>{runtime.trick.passCount}</strong>
              </div>
              <div className="ipad-info-card">
                <span>{language === 'zh-CN' ? '托管状态' : 'Auto-play'}</span>
                <strong>{trusteeStatusLabel}</strong>
              </div>
              <div className="ipad-info-card wide">
                <span>{language === 'zh-CN' ? '会话进展' : 'Session progress'}</span>
                <strong>{sessionProgressLabel}</strong>
              </div>
              {showSpecialSummary ? (
                <div className="ipad-info-card wide">
                  <span>{language === 'zh-CN' ? '本局高能' : 'Highlights'}</span>
                  <strong>{recentSpecialSummary}</strong>
                </div>
              ) : null}
              {showRecentHistorySummary ? (
                <div className="ipad-info-card wide">
                  <span>{language === 'zh-CN' ? '最近战报' : 'Recent results'}</span>
                  <strong>{recentHistorySummary}</strong>
                </div>
              ) : null}
              <div className="ipad-info-control-card wide">
                <div className="ipad-info-control-head">
                  <span>{language === 'zh-CN' ? 'AI 策略' : 'AI profile'}</span>
                  <strong>{aiDifficultyLabel}</strong>
                </div>
                <div className="ipad-info-select-row">
                  <select
                    value={runtime.config.aiDifficulty}
                    aria-label={language === 'zh-CN' ? 'AI 策略' : 'AI profile'}
                    onChange={(event) => onChangeAIDifficulty(event.target.value as AIDifficulty)}
                  >
                    <option value="conservative">{language === 'zh-CN' ? 'AI 保守' : 'AI Conservative'}</option>
                    <option value="standard">{language === 'zh-CN' ? 'AI 标准' : 'AI Standard'}</option>
                    <option value="aggressive">{language === 'zh-CN' ? 'AI 激进' : 'AI Aggressive'}</option>
                  </select>
                </div>
              </div>
              <div className="ipad-info-control-card wide">
                <div className="ipad-info-control-head">
                  <span>{language === 'zh-CN' ? '托管控制' : 'Auto-play controls'}</span>
                  <strong>{trusteeStatusLabel}</strong>
                </div>
                <div className="ipad-info-segmented">
                  <button className={`btn mini ${trusteeMode === 'turn' ? 'primary' : ''}`} type="button" onClick={() => onSetTrusteeMode(trusteeMode === 'turn' ? 'off' : 'turn')}>
                    {trusteeMode === 'turn' ? (language === 'zh-CN' ? '关单托' : 'Stop turn auto') : language === 'zh-CN' ? '单托' : 'Turn auto'}
                  </button>
                  <button className={`btn mini ${trusteeMode === 'round' ? 'primary' : ''}`} type="button" onClick={() => onSetTrusteeMode(trusteeMode === 'round' ? 'off' : 'round')}>
                    {trusteeMode === 'round' ? (language === 'zh-CN' ? '关整托' : 'Stop round auto') : language === 'zh-CN' ? '整托' : 'Round auto'}
                  </button>
                  <button className={`btn mini ${trusteeMode === 'off' ? 'primary' : ''}`} type="button" onClick={() => onSetTrusteeMode('off')}>
                    {language === 'zh-CN' ? '关闭托管' : 'Turn off'}
                  </button>
                </div>
              </div>
            </div>
            <div className="ipad-info-actions">
              <button className="btn" type="button" onClick={() => {
                setInfoOpen(false);
                onRestart();
              }}>
                {language === 'zh-CN' ? '重新开局' : 'Restart Session'}
              </button>
            </div>
          </IpadInfoSheet>
        ) : null}
      </section>

      {!isIpadLike ? (
        <section className="ddz-banner glass-panel gd-banner">
          <strong>{language === 'zh-CN' ? runtime.banner : runtime.banner.replace('掼蛋牌桌已准备，开始首轮领牌。', 'Guandan table ready. Opening lead begins.').replace('AI 难度已切换为 保守', 'AI difficulty set to Conservative').replace('AI 难度已切换为 标准', 'AI difficulty set to Standard').replace('AI 难度已切换为 激进', 'AI difficulty set to Aggressive').replace('牌权回到新领牌阶段。', 'Lead resets.').replace('过牌。', 'passes.').replace('过牌', 'Pass').replace('重新领牌。', 'leads the next trick.').replace('打出 ', 'plays ')}</strong>
          <span>
            {language === 'zh-CN' ? '已完成' : 'Played'} {stats.rounds} {language === 'zh-CN' ? '局' : 'rounds'} · {language === 'zh-CN' ? '我方胜' : 'Our wins'} {stats.humanTeamWins} {language === 'zh-CN' ? '局' : 'rounds'} · {language === 'zh-CN' ? '最佳名次' : 'Best finish'} {stats.bestFinish === 4 ? (language === 'zh-CN' ? '未出结果' : 'N/A') : `${language === 'zh-CN' ? '第' : '#'} ${stats.bestFinish}`}
          </span>
        </section>
      ) : null}

      <section className="gd-table-layout">
        <div className="gd-opponents-row">
          {opponents.map((player) => {
            const active = runtime.currentPlayerId === player.id && runtime.phase !== 'settlement';
            const isDisplayOwner = runtime.tableDisplay.playerId === player.id;
            const isPartner = player.id === partnerCard.id;
            return (
              <article key={player.id} className={`gd-seat-card ${player.team} ${active ? 'active' : ''} ${isPartner ? 'partner' : ''}`}>
                <div className="gd-seat-head">
                  <PlayerPortrait player={player} active={active} mood={actionMood(player, active)} size="focus" variant="panel" />
                  <div>
                    <strong>{player.name}</strong>
                    <span>{teamLabel(player.team, language)} · {language === 'zh-CN' ? '手牌' : 'Hand'} {player.hand.length}</span>
                  </div>
                </div>
                <div className="gd-seat-meta">
                  <span>{language === 'zh-CN' ? '累计分数' : 'Score'} {player.score >= 0 ? `+${player.score}` : player.score}</span>
                  <span>{player.finishOrder ? `${language === 'zh-CN' ? '第' : '#'} ${player.finishOrder}` : language === 'zh-CN' ? '仍在场' : 'Still in'}</span>
                </div>
                <div className="gd-seat-action">{player.lastAction}</div>
                <div className="gd-seat-played">
                  {isDisplayOwner && runtime.tableDisplay.cards.length > 0 ? (
                    runtime.tableDisplay.cards.map((card) => <DouDizhuCard key={`${player.id}-${card.id}`} card={card} compact backLabel="掼蛋" cardSkinKey={cardSkinKey} />)
                  ) : hiddenCardReference ? (
                    <div className="ddz-card-count-stack">
                      {Array.from({ length: Math.min(3, player.hand.length || 1) }).map((_, index) => (
                        <DouDizhuCard key={`gd-back-${player.id}-${index}`} card={hiddenCardReference} compact hidden backLabel="掼蛋" cardSkinKey={cardSkinKey} />
                      ))}
                    </div>
                  ) : (
                    <div className="ddz-history-empty">本位已清空</div>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <div className="gd-center-zone glass-panel">
          <div className="gd-status-strip">
            <div>
              <span>{language === 'zh-CN' ? '轮到谁' : 'Turn'}</span>
              <strong>{currentPlayer.name}</strong>
            </div>
            <div>
              <span>{language === 'zh-CN' ? '当前牌权' : 'Lead'}</span>
              <strong>{runtime.trick.playerId ? runtime.players.find((player) => player.id === runtime.trick.playerId)?.name : language === 'zh-CN' ? '等待领出' : 'Waiting for a lead'}</strong>
            </div>
            <div>
              <span>{language === 'zh-CN' ? '已过牌' : 'Passes'}</span>
              <strong>{runtime.trick.passCount}</strong>
            </div>
            <div>
              <span>{language === 'zh-CN' ? '出完顺序' : 'Finish order'}</span>
              <strong>{finishOrderNames.length > 0 ? finishOrderNames.join(' → ') : language === 'zh-CN' ? '暂无' : 'None yet'}</strong>
            </div>
          </div>
          {!isIpadLike ? (
            <div className="gd-level-strip">
              <span>{language === 'zh-CN' ? '我方级牌' : 'Our level'} {alphaLevel}</span>
              <span>{language === 'zh-CN' ? '对家级牌' : 'Opp level'} {betaLevel}</span>
              <span>{language === 'zh-CN' ? '本局若胜' : 'If won'}：+{runtime.levelDelta || 1}</span>
            </div>
          ) : null}
          <div className="gd-special-strip">
            <div className="gd-special-strip-head">
              <strong>{language === 'zh-CN' ? '本局高能' : 'Highlights'}</strong>
              <span>{runtime.specialHistory.length} 次</span>
            </div>
            <div className="gd-special-strip-chips">
              {runtime.specialHistory.length > 0 ? (
                runtime.specialHistory.slice(0, 6).map((entry) => (
                  <span key={entry.id} className={`gd-special-chip tone-${specialToneClass(entry.kind)}`}>
                    {entry.label}
                  </span>
                ))
              ) : (
                <em>{specialStripEmptyLabel}</em>
              )}
            </div>
          </div>
          <div className="gd-current-play">
            <div className="ddz-current-play-head">
              <strong>{runtime.tableDisplay.playerId ? `${runtime.players.find((player) => player.id === runtime.tableDisplay.playerId)?.name}${language === 'zh-CN' ? ' 的牌' : "'s play"}` : language === 'zh-CN' ? '等待领牌' : 'Waiting for a lead'}</strong>
              <span>{currentPlayPatternLabel}</span>
            </div>
            <div className="ddz-current-play-cards">
              {runtime.tableDisplay.cards.length > 0 ? runtime.tableDisplay.cards.map((card) => <DouDizhuCard key={`gd-center-${card.id}`} card={card} backLabel="掼蛋" cardSkinKey={cardSkinKey} />) : <em>{currentPlayEmptyLabel}</em>}
            </div>
          </div>
          {!isIpadLike ? (
            <div className="gd-team-panels">
              <div>
                <span>{language === 'zh-CN' ? '我方' : 'Our side'}</span>
                <strong>{runtime.players.filter((player) => player.team === 'alpha' && player.finishOrder !== null).length} {language === 'zh-CN' ? '人已出完' : 'finished'}</strong>
              </div>
              <div>
                <span>{language === 'zh-CN' ? '对家' : 'Opponents'}</span>
                <strong>{runtime.players.filter((player) => player.team === 'beta' && player.finishOrder !== null).length} {language === 'zh-CN' ? '人已出完' : 'finished'}</strong>
              </div>
            </div>
          ) : null}
        </div>

        {!isIpadLike ? (
          <aside className="gd-side-panel glass-panel">
            <div className="ddz-log-head">
              <strong>{language === 'zh-CN' ? '最近行动' : 'Recent actions'}</strong>
              <span>{runtime.log.length} {language === 'zh-CN' ? '条' : 'items'}</span>
            </div>
            <ul className="gd-log-list">
              {runtime.log.slice(0, 10).map((entry) => (
                <li key={entry.id} className={`tone-${entry.tone ?? 'neutral'}`}>{entry.text}</li>
              ))}
            </ul>
            <div className="gd-history-head">
              <strong>{language === 'zh-CN' ? '最近战报' : 'Recent results'}</strong>
              <span>{language === 'zh-CN' ? '最近' : 'Latest'} {recentHistory.length} {language === 'zh-CN' ? '局' : 'rounds'}</span>
            </div>
            <div className="gd-history-list">
              {recentHistory.length > 0 ? (
                recentHistory.map((entry) => (
                  <div key={`gd-history-${entry.round}-${entry.timestamp}`} className={`gd-history-card tone-${entry.winningTeam}`}>
                    <div className="gd-history-card-head">
                      <strong>{language === 'zh-CN' ? '第' : 'Round'} {entry.round} {language === 'zh-CN' ? '局' : ''}</strong>
                      <span>{entry.victoryLabel} · +{entry.levelDelta} {language === 'zh-CN' ? '级' : 'levels'}</span>
                    </div>
                    <div className="gd-history-card-body">
                      <span>{language === 'zh-CN' ? '出完顺序' : 'Finish order'} {entry.finishOrder.map((playerId) => entry.players.find((player) => player.id === playerId)?.name ?? playerId).join(' → ')}</span>
                      <strong>
                        {guandanRankLabel(entry.teamLevelsBefore.alpha)} / {guandanRankLabel(entry.teamLevelsBefore.beta)} → {guandanRankLabel(entry.teamLevelsAfter.alpha)} / {guandanRankLabel(entry.teamLevelsAfter.beta)}
                      </strong>
                      <em>{language === 'zh-CN' ? '发牌种子' : 'Deal seed'} #{entry.dealSeed}</em>
                    </div>
                    {entry.specials.length > 0 ? (
                      <div className="gd-history-card-tags">
                        {entry.specials.slice(0, 4).map((tag) => (
                          <span key={tag.id} className={`gd-special-chip small tone-${specialToneClass(tag.kind)}`}>
                            {tag.label}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="ddz-history-empty">{language === 'zh-CN' ? '完成一局后显示战报。' : 'Finish one round to see history.'}</div>
              )}
            </div>
          </aside>
        ) : null}
      </section>

      <section className={`gd-human-area glass-panel phase-${runtime.phase} ${runtime.phase === 'settlement' ? 'settlement' : ''}`}>
        <div className="gd-human-header">
          <div className="ddz-human-seat-head">
            <PlayerPortrait player={human} active={runtime.currentPlayerId === human.id && runtime.phase !== 'settlement'} mood={actionMood(human, runtime.currentPlayerId === human.id)} size="hero" variant="panel" />
            <div>
              <strong>{human.name}</strong>
              <span>
                {teamLabel(human.team, language)} · {language === 'zh-CN' ? '当前级牌' : 'Level'} {alphaLevel} · {language === 'zh-CN' ? '累计分数' : 'Score'} {human.score >= 0 ? `+${human.score}` : human.score}
              </span>
              {trusteeMode !== 'off' ? <em className="ddz-trustee-badge">{trusteeMode === 'turn' ? '单回合托管' : '整局托管'}</em> : null}
            </div>
          </div>
          <div className="ddz-human-last-action">{human.lastAction}</div>
        </div>

        {runtime.phase === 'playing' && (
          <div className="ddz-human-selection-strip gd-selection-strip">
            <div>
              <span>{language === 'zh-CN' ? '选牌状态' : 'Selection'}</span>
              <strong>{selectionStatus}</strong>
            </div>
            <div>
              <span>{language === 'zh-CN' ? '目标牌型' : 'Target'}</span>
              <strong>{runtime.trick.pattern ? runtime.trick.pattern.description : language === 'zh-CN' ? '你可自由领牌' : 'You may lead freely'}</strong>
            </div>
            <div>
              <span>{language === 'zh-CN' ? '已选张数' : 'Selected cards'}</span>
              <strong>{selectedCards.length}</strong>
            </div>
          </div>
        )}

        {runtime.phase === 'playing' && (
          <>
            <div className="gd-human-controls">
              <button className="btn" type="button" onClick={onHint} disabled={paused || trusteeMode !== 'off' || runtime.currentPlayerId !== human.id}>{language === 'zh-CN' ? '提示' : 'Hint'}</button>
              <button className={`btn ${trusteeMode === 'turn' ? 'primary' : ''}`} type="button" onClick={() => onSetTrusteeMode(trusteeMode === 'turn' ? 'off' : 'turn')}>
                {trusteeMode === 'turn' ? '关闭单回合托管' : '托管一回合'}
              </button>
              <button className={`btn ${trusteeMode === 'round' ? 'primary' : ''}`} type="button" onClick={() => onSetTrusteeMode(trusteeMode === 'round' ? 'off' : 'round')}>
                {trusteeMode === 'round' ? '关闭整局托管' : '托管整局'}
              </button>
              <button className="btn" type="button" onClick={onClearSelection} disabled={paused || trusteeMode !== 'off' || runtime.selectedCardIds.length === 0}>{language === 'zh-CN' ? '重选' : 'Clear'}</button>
              <button className="btn" type="button" onClick={onPass} disabled={paused || trusteeMode !== 'off' || runtime.currentPlayerId !== human.id || !canPass}>{language === 'zh-CN' ? '过牌' : 'Pass'}</button>
              <button className="btn primary" type="button" onClick={onPlay} disabled={paused || trusteeMode !== 'off' || runtime.currentPlayerId !== human.id}>{language === 'zh-CN' ? '出牌' : 'Play'}</button>
            </div>

            <div
              className={`gd-hand-row ${humanHandDensityClass} ${isIpadLike && handInteractionEnabled ? 'sweep-enabled' : ''}`}
              {...(isIpadLike && runtime.phase === 'playing' && handInteractionEnabled ? sweepSelectionHandlers : {})}
            >
              {human.hand.map((card) => (
                <DouDizhuCard
                  key={card.id}
                  card={card}
                  cardId={card.id}
                  cardSkinKey={cardSkinKey}
                  selected={selected.has(card.id)}
                  onClick={!isIpadLike && handInteractionEnabled ? () => onToggleCard(card.id) : undefined}
                  backLabel="掼蛋"
                />
              ))}
            </div>
          </>
        )}

        {runtime.phase === 'settlement' && (
          <div className="gd-settlement-panel">
            <div className={`gd-settlement-hero tone-${runtime.victoryType ?? 'hard-fought'}`}>
              <div>
                <strong>{runtime.victoryLabel ?? (runtime.winnerTeam === 'alpha' ? (language === 'zh-CN' ? '我方获胜' : 'Our side wins') : language === 'zh-CN' ? '对家获胜' : 'Opponents win')}</strong>
                <span>{settlementSummary}</span>
              </div>
              <div className="gd-settlement-hero-stats">
                <span>升级 +{runtime.levelDelta}</span>
                <span>{runtime.winnerTeam === 'alpha' ? `我方级牌 ${alphaLevel}` : `对家级牌 ${betaLevel}`}</span>
                <span>你当前总分 {settlementHeroDelta >= 0 ? `+${settlementHeroDelta}` : settlementHeroDelta}</span>
              </div>
            </div>
            {runtime.specialHistory.length > 0 ? (
              <div className="gd-settlement-specials">
                {runtime.specialHistory.slice(0, 6).map((entry) => (
                  <span key={`gd-settlement-special-${entry.id}`} className={`gd-special-chip tone-${specialToneClass(entry.kind)}`}>
                    {entry.label}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="gd-settlement-portrait-strip">
              {settlementOrder.map((entry) => (
                <PortraitSpotlightCard
                  key={`gd-settlement-card-${entry.player.id}`}
                  player={entry.player}
                  mood={entry.mood}
                  eyebrow={entry.eyebrow}
                  detail={entry.detail}
                  note={entry.note}
                  value={entry.value}
                  compact={settlementOrder.length > 2}
                  featured
                />
              ))}
            </div>
            <div className="gd-settlement-grid">
              {runtime.players
                .slice()
                .sort((left, right) => (left.finishOrder ?? 9) - (right.finishOrder ?? 9))
                .map((player) => (
                  <div key={`gd-settle-${player.id}`}>
                    <span>{player.name} · {teamLabel(player.team, language)}</span>
                    <strong>{player.finishOrder ? `${language === 'zh-CN' ? '第' : '#'} ${player.finishOrder}` : language === 'zh-CN' ? '未出完' : 'Still holding cards'}</strong>
                    <em>{language === 'zh-CN' ? '总分' : 'Total'} {player.score >= 0 ? `+${player.score}` : player.score}</em>
                  </div>
                ))}
            </div>
            <button className="btn primary" type="button" onClick={onNextRound}>{language === 'zh-CN' ? '确认继续' : 'Confirm & Continue'}</button>
          </div>
        )}
      </section>
    </main>
  );
}
