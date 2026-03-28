import { Suspense, lazy, useEffect, useState } from 'react';
import { t } from '../../i18n';
import { useLanguage } from '../../i18n/languageContext';
import type { ReplaySessionsPanelProps } from './replaySessionsShared';

const ReplaySessionArchivePanel = lazy(() => import('./ReplaySessionArchivePanel').then((module) => ({ default: module.ReplaySessionArchivePanel })));
const ReplayCareerPanel = lazy(() => import('./ReplayCareerPanel').then((module) => ({ default: module.ReplayCareerPanel })));

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

function ReplaySubpanelLoader({ label }: { label: string }) {
  const language = useLanguage();
  return (
    <section className="glass-panel replay-subpanel-loader" role="status" aria-live="polite">
      <div className="screen-loader-ring" />
      <strong>{label}</strong>
      <span>{t(language, 'replay.preparingSessionResources')}</span>
    </section>
  );
}

function scheduleIdleLoad(callback: () => void): () => void {
  if (typeof window === 'undefined') {
    callback();
    return () => undefined;
  }

  let timeoutId: number | null = null;
  let idleCancel: (() => void) | null = null;
  const idleWindow = window as IdleWindow;
  timeoutId = window.setTimeout(() => {
    if (typeof idleWindow.requestIdleCallback === 'function') {
      const idleId = idleWindow.requestIdleCallback(callback, { timeout: 360 });
      idleCancel = () => {
        if (typeof idleWindow.cancelIdleCallback === 'function') {
          idleWindow.cancelIdleCallback(idleId);
        }
      };
      return;
    }
    callback();
  }, 220);

  return () => {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
    idleCancel?.();
  };
}

export function ReplaySessionsPanel(props: ReplaySessionsPanelProps) {
  const language = useLanguage();
  const [showCareerPanel, setShowCareerPanel] = useState(false);
  const { onReady, onArchiveReady, onCareerReady } = props;

  useEffect(() => {
    onReady?.();
  }, [onReady]);

  useEffect(() => {
    const cancel = scheduleIdleLoad(() => {
      setShowCareerPanel(true);
    });
    return cancel;
  }, []);

  return (
    <>
      <Suspense fallback={<ReplaySubpanelLoader label={t(language, 'replay.loadingSessionArchive')} />}>
        <ReplaySessionArchivePanel {...props} onReady={onArchiveReady} />
      </Suspense>

      {showCareerPanel ? (
        <Suspense fallback={<ReplaySubpanelLoader label={t(language, 'replay.loadingCareerCenter')} />}>
          <ReplayCareerPanel {...props} onReady={onCareerReady} />
        </Suspense>
      ) : (
        <section className="glass-panel replay-deferred-panel" aria-live="polite">
          <strong>{t(language, 'replay.localCareerCenter')}</strong>
          <span>{t(language, 'replay.careerCenterDeferred')}</span>
        </section>
      )}
    </>
  );
}
