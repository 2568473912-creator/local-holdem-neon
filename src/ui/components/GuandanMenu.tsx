import { useMemo, useState } from 'react';
import { t, type AppLanguage } from '../../i18n';
import type { AIDifficulty } from '../../types/game';
import type { HumanPortraitKey } from '../../types/portrait';
import { getHumanPortraitOptions } from '../playerPortraits';
import { PlayerPortrait } from './PlayerPortrait';

interface GuandanMenuProps {
  language: AppLanguage;
  onStart: (config: { aiDifficulty: AIDifficulty; autoNextRound: boolean; language?: AppLanguage }) => void;
  onBackToHub: () => void;
  humanPortraitKey: HumanPortraitKey;
}

export function GuandanMenu({ language, onStart, onBackToHub, humanPortraitKey }: GuandanMenuProps) {
  const isIpadLike = typeof document !== 'undefined' && document.documentElement.dataset.ipadLike === 'true';
  const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>('standard');
  const [autoNextRound, setAutoNextRound] = useState(false);
  const [rulesExpanded, setRulesExpanded] = useState(() => !isIpadLike);
  const humanPortrait = useMemo(() => getHumanPortraitOptions(language).find((option) => option.key === humanPortraitKey), [humanPortraitKey, language]);
  const portraitKey = humanPortrait?.key as HumanPortraitKey | undefined;

  return (
    <main className="menu-screen gd-menu-screen">
      <div className="menu-backdrop" />
      <section className="menu-card glass-panel gd-menu-card">
        <div className="ddz-menu-switch">
          <div className="bj-mode-links">
            <button className="btn mini" type="button" onClick={onBackToHub}>
              {t(language, 'common.backToHub')}
            </button>
          </div>
        </div>

        <div className="ddz-menu-hero gd-menu-hero">
          <div>
            <h1>{t(language, 'guandan.menuTitle')}</h1>
            <p className="subtitle">{t(language, 'guandan.menuSubtitle')}</p>
          </div>
          {humanPortrait && (
            <div className="ddz-menu-portrait-preview">
              <PlayerPortrait player={{ id: 'P0', name: t(language, 'common.you'), isHuman: true, portraitKey, style: 'balanced' }} mood="focused" size="focus" variant="panel" />
            </div>
          )}
        </div>

        <div className="menu-grid ddz-menu-grid">
          <label>
            {t(language, 'guandan.aiDifficulty')}
            <select value={aiDifficulty} onChange={(event) => setAiDifficulty(event.target.value as AIDifficulty)}>
              <option value="conservative">{t(language, 'guandan.aiConservative')}</option>
              <option value="standard">{t(language, 'guandan.aiStandard')}</option>
              <option value="aggressive">{t(language, 'guandan.aiAggressive')}</option>
            </select>
          </label>

          <label>
            {t(language, 'guandan.pace')}
            <select value={autoNextRound ? 'auto' : 'manual'} onChange={(event) => setAutoNextRound(event.target.value === 'auto')}>
              <option value="manual">{t(language, 'common.manualNext')}</option>
              <option value="auto">{t(language, 'common.autoNext')}</option>
            </select>
          </label>
        </div>

        <section className="menu-preview-card gd-rules-card">
          <div className="menu-preview-head with-toggle">
            <div>
              <strong>{t(language, 'guandan.rules')}</strong>
              <span>{t(language, 'guandan.rulePlayers')}</span>
            </div>
            {isIpadLike ? (
              <button className="btn mini menu-inline-toggle" type="button" onClick={() => setRulesExpanded((value) => !value)}>
                {t(language, rulesExpanded ? 'common.collapse' : 'common.expand')}
              </button>
            ) : null}
          </div>
          {rulesExpanded ? (
            <div className="ddz-rules-grid">
              <div>
                <strong>{t(language, 'guandan.ruleDeskTitle')}</strong>
                <p>{t(language, 'guandan.ruleDeskBody')}</p>
              </div>
              <div>
                <strong>{t(language, 'guandan.rulePatternTitle')}</strong>
                <p>{t(language, 'guandan.rulePatternBody')}</p>
              </div>
              <div>
                <strong>{t(language, 'guandan.ruleLevelTitle')}</strong>
                <p>{t(language, 'guandan.ruleLevelBody')}</p>
              </div>
              <div>
                <strong>{t(language, 'guandan.ruleScopeTitle')}</strong>
                <p>{t(language, 'guandan.ruleScopeBody')}</p>
              </div>
            </div>
          ) : (
            <div className="menu-preview-pills" aria-label={t(language, 'guandan.rules')}>
              <span className="menu-preview-pill">{t(language, 'guandan.ruleDeskTitle')}</span>
              <span className="menu-preview-pill">{t(language, 'guandan.rulePatternTitle')}</span>
              <span className="menu-preview-pill">{t(language, 'guandan.ruleLevelTitle')}</span>
              <span className="menu-preview-pill">{t(language, 'guandan.ruleScopeTitle')}</span>
            </div>
          )}
        </section>

        <button className="btn primary big" type="button" onClick={() => onStart({ aiDifficulty, autoNextRound, language })}>
          {t(language, 'common.startGuandan')}
        </button>
      </section>
    </main>
  );
}
