import { useMemo, useState } from 'react';
import { t, type AppLanguage } from '../../i18n';
import type { AIDifficulty } from '../../types/game';
import type { HumanPortraitKey } from '../../types/portrait';
import { getHumanPortraitOptions } from '../playerPortraits';
import { PlayerPortrait } from './PlayerPortrait';

interface DouDizhuMenuProps {
  language: AppLanguage;
  onStart: (config: { aiDifficulty: AIDifficulty; autoNextRound: boolean; language?: AppLanguage }) => void;
  onBackToHub: () => void;
  humanPortraitKey: HumanPortraitKey;
}

export function DouDizhuMenu({ language, onStart, onBackToHub, humanPortraitKey }: DouDizhuMenuProps) {
  const isIpadLike = typeof document !== 'undefined' && document.documentElement.dataset.ipadLike === 'true';
  const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>('standard');
  const [autoNextRound, setAutoNextRound] = useState(false);
  const [rulesExpanded, setRulesExpanded] = useState(() => !isIpadLike);
  const humanPortrait = useMemo(() => getHumanPortraitOptions(language).find((option) => option.key === humanPortraitKey), [humanPortraitKey, language]);
  const portraitKey = humanPortrait?.key as HumanPortraitKey | undefined;

  return (
    <main className="menu-screen ddz-menu-screen">
      <div className="menu-backdrop" />
      <section className="menu-card glass-panel ddz-menu-card">
        <div className="ddz-menu-switch">
          <div className="bj-mode-links">
            <button className="btn mini" type="button" onClick={onBackToHub}>
              {t(language, 'common.backToHub')}
            </button>
          </div>
        </div>

        <div className="ddz-menu-hero">
          <div>
            <h1>{t(language, 'doudizhu.menuTitle')}</h1>
            <p className="subtitle">{t(language, 'doudizhu.menuSubtitle')}</p>
          </div>
          {humanPortrait && (
            <div className="ddz-menu-portrait-preview">
              <PlayerPortrait
                player={{ id: 'P0', name: t(language, 'common.you'), isHuman: true, portraitKey, style: 'balanced' }}
                mood="focused"
                size="focus"
                variant="panel"
              />
            </div>
          )}
        </div>

        <div className="menu-grid ddz-menu-grid">
          <label>
            {t(language, 'doudizhu.aiDifficulty')}
            <select value={aiDifficulty} onChange={(event) => setAiDifficulty(event.target.value as AIDifficulty)}>
              <option value="conservative">{t(language, 'doudizhu.aiConservative')}</option>
              <option value="standard">{t(language, 'doudizhu.aiStandard')}</option>
              <option value="aggressive">{t(language, 'doudizhu.aiAggressive')}</option>
            </select>
          </label>

          <label>
            {t(language, 'doudizhu.pace')}
            <select value={autoNextRound ? 'auto' : 'manual'} onChange={(event) => setAutoNextRound(event.target.value === 'auto')}>
              <option value="manual">{t(language, 'common.manualNext')}</option>
              <option value="auto">{t(language, 'common.autoNext')}</option>
            </select>
          </label>
        </div>

        <section className="menu-preview-card ddz-rules-card">
          <div className="menu-preview-head with-toggle">
            <div>
              <strong>{t(language, 'doudizhu.rules')}</strong>
              <span>{t(language, 'doudizhu.rulePlayers')}</span>
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
                <strong>{t(language, 'doudizhu.ruleBidTitle')}</strong>
                <p>{t(language, 'doudizhu.ruleBidBody')}</p>
              </div>
              <div>
                <strong>{t(language, 'doudizhu.rulePatternTitle')}</strong>
                <p>{t(language, 'doudizhu.rulePatternBody')}</p>
              </div>
              <div>
                <strong>{t(language, 'doudizhu.ruleMultiplierTitle')}</strong>
                <p>{t(language, 'doudizhu.ruleMultiplierBody')}</p>
              </div>
              <div>
                <strong>{t(language, 'doudizhu.ruleGoalTitle')}</strong>
                <p>{t(language, 'doudizhu.ruleGoalBody')}</p>
              </div>
            </div>
          ) : (
            <div className="menu-preview-pills" aria-label={t(language, 'doudizhu.rules')}>
              <span className="menu-preview-pill">{t(language, 'doudizhu.ruleBidTitle')}</span>
              <span className="menu-preview-pill">{t(language, 'doudizhu.rulePatternTitle')}</span>
              <span className="menu-preview-pill">{t(language, 'doudizhu.ruleMultiplierTitle')}</span>
              <span className="menu-preview-pill">{t(language, 'doudizhu.ruleGoalTitle')}</span>
            </div>
          )}
        </section>

        <button className="btn primary big" type="button" onClick={() => onStart({ aiDifficulty, autoNextRound, language })}>
          {t(language, 'common.startDouDizhu')}
        </button>
      </section>
    </main>
  );
}
