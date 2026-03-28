import { type ReactNode } from 'react';
import { t, type AppLanguage } from '../../i18n';

interface GameHubMenuProps {
  language: AppLanguage;
  onOpenHoldem: () => void;
  onOpenDouDizhu: () => void;
  onOpenGuandan: () => void;
  onOpenShop: () => void;
  onResumeHoldem: (() => void) | null;
  hasResumeHoldem: boolean;
  availablePoints: number;
  totalEarnedPoints: number;
  menuTools?: ReactNode;
}

export function GameHubMenu({
  language,
  onOpenHoldem,
  onOpenDouDizhu,
  onOpenGuandan,
  onOpenShop,
  onResumeHoldem,
  hasResumeHoldem,
  availablePoints,
  totalEarnedPoints,
  menuTools,
}: GameHubMenuProps) {
  const isIpadLike = typeof document !== 'undefined' && document.documentElement.dataset.ipadLike === 'true';
  const modeCards = [
    {
      key: 'holdem',
      title: t(language, 'hub.holdem.title'),
      subtitle: t(language, 'hub.holdem.subtitle'),
      points: [t(language, 'hub.holdem.point1'), t(language, 'hub.holdem.point2'), t(language, 'hub.holdem.point3')],
    },
    {
      key: 'doudizhu',
      title: t(language, 'hub.doudizhu.title'),
      subtitle: t(language, 'hub.doudizhu.subtitle'),
      points: [t(language, 'hub.doudizhu.point1'), t(language, 'hub.doudizhu.point2'), t(language, 'hub.doudizhu.point3')],
    },
    {
      key: 'guandan',
      title: t(language, 'hub.guandan.title'),
      subtitle: t(language, 'hub.guandan.subtitle'),
      points: [t(language, 'hub.guandan.point1'), t(language, 'hub.guandan.point2'), t(language, 'hub.guandan.point3')],
    },
  ] as const;

  return (
    <main className="menu-screen game-hub-screen">
      <div className="menu-backdrop" />
      <section className="menu-card glass-panel game-hub-card">
        <div className="game-hub-head">
          <div>
            <h1>{t(language, 'hub.title')}</h1>
          </div>
          <div className="game-hub-actions">
            {menuTools}
            <button className="btn secondary" type="button" onClick={onOpenShop}>
              {t(language, 'common.shop')}
            </button>
            {hasResumeHoldem && onResumeHoldem ? (
              <button className="btn primary" type="button" onClick={onResumeHoldem}>
                {t(language, 'hub.resumeHoldem')}
              </button>
            ) : null}
          </div>
        </div>

        <section className={`game-hub-store-strip glass-panel ${isIpadLike ? 'touch-target' : ''}`}>
          {isIpadLike ? (
            <button className="game-hub-store-hitbox" type="button" onClick={onOpenShop} aria-label={t(language, 'common.shop')} />
          ) : null}
          <div className="game-hub-store-copy">
            <strong>{t(language, 'hub.storeTitle')}</strong>
            <span>{t(language, 'hub.storeBody')}</span>
          </div>
          <div className="game-hub-store-stats">
            <div>
              <span>{t(language, 'common.availableNow')}</span>
              <strong>{availablePoints}</strong>
            </div>
            <div>
              <span>{t(language, 'common.totalEarned')}</span>
              <strong>{totalEarnedPoints}</strong>
            </div>
          </div>
        </section>

        <div className="game-hub-grid">
          {modeCards.map((card) => {
            const action =
              card.key === 'holdem' ? onOpenHoldem : card.key === 'doudizhu' ? onOpenDouDizhu : onOpenGuandan;
            return (
              <article key={card.key} className={`game-hub-mode-card game-hub-mode-card-${card.key} ${isIpadLike ? 'touch-target' : ''}`}>
                {isIpadLike ? (
                  <button className="game-hub-mode-hitbox" type="button" onClick={action} aria-label={t(language, 'hub.enter', { title: card.title })} />
                ) : null}
                <div className="game-hub-mode-copy">
                  <strong>{card.title}</strong>
                  <span>{card.subtitle}</span>
                </div>
                <ul className="game-hub-mode-list">
                  {card.points.map((point) => (
                    <li key={`${card.key}-${point}`}>{point}</li>
                  ))}
                </ul>
                {isIpadLike ? (
                  <div className="btn primary big game-hub-mode-enter" aria-hidden="true">
                    {t(language, 'hub.enter', { title: card.title })}
                  </div>
                ) : (
                  <button className="btn primary big" type="button" onClick={action}>
                    {t(language, 'hub.enter', { title: card.title })}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
