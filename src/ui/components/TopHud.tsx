import { useId, useState } from 'react';
import { t, type AppLanguage } from '../../i18n';
import type { AIDifficulty, GameConfig, TableState } from '../../types/game';
import type { AudioLevel } from '../../state/audioPreferences';
import type { MotionLevel } from '../../state/motionPreferences';
import type { TableThemeKey } from '../../types/theme';
import { getTournamentPaidPlaces } from '../../engine/tournamentPrize';
import { getNextTournamentLevel, getTournamentLevel, getTournamentStructure } from '../../engine/tournamentStructure';
import { IpadInfoSheet } from './IpadInfoSheet';
import { getHoldemStageLabel, getHoldemTurnChip } from '../holdemDisplayText';
import { translateHoldemText } from '../holdemText';

const TOP_HUD_COPY: Record<
  AppLanguage,
  {
    cashChip: string;
    tournamentChip: string;
    details: string;
    replay: string;
    next: string;
    menu: string;
    pot: string;
    betting: string;
    potLimit: string;
    structure: string;
    paid: string;
    paidTop: (count: number) => string;
    ante: string;
    blindUp: string;
    blindUpEvery: (count: number) => string;
    nextLevel: string;
    maxLevel: string;
    afterThisHand: string;
    afterHands: (count: number) => string;
    audio: string;
    motion: string;
    theme: string;
    restart: string;
  }
> = {
  'zh-CN': {
    cashChip: '现',
    tournamentChip: '赛',
    details: '信息',
    replay: '回放',
    next: '下手',
    menu: '菜单',
    pot: '池',
    betting: '下注规则',
    potLimit: '底池限注',
    structure: '结构',
    paid: '奖励圈',
    paidTop: (count) => `前 ${count} 名`,
    ante: '前注',
    blindUp: '升盲',
    blindUpEvery: (count) => `每 ${count} 手`,
    nextLevel: '下一级',
    maxLevel: '已到最高档',
    afterThisHand: '本手后',
    afterHands: (count) => `${count} 手后`,
    audio: '音效',
    motion: '动效',
    theme: '主题',
    restart: '重开',
  },
  en: {
    cashChip: 'Cash',
    tournamentChip: 'MTT',
    details: 'Info',
    replay: 'Replay',
    next: 'Next',
    menu: 'Menu',
    pot: 'Pot',
    betting: 'Betting',
    potLimit: 'Pot Limit',
    structure: 'Structure',
    paid: 'Paid',
    paidTop: (count) => `Top ${count}`,
    ante: 'Ante',
    blindUp: 'Blind Up',
    blindUpEvery: (count) => `Every ${count} hands`,
    nextLevel: 'Next Level',
    maxLevel: 'Max level',
    afterThisHand: 'After this hand',
    afterHands: (count) => `${count} hands`,
    audio: 'Audio',
    motion: 'Motion',
    theme: 'Theme',
    restart: 'Restart',
  },
  ja: {
    cashChip: '現金',
    tournamentChip: '大会',
    details: '情報',
    replay: 'リプレイ',
    next: '次へ',
    menu: 'メニュー',
    pot: 'ポット',
    betting: 'ベット',
    potLimit: 'ポット上限',
    structure: '構造',
    paid: '入賞',
    paidTop: (count) => `上位 ${count}`,
    ante: 'アンティ',
    blindUp: '昇盲',
    blindUpEvery: (count) => `${count} ハンドごと`,
    nextLevel: '次レベル',
    maxLevel: '最終レベル',
    afterThisHand: 'この手の後',
    afterHands: (count) => `あと ${count} 手`,
    audio: '音声',
    motion: '演出',
    theme: 'テーマ',
    restart: '再開',
  },
  fr: {
    cashChip: 'Cash',
    tournamentChip: 'Tour.',
    details: 'Infos',
    replay: 'Replay',
    next: 'Suite',
    menu: 'Menu',
    pot: 'Pot',
    betting: 'Mise',
    potLimit: 'Pot limit',
    structure: 'Structure',
    paid: 'Payés',
    paidTop: (count) => `Top ${count}`,
    ante: 'Ante',
    blindUp: 'Niveau',
    blindUpEvery: (count) => `Toutes les ${count} mains`,
    nextLevel: 'Niveau suivant',
    maxLevel: 'Niveau max',
    afterThisHand: 'Après cette main',
    afterHands: (count) => `Dans ${count} mains`,
    audio: 'Audio',
    motion: 'Anim.',
    theme: 'Thème',
    restart: 'Relancer',
  },
  de: {
    cashChip: 'Cash',
    tournamentChip: 'Turn.',
    details: 'Info',
    replay: 'Replay',
    next: 'Weiter',
    menu: 'Menü',
    pot: 'Pot',
    betting: 'Setzen',
    potLimit: 'Pot Limit',
    structure: 'Struktur',
    paid: 'ITM',
    paidTop: (count) => `Top ${count}`,
    ante: 'Ante',
    blindUp: 'Blind Up',
    blindUpEvery: (count) => `Alle ${count} Hände`,
    nextLevel: 'Nächstes Level',
    maxLevel: 'Max Level',
    afterThisHand: 'Nach dieser Hand',
    afterHands: (count) => `In ${count} Händen`,
    audio: 'Audio',
    motion: 'Motion',
    theme: 'Thema',
    restart: 'Neu',
  },
};

interface TopHudProps {
  language: AppLanguage;
  table: TableState;
  config: GameConfig;
  banner: string;
  paused: boolean;
  onPause: () => void;
  onNextHand: () => void;
  onRestart: () => void;
  onHistory: () => void;
  onMenu: () => void;
  onChangeAIDifficulty: (level: AIDifficulty) => void;
  audioLevel: AudioLevel;
  audioLabel: string;
  onCycleAudioLevel: () => void;
  motionLevel: MotionLevel;
  motionLabel: string;
  onCycleMotionLevel: () => void;
  tableThemeKey: TableThemeKey;
  tableThemeLabel: string;
  onCycleTableTheme: () => void;
}

export function TopHud({
  language,
  table,
  config,
  banner,
  paused,
  onPause,
  onNextHand,
  onRestart,
  onHistory,
  onMenu,
  onChangeAIDifficulty,
  audioLevel,
  audioLabel,
  onCycleAudioLevel,
  motionLevel,
  motionLabel,
  onCycleMotionLevel,
  tableThemeKey,
  tableThemeLabel,
  onCycleTableTheme,
}: TopHudProps) {
  const infoSheetId = useId();
  const isIpadLike = typeof document !== 'undefined' && document.documentElement.dataset.ipadLike === 'true';
  const [infoOpen, setInfoOpen] = useState(false);
  const copy = TOP_HUD_COPY[language];
  const modeLabel =
    config.mode === 'standard'
      ? t(language, 'mode.standard')
      : config.mode === 'shortDeck'
        ? t(language, 'mode.shortDeck')
        : config.mode === 'omaha'
          ? t(language, 'mode.omaha')
          : config.mode === 'plo'
            ? t(language, 'mode.plo')
            : t(language, 'mode.stud');
  const modeChipLabel = t(language, `modeShort.${config.mode}`);
  const sessionLabel = config.sessionMode === 'cash' ? t(language, 'common.cash') : `${t(language, 'common.tournament')} L${config.blindLevel}`;
  const sessionChipLabel = config.sessionMode === 'cash' ? copy.cashChip : `${copy.tournamentChip} L${config.blindLevel}`;
  const speedLabel = config.fastMode ? t(language, 'common.fastMode') : t(language, 'common.standardPace');
  const straddleLabel = config.straddleMode === 'utg' && config.sessionMode === 'cash' ? 'UTG Straddle' : t(language, 'common.off');
  const difficultyLabel =
    config.aiDifficulty === 'conservative'
      ? t(language, 'common.conservative')
      : config.aiDifficulty === 'aggressive'
        ? t(language, 'common.aggressive')
        : t(language, 'common.standard');
  const currentLevel = config.sessionMode === 'tournament' ? getTournamentLevel(config) : null;
  const nextLevel = config.sessionMode === 'tournament' ? getNextTournamentLevel(config) : null;
  const structureLabel = config.sessionMode === 'tournament' ? getTournamentStructure(config.tournamentStructureId ?? 'standard').label : '';
  const paidPlaces = config.sessionMode === 'tournament' ? getTournamentPaidPlaces(table.players.length) : 0;
  const ante = currentLevel?.ante ?? 0;
  const handsUntilBlindUp = (() => {
    if (config.sessionMode !== 'tournament') {
      return '';
    }
    const interval = Math.max(2, config.blindUpEveryHands);
    const remainder = table.handId % interval;
    if (remainder === 0) {
      return copy.afterThisHand;
    }
    return copy.afterHands(interval - remainder);
  })();
  const menuButtonLabel = isIpadLike ? t(language, 'common.menu') : copy.menu;
  const nextHandButtonLabel = copy.next;
  const replayButtonLabel = copy.replay;
  const detailsButtonLabel = copy.details;
  const pauseButtonLabel = paused ? t(language, 'common.resume') : t(language, 'common.pause');
  const showCompactHudActions = isIpadLike;
  const activeActorName = table.players.find((player) => player.id === table.activePlayerId)?.name;
  const hudPills = isIpadLike
    ? [
        { key: 'stage', className: 'hud-pill hud-stage', label: getHoldemStageLabel(language, table.stage, config.mode) },
        { key: 'session', className: 'hud-pill hud-session', label: sessionChipLabel },
        { key: 'mode', className: 'hud-pill hud-mode', label: modeChipLabel },
        { key: 'blinds', className: 'hud-pill hud-blinds', label: `${config.smallBlind}/${config.bigBlind}` },
        { key: 'pot', className: 'hud-pill hud-pot glowing', label: `${copy.pot} ${table.totalPot}` },
        { key: 'actor', className: 'hud-pill hud-actor', label: getHoldemTurnChip(language, activeActorName) },
      ]
    : [
        { key: 'mode', className: 'hud-pill hud-mode', label: modeChipLabel },
        { key: 'session', className: 'hud-pill hud-session', label: sessionChipLabel },
        { key: 'blinds', className: 'hud-pill hud-blinds', label: `${config.smallBlind}/${config.bigBlind}` },
        { key: 'ai', className: 'hud-pill hud-ai', label: `AI ${difficultyLabel}` },
        ...(config.sessionMode === 'tournament' ? [{ key: 'structure', className: 'hud-pill hud-structure', label: structureLabel }] : []),
        { key: 'pot', className: 'hud-pill hud-pot glowing', label: `${copy.pot} ${table.totalPot}` },
      ];

  return (
    <header className={`top-hud glass-panel ${isIpadLike ? 'ipad-top-hud' : ''}`}>
      <div className="hud-left">
        <h1>{t(language, 'top.title')}</h1>
        {!isIpadLike ? <p>{translateHoldemText(banner, language)}</p> : null}
      </div>

      <div className="hud-center">
        {hudPills.map((pill) => (
          <div key={pill.key} className={pill.className}>
            {pill.label}
          </div>
        ))}
      </div>

      <div className="hud-actions">
        <button
          className={`btn hud-more-info ${infoOpen ? 'primary' : ''}`}
          onClick={() => setInfoOpen((current) => !current)}
          aria-haspopup={isIpadLike ? 'dialog' : undefined}
          aria-expanded={isIpadLike ? infoOpen : undefined}
          aria-controls={isIpadLike ? infoSheetId : undefined}
        >
          {detailsButtonLabel}
        </button>
        <button className="btn hud-pause" onClick={onPause}>
          {pauseButtonLabel}
        </button>
        {!showCompactHudActions ? (
          <>
            <button className="btn hud-history" onClick={onHistory}>
              {replayButtonLabel}
            </button>
            <button className="btn hud-next-hand" onClick={onNextHand} disabled={table.stage !== 'complete'}>
              {nextHandButtonLabel}
            </button>
          </>
        ) : null}
        <button className="btn hud-menu" onClick={onMenu}>
          {menuButtonLabel}
        </button>
      </div>

      {infoOpen ? (
        <IpadInfoSheet
          sheetId={infoSheetId}
          title={t(language, 'top.detailTitle')}
          summary={`${modeLabel} · ${sessionLabel}`}
          onClose={() => setInfoOpen(false)}
          className="holdem-ipad-info-sheet"
        >
          <div className="ipad-info-grid">
            <div className="ipad-info-card">
              <span>{t(language, 'top.aiDifficulty')}</span>
              <strong>{difficultyLabel}</strong>
            </div>
            <div className="ipad-info-card">
              <span>{t(language, 'top.pace')}</span>
              <strong>{speedLabel}</strong>
            </div>
            <div className="ipad-info-card">
              <span>{t(language, 'top.straddle')}</span>
              <strong>{straddleLabel}</strong>
            </div>
            {config.mode === 'plo' ? (
              <div className="ipad-info-card">
                <span>{copy.betting}</span>
                <strong>{copy.potLimit}</strong>
              </div>
            ) : null}
            {config.sessionMode === 'tournament' ? (
              <>
                <div className="ipad-info-card">
                  <span>{copy.structure}</span>
                  <strong>{structureLabel}</strong>
                </div>
                <div className="ipad-info-card">
                  <span>{copy.paid}</span>
                  <strong>{copy.paidTop(paidPlaces)}</strong>
                </div>
                <div className="ipad-info-card">
                  <span>{copy.ante}</span>
                  <strong>{ante}</strong>
                </div>
                <div className="ipad-info-card">
                  <span>{copy.blindUp}</span>
                  <strong>{copy.blindUpEvery(config.blindUpEveryHands)}</strong>
                </div>
                <div className="ipad-info-card wide">
                  <span>{copy.nextLevel}</span>
                  <strong>
                    {handsUntilBlindUp} · {nextLevel ? `${nextLevel.smallBlind}/${nextLevel.bigBlind} · ${copy.ante} ${nextLevel.ante}` : copy.maxLevel}
                  </strong>
                </div>
              </>
            ) : (
              <div className="ipad-info-card wide">
                <span>{t(language, 'top.themeExperience')}</span>
                <strong>
                  {tableThemeLabel} · {copy.audio} {audioLabel} · {copy.motion} {motionLabel}
                </strong>
              </div>
            )}
          </div>
          <div className="hud-sheet-quick-actions">
            <button className="btn mini" type="button" onClick={onHistory}>
              {replayButtonLabel}
            </button>
            <button className="btn mini" type="button" onClick={onNextHand} disabled={table.stage !== 'complete'}>
              {nextHandButtonLabel}
            </button>
            <button className="btn mini" type="button" onClick={onRestart}>
              {copy.restart}
            </button>
          </div>
          <div className="hud-sheet-controls">
            <label className="hud-select-wrap hud-ai-select">
              {t(language, 'top.aiDifficulty')}
              <select value={config.aiDifficulty} onChange={(event) => onChangeAIDifficulty(event.target.value as AIDifficulty)}>
                <option value="conservative">{t(language, 'common.conservative')}</option>
                <option value="standard">{t(language, 'common.standard')}</option>
                <option value="aggressive">{t(language, 'common.aggressive')}</option>
              </select>
            </label>
            <div className="hud-sheet-actions">
              <button className={`btn mini ${audioLevel === 'off' ? '' : 'primary'}`} type="button" onClick={onCycleAudioLevel}>
                {copy.audio}: {audioLabel}
              </button>
              <button className={`btn mini ${motionLevel === 'reduced' ? '' : 'primary'}`} type="button" onClick={onCycleMotionLevel}>
                {copy.motion}: {motionLabel}
              </button>
              <button className={`btn mini ${tableThemeKey === 'neon-ocean' ? '' : 'primary'}`} type="button" onClick={onCycleTableTheme}>
                {copy.theme}: {tableThemeLabel}
              </button>
            </div>
          </div>
        </IpadInfoSheet>
      ) : null}
    </header>
  );
}
