import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { t, type AppLanguage } from '../../i18n';
import type { GameConfig } from '../../types/game';
import type { CareerProfile } from '../../types/profile';
import type { CardSkinKey } from '../../types/cardSkin';
import type { HumanPortraitKey } from '../../types/portrait';
import type { TableThemeKey } from '../../types/theme';
import { exportCareerProfile, getCareerModeBreakdown, parseCareerProfileImport } from '../../state/careerProfile';
import { getTournamentPrizeLines } from '../../engine/tournamentPrize';
import { getTournamentStructure } from '../../engine/tournamentStructure';
import type { PersistedSessionSummary } from '../../state/sessionPersistence';
import { getHumanPortraitOptions } from '../playerPortraits';
import { getCardSkinOptions } from '../cardSkins';
import { getTableThemeOptions } from '../tableThemes';

interface MainMenuProps {
  language: AppLanguage;
  onStart: (config: GameConfig) => void;
  onBackToHub: () => void;
  onResume: () => void;
  onClearResume: () => void;
  resumeMeta: PersistedSessionSummary | null;
  careerProfile: CareerProfile;
  onClearCareer: () => void;
  onImportCareer: (profile: CareerProfile, message?: string) => void;
  humanPortraitKey: HumanPortraitKey;
  portraitAvailablePoints: number;
  cardSkinKey: CardSkinKey;
  tableThemeKey: TableThemeKey;
}

const BLIND_PRESETS = [
  { sb: 10, bb: 20 },
  { sb: 20, bb: 40 },
  { sb: 25, bb: 50 },
  { sb: 50, bb: 100 },
  { sb: 100, bb: 200 },
];

function modeLabel(mode: GameConfig['mode'], language: AppLanguage): string {
  return t(language, `mode.${mode}`);
}

function stageLabel(stage: PersistedSessionSummary['stage'], language: AppLanguage): string {
  return t(language, `stage.${stage}`);
}

function sessionTypeLabel(entry: CareerProfile['recentSessions'][number], language: AppLanguage): string {
  if (entry.sessionMode === 'tournament') {
    return entry.finalRank
      ? t(language, 'main.sessionTournamentRanked', { rank: entry.finalRank, fieldSize: entry.fieldSize, points: entry.tournamentPointsEarned })
      : t(language, 'main.sessionTournamentPoints', { points: entry.tournamentPointsEarned });
  }
  return t(language, 'main.sessionCashProfit', { profit: `${entry.totalProfit >= 0 ? '+' : ''}${entry.totalProfit}` });
}

function modeLabelShort(mode: GameConfig['mode'], language: AppLanguage): string {
  return t(language, `modeShort.${mode}`);
}

export function MainMenu({
  language,
  onStart,
  onBackToHub,
  onResume,
  onClearResume,
  resumeMeta,
  careerProfile,
  onClearCareer,
  onImportCareer,
  humanPortraitKey,
  portraitAvailablePoints,
  cardSkinKey,
  tableThemeKey,
}: MainMenuProps) {
  const isIpadLike = typeof document !== 'undefined' && document.documentElement.dataset.ipadLike === 'true';
  const appearancePanelId = useId();
  const [mode, setMode] = useState<GameConfig['mode']>('standard');
  const [sessionMode, setSessionMode] = useState<GameConfig['sessionMode']>('cash');
  const [aiDifficulty, setAiDifficulty] = useState<GameConfig['aiDifficulty']>('standard');
  const [aiCount, setAiCount] = useState(5);
  const [startingChips, setStartingChips] = useState(5000);
  const [blindIdx, setBlindIdx] = useState(1);
  const [fastMode, setFastMode] = useState(false);
  const [blindUpEveryHands, setBlindUpEveryHands] = useState(5);
  const [straddleMode, setStraddleMode] = useState<GameConfig['straddleMode']>('off');
  const [tournamentStructureId, setTournamentStructureId] = useState<GameConfig['tournamentStructureId']>('standard');
  const [careerFeedback, setCareerFeedback] = useState<{ tone: 'neutral' | 'error'; message: string } | null>(null);
  const [careerModalOpen, setCareerModalOpen] = useState(false);
  const [tournamentModalOpen, setTournamentModalOpen] = useState(false);
  const [appearanceExpanded, setAppearanceExpanded] = useState(() => !isIpadLike);
  const careerImportRef = useRef<HTMLInputElement | null>(null);

  const blindInfo = BLIND_PRESETS[blindIdx];
  const tournamentStructure = getTournamentStructure(tournamentStructureId ?? 'standard');
  const tournamentPrizeLines = useMemo(() => getTournamentPrizeLines(aiCount + 1), [aiCount]);
  const tournamentLevelPreview = useMemo(() => tournamentStructure.levels.slice(0, 6), [tournamentStructure.levels]);
  const careerModeBreakdown = useMemo(() => getCareerModeBreakdown(careerProfile), [careerProfile]);
  const humanPortraitOptions = useMemo(() => getHumanPortraitOptions(language), [language]);
  const cardSkinOptions = useMemo(() => getCardSkinOptions(language), [language]);
  const tableThemeOptions = useMemo(() => getTableThemeOptions(language), [language]);
  const activeHumanPortrait = useMemo(
    () => humanPortraitOptions.find((option) => option.key === humanPortraitKey) ?? humanPortraitOptions[0],
    [humanPortraitKey, humanPortraitOptions],
  );
  const activeCardSkin = useMemo(
    () => cardSkinOptions.find((option) => option.key === cardSkinKey) ?? cardSkinOptions[0],
    [cardSkinKey, cardSkinOptions],
  );
  const activeTableTheme = useMemo(
    () => tableThemeOptions.find((option) => option.key === tableThemeKey) ?? tableThemeOptions[0],
    [tableThemeKey, tableThemeOptions],
  );
  const toggleAppearanceExpanded = () => {
    setAppearanceExpanded((value) => !value);
  };
  const handleAppearanceHeaderKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    toggleAppearanceExpanded();
  };
  const handleClearCareer = () => {
    if (careerProfile.totalSessions === 0) {
      return;
    }
    if (typeof window !== 'undefined' && !window.confirm(t(language, 'main.confirmClearCareer'))) {
      return;
    }
    onClearCareer();
    setCareerFeedback({
      tone: 'neutral',
      message: t(language, 'main.careerCleared'),
    });
  };

  const handleImportCareerClick = () => {
    careerImportRef.current?.click();
  };

  useEffect(() => {
    if (!careerModalOpen && !tournamentModalOpen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCareerModalOpen(false);
        setTournamentModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [careerModalOpen, tournamentModalOpen]);

  const handleImportCareerFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    const raw = await file.text();
    const parsed = parseCareerProfileImport(raw);
    if (!parsed.result) {
      setCareerFeedback({
        tone: 'error',
        message: parsed.error ?? t(language, 'main.importCareerFailed'),
      });
      return;
    }

    if (typeof window !== 'undefined' && !window.confirm(t(language, 'main.confirmImportCareerOverwrite'))) {
      return;
    }

    onImportCareer(parsed.result.profile, parsed.result.warning ?? t(language, 'main.careerImported'));
    setCareerFeedback({
      tone: parsed.result.warning ? 'error' : 'neutral',
      message: parsed.result.warning ?? t(language, 'main.importedFile', { fileName: file.name }),
    });
  };

  const submit = () => {
    onStart({
      mode,
      sessionMode,
      aiCount,
      startingChips,
      smallBlind: blindInfo.sb,
      bigBlind: blindInfo.bb,
      blindLevel: 1,
      blindUpEveryHands: Math.max(2, blindUpEveryHands),
      fastMode,
      aiDifficulty,
      straddleMode: sessionMode === 'cash' && mode !== 'stud' ? straddleMode : 'off',
      tournamentStructureId,
      humanPortraitKey,
      language,
    });
  };

  return (
    <main className="menu-screen">
      <div className="menu-backdrop" />
      <section className="menu-card glass-panel holdem-menu-card">
        <input ref={careerImportRef} className="visually-hidden-input" type="file" accept=".json,application/json" onChange={handleImportCareerFile} />
        <div className="submenu-head menu-toolbar-row">
          <button className="btn mini" type="button" onClick={onBackToHub}>
            {t(language, 'common.backToHub')}
          </button>
          <div className="menu-toolbar-actions">
            <button className="btn mini" type="button" onClick={() => setCareerModalOpen(true)}>
              {t(language, 'main.viewCareer')}
            </button>
            {sessionMode === 'tournament' ? (
              <button className="btn mini" type="button" onClick={() => setTournamentModalOpen(true)}>
                {t(language, 'main.viewTournament')}
              </button>
            ) : null}
          </div>
        </div>
        <div className="menu-title-row">
          <div className="menu-title-copy">
            <h1>{t(language, 'main.title')}</h1>
            <span className="menu-title-kicker">{t(language, 'main.subtitle')}</span>
          </div>
        </div>

        {resumeMeta && (
          <div className="menu-resume-card">
            <div className="menu-resume-head">
              <strong>{t(language, 'main.resumeTitle')}</strong>
              <span>{resumeMeta.sessionOver ? t(language, 'main.resumeClosed') : t(language, 'main.resumeReady')}</span>
            </div>
            <div className="menu-resume-grid">
              <div>
                <span>{t(language, 'main.resumeMode')}</span>
                <strong>{modeLabel(resumeMeta.mode, language)}</strong>
              </div>
              <div>
                <span>{t(language, 'main.resumeHand')}</span>
                <strong>
                  {t(language, 'main.resumeHandStage', { handId: resumeMeta.handId, stage: stageLabel(resumeMeta.stage, language) })}
                </strong>
              </div>
              <div>
                <span>{t(language, 'main.resumeBlinds')}</span>
                <strong>
                  {resumeMeta.smallBlind}/{resumeMeta.bigBlind} · L{resumeMeta.blindLevel}
                </strong>
              </div>
              <div>
                <span>{t(language, 'main.resumeChips')}</span>
                <strong>{resumeMeta.heroStack}</strong>
              </div>
              <div>
                <span>{t(language, 'main.resumeAlive')}</span>
                <strong>
                  {resumeMeta.aliveCount}/{resumeMeta.playerCount}
                </strong>
              </div>
              <div>
                <span>{t(language, 'main.resumeHands')}</span>
                <strong>{resumeMeta.totalHands}</strong>
              </div>
            </div>
            <div className="menu-resume-actions">
              <button className="btn primary" type="button" onClick={onResume}>
                {t(language, 'main.resume')}
              </button>
              <button className="btn" type="button" onClick={onClearResume}>
                {t(language, 'main.clearSave')}
              </button>
            </div>
          </div>
        )}

        <div className="menu-grid">
          <label>
            {t(language, 'main.mode')}
            <select value={mode} onChange={(event) => setMode(event.target.value as GameConfig['mode'])}>
              <option value="standard">{t(language, 'mode.standard')}</option>
              <option value="shortDeck">{t(language, 'mode.shortDeck')}</option>
              <option value="omaha">{t(language, 'mode.omahaLong')}</option>
              <option value="plo">{t(language, 'mode.ploLong')}</option>
              <option value="stud">{t(language, 'mode.studLong')}</option>
            </select>
          </label>

          <label>
            {t(language, 'main.sessionMode')}
            <select value={sessionMode} onChange={(event) => setSessionMode(event.target.value as GameConfig['sessionMode'])}>
              <option value="cash">{t(language, 'main.sessionCash')}</option>
              <option value="tournament">{t(language, 'main.sessionTournament')}</option>
            </select>
          </label>

          <label>
            {t(language, 'main.aiDifficulty')}
            <select value={aiDifficulty} onChange={(event) => setAiDifficulty(event.target.value as GameConfig['aiDifficulty'])}>
              <option value="conservative">{t(language, 'main.aiConservative')}</option>
              <option value="standard">{t(language, 'main.aiStandard')}</option>
              <option value="aggressive">{t(language, 'main.aiAggressive')}</option>
            </select>
          </label>

          <label>
            {t(language, 'main.aiCount')}
            <input
              type="range"
              min={1}
              max={7}
              value={aiCount}
              onChange={(event) => setAiCount(Number(event.target.value))}
            />
            <strong>{aiCount}</strong>
          </label>

          <label>
            {t(language, 'main.startingChips')}
            <input
              type="number"
              min={500}
              step={100}
              value={startingChips}
              onChange={(event) => setStartingChips(Math.max(500, Number(event.target.value) || 500))}
            />
          </label>

          <label>
            {t(language, 'main.blindPreset')}
            <select value={blindIdx} disabled={sessionMode === 'tournament'} onChange={(event) => setBlindIdx(Number(event.target.value))}>
              {BLIND_PRESETS.map((blind, idx) => (
                <option key={`${blind.sb}-${blind.bb}`} value={idx}>
                  {blind.sb}/{blind.bb}
                </option>
              ))}
            </select>
          </label>

          <label>
            {t(language, 'main.tournamentStructure')}
            <select
              value={tournamentStructureId}
              disabled={sessionMode !== 'tournament'}
              onChange={(event) => setTournamentStructureId(event.target.value as GameConfig['tournamentStructureId'])}
            >
              <option value="standard">{t(language, 'main.structureStandard')}</option>
              <option value="turbo">{t(language, 'main.structureTurbo')}</option>
              <option value="deep">{t(language, 'main.structureDeep')}</option>
            </select>
          </label>

          <label>
            {t(language, 'main.fastMode')}
            <select value={fastMode ? 'fast' : 'normal'} onChange={(event) => setFastMode(event.target.value === 'fast')}>
              <option value="normal">{t(language, 'main.paceStandard')}</option>
              <option value="fast">{t(language, 'main.paceFast')}</option>
            </select>
          </label>

          <label>
            {t(language, 'main.straddle')}
            <select
              value={sessionMode === 'cash' && mode !== 'stud' ? straddleMode : 'off'}
              disabled={sessionMode !== 'cash' || mode === 'stud'}
              onChange={(event) => setStraddleMode(event.target.value as GameConfig['straddleMode'])}
            >
              <option value="off">{t(language, 'main.straddleOffOption')}</option>
              <option value="utg">{t(language, 'main.straddleUtgOption')}</option>
            </select>
          </label>

          <label>
            {t(language, 'main.blindUpInterval')}
            <input
              type="range"
              min={2}
              max={15}
              value={blindUpEveryHands}
              disabled={sessionMode !== 'tournament'}
              onChange={(event) => setBlindUpEveryHands(Number(event.target.value))}
            />
            <strong>
              {blindUpEveryHands} {t(language, 'common.handsUnit')}
            </strong>
          </label>
        </div>

        <section className="menu-preview-card menu-shop-ribbon">
          <div
            className={`menu-preview-head with-toggle ${isIpadLike ? 'touch-toggle' : ''}`}
            onClick={isIpadLike ? toggleAppearanceExpanded : undefined}
            onKeyDown={isIpadLike ? handleAppearanceHeaderKeyDown : undefined}
            role={isIpadLike ? 'button' : undefined}
            tabIndex={isIpadLike ? 0 : undefined}
            aria-expanded={isIpadLike ? appearanceExpanded : undefined}
            aria-controls={isIpadLike ? appearancePanelId : undefined}
          >
            <div>
              <strong>{t(language, 'main.appearanceAssets')}</strong>
              {appearanceExpanded ? (
                <span>
                  {t(language, 'main.appearanceCurrent', { portrait: activeHumanPortrait.title, cardSkin: activeCardSkin.title, theme: activeTableTheme.title })}
                </span>
              ) : null}
            </div>
            {isIpadLike ? (
              <span className="btn mini menu-inline-toggle" aria-hidden="true">
                {t(language, appearanceExpanded ? 'common.collapse' : 'common.expand')}
              </span>
            ) : null}
          </div>
          {appearanceExpanded ? (
            <div className="menu-store-summary" id={appearancePanelId}>
              <div>
                <span>{t(language, 'common.availableNow')}</span>
                <strong>{portraitAvailablePoints}</strong>
              </div>
              <div>
                <span>{t(language, 'common.totalEarned')}</span>
                <strong>{careerProfile.tournamentPointsEarned}</strong>
              </div>
            </div>
          ) : (
            <div className="menu-preview-pills" aria-label={t(language, 'main.appearanceAssets')}>
              <span className="menu-preview-pill">{activeHumanPortrait.title}</span>
              <span className="menu-preview-pill">{activeCardSkin.title}</span>
              <span className="menu-preview-pill">{activeTableTheme.title}</span>
              <span className="menu-preview-pill strong">
                {t(language, 'common.availableNow')} {portraitAvailablePoints}
              </span>
            </div>
          )}
        </section>

        <button className="btn primary big menu-start-button" onClick={submit}>
          {t(language, 'common.startGame')}
        </button>
      </section>

      {careerModalOpen ? (
        <div className="menu-modal-backdrop" role="presentation" onClick={() => setCareerModalOpen(false)}>
          <section
            className="menu-modal-sheet glass-panel"
            role="dialog"
            aria-modal="true"
            aria-label={t(language, 'main.careerTitle')}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="menu-modal-head">
              <div>
                <strong>{t(language, 'main.careerTitle')}</strong>
                <span>{t(language, 'main.completedSessions', { count: careerProfile.totalSessions })}</span>
              </div>
              <div className="menu-modal-actions">
                <button className="btn mini" type="button" onClick={handleImportCareerClick}>
                  {t(language, 'main.careerImport')}
                </button>
                <button className="btn mini" type="button" onClick={() => exportCareerProfile(careerProfile)} disabled={careerProfile.totalSessions === 0}>
                  {t(language, 'main.careerExport')}
                </button>
                <button className="btn mini" type="button" onClick={handleClearCareer} disabled={careerProfile.totalSessions === 0}>
                  {t(language, 'main.careerClear')}
                </button>
                <button className="btn mini" type="button" onClick={() => setCareerModalOpen(false)}>
                  {t(language, 'common.close')}
                </button>
              </div>
            </div>
            {careerFeedback && <div className={`career-feedback ${careerFeedback.tone}`}>{careerFeedback.message}</div>}
            <div className="menu-career-grid compact">
              <div>
                <span>{t(language, 'main.totalSessions')}</span>
                <strong>{careerProfile.totalSessions}</strong>
              </div>
              <div>
                <span>{t(language, 'main.totalHands')}</span>
                <strong>{careerProfile.totalHands}</strong>
              </div>
              <div>
                <span>{t(language, 'main.totalProfit')}</span>
                <strong className={careerProfile.totalProfit >= 0 ? 'up' : 'down'}>
                  {careerProfile.totalProfit >= 0 ? '+' : ''}
                  {careerProfile.totalProfit}
                </strong>
              </div>
              <div>
                <span>{t(language, 'main.titles')}</span>
                <strong>{careerProfile.tournamentTitles}</strong>
              </div>
              <div>
                <span>{t(language, 'main.tournamentPoints')}</span>
                <strong>{portraitAvailablePoints}</strong>
              </div>
              <div>
                <span>{t(language, 'main.itm')}</span>
                <strong>{careerProfile.itmFinishes}</strong>
              </div>
              <div>
                <span>{t(language, 'main.bestFinish')}</span>
                <strong>{careerProfile.bestFinish ? `#${careerProfile.bestFinish}` : '-'}</strong>
              </div>
            </div>
            <div className="menu-modal-grid">
              <div className="menu-career-breakdown">
                <div className="menu-career-subhead">
                  <strong>{t(language, 'main.breakdownTitle')}</strong>
                  <span>{t(language, 'main.breakdownSubtitle')}</span>
                </div>
                <div className="menu-career-mode-grid">
                  {careerModeBreakdown.map((entry) => (
                    <div key={`mode-${entry.mode}`} className="menu-career-mode-card">
                      <span>{modeLabel(entry.mode, language)}</span>
                      <strong>{t(language, 'main.sessionCountValue', { count: entry.sessions })}</strong>
                      <em className={entry.profit >= 0 ? 'up' : 'down'}>
                        {entry.profit >= 0 ? '+' : ''}
                        {entry.profit}
                      </em>
                    </div>
                  ))}
                </div>
              </div>
              <div className="menu-career-recent">
                <div className="menu-career-subhead">
                  <strong>{t(language, 'main.recentResults')}</strong>
                  <span>{t(language, 'main.recentResultsSubtitle')}</span>
                </div>
                {careerProfile.recentSessions.length === 0 ? (
                  <p>{t(language, 'main.noCompletedSessions')}</p>
                ) : (
                  <ul>
                    {careerProfile.recentSessions.slice(0, 6).map((entry) => (
                      <li key={entry.sessionId}>
                        <div>
                          <span>{sessionTypeLabel(entry, language)}</span>
                          <strong>{modeLabelShort(entry.mode, language)}</strong>
                        </div>
                        <em className={entry.totalProfit >= 0 ? 'up' : 'down'}>
                          {entry.totalProfit >= 0 ? '+' : ''}
                          {entry.totalProfit}
                        </em>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {tournamentModalOpen && sessionMode === 'tournament' ? (
        <div className="menu-modal-backdrop" role="presentation" onClick={() => setTournamentModalOpen(false)}>
          <section
            className="menu-modal-sheet glass-panel tournament-modal-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={t(language, 'main.viewTournament')}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="menu-modal-head">
              <div>
                <strong>{t(language, 'main.viewTournament')}</strong>
                <span>{t(language, 'main.blindPreviewMeta', { label: tournamentStructure.label, hands: blindUpEveryHands })}</span>
              </div>
              <div className="menu-modal-actions">
                <button className="btn mini" type="button" onClick={() => setTournamentModalOpen(false)}>
                  {t(language, 'common.close')}
                </button>
              </div>
            </div>
            <div className="menu-modal-grid tournament">
              <div className="menu-preview-card">
                <div className="menu-preview-head">
                  <strong>{t(language, 'main.prizeStructure')}</strong>
                  <span>{t(language, 'main.prizeStructureMeta', { players: aiCount + 1, count: tournamentPrizeLines.length })}</span>
                </div>
                <div className="menu-prize-grid">
                  {tournamentPrizeLines.map((line) => (
                    <div key={`prize-${line.place}`} className="menu-prize-card">
                      <span>{line.label}</span>
                      <strong>{line.percentage}%</strong>
                      <em>{t(language, 'main.buyInMultiple', { count: line.buyInMultiplier })}</em>
                    </div>
                  ))}
                </div>
              </div>
              <div className="menu-preview-card">
                <div className="menu-preview-head">
                  <strong>{t(language, 'main.blindPreview')}</strong>
                  <span>{t(language, 'main.blindPreviewMeta', { label: tournamentStructure.label, hands: blindUpEveryHands })}</span>
                </div>
                <div className="menu-level-grid">
                  {tournamentLevelPreview.map((level) => (
                    <div key={`preview-level-${level.level}`} className={`menu-level-card ${level.level === 1 ? 'active' : ''}`}>
                      <span>L{level.level}</span>
                      <strong>
                        {level.smallBlind}/{level.bigBlind}
                      </strong>
                      <em>{t(language, 'main.anteValue', { ante: level.ante })}</em>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
