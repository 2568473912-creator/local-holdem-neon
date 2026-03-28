import { describe, expect, it } from 'vitest';
import { getUiMotionProfile } from '../src/ui/motionProfile';

describe('getUiMotionProfile', () => {
  it('keeps iPad full motion smoother and tighter than desktop full motion', () => {
    const desktopProfile = getUiMotionProfile('full', false);
    const ipadProfile = getUiMotionProfile('full', true);

    expect(ipadProfile.surfaceDuration).toBeLessThan(desktopProfile.surfaceDuration);
    expect(ipadProfile.panelSlideOffset).toBeLessThan(desktopProfile.panelSlideOffset);
    expect(ipadProfile.replayCardEnterOffset).toBeLessThan(desktopProfile.replayCardEnterOffset);
  });

  it('shrinks iPad motion when reduced motion is active', () => {
    const fullProfile = getUiMotionProfile('full', true);
    const reducedProfile = getUiMotionProfile('reduced', true);

    expect(reducedProfile.reducedMotion).toBe(true);
    expect(reducedProfile.surfaceDuration).toBeLessThan(fullProfile.surfaceDuration);
    expect(reducedProfile.panelSlideOffset).toBeLessThan(fullProfile.panelSlideOffset);
    expect(reducedProfile.replayCardEnterBlur).toBeLessThan(fullProfile.replayCardEnterBlur);
  });
});
