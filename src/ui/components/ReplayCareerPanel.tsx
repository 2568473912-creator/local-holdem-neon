import { useEffect, useState } from 'react';
import { t } from '../../i18n';
import { useLanguage } from '../../i18n/languageContext';
import { formatCareerEntry, modeLabel } from './replayCenterShared';
import type { ReplayCareerPanelProps } from './replaySessionsShared';

type CareerSectionKey = 'modes' | 'formats' | 'difficulty' | 'recent';

export function ReplayCareerPanel({
  careerImportRef,
  careerProfile,
  careerModeBreakdown,
  recentDifficultyBreakdown,
  careerFeedback,
  onCareerImportFileChange,
  onImportCareerClick,
  onExportCareer,
  onClearCareer,
  onReady,
}: ReplayCareerPanelProps) {
  const language = useLanguage();
  const isIpadLike = typeof document !== 'undefined' && document.documentElement.dataset.ipadLike === 'true';
  const [showExtendedSections, setShowExtendedSections] = useState(() => !isIpadLike);
  const [activeSection, setActiveSection] = useState<CareerSectionKey>(() => (careerProfile.recentSessions.length > 0 ? 'recent' : 'modes'));
  const showSectionedIpadView = isIpadLike && showExtendedSections;
  const resolvedActiveSection =
    activeSection === 'recent' && careerProfile.recentSessions.length === 0 ? 'modes' : activeSection;

  useEffect(() => {
    onReady?.();
  }, [onReady]);

  const sectionTabs: Array<{ key: CareerSectionKey; label: string }> = [
    { key: 'modes', label: t(language, 'replay.careerTabModes') },
    { key: 'formats', label: t(language, 'replay.careerTabFormats') },
    { key: 'difficulty', label: t(language, 'replay.careerTabDifficulty') },
    { key: 'recent', label: t(language, 'replay.careerTabRecent') },
  ];

  const modeBreakdownSection = (
    <div className="career-center-breakdown">
      <div className="career-center-subhead">
        <strong>{t(language, 'replay.breakdownByMode')}</strong>
        <span>{t(language, 'replay.sessionsHandsProfit')}</span>
      </div>
      <div className="career-center-mode-grid">
        {careerModeBreakdown.map((entry) => (
          <div key={`career-mode-${entry.mode}`} className="career-center-mode-card">
            <span>{modeLabel(entry.mode, language)}</span>
            <strong>{t(language, 'replay.sessionCountValue', { count: entry.sessions })}</strong>
            <em>{t(language, 'replay.handCountValue', { count: entry.hands })}</em>
            <b className={entry.profit >= 0 ? 'up' : 'down'}>
              {entry.profit >= 0 ? '+' : ''}
              {entry.profit}
            </b>
          </div>
        ))}
      </div>
    </div>
  );

  const sessionDistributionSection = (
    <div className="career-center-split-card">
      <div className="career-center-subhead">
        <strong>{t(language, 'replay.sessionDistribution')}</strong>
        <span>{t(language, 'replay.cashTournamentSplit')}</span>
      </div>
      <div className="career-mini-grid">
        <div>
          <span>{t(language, 'common.cash')}</span>
          <strong>{t(language, 'replay.sessionCountValue', { count: careerProfile.cashSessions })}</strong>
        </div>
        <div>
          <span>{t(language, 'common.tournament')}</span>
          <strong>{t(language, 'replay.sessionCountValue', { count: careerProfile.tournamentSessions })}</strong>
        </div>
        <div>
          <span>{t(language, 'replay.titleRate')}</span>
          <strong>{careerProfile.tournamentSessions > 0 ? `${Math.round((careerProfile.tournamentTitles / careerProfile.tournamentSessions) * 100)}%` : '-'}</strong>
        </div>
        <div>
          <span>{t(language, 'replay.itmRate')}</span>
          <strong>{careerProfile.tournamentSessions > 0 ? `${Math.round((careerProfile.itmFinishes / careerProfile.tournamentSessions) * 100)}%` : '-'}</strong>
        </div>
      </div>
    </div>
  );

  const recentDifficultySection = (
    <div className="career-center-split-card">
      <div className="career-center-subhead">
        <strong>{t(language, 'replay.recentDifficultyBreakdown')}</strong>
        <span>{t(language, 'replay.recentSessionCount', { count: careerProfile.recentSessions.length })}</span>
      </div>
      <div className="career-mini-grid">
        <div>
          <span>{t(language, 'replay.conservativeAi')}</span>
          <strong>{recentDifficultyBreakdown.conservative}</strong>
        </div>
        <div>
          <span>{t(language, 'replay.standardAi')}</span>
          <strong>{recentDifficultyBreakdown.standard}</strong>
        </div>
        <div>
          <span>{t(language, 'replay.aggressiveAi')}</span>
          <strong>{recentDifficultyBreakdown.aggressive}</strong>
        </div>
        <div>
          <span>{t(language, 'replay.sampleSource')}</span>
          <strong>{careerProfile.recentSessions.length > 0 ? t(language, 'replay.recentSessions') : '-'}</strong>
        </div>
      </div>
    </div>
  );

  const recentSessionsSection = (
    <div className="career-center-recent">
      <div className="career-center-subhead">
        <strong>{t(language, 'replay.recentCompletedSessions')}</strong>
        <span>{t(language, 'replay.recentEight')}</span>
      </div>
      {careerProfile.recentSessions.length === 0 ? (
        <div className="empty">{t(language, 'replay.noCompletedSessions')}</div>
      ) : (
        <ul>
          {careerProfile.recentSessions.slice(0, 8).map((entry) => (
            <li key={entry.sessionId}>
              <div>
                <strong>{entry.sessionMode === 'tournament' ? t(language, 'common.tournament') : t(language, 'common.cash')}</strong>
                <span>
                  {modeLabel(entry.mode, language)} · {formatCareerEntry(entry, language)}
                </span>
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
  );

  const activeSectionContent =
    resolvedActiveSection === 'modes'
      ? modeBreakdownSection
      : resolvedActiveSection === 'formats'
        ? sessionDistributionSection
        : resolvedActiveSection === 'difficulty'
          ? recentDifficultySection
          : recentSessionsSection;

  return (
    <section className={`career-center glass-panel ${showExtendedSections ? 'expanded' : 'collapsed'}`}>
      <input ref={careerImportRef} className="visually-hidden-input" type="file" accept=".json,application/json" onChange={onCareerImportFileChange} />
      <div className="career-center-head">
        <h3>{t(language, 'replay.localCareerCenter')}</h3>
        <div className="career-center-actions">
          <span>{t(language, 'replay.crossSessionPersistence')}</span>
          <button className="btn mini" type="button" onClick={onImportCareerClick}>
            {t(language, 'replay.importCareer')}
          </button>
          <button className="btn mini" type="button" onClick={onExportCareer} disabled={careerProfile.totalSessions === 0}>
            {t(language, 'replay.exportCareer')}
          </button>
          <button className="btn mini" type="button" onClick={onClearCareer} disabled={careerProfile.totalSessions === 0}>
            {t(language, 'replay.clearCareer')}
          </button>
          {isIpadLike && (
            <button className="btn mini ghost section-inline-toggle" type="button" onClick={() => setShowExtendedSections((value) => !value)}>
              {t(language, showExtendedSections ? 'common.collapse' : 'common.expand')}
            </button>
          )}
        </div>
      </div>
      {careerFeedback && <div className={`career-feedback ${careerFeedback.tone}`}>{careerFeedback.message}</div>}
      <div className="career-center-grid">
        <div>
          <span>{t(language, 'replay.completedSessions')}</span>
          <strong>{careerProfile.totalSessions}</strong>
        </div>
        <div>
          <span>{t(language, 'common.cash')}</span>
          <strong>{careerProfile.cashSessions}</strong>
        </div>
        <div>
          <span>{t(language, 'common.tournament')}</span>
          <strong>{careerProfile.tournamentSessions}</strong>
        </div>
        <div>
          <span>{t(language, 'replay.tournamentPoints')}</span>
          <strong>{careerProfile.tournamentPointsEarned}</strong>
        </div>
        <div>
          <span>{t(language, 'replay.titles')}</span>
          <strong>{careerProfile.tournamentTitles}</strong>
        </div>
        <div>
          <span>{t(language, 'replay.itmFinishes')}</span>
          <strong>{careerProfile.itmFinishes}</strong>
        </div>
        <div>
          <span>{t(language, 'replay.averageFinish')}</span>
          <strong>{careerProfile.averageFinish ? careerProfile.averageFinish : '-'}</strong>
        </div>
        <div>
          <span>{t(language, 'replay.bestFinish')}</span>
          <strong>{careerProfile.bestFinish ? `#${careerProfile.bestFinish}` : '-'}</strong>
        </div>
        <div>
          <span>{t(language, 'replay.bestSessionWin')}</span>
          <strong className="up">+{careerProfile.biggestSessionWin}</strong>
        </div>
        <div>
          <span>{t(language, 'replay.worstSessionLoss')}</span>
          <strong className="down">{careerProfile.biggestSessionLoss}</strong>
        </div>
      </div>
      <div className={`career-center-extended ${showSectionedIpadView ? 'sectioned' : ''}`}>
        {showSectionedIpadView ? (
          <>
            <div className="career-center-panel-switch" role="tablist" aria-label={t(language, 'replay.localCareerCenter')}>
              {sectionTabs.map((section) => (
                <button
                  key={section.key}
                  className={`career-center-panel-button ${resolvedActiveSection === section.key ? 'active' : ''}`}
                  type="button"
                  role="tab"
                  aria-selected={resolvedActiveSection === section.key}
                  onClick={() => setActiveSection(section.key)}
                >
                  {section.label}
                </button>
              ))}
            </div>
            <div
              className="career-center-section-shell"
              role="tabpanel"
              aria-label={sectionTabs.find((section) => section.key === resolvedActiveSection)?.label}
            >
              {activeSectionContent}
            </div>
          </>
        ) : (
          <>
            {modeBreakdownSection}
            <div className="career-center-split-grid">
              {sessionDistributionSection}
              {recentDifficultySection}
            </div>
            {recentSessionsSection}
          </>
        )}
      </div>
    </section>
  );
}
