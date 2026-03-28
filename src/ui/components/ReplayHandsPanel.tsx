import { useEffect } from 'react';
import { t } from '../../i18n';
import { useLanguage } from '../../i18n/languageContext';
import { getHandHistoryRecordKey } from '../../replay/replayRecordKey';
import type { GameMode } from '../../types/cards';
import type { SessionStats } from '../../types/game';
import type { HandHistoryRecord } from '../../types/replay';
import { difficultyLabel, formatTime, handTotalPot, modeLabel, sessionModeLabel } from './replayCenterShared';

interface ReplayHandsPanelProps {
  filteredHistory: HandHistoryRecord[];
  stats: SessionStats;
  analyzed: {
    aiActions: number;
    aggressiveRate: number;
    pressureFoldRate: number;
    topTags: Array<[string, number]>;
  };
  currentSessionId: string | null;
  modeFilter: 'all' | GameMode;
  sessionFilter: 'all' | 'cash' | 'tournament';
  sourceFilter: 'all' | 'current' | 'archive';
  resultFilter: 'all' | 'humanWin' | 'humanLose';
  difficultyFilter: 'all' | 'conservative' | 'standard' | 'aggressive';
  minPot: number;
  onModeFilterChange: (value: 'all' | GameMode) => void;
  onSessionFilterChange: (value: 'all' | 'cash' | 'tournament') => void;
  onSourceFilterChange: (value: 'all' | 'current' | 'archive') => void;
  onResultFilterChange: (value: 'all' | 'humanWin' | 'humanLose') => void;
  onDifficultyFilterChange: (value: 'all' | 'conservative' | 'standard' | 'aggressive') => void;
  onMinPotChange: (value: number) => void;
  onOpenReplay: (handKey: string) => void;
  onReady?: () => void;
}

export function ReplayHandsPanel({
  filteredHistory,
  stats,
  analyzed,
  currentSessionId,
  modeFilter,
  sessionFilter,
  sourceFilter,
  resultFilter,
  difficultyFilter,
  minPot,
  onModeFilterChange,
  onSessionFilterChange,
  onSourceFilterChange,
  onResultFilterChange,
  onDifficultyFilterChange,
  onMinPotChange,
  onOpenReplay,
  onReady,
}: ReplayHandsPanelProps) {
  const language = useLanguage();

  useEffect(() => {
    onReady?.();
  }, [onReady]);

  return (
    <>
      <section className="history-filters glass-panel">
        <label>
          {t(language, 'replay.modeFilter')}
          <select value={modeFilter} onChange={(event) => onModeFilterChange(event.target.value as 'all' | GameMode)}>
            <option value="all">{t(language, 'common.all')}</option>
            <option value="standard">{modeLabel('standard', language)}</option>
            <option value="shortDeck">{modeLabel('shortDeck', language)}</option>
            <option value="omaha">{modeLabel('omaha', language)}</option>
            <option value="plo">PLO</option>
            <option value="stud">{modeLabel('stud', language)}</option>
          </select>
        </label>
        <label>
          {t(language, 'replay.sessionFilter')}
          <select value={sessionFilter} onChange={(event) => onSessionFilterChange(event.target.value as 'all' | 'cash' | 'tournament')}>
            <option value="all">{t(language, 'common.all')}</option>
            <option value="cash">{t(language, 'common.cash')}</option>
            <option value="tournament">{t(language, 'common.tournament')}</option>
          </select>
        </label>
        <label>
          {t(language, 'replay.sourceFilter')}
          <select value={sourceFilter} onChange={(event) => onSourceFilterChange(event.target.value as 'all' | 'current' | 'archive')}>
            <option value="all">{t(language, 'common.all')}</option>
            <option value="current">{t(language, 'replay.currentSession')}</option>
            <option value="archive">{t(language, 'replay.localArchive')}</option>
          </select>
        </label>
        <label>
          {t(language, 'replay.resultFilter')}
          <select value={resultFilter} onChange={(event) => onResultFilterChange(event.target.value as 'all' | 'humanWin' | 'humanLose')}>
            <option value="all">{t(language, 'common.all')}</option>
            <option value="humanWin">{t(language, 'replay.onlyHeroWins')}</option>
            <option value="humanLose">{t(language, 'replay.onlyHeroNonWins')}</option>
          </select>
        </label>
        <label>
          {t(language, 'main.aiDifficulty')}
          <select value={difficultyFilter} onChange={(event) => onDifficultyFilterChange(event.target.value as 'all' | 'conservative' | 'standard' | 'aggressive')}>
            <option value="all">{t(language, 'common.all')}</option>
            <option value="conservative">{difficultyLabel('conservative', language)}</option>
            <option value="standard">{difficultyLabel('standard', language)}</option>
            <option value="aggressive">{difficultyLabel('aggressive', language)}</option>
          </select>
        </label>
        <label>
          {t(language, 'replay.minPot')}
          <input type="number" min={0} step={10} value={minPot} onChange={(event) => onMinPotChange(Math.max(0, Number(event.target.value) || 0))} />
        </label>
        <div className="history-filter-summary">{t(language, 'replay.filterResult', { count: filteredHistory.length })}</div>
      </section>

      <section className="stats-grid">
        <div className="stat-card glass-panel">
          <span>{t(language, 'replay.totalHands')}</span>
          <strong>{stats.totalHands}</strong>
        </div>
        <div className="stat-card glass-panel">
          <span>{t(language, 'replay.winningHands')}</span>
          <strong>{stats.wins}</strong>
        </div>
        <div className="stat-card glass-panel">
          <span>{t(language, 'replay.winRate')}</span>
          <strong>{stats.winRate}%</strong>
        </div>
        <div className="stat-card glass-panel">
          <span>{t(language, 'replay.totalProfit')}</span>
          <strong className={stats.totalProfit >= 0 ? 'up' : 'down'}>
            {stats.totalProfit >= 0 ? '+' : ''}
            {stats.totalProfit}
          </strong>
        </div>
        <div className="stat-card glass-panel">
          <span>{t(language, 'replay.maxPotWin')}</span>
          <strong>{stats.maxSinglePotWin}</strong>
        </div>
      </section>

      <section className="history-list glass-panel">
        <div className="history-analysis">
          <div>
            <span>{t(language, 'replay.aiActions')}</span>
            <strong>{analyzed.aiActions}</strong>
          </div>
          <div>
            <span>{t(language, 'replay.aggressionRate')}</span>
            <strong>{analyzed.aggressiveRate}%</strong>
          </div>
          <div>
            <span>{t(language, 'replay.pressureFoldRate')}</span>
            <strong>{analyzed.pressureFoldRate}%</strong>
          </div>
          <div>
            <span>{t(language, 'replay.topTeachingTags')}</span>
            <strong>{analyzed.topTags.map((item) => `${item[0]}(${item[1]})`).join(' / ') || t(language, 'replay.none')}</strong>
          </div>
        </div>
        <h3>{t(language, 'replay.handList')}</h3>
        {filteredHistory.length === 0 ? (
          <div className="empty">{t(language, 'replay.noHistoryHands')}</div>
        ) : (
          <ul>
            {filteredHistory.map((hand) => (
              <li key={`${hand.sessionId ?? 'legacy'}-${hand.handId}-${hand.timestamp}`}>
                <div>
                  <strong>{t(language, 'replay.handNumber', { handId: hand.handId })}</strong>
                  <span>{formatTime(hand.timestamp, language)}</span>
                  <span>{modeLabel(hand.gameMode, language)}</span>
                  <span>{sessionModeLabel(hand.sessionMode, language)}</span>
                  <span>{t(language, 'replay.difficultyValue', { value: difficultyLabel(hand.aiDifficulty, language) })}</span>
                  <span>{currentSessionId && hand.sessionId === currentSessionId ? t(language, 'replay.currentSession') : t(language, 'replay.localArchive')}</span>
                  <span>
                    {t(language, 'common.blinds')} {hand.blindInfo.smallBlind}/{hand.blindInfo.bigBlind}
                  </span>
                  <span>{t(language, 'common.pot')} {handTotalPot(hand)}</span>
                </div>
                <div>
                  <span>{t(language, 'replay.winnersValue', { value: hand.winners.join(' / ') || t(language, 'replay.none') })}</span>
                  <button className="btn primary" onClick={() => onOpenReplay(getHandHistoryRecordKey(hand))}>
                    {t(language, 'replay.openReplay')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
