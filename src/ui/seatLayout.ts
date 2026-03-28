export interface SeatPosition {
  x: number;
  y: number;
  scale: number;
}

export type SeatLayoutMode = 'table' | 'focus' | 'replay';
export type SeatDensity = 'roomy' | 'balanced' | 'compact' | 'dense';

interface SeatLayoutOptions {
  mode?: SeatLayoutMode;
  profile?: 'default' | 'ipad';
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

const MANUAL_FOCUS_LAYOUTS: Partial<Record<number, SeatPosition[]>> = {
  8: [
    { x: 50, y: 87.5, scale: 0.88 },
    { x: 24.8, y: 87.5, scale: 0.84 },
    { x: 10.4, y: 63.2, scale: 0.82 },
    { x: 24.2, y: 33.0, scale: 0.82 },
    { x: 40.8, y: 35.0, scale: 0.82 },
    { x: 59.2, y: 35.0, scale: 0.82 },
    { x: 75.8, y: 33.0, scale: 0.82 },
    { x: 89.6, y: 63.2, scale: 0.82 },
  ],
  10: [
    { x: 50, y: 87.8, scale: 0.86 },
    { x: 31.4, y: 90.2, scale: 0.83 },
    { x: 18.4, y: 71.2, scale: 0.81 },
    { x: 7.8, y: 48.4, scale: 0.81 },
    { x: 20.8, y: 33.8, scale: 0.81 },
    { x: 40.4, y: 34.6, scale: 0.81 },
    { x: 59.6, y: 34.6, scale: 0.81 },
    { x: 77.8, y: 34.8, scale: 0.81 },
    { x: 84.6, y: 64.5, scale: 0.81 },
    { x: 68.6, y: 90.2, scale: 0.83 },
  ],
  11: [
    { x: 50, y: 87.8, scale: 0.85 },
    { x: 31.0, y: 90.1, scale: 0.82 },
    { x: 18.2, y: 75.4, scale: 0.8 },
    { x: 7.6, y: 53.6, scale: 0.8 },
    { x: 20.6, y: 34.0, scale: 0.8 },
    { x: 40.2, y: 34.5, scale: 0.8 },
    { x: 59.8, y: 34.5, scale: 0.8 },
    { x: 79.4, y: 34.0, scale: 0.8 },
    { x: 92.4, y: 53.6, scale: 0.8 },
    { x: 81.8, y: 75.4, scale: 0.8 },
    { x: 69.0, y: 90.1, scale: 0.82 },
  ],
};

const IPAD_TABLE_LAYOUTS: Partial<Record<number, SeatPosition[]>> = {
  2: [
    { x: 50, y: 82.6, scale: 0.96 },
    { x: 50, y: 19.5, scale: 0.94 },
  ],
  3: [
    { x: 50, y: 83.2, scale: 0.94 },
    { x: 19.8, y: 50.2, scale: 0.91 },
    { x: 80.2, y: 50.2, scale: 0.91 },
  ],
  4: [
    { x: 50, y: 82.9, scale: 0.93 },
    { x: 14.8, y: 57.4, scale: 0.9 },
    { x: 50, y: 19.2, scale: 0.9 },
    { x: 85.2, y: 57.4, scale: 0.9 },
  ],
  5: [
    { x: 50, y: 82.9, scale: 0.92 },
    { x: 18.4, y: 68.0, scale: 0.88 },
    { x: 22.2, y: 20.4, scale: 0.87 },
    { x: 77.8, y: 20.4, scale: 0.87 },
    { x: 81.6, y: 68.0, scale: 0.88 },
  ],
  6: [
    { x: 50, y: 83.0, scale: 0.9 },
    { x: 16.6, y: 71.6, scale: 0.87 },
    { x: 13.4, y: 22.0, scale: 0.86 },
    { x: 50, y: 19.4, scale: 0.86 },
    { x: 86.6, y: 22.0, scale: 0.86 },
    { x: 83.4, y: 71.6, scale: 0.87 },
  ],
  7: [
    { x: 50, y: 83.0, scale: 0.89 },
    { x: 23.4, y: 73.9, scale: 0.86 },
    { x: 10.8, y: 53.5, scale: 0.84 },
    { x: 24.0, y: 21.0, scale: 0.83 },
    { x: 50, y: 18.2, scale: 0.83 },
    { x: 76.0, y: 21.0, scale: 0.83 },
    { x: 89.2, y: 53.5, scale: 0.84 },
  ],
  8: [
    { x: 50, y: 83.0, scale: 0.87 },
    { x: 27.4, y: 76.6, scale: 0.84 },
    { x: 72.6, y: 76.6, scale: 0.84 },
    { x: 10.4, y: 56.0, scale: 0.82 },
    { x: 21.6, y: 20.0, scale: 0.81 },
    { x: 50, y: 17.8, scale: 0.81 },
    { x: 78.4, y: 20.0, scale: 0.81 },
    { x: 89.6, y: 56.0, scale: 0.82 },
  ],
  9: [
    { x: 50, y: 83.1, scale: 0.85 },
    { x: 31.4, y: 79.1, scale: 0.83 },
    { x: 14.2, y: 67.9, scale: 0.81 },
    { x: 9.4, y: 48.2, scale: 0.8 },
    { x: 24.2, y: 29.4, scale: 0.79 },
    { x: 50, y: 23.2, scale: 0.79 },
    { x: 75.8, y: 29.4, scale: 0.79 },
    { x: 90.6, y: 48.2, scale: 0.8 },
    { x: 85.8, y: 67.9, scale: 0.81 },
  ],
  10: [
    { x: 50, y: 83.2, scale: 0.84 },
    { x: 34.6, y: 80.4, scale: 0.82 },
    { x: 18.6, y: 72.8, scale: 0.81 },
    { x: 8.8, y: 59.4, scale: 0.79 },
    { x: 13.8, y: 33.8, scale: 0.78 },
    { x: 37.2, y: 23.8, scale: 0.78 },
    { x: 62.8, y: 23.8, scale: 0.78 },
    { x: 86.2, y: 33.8, scale: 0.78 },
    { x: 91.2, y: 59.4, scale: 0.79 },
    { x: 81.4, y: 72.8, scale: 0.81 },
  ],
  11: [
    { x: 50, y: 83.4, scale: 0.83 },
    { x: 35.8, y: 81.0, scale: 0.82 },
    { x: 20.0, y: 74.8, scale: 0.8 },
    { x: 8.8, y: 63.2, scale: 0.78 },
    { x: 13.8, y: 32.6, scale: 0.77 },
    { x: 36.4, y: 22.6, scale: 0.77 },
    { x: 63.6, y: 22.6, scale: 0.77 },
    { x: 86.2, y: 32.6, scale: 0.77 },
    { x: 91.2, y: 63.2, scale: 0.78 },
    { x: 80.0, y: 74.8, scale: 0.8 },
    { x: 64.2, y: 81.0, scale: 0.82 },
  ],
};

const IPAD_FOCUS_LAYOUTS: Partial<Record<number, SeatPosition[]>> = {
  6: [
    { x: 50, y: 84.2, scale: 0.76 },
    { x: 15.6, y: 74.2, scale: 0.74 },
    { x: 12.4, y: 37.8, scale: 0.72 },
    { x: 50, y: 31.8, scale: 0.72 },
    { x: 87.6, y: 37.8, scale: 0.72 },
    { x: 84.4, y: 74.2, scale: 0.74 },
  ],
  7: [
    { x: 50, y: 84.2, scale: 0.74 },
    { x: 23.8, y: 76.8, scale: 0.72 },
    { x: 10.8, y: 56.5, scale: 0.7 },
    { x: 23.2, y: 33.8, scale: 0.69 },
    { x: 50, y: 30.5, scale: 0.69 },
    { x: 76.8, y: 33.8, scale: 0.69 },
    { x: 89.2, y: 56.5, scale: 0.7 },
  ],
  8: [
    { x: 50, y: 84.4, scale: 0.72 },
    { x: 28.2, y: 78.4, scale: 0.71 },
    { x: 71.8, y: 78.4, scale: 0.71 },
    { x: 10.4, y: 58.5, scale: 0.69 },
    { x: 20.8, y: 30.5, scale: 0.68 },
    { x: 50, y: 26.5, scale: 0.68 },
    { x: 79.2, y: 30.5, scale: 0.68 },
    { x: 89.6, y: 58.5, scale: 0.69 },
  ],
  9: [
    { x: 50, y: 84.2, scale: 0.85 },
    { x: 31.0, y: 79.4, scale: 0.83 },
    { x: 13.6, y: 67.8, scale: 0.82 },
    { x: 7.6, y: 47.8, scale: 0.8 },
    { x: 23.2, y: 23.5, scale: 0.79 },
    { x: 50, y: 18.0, scale: 0.79 },
    { x: 76.8, y: 23.5, scale: 0.79 },
    { x: 92.4, y: 47.8, scale: 0.8 },
    { x: 86.4, y: 67.8, scale: 0.82 },
  ],
  10: [
    { x: 50, y: 84.2, scale: 0.84 },
    { x: 34.2, y: 80.4, scale: 0.83 },
    { x: 18.0, y: 73.2, scale: 0.81 },
    { x: 7.4, y: 59.0, scale: 0.8 },
    { x: 11.2, y: 23.0, scale: 0.78 },
    { x: 36.6, y: 17.2, scale: 0.78 },
    { x: 63.4, y: 17.2, scale: 0.78 },
    { x: 88.8, y: 23.0, scale: 0.78 },
    { x: 92.6, y: 59.0, scale: 0.8 },
    { x: 82.0, y: 73.2, scale: 0.81 },
  ],
  11: [
    { x: 50, y: 84.2, scale: 0.83 },
    { x: 35.6, y: 80.6, scale: 0.82 },
    { x: 19.8, y: 73.8, scale: 0.8 },
    { x: 8.4, y: 62.0, scale: 0.79 },
    { x: 12.6, y: 23.2, scale: 0.77 },
    { x: 36.2, y: 17.4, scale: 0.77 },
    { x: 63.8, y: 17.4, scale: 0.77 },
    { x: 87.4, y: 23.2, scale: 0.77 },
    { x: 91.6, y: 62.0, scale: 0.79 },
    { x: 80.2, y: 73.8, scale: 0.8 },
    { x: 64.4, y: 80.6, scale: 0.82 },
  ],
};

export function getSeatDensity(total: number, options: SeatLayoutOptions = {}): SeatDensity {
  const mode = options.mode ?? 'table';
  if (total >= 9) {
    return 'dense';
  }
  if (total >= 7) {
    return 'compact';
  }
  if (total >= 5) {
    return mode === 'focus' ? 'balanced' : 'balanced';
  }
  return 'roomy';
}

export function getSeatPositions(total: number, options: SeatLayoutOptions = {}): SeatPosition[] {
  const positions: SeatPosition[] = [];
  const mode = options.mode ?? 'table';
  const profile = options.profile ?? 'default';
  const isFocus = mode === 'focus';
  const isReplay = mode === 'replay';
  const ipadLayout = profile === 'ipad' ? (isFocus ? IPAD_FOCUS_LAYOUTS[total] : !isReplay ? IPAD_TABLE_LAYOUTS[total] : undefined) : undefined;
  if (ipadLayout) {
    return ipadLayout.map((item) => ({ ...item }));
  }
  const manualFocusLayout = isFocus ? MANUAL_FOCUS_LAYOUTS[total] : undefined;
  if (manualFocusLayout) {
    return manualFocusLayout.map((item) => ({ ...item }));
  }
  const radiusXBase = total >= 10 ? 46.8 : total >= 9 ? 45.1 : total >= 8 ? 42.7 : 41.2;
  const radiusYBase = total >= 10 ? 43.8 : total >= 9 ? 42.8 : total >= 8 ? 41.3 : 40.1;
  const radiusX = radiusXBase + (isFocus ? (total >= 9 ? 2.8 : total >= 7 ? 1.9 : 1.3) : isReplay ? 0.6 : 0);
  const radiusY = radiusYBase + (isFocus ? (total >= 9 ? 3.4 : total >= 7 ? 2.4 : 1.8) : isReplay ? 0.8 : 0);
  const start = 90;
  const baseScaleBase = total >= 10 ? 0.76 : total >= 9 ? 0.81 : total >= 8 ? 0.87 : total >= 7 ? 0.92 : total >= 5 ? 0.98 : 1.02;
  const baseScale = baseScaleBase + (isFocus ? (total >= 9 ? 0.1 : total >= 7 ? 0.07 : 0.05) : isReplay ? -0.01 : 0);
  const bottomClampMax =
    total <= 2
      ? isFocus
        ? 94
        : 104.5
      : isFocus
        ? total <= 4
          ? 94.2
          : total >= 9
            ? 97.6
            : 95.8
        : 99.5;
  const minY = isFocus ? (total <= 4 ? 30.5 : 27.5) : 30;
  const minX = isFocus ? (total >= 10 ? 7.1 : total >= 8 ? 6.2 : 5.2) : 4.5;
  const maxX = 100 - minX;

  for (let i = 0; i < total; i += 1) {
    const angle = ((start + (360 / total) * i) * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    let x = 50 + cos * radiusX;
    let y = 50 + sin * radiusY;

    // Push upper seats away from board and keep lower seats above bottom HUD.
    if (sin < -0.5) {
      y -= isFocus ? 17.5 : 16;
    } else if (sin < -0.2) {
      y -= isFocus ? 13 : 12;
    } else if (sin > 0.42) {
      y += isFocus ? 9 : 8;
    } else if (sin > 0.1) {
      y += isFocus ? 6 : 5;
    } else {
      y += cos > 0 ? (isFocus ? 9.5 : 9) : isFocus ? -9.5 : -9;
    }

    if (sin < -0.82) {
      y -= isFocus ? 4.5 : 3.5;
    }

    // Hard-clearance for top-center seats so their hole cards never encroach on the board region.
    if (sin < -0.1) {
      const centerFactor = 1 - clamp(Math.abs(x - 50) / 24, 0, 1);
      y -= (isFocus ? 8.6 : 7) * centerFactor + (isFocus ? 2.2 : 1.5);
    }

    // Bottom-center seats need extra clearance from the board; bottom-side seats need to fan outward
    // so portraits and chips do not intrude into the main pot region.
    if (sin > 0.72) {
      const centerFactor = 1 - clamp(Math.abs(x - 50) / 20, 0, 1);
      const sideFactor = clamp(Math.abs(x - 50) / 24, 0, 1);
      if (sideFactor > 0.12) {
        x += Math.sign(cos) * ((isFocus ? 3.6 : 3) + 3 * sideFactor);
      }
      y += (isFocus ? 8.8 : 8) + (isFocus ? 6.8 : 6) * centerFactor;
    } else if (sin > 0.34 && Math.abs(cos) > 0.24) {
      x += Math.sign(cos) * ((isFocus ? 4.6 : 4) + 2 * Math.abs(cos));
      y += isFocus ? 4.6 : 4;
    }

    // In focus mode with 10+ opponents, the far upper-left seat needs its own lane so
    // the enlarged portrait card does not collide with the next seat on the arc.
    if (isFocus && total >= 10 && cos < -0.92 && sin < -0.06 && sin > -0.32) {
      y += 28.5;
      x -= total >= 11 ? 1.4 : 0.8;
    }

    if (isFocus && total >= 9) {
      if (sin > 0.66 && Math.abs(cos) > 0.22) {
        x -= Math.sign(cos) * (total >= 10 ? 9.4 : 8.2);
      } else if (sin > 0.28 && sin <= 0.66 && Math.abs(cos) > 0.72) {
        x -= Math.sign(cos) * (total >= 10 ? 12.2 : 10.6);
      } else if (sin > -0.04 && sin <= 0.28 && Math.abs(cos) > 0.9) {
        x -= Math.sign(cos) * (total >= 10 ? 4.8 : 3.8);
      }
    }

    if (isFocus && total === 10) {
      if (sin > 0.7 && Math.abs(cos) > 0.22) {
        x -= Math.sign(cos) * 4.4;
      } else if (sin > 0.28 && sin <= 0.7 && Math.abs(cos) > 0.55) {
        x -= Math.sign(cos) * 4.2;
      }
    }

    if (isFocus && total === 11) {
      if (sin > 0.18 && sin <= 0.72 && Math.abs(cos) > 0.78) {
        x -= Math.sign(cos) * 5.4;
      } else if (sin > -0.08 && sin <= 0.22 && Math.abs(cos) > 0.88) {
        x -= Math.sign(cos) * 4.6;
      }
    }

    if (isFocus && total === 10) {
      if (i === 1) x += 4.2;
      if (i === 2) x += 4.8;
      if (i === 3) x += 3.4;
      if (i === 7) x -= 3.4;
      if (i === 8) x -= 4.8;
      if (i === 9) x -= 4.2;
    }

    if (isFocus && total === 11) {
      if (i === 1) x += 3.2;
      if (i === 2) x += 5.2;
      if (i === 3) x += 3.8;
      if (i === 7) x -= 3.8;
      if (i === 8) x -= 5.2;
      if (i === 9) x -= 3.2;
      if (i === 10) x -= 4.4;
    }

    x = clamp(x, minX, maxX);
    y = clamp(y, minY, bottomClampMax);
    const scale = sin < -0.25 ? baseScale * (isFocus ? 0.98 : 0.9) : baseScale;
    positions.push({ x, y, scale });
  }

  return positions;
}
