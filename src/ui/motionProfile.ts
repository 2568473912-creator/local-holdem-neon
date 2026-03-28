import type { MotionLevel } from '../state/motionPreferences';

export interface UiMotionProfile {
  reducedMotion: boolean;
  softMotion: boolean;
  surfaceDuration: number;
  surfaceAccentDuration: number;
  surfaceEmphasisDuration: number;
  settlementFadeDuration: number;
  settlementPanelDuration: number;
  panelSlideOffset: number;
  championStaggerChildren: number;
  championDelayChildren: number;
  championBannerDuration: number;
  championChipDuration: number;
  championTrailDuration: number;
  championSparkDuration: number;
  replayWipeDuration: number;
  replayCardDuration: number;
  replayCardEnterOffset: number;
  replayCardExitOffset: number;
  replayCardEnterTilt: number;
  replayCardExitTilt: number;
  replayCardEnterBlur: number;
  replayCardExitBlur: number;
}

export function getUiMotionProfile(motionLevel: MotionLevel, ipadLike: boolean): UiMotionProfile {
  const reducedMotion = motionLevel === 'reduced';
  const softMotion = motionLevel === 'soft';

  if (!ipadLike) {
    return {
      reducedMotion,
      softMotion,
      surfaceDuration: reducedMotion ? 0.12 : softMotion ? 0.16 : 0.2,
      surfaceAccentDuration: reducedMotion ? 0.16 : softMotion ? 0.22 : 0.24,
      surfaceEmphasisDuration: reducedMotion ? 0.12 : softMotion ? 0.16 : 0.18,
      settlementFadeDuration: reducedMotion ? 0.08 : softMotion ? 0.12 : 0.14,
      settlementPanelDuration: reducedMotion ? 0.1 : softMotion ? 0.14 : 0.18,
      panelSlideOffset: reducedMotion ? 8 : softMotion ? 10 : 12,
      championStaggerChildren: 0.06,
      championDelayChildren: reducedMotion ? 0.01 : 0.02,
      championBannerDuration: reducedMotion ? 0.12 : softMotion ? 0.16 : 0.18,
      championChipDuration: reducedMotion ? 0.18 : softMotion ? 0.22 : 0.24,
      championTrailDuration: reducedMotion ? 0.12 : softMotion ? 0.16 : 0.2,
      championSparkDuration: reducedMotion ? 0.1 : softMotion ? 0.12 : 0.16,
      replayWipeDuration: reducedMotion ? 0.18 : softMotion ? 0.3 : 0.42,
      replayCardDuration: reducedMotion ? 0.18 : softMotion ? 0.22 : 0.32,
      replayCardEnterOffset: reducedMotion ? 10 : 30,
      replayCardExitOffset: reducedMotion ? -10 : -22,
      replayCardEnterTilt: reducedMotion ? -6 : -22,
      replayCardExitTilt: reducedMotion ? 6 : 16,
      replayCardEnterBlur: reducedMotion ? 2 : 6,
      replayCardExitBlur: reducedMotion ? 2 : 5,
    };
  }

  if (reducedMotion) {
    return {
      reducedMotion,
      softMotion,
      surfaceDuration: 0.12,
      surfaceAccentDuration: 0.16,
      surfaceEmphasisDuration: 0.12,
      settlementFadeDuration: 0.08,
      settlementPanelDuration: 0.1,
      panelSlideOffset: 4,
      championStaggerChildren: 0.05,
      championDelayChildren: 0.01,
      championBannerDuration: 0.12,
      championChipDuration: 0.18,
      championTrailDuration: 0.12,
      championSparkDuration: 0.1,
      replayWipeDuration: 0.18,
      replayCardDuration: 0.18,
      replayCardEnterOffset: 10,
      replayCardExitOffset: -10,
      replayCardEnterTilt: -6,
      replayCardExitTilt: 6,
      replayCardEnterBlur: 2,
      replayCardExitBlur: 2,
    };
  }

  if (softMotion) {
    return {
      reducedMotion,
      softMotion,
      surfaceDuration: 0.15,
      surfaceAccentDuration: 0.2,
      surfaceEmphasisDuration: 0.15,
      settlementFadeDuration: 0.1,
      settlementPanelDuration: 0.12,
      panelSlideOffset: 8,
      championStaggerChildren: 0.05,
      championDelayChildren: 0.02,
      championBannerDuration: 0.15,
      championChipDuration: 0.2,
      championTrailDuration: 0.15,
      championSparkDuration: 0.12,
      replayWipeDuration: 0.26,
      replayCardDuration: 0.22,
      replayCardEnterOffset: 18,
      replayCardExitOffset: -14,
      replayCardEnterTilt: -14,
      replayCardExitTilt: 10,
      replayCardEnterBlur: 4,
      replayCardExitBlur: 3,
    };
  }

  return {
    reducedMotion,
    softMotion,
    surfaceDuration: 0.18,
    surfaceAccentDuration: 0.22,
    surfaceEmphasisDuration: 0.17,
    settlementFadeDuration: 0.12,
    settlementPanelDuration: 0.15,
    panelSlideOffset: 10,
    championStaggerChildren: 0.05,
    championDelayChildren: 0.02,
    championBannerDuration: 0.17,
    championChipDuration: 0.22,
    championTrailDuration: 0.17,
    championSparkDuration: 0.14,
    replayWipeDuration: 0.34,
    replayCardDuration: 0.28,
    replayCardEnterOffset: 24,
    replayCardExitOffset: -18,
    replayCardEnterTilt: -18,
    replayCardExitTilt: 12,
    replayCardEnterBlur: 5,
    replayCardExitBlur: 4,
  };
}
