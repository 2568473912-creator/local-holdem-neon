export interface PlatformRuntimeState {
  isTouch: boolean;
  isIpadLike: boolean;
  isStandalone: boolean;
  isPortrait: boolean;
  ipadSize: 'regular' | 'roomy' | 'none';
}

declare global {
  interface Navigator {
    standalone?: boolean;
  }
}

function detectIpadLike(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return false;
  }

  const ua = navigator.userAgent ?? '';
  const platform = navigator.platform ?? '';
  const maxTouchPoints = navigator.maxTouchPoints ?? 0;
  const shortEdge = Math.min(window.screen.width, window.screen.height);
  const longEdge = Math.max(window.screen.width, window.screen.height);

  return (
    /iPad/i.test(ua) ||
    (platform === 'MacIntel' && maxTouchPoints > 1) ||
    (maxTouchPoints > 1 && shortEdge >= 768 && longEdge >= 1024)
  );
}

function detectIpadSize(isIpadLike: boolean): PlatformRuntimeState['ipadSize'] {
  if (!isIpadLike || typeof window === 'undefined') {
    return 'none';
  }

  const shortEdge = Math.min(window.screen.width, window.screen.height, window.innerWidth, window.innerHeight);
  const longEdge = Math.max(window.screen.width, window.screen.height, window.innerWidth, window.innerHeight);
  return shortEdge >= 1000 || longEdge >= 1300 ? 'roomy' : 'regular';
}

export function readPlatformRuntimeState(): PlatformRuntimeState {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      isTouch: false,
      isIpadLike: false,
      isStandalone: false,
      isPortrait: false,
      ipadSize: 'none',
    };
  }

  const isTouch = (navigator.maxTouchPoints ?? 0) > 0;
  const isStandalone = Boolean(window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone);
  const isPortrait = window.innerHeight > window.innerWidth;
  const isIpadLike = detectIpadLike();

  return {
    isTouch,
    isIpadLike,
    isStandalone,
    isPortrait,
    ipadSize: detectIpadSize(isIpadLike),
  };
}

function applyPlatformRuntimeState(state: PlatformRuntimeState) {
  if (typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  root.dataset.touchDevice = state.isTouch ? 'true' : 'false';
  root.dataset.ipadLike = state.isIpadLike ? 'true' : 'false';
  root.dataset.ipadSize = state.ipadSize;
  root.dataset.displayMode = state.isStandalone ? 'standalone' : 'browser';
  root.dataset.deviceOrientation = state.isPortrait ? 'portrait' : 'landscape';
  root.style.setProperty('--app-height', `${window.innerHeight}px`);
}

export function primePlatformRuntimeState(): PlatformRuntimeState {
  const state = readPlatformRuntimeState();
  applyPlatformRuntimeState(state);
  return state;
}

export function watchPlatformRuntimeState(onChange: (state: PlatformRuntimeState) => void): () => void {
  const update = () => {
    const next = readPlatformRuntimeState();
    applyPlatformRuntimeState(next);
    onChange(next);
  };

  update();
  window.addEventListener('resize', update);
  window.addEventListener('orientationchange', update);
  return () => {
    window.removeEventListener('resize', update);
    window.removeEventListener('orientationchange', update);
  };
}

export function registerAppServiceWorker() {
  if (!import.meta.env.PROD || typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((error) => {
      console.warn('service-worker register failed', error);
    });
  });
}
